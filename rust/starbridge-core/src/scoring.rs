//! Scoring engine — 3-mode trajectory scoring + RLVR signal collection.
//!
//! Modes:
//! - Local: Qwen3-4B via llama-cpp-2 (behind `local-ml` feature flag)
//! - Remote: POST to cadet-inference-server `/v1/score`
//! - Cloud: Haiku via AI Gateway

use serde::{Deserialize, Serialize};

use crate::scoring_prompt::{JudgeScores, judge_system_prompt, judge_user_prompt};

// ── Score Mode ─────────────────────────────────────────────────────

/// Which backend to use for LLM-as-judge scoring.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScoreMode {
    /// Local model via llama-cpp-2 (requires `local-ml` feature)
    Local,
    /// Remote cadet-inference-server
    Remote,
    /// Cloud LLM (Haiku via AI Gateway)
    Cloud,
}

// ── RLVR Signals ───────────────────────────────────────────────────

/// Verifiable reward signals from task outcomes.
/// These are free, instant, and deterministic — no judge needed.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RlvrSignals {
    /// Did the code compile? None if not applicable.
    pub compile_success: Option<bool>,
    /// Did tests pass? None if no tests were run.
    pub tests_passed: Option<bool>,
    /// Did the deploy succeed? None if no deploy.
    pub deploy_success: Option<bool>,
    /// Did the user give thumbs up/down? None if no feedback yet.
    pub user_feedback: Option<bool>,
    /// Was the task marked completed (vs abandoned/failed)?
    pub task_completed: Option<bool>,
    /// Exit code from the agent process (0 = success).
    pub exit_code: Option<i32>,
}

impl RlvrSignals {
    /// Compute composite reward from available signals.
    /// Returns the average of all available binary signals.
    pub fn composite(&self) -> f32 {
        let mut sum = 0.0f32;
        let mut count = 0u32;

        for signal in [
            self.compile_success,
            self.tests_passed,
            self.deploy_success,
            self.user_feedback,
            self.task_completed,
        ] {
            if let Some(val) = signal {
                sum += if val { 1.0 } else { 0.0 };
                count += 1;
            }
        }

        // Exit code: 0 = success (1.0), non-zero = failure (0.0)
        if let Some(code) = self.exit_code {
            sum += if code == 0 { 1.0 } else { 0.0 };
            count += 1;
        }

        if count == 0 {
            0.5 // No signals available — neutral
        } else {
            sum / count as f32
        }
    }

    /// Serialize to JSON string for storage.
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    /// Parse from JSON string.
    pub fn from_json(json: &str) -> Self {
        serde_json::from_str(json).unwrap_or_default()
    }

    /// Build from workflow step outcomes.
    pub fn from_workflow_outcome(
        exit_code: Option<i32>,
        tests_passed: Option<bool>,
        task_completed: bool,
    ) -> Self {
        Self {
            compile_success: exit_code.map(|c| c == 0),
            tests_passed,
            deploy_success: None,
            user_feedback: None,
            task_completed: Some(task_completed),
            exit_code,
        }
    }
}

// ── Trajectory Score Result ────────────────────────────────────────

/// Complete score result ready to be written to SpacetimeDB.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryScoreResult {
    pub correctness: f32,
    pub efficiency: f32,
    pub tool_use_quality: f32,
    pub adherence: f32,
    pub composite: f32,
    pub source: String,
    pub judge_model: String,
    pub judge_reasoning: String,
    pub rlvr_signals: RlvrSignals,
}

impl TrajectoryScoreResult {
    /// Create from RLVR signals only (no judge).
    pub fn from_rlvr(signals: RlvrSignals) -> Self {
        let composite = signals.composite();
        Self {
            correctness: composite,
            efficiency: composite,
            tool_use_quality: composite,
            adherence: composite,
            composite,
            source: "rlvr".to_string(),
            judge_model: String::new(),
            judge_reasoning: format!("RLVR composite from {} signals", Self::count_signals(&signals)),
            rlvr_signals: signals,
        }
    }

    /// Create from LLM judge scores + optional RLVR signals.
    pub fn from_judge(judge: JudgeScores, model: &str, signals: Option<RlvrSignals>) -> Self {
        Self {
            correctness: judge.correctness,
            efficiency: judge.efficiency,
            tool_use_quality: judge.tool_use_quality,
            adherence: judge.adherence,
            composite: judge.composite(),
            source: "llm-judge".to_string(),
            judge_model: model.to_string(),
            judge_reasoning: judge.reasoning,
            rlvr_signals: signals.unwrap_or_default(),
        }
    }

    /// Create from operator feedback (thumbs up/down).
    pub fn from_operator_feedback(thumbs_up: bool) -> Self {
        let composite = if thumbs_up { 1.0 } else { 0.0 };
        Self {
            correctness: composite,
            efficiency: composite,
            tool_use_quality: composite,
            adherence: composite,
            composite,
            source: "operator-feedback".to_string(),
            judge_model: String::new(),
            judge_reasoning: if thumbs_up { "Operator thumbs up" } else { "Operator thumbs down" }.to_string(),
            rlvr_signals: RlvrSignals {
                user_feedback: Some(thumbs_up),
                ..Default::default()
            },
        }
    }

