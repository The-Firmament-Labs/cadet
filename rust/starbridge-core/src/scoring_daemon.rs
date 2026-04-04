//! Background scoring daemon — scores trajectories as they arrive via SpacetimeDB subscription.
//!
//! Architecture:
//! 1. Receives new `TrajectoryLog` entries via tokio mpsc channel
//! 2. Collects RLVR signals from workflow run status
//! 3. Calls LLM judge (per resource profile / score mode)
//! 4. Computes surprise via embedding distance (or cold-start default)
//! 5. Computes delight = loss × surprise
//! 6. Writes `TrajectoryScore` via SpacetimeDB reducer
//! 7. If delight exceeds threshold, writes to `TrainingBuffer`
//!
//! Idle-only mode: pauses when system CPU exceeds threshold.
//! Exposes pause/resume/is_running controls.

use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, watch};

use crate::delight::{self, DelightGate};
use crate::scoring::{RlvrSignals, ScoreMode, ScoringConfig, TrajectoryScoreResult};

// ── Trajectory Entry ───────────────────────────────────────────────

/// A trajectory received from SpacetimeDB subscription, ready for scoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryEntry {
    pub trajectory_id: String,
    pub run_id: String,
    pub agent_id: String,
    pub instruction: String,
    pub context_toon: String,
    pub output: String,
    pub tool_calls_json: String,
    pub success: bool,
    pub duration_ms: u64,
}

// ── Scored Result ──────────────────────────────────────────────────

/// Complete result from the scoring daemon, ready to write to SpacetimeDB.
#[derive(Debug, Clone)]
pub struct ScoredTrajectory {
    pub trajectory_id: String,
    pub run_id: String,
    pub score: TrajectoryScoreResult,
    pub surprise: f32,
    pub delight: f32,
    pub should_buffer: bool,
    pub task_cluster: String,
}

// ── Resource Profile ───────────────────────────────────────────────

/// Controls when and how scoring runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResourceProfile {
    /// Cloud (Haiku) scoring on explicit request only
    Lightweight,
    /// Local scoring when idle, pauses at CPU > threshold
    Balanced,
    /// Local continuous scoring on every trajectory
    Power,
    /// Remote server scoring on every trajectory
    Team,
}

impl ResourceProfile {
    /// Whether this profile scores automatically (vs. on-demand only).
    pub fn auto_scores(&self) -> bool {
        matches!(self, Self::Balanced | Self::Power | Self::Team)
    }

    /// The score mode for this profile.
    pub fn score_mode(&self) -> ScoreMode {
        match self {
            Self::Lightweight => ScoreMode::Cloud,
            Self::Balanced => ScoreMode::Local,
            Self::Power => ScoreMode::Local,
            Self::Team => ScoreMode::Remote,
        }
    }

    /// Whether to respect idle detection (pause at high CPU).
    pub fn idle_only(&self) -> bool {
        matches!(self, Self::Balanced)
    }
}

// ── Daemon State ───────────────────────────────────────────────────

/// Current state of the scoring daemon.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DaemonState {
    Running,
    Paused,
    IdleWait,
    Stopped,
}

// ── Daemon Configuration ───────────────────────────────────────────

/// Configuration for the scoring daemon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    pub profile: ResourceProfile,
    pub scoring: ScoringConfig,
    /// CPU threshold for idle-only mode (0.0-1.0, default 0.60)
    pub cpu_threshold: f32,
    /// Channel buffer size for incoming trajectories
    pub channel_buffer: usize,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            profile: ResourceProfile::Balanced,
            scoring: ScoringConfig::default(),
            cpu_threshold: 0.60,
            channel_buffer: 64,
        }
    }
}

// ── Daemon Handle ──────────────────────────────────────────────────

/// Handle for controlling the scoring daemon from outside the task.
#[derive(Clone)]
pub struct DaemonHandle {
    /// Send trajectories to the daemon for scoring
    pub tx: mpsc::Sender<TrajectoryEntry>,
    /// Control channel: true = running, false = paused
    pause_tx: watch::Sender<bool>,
    /// Read current state
    state_rx: watch::Receiver<DaemonState>,
}

