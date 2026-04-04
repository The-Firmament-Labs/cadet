//! Delight computation and adaptive threshold gate.
//!
//! Core formula: `delight = loss × surprise`
//!
//! - **Loss**: How wrong was the model? `1.0 - composite_score`
//! - **Surprise**: How novel is this trajectory? Embedding distance from cluster centroid.
//! - **Delight**: The product — high only when the model was wrong about something new.
//!
//! Only the top ~3% most delightful trajectories enter the training buffer.
//! This prevents mode collapse from over-training on routine data.

use serde::{Deserialize, Serialize};

/// Compute loss from composite score.
/// Loss is high when the model performed poorly.
#[inline]
pub fn compute_loss(composite_score: f32) -> f32 {
    (1.0 - composite_score).clamp(0.0, 1.0)
}

/// Compute delight from loss and surprise.
/// Both must be high for delight to be high.
#[inline]
pub fn compute_delight(loss: f32, surprise: f32) -> f32 {
    (loss * surprise).clamp(0.0, 1.0)
}

/// Compute surprise from embedding distance.
///
/// `distance` is the raw distance from the nearest cluster centroid.
/// `max_distance` is the normalization factor (e.g. max observed distance).
///
/// Returns 0.0-1.0 normalized surprise.
pub fn compute_surprise(distance: f32, max_distance: f32) -> f32 {
    if max_distance <= 0.0 {
        // Cold start: everything is maximally surprising
        1.0
    } else {
        (distance / max_distance).clamp(0.0, 1.0)
    }
}

// ── Delight Gate ───────────────────────────────────────────────────

/// Adaptive threshold that targets a specific acceptance rate.
///
/// Maintains a rolling window of recent delight scores and adjusts
/// the threshold to accept approximately `target_rate` of trajectories.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelightGate {
    /// Target acceptance rate (default: 0.03 = top 3%)
    target_rate: f32,
    /// Minimum acceptance rate (floor, default: 0.01 = top 1%)
    min_rate: f32,
    /// Maximum acceptance rate (ceiling, default: 0.10 = top 10%)
    max_rate: f32,
    /// Rolling window of recent delight scores
    recent_scores: Vec<f32>,
    /// Maximum window size
    window_size: usize,
    /// Current threshold — trajectories above this enter the buffer
    threshold: f32,
    /// Number of trajectories accepted since last threshold update
    accepted_count: u64,
    /// Total trajectories seen since last threshold update
    total_count: u64,
}

impl Default for DelightGate {
    fn default() -> Self {
        Self::new(0.03, 0.01, 0.10, 500)
    }
}

impl DelightGate {
    /// Create a new delight gate.
    ///
    /// - `target_rate`: desired acceptance rate (e.g. 0.03 for top 3%)
    /// - `min_rate`: floor — never tighten below this (e.g. 0.01)
    /// - `max_rate`: ceiling — never relax above this (e.g. 0.10)
    /// - `window_size`: number of recent scores to track for threshold computation
    pub fn new(target_rate: f32, min_rate: f32, max_rate: f32, window_size: usize) -> Self {
        Self {
            target_rate,
            min_rate,
            max_rate,
            recent_scores: Vec::with_capacity(window_size),
            window_size,
            // Start with threshold = 0.0 so everything passes during cold start
            threshold: 0.0,
            accepted_count: 0,
            total_count: 0,
        }
    }

    /// Check if a delight score passes the gate.
    /// Also records the score for threshold adaptation.
    pub fn should_buffer(&mut self, delight: f32) -> bool {
        // Record the score
        if self.recent_scores.len() >= self.window_size {
            self.recent_scores.remove(0);
        }
        self.recent_scores.push(delight);
        self.total_count += 1;

        let passes = delight > self.threshold;
        if passes {
            self.accepted_count += 1;
        }

        // Recompute threshold periodically (every 50 scores)
        if self.total_count % 50 == 0 && self.recent_scores.len() >= 20 {
            self.recompute_threshold();
        }

        passes
    }

    /// Force a delight score into the buffer regardless of threshold.
    /// Used for operator feedback (thumbs down always trains).
    pub fn force_accept(&mut self, delight: f32) {
        if self.recent_scores.len() >= self.window_size {
            self.recent_scores.remove(0);
        }
        self.recent_scores.push(delight);
        self.total_count += 1;
        self.accepted_count += 1;
    }

    /// Get the current threshold.
    pub fn threshold(&self) -> f32 {
        self.threshold
    }

    /// Get the current actual acceptance rate.
    pub fn acceptance_rate(&self) -> f32 {
        if self.total_count == 0 {
            0.0
        } else {
            self.accepted_count as f32 / self.total_count as f32
        }
    }