    fn count_signals(signals: &RlvrSignals) -> usize {
        let mut count = 0;
        if signals.compile_success.is_some() { count += 1; }
        if signals.tests_passed.is_some() { count += 1; }
        if signals.deploy_success.is_some() { count += 1; }
        if signals.user_feedback.is_some() { count += 1; }
        if signals.task_completed.is_some() { count += 1; }
        if signals.exit_code.is_some() { count += 1; }
        count
    }
}

// ── Score Engine ───────────────────────────────────────────────────

/// Configuration for the scoring engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringConfig {
    pub mode: ScoreMode,
    /// Remote server URL (for Remote mode)
    pub remote_url: Option<String>,
    /// Cloud API key (for Cloud mode)
    pub cloud_api_key: Option<String>,
    /// Local model path (for Local mode)
    pub local_model_path: Option<String>,
}

impl Default for ScoringConfig {
    fn default() -> Self {
        Self {
            mode: ScoreMode::Cloud,
            remote_url: None,
            cloud_api_key: None,
            local_model_path: None,
        }
    }
}

/// Score a trajectory using the configured mode.
///
/// For Local mode: returns an error unless the `local-ml` feature is enabled.
/// For Remote mode: POSTs to `{remote_url}/v1/score`.
/// For Cloud mode: calls Haiku via AI Gateway (caller must provide HTTP client).
///
/// This function builds the judge prompt but does NOT make HTTP calls directly —
/// it returns the prompt pair for the caller to execute against their HTTP client.
pub fn build_judge_request(
    instruction: &str,
    context_toon: &str,
    output: &str,
    tool_calls_json: &str,
    success: bool,
) -> (String, String) {
    let system = judge_system_prompt().to_string();
    let user = judge_user_prompt(instruction, context_toon, output, tool_calls_json, success);
    (system, user)
}

/// Parse judge response into a TrajectoryScoreResult.
pub fn parse_judge_response(
    response_text: &str,
    model: &str,
    signals: Option<RlvrSignals>,
) -> Option<TrajectoryScoreResult> {
    JudgeScores::parse(response_text)
        .map(|scores| TrajectoryScoreResult::from_judge(scores, model, signals))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rlvr_composite_all_pass() {
        let signals = RlvrSignals {
            compile_success: Some(true),
            tests_passed: Some(true),
            task_completed: Some(true),
            exit_code: Some(0),
            ..Default::default()
        };
        assert!((signals.composite() - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn rlvr_composite_all_fail() {
        let signals = RlvrSignals {
            compile_success: Some(false),
            tests_passed: Some(false),
            task_completed: Some(false),
            exit_code: Some(1),
            ..Default::default()
        };
        assert!((signals.composite()).abs() < f32::EPSILON);
    }

    #[test]
    fn rlvr_composite_mixed() {
        let signals = RlvrSignals {
            compile_success: Some(true),
            tests_passed: Some(false),
            task_completed: Some(true),
            ..Default::default()
        };
        // 2 pass, 1 fail = 0.667
        let composite = signals.composite();
        assert!(composite > 0.6 && composite < 0.7);
    }

    #[test]
    fn rlvr_no_signals_neutral() {
        let signals = RlvrSignals::default();
        assert!((signals.composite() - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn from_operator_thumbs_down() {
        let result = TrajectoryScoreResult::from_operator_feedback(false);
        assert_eq!(result.source, "operator-feedback");
        assert!((result.composite).abs() < f32::EPSILON);
    }

    #[test]
    fn from_operator_thumbs_up() {
        let result = TrajectoryScoreResult::from_operator_feedback(true);
        assert!((result.composite - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn from_rlvr_signals() {
        let signals = RlvrSignals {
            tests_passed: Some(true),
            task_completed: Some(true),
            ..Default::default()
        };
        let result = TrajectoryScoreResult::from_rlvr(signals);
        assert_eq!(result.source, "rlvr");
        assert!((result.composite - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn build_judge_request_includes_fields() {
        let (system, user) = build_judge_request("goal", "ctx", "out", "[]", true);
        assert!(system.contains("correctness"));
        assert!(user.contains("goal"));
        assert!(user.contains("Yes"));
    }

    #[test]
    fn parse_judge_response_valid() {
        let json = r#"{"correctness": 0.8, "efficiency": 0.6, "tool_use_quality": 0.7, "adherence": 0.9, "reasoning": "Good."}"#;
        let result = parse_judge_response(json, "haiku", None).unwrap();
        assert_eq!(result.source, "llm-judge");
        assert_eq!(result.judge_model, "haiku");
    }

    #[test]
    fn rlvr_json_roundtrip() {
        let signals = RlvrSignals {
            compile_success: Some(true),
            tests_passed: Some(false),
            ..Default::default()
        };
        let json = signals.to_json();
        let parsed = RlvrSignals::from_json(&json);
        assert_eq!(parsed.compile_success, Some(true));
        assert_eq!(parsed.tests_passed, Some(false));
    }

    #[test]
    fn scoring_config_default_is_cloud() {
        let config = ScoringConfig::default();
        assert_eq!(config.mode, ScoreMode::Cloud);
    }
}