impl DaemonHandle {
    /// Send a trajectory for scoring.
    pub async fn submit(&self, entry: TrajectoryEntry) -> Result<(), mpsc::error::SendError<TrajectoryEntry>> {
        self.tx.send(entry).await
    }

    /// Pause the daemon.
    pub fn pause(&self) {
        let _ = self.pause_tx.send(false);
    }

    /// Resume the daemon.
    pub fn resume(&self) {
        let _ = self.pause_tx.send(true);
    }

    /// Check if the daemon is currently running.
    pub fn is_running(&self) -> bool {
        *self.state_rx.borrow() == DaemonState::Running
    }

    /// Get the current daemon state.
    pub fn state(&self) -> DaemonState {
        *self.state_rx.borrow()
    }
}

// ── Scoring Callback ───────────────────────────────────────────────

/// Callback trait for the daemon to write results back to SpacetimeDB.
/// The daemon doesn't hold a SpacetimeDB client directly — the caller
/// provides this callback to handle persistence.
pub trait ScoringCallback: Send + Sync + 'static {
    /// Write a trajectory score to SpacetimeDB.
    fn record_score(&self, scored: &ScoredTrajectory) -> impl std::future::Future<Output = Result<(), String>> + Send;

    /// Write a high-delight trajectory to the training buffer.
    fn buffer_trajectory(&self, scored: &ScoredTrajectory) -> impl std::future::Future<Output = Result<(), String>> + Send;

    /// Call the LLM judge and return the response text.
    /// The daemon builds the prompt; this callback executes the HTTP call.
    fn call_judge(&self, system: &str, user: &str, mode: ScoreMode) -> impl std::future::Future<Output = Result<String, String>> + Send;

    /// Get the embedding distance for surprise computation.
    /// Returns (distance, max_distance) or None if embeddings aren't available.
    fn embedding_distance(&self, text: &str) -> impl std::future::Future<Output = Option<(f32, f32)>> + Send;
}

// ── Daemon Spawn ───────────────────────────────────────────────────

/// Spawn the scoring daemon as a background Tokio task.
///
/// Returns a handle for submitting trajectories and controlling the daemon.
/// The daemon runs until the handle's sender is dropped.
pub fn spawn_daemon<C: ScoringCallback>(
    config: DaemonConfig,
    callback: C,
) -> DaemonHandle {
    let (tx, rx) = mpsc::channel(config.channel_buffer);
    let (pause_tx, pause_rx) = watch::channel(true); // start running
    let (state_tx, state_rx) = watch::channel(DaemonState::Running);

    tokio::spawn(daemon_loop(config, rx, pause_rx, state_tx, callback));

    DaemonHandle { tx, pause_tx, state_rx }
}

async fn daemon_loop<C: ScoringCallback>(
    config: DaemonConfig,
    mut rx: mpsc::Receiver<TrajectoryEntry>,
    mut pause_rx: watch::Receiver<bool>,
    state_tx: watch::Sender<DaemonState>,
    callback: C,
) {
    let mut gate = DelightGate::default();

    // Track trajectory count for cold-start detection
    let mut trajectory_count: usize = 0;

    while let Some(entry) = rx.recv().await {
        // Check pause state
        if !*pause_rx.borrow() {
            let _ = state_tx.send(DaemonState::Paused);
            // Wait until resumed
            loop {
                if pause_rx.changed().await.is_err() {
                    let _ = state_tx.send(DaemonState::Stopped);
                    return;
                }
                if *pause_rx.borrow() {
                    break;
                }
            }
        }

        // Skip if profile doesn't auto-score
        if !config.profile.auto_scores() {
            continue;
        }

        let _ = state_tx.send(DaemonState::Running);
        trajectory_count += 1;

        // Score the trajectory
        let scored = score_trajectory(&entry, &config, &callback, &mut gate, trajectory_count).await;

        match scored {
            Some(result) => {
                // Write score to SpacetimeDB
                if let Err(e) = callback.record_score(&result).await {
                    eprintln!("[scoring-daemon] Failed to record score: {e}");
                }

                // Buffer if high delight
                if result.should_buffer {
                    if let Err(e) = callback.buffer_trajectory(&result).await {
                        eprintln!("[scoring-daemon] Failed to buffer trajectory: {e}");
                    }
                }
            }
            None => {
                eprintln!(
                    "[scoring-daemon] Failed to score trajectory {}",
                    entry.trajectory_id
                );
            }
        }
    }

    let _ = state_tx.send(DaemonState::Stopped);
}