    /// Get the number of scores in the rolling window.
    pub fn window_len(&self) -> usize {
        self.recent_scores.len()
    }

    /// Recompute threshold to target the desired acceptance rate.
    fn recompute_threshold(&mut self) {
        let mut sorted = self.recent_scores.clone();
        sorted.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

        let current_rate = self.acceptance_rate();

        // Determine effective target rate with bounds
        let effective_rate = if current_rate < self.min_rate && self.total_count > 100 {
            // Buffer has been empty too long — relax toward max_rate
            (self.target_rate + self.max_rate) / 2.0
        } else if current_rate > self.max_rate {
            // Buffer filling too fast — tighten toward min_rate
            (self.target_rate + self.min_rate) / 2.0
        } else {
            self.target_rate
        };

        // Find the score at the target percentile
        let target_index = ((effective_rate * sorted.len() as f32) as usize).min(sorted.len().saturating_sub(1));
        self.threshold = sorted[target_index];

        // Reset counters for next period
        self.accepted_count = 0;
        self.total_count = 0;
    }
}

// ── Cold Start ─────────────────────────────────────────────────────

/// During cold start (no cluster centroids), all trajectories get
/// maximum surprise. This mirrors how a child learns — everything
/// is new, so everything is worth training on.
pub const COLD_START_SURPRISE: f32 = 1.0;

/// Minimum number of trajectories before cluster centroids are meaningful.
pub const MIN_TRAJECTORIES_FOR_CLUSTERS: usize = 20;

/// Check if we're still in cold start phase.
pub fn is_cold_start(trajectory_count: usize) -> bool {
    trajectory_count < MIN_TRAJECTORIES_FOR_CLUSTERS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loss_from_perfect_score() {
        assert!((compute_loss(1.0)).abs() < f32::EPSILON);
    }

    #[test]
    fn loss_from_zero_score() {
        assert!((compute_loss(0.0) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn loss_clamps() {
        assert!((compute_loss(1.5)).abs() < f32::EPSILON); // clamps to 0.0
        assert!((compute_loss(-0.5) - 1.0).abs() < 0.5);   // clamps to 1.0
    }

    #[test]
    fn delight_high_loss_high_surprise() {
        let d = compute_delight(0.9, 0.9);
        assert!(d > 0.8);
    }

    #[test]
    fn delight_low_loss_high_surprise() {
        let d = compute_delight(0.1, 0.9);
        assert!(d < 0.1);
    }

    #[test]
    fn delight_high_loss_low_surprise() {
        let d = compute_delight(0.9, 0.1);
        assert!(d < 0.1);
    }

    #[test]
    fn delight_both_zero() {
        assert!((compute_delight(0.0, 0.0)).abs() < f32::EPSILON);
    }

    #[test]
    fn surprise_cold_start() {
        assert!((compute_surprise(0.5, 0.0) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn surprise_normalized() {
        assert!((compute_surprise(0.5, 1.0) - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn surprise_clamps_above_max() {
        assert!((compute_surprise(2.0, 1.0) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn gate_cold_start_accepts_everything() {
        let mut gate = DelightGate::default();
        // During cold start, threshold is 0.0, so any positive delight passes
        assert!(gate.should_buffer(0.1));
        assert!(gate.should_buffer(0.01));
    }

    #[test]
    fn gate_zero_delight_rejected() {
        let mut gate = DelightGate::default();
        // delight = 0.0 should NOT pass (not >0.0)
        assert!(!gate.should_buffer(0.0));
    }

    #[test]
    fn gate_force_accept_always_works() {
        let mut gate = DelightGate::new(0.03, 0.01, 0.10, 100);
        gate.threshold = 0.99; // Very high threshold
        // force_accept doesn't check threshold
        gate.force_accept(0.01);
        assert!(gate.accepted_count > 0);
    }

    #[test]
    fn gate_adapts_threshold() {
        let mut gate = DelightGate::new(0.03, 0.01, 0.10, 100);
        // Feed 100 scores, linearly distributed 0.0 to 1.0
        for i in 0..100 {
            gate.should_buffer(i as f32 / 100.0);
        }
        // After adaptation, threshold should be high (targeting top 3%)
        // The gate recomputes at 50 and 100, so threshold should be set
        assert!(gate.threshold > 0.5, "threshold should be high, got {}", gate.threshold);
    }

    #[test]
    fn gate_default_targets_three_percent() {
        let gate = DelightGate::default();
        assert!((gate.target_rate - 0.03).abs() < f32::EPSILON);
    }

    #[test]
    fn cold_start_detection() {
        assert!(is_cold_start(0));
        assert!(is_cold_start(19));
        assert!(!is_cold_start(20));
        assert!(!is_cold_start(100));
    }
}
