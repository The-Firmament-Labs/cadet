//! Judge prompt template for LLM-as-judge trajectory scoring.
//!
//! The judge evaluates agent trajectories on four dimensions:
//! correctness, efficiency, tool_use_quality, and adherence.
//! Returns structured JSON scores (0.0-1.0) with reasoning.

/// Build the judge system prompt.
pub fn judge_system_prompt() -> &'static str {
    r#"You are an expert evaluator of AI agent task execution. Score the following agent trajectory on four dimensions, each 0.0 to 1.0:

1. **correctness** — Did the agent achieve the goal? Is the output factually correct and complete?
2. **efficiency** — Did the agent use a reasonable number of steps? Did it avoid unnecessary work?
3. **tool_use_quality** — Did the agent use the right tools for the job? Were tool arguments well-formed?
4. **adherence** — Did the agent follow its instructions and constraints? Did it stay on task?

Respond with ONLY a JSON object, no markdown fences, no explanation outside the JSON:
{
  "correctness": 0.0,
  "efficiency": 0.0,
  "tool_use_quality": 0.0,
  "adherence": 0.0,
  "reasoning": "One sentence explaining the overall assessment."
}"#
}

/// Build the judge user prompt from a trajectory.
pub fn judge_user_prompt(instruction: &str, context_toon: &str, output: &str, tool_calls_json: &str, success: bool) -> String {
    let success_str = if success { "Yes" } else { "No" };
    format!(
        "## Agent Trajectory\n\n\
         **Instruction:** {instruction}\n\n\
         **Context (TOON-encoded):**\n{context_toon}\n\n\
         **Output:**\n{output}\n\n\
         **Tool Calls:**\n{tool_calls_json}\n\n\
         **Reported Success:** {success_str}"
    )
}

/// Parsed judge response.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct JudgeScores {
    pub correctness: f32,
    pub efficiency: f32,
    pub tool_use_quality: f32,
    pub adherence: f32,
    pub reasoning: String,
}

impl JudgeScores {
    /// Weighted composite score.
    pub fn composite(&self) -> f32 {
        // Correctness weighted highest — getting it right matters most
        (self.correctness * 0.4
            + self.efficiency * 0.2
            + self.tool_use_quality * 0.2
            + self.adherence * 0.2)
            .clamp(0.0, 1.0)
    }

    /// Parse from JSON string, returning None if malformed.
    pub fn parse(json_str: &str) -> Option<Self> {
        // Strip markdown fences if the model wraps the JSON
        let cleaned = json_str
            .trim()
            .strip_prefix("```json")
            .or_else(|| json_str.trim().strip_prefix("```"))
            .unwrap_or(json_str.trim())
            .strip_suffix("```")
            .unwrap_or(json_str.trim())
            .trim();
        serde_json::from_str(cleaned).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_judge_response() {
        let json = r#"{"correctness": 0.9, "efficiency": 0.7, "tool_use_quality": 0.8, "adherence": 1.0, "reasoning": "Good work."}"#;
        let scores = JudgeScores::parse(json).unwrap();
        assert!((scores.correctness - 0.9).abs() < f32::EPSILON);
        assert!((scores.composite() - 0.86).abs() < 0.01);
    }

    #[test]
    fn parse_markdown_fenced_response() {
        let json = "```json\n{\"correctness\": 0.5, \"efficiency\": 0.5, \"tool_use_quality\": 0.5, \"adherence\": 0.5, \"reasoning\": \"Average.\"}\n```";
        let scores = JudgeScores::parse(json).unwrap();
        assert!((scores.composite() - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn parse_garbage_returns_none() {
        assert!(JudgeScores::parse("not json").is_none());
    }

    #[test]
    fn composite_clamps_to_unit() {
        let scores = JudgeScores {
            correctness: 1.0,
            efficiency: 1.0,
            tool_use_quality: 1.0,
            adherence: 1.0,
            reasoning: String::new(),
        };
        assert!((scores.composite() - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn judge_user_prompt_includes_all_fields() {
        let prompt = judge_user_prompt("do X", "ctx", "output", "[]", true);
        assert!(prompt.contains("do X"));
        assert!(prompt.contains("ctx"));
        assert!(prompt.contains("output"));
        assert!(prompt.contains("Yes"));
    }
}