async fn score_trajectory<C: ScoringCallback>(
    entry: &TrajectoryEntry,
    config: &DaemonConfig,
    callback: &C,
    gate: &mut DelightGate,
    trajectory_count: usize,
) -> Option<ScoredTrajectory> {
    let mode = config.profile.score_mode();

    // Build judge request
    let (system, user) = crate::scoring::build_judge_request(
        &entry.instruction,
        &entry.context_toon,
        &entry.output,
        &entry.tool_calls_json,
        entry.success,
    );

    // Call judge
    let response = callback.call_judge(&system, &user, mode).await.ok()?;

    // Parse response
    let rlvr_signals = RlvrSignals::from_workflow_outcome(
        if entry.success { Some(0) } else { Some(1) },
        Some(entry.success),
        entry.success,
    );
    let score = crate::scoring::parse_judge_response(&response, &format!("{mode:?}"), Some(rlvr_signals))?;

    // Compute surprise
    let surprise = if delight::is_cold_start(trajectory_count) {
        delight::COLD_START_SURPRISE
    } else {
        // Try to get embedding distance
        let embed_text = format!("{} {}", entry.instruction, entry.output);
        match callback.embedding_distance(&embed_text).await {
            Some((dist, max_dist)) => delight::compute_surprise(dist, max_dist),
            None => delight::COLD_START_SURPRISE, // fallback if embeddings unavailable
        }
    };

    // Compute delight
    let loss = delight::compute_loss(score.composite);
    let delight_score = delight::compute_delight(loss, surprise);

    // Check gate
    let should_buffer = gate.should_buffer(delight_score);

    Some(ScoredTrajectory {
        trajectory_id: entry.trajectory_id.clone(),
        run_id: entry.run_id.clone(),
        score,
        surprise,
        delight: delight_score,
        should_buffer,
        task_cluster: String::new(), // TODO: derive from embedding cluster
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_profile_auto_scores() {
        assert!(!ResourceProfile::Lightweight.auto_scores());
        assert!(ResourceProfile::Balanced.auto_scores());
        assert!(ResourceProfile::Power.auto_scores());
        assert!(ResourceProfile::Team.auto_scores());
    }

    #[test]
    fn resource_profile_idle_only() {
        assert!(!ResourceProfile::Lightweight.idle_only());
        assert!(ResourceProfile::Balanced.idle_only());
        assert!(!ResourceProfile::Power.idle_only());
        assert!(!ResourceProfile::Team.idle_only());
    }

    #[test]
    fn resource_profile_score_modes() {
        assert_eq!(ResourceProfile::Lightweight.score_mode(), ScoreMode::Cloud);
        assert_eq!(ResourceProfile::Balanced.score_mode(), ScoreMode::Local);
        assert_eq!(ResourceProfile::Power.score_mode(), ScoreMode::Local);
        assert_eq!(ResourceProfile::Team.score_mode(), ScoreMode::Remote);
    }

    #[test]
    fn daemon_config_defaults() {
        let config = DaemonConfig::default();
        assert_eq!(config.profile, ResourceProfile::Balanced);
        assert!((config.cpu_threshold - 0.60).abs() < f32::EPSILON);
        assert_eq!(config.channel_buffer, 64);
    }
}
