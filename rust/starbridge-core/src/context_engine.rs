//! Context Engine — TOON serialization + token budget management for agent context.
//!
//! The agent decides what context it needs via tools. This module handles:
//! 1. Encoding SpacetimeDB state as TOON (~40% fewer tokens than JSON)
//! 2. Managing token budgets (what fits in the context window)
//! 3. Logging trajectories as SpacetimeDB rows for self-improvement
//!
//! What this module does NOT do (the LLM handles these):
//! - Deciding what context is relevant (agent uses tools to query)
//! - Keyword matching / trigger rules (model reads the goal directly)
//! - Pre-computing prompt injection (agent loads prompts on demand)

use serde::{Deserialize, Serialize};

// ── TOON Encoding ───────────────────────────────────────────────────
// TOON: ~40% fewer tokens than JSON for the same data.
// Uses indentation instead of braces, minimizes quoting.
// Spec: https://toonformat.dev/

/// Encode key-value pairs as TOON. Only quotes values that need it.
pub fn encode_object(fields: &[(&str, &str)]) -> String {
    let mut out = String::new();
    for (key, value) in fields {
        if needs_quoting(value) {
            out.push_str(&format!("{}: \"{}\"\n", key, value.replace('"', "\\\"")));
        } else {
            out.push_str(&format!("{}: {}\n", key, value));
        }
    }
    out
}

/// Encode a tabular array as TOON.
/// Output: `key[N]{field1,field2,...}:\n  val1,val2\n  val3,val4\n`
pub fn encode_table(key: &str, fields: &[&str], rows: &[Vec<String>]) -> String {
    let mut out = format!("{}[{}]{{{}}}:\n", key, rows.len(), fields.join(","));
    for row in rows {
        let encoded: Vec<String> = row.iter().map(|v| {
            if v.contains(',') || v.contains('"') || v.is_empty() {
                format!("\"{}\"", v.replace('"', "\\\""))
            } else {
                v.clone()
            }
        }).collect();
        out.push_str(&format!("  {}\n", encoded.join(",")));
    }
    out
}

/// Encode nested object as TOON with indentation.
pub fn encode_nested(key: &str, fields: &[(&str, &str)]) -> String {
    let mut out = format!("{}:\n", key);
    for (k, v) in fields {
        if needs_quoting(v) {
            out.push_str(&format!("  {}: \"{}\"\n", k, v.replace('"', "\\\"")));
        } else {
            out.push_str(&format!("  {}: {}\n", k, v));
        }
    }
    out
}

fn needs_quoting(value: &str) -> bool {
    value.is_empty()
        || value.contains(':')
        || value.contains('"')
        || value.contains('\\')
        || value.contains('\n')
        || value.contains('\t')
        || value.contains('[')
        || value.contains(']')
        || value.contains('{')
        || value.contains('}')
        || value == "true"
        || value == "false"
        || value == "null"
        || value.parse::<f64>().is_ok()
}

// ── Token Budget ────────────────────────────────────────────────────

/// Rough token estimate: ~4 chars per token for English text.
pub fn estimate_tokens(text: &str) -> u32 {
    (text.len() as u32 + 3) / 4
}

/// A context fragment with its estimated token cost.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFragment {
    pub source: String,
    pub content: String,
    pub tokens: u32,
}

impl ContextFragment {
    pub fn new(source: &str, content: String) -> Self {
        let tokens = estimate_tokens(&content);
        Self { source: source.to_string(), content, tokens }
    }
}

/// Fit fragments into a token budget, keeping highest-priority first.
/// Fragments earlier in the slice have higher priority.
pub fn fit_to_budget(fragments: &[ContextFragment], budget: u32) -> Vec<&ContextFragment> {
    let mut used = 0u32;
    let mut result = Vec::new();
    for frag in fragments {
        if used + frag.tokens <= budget {
            used += frag.tokens;
            result.push(frag);
        }
    }
    result
}

/// Assemble fragments into a single TOON-encoded context string.
pub fn assemble(fragments: &[&ContextFragment]) -> String {
    let mut out = String::new();
    for (i, frag) in fragments.iter().enumerate() {
        if i > 0 {
            out.push('\n');
        }
        out.push_str(&frag.content);
    }
    out
}

// ── Trajectory Logging ──────────────────────────────────────────────
// Trajectories are persisted to SpacetimeDB (not in-memory structs).
// This module provides the serialization format.

/// A trajectory entry for SFT/RL training data.
/// Stored in SpacetimeDB as a row in a trajectory table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryEntry {
    pub run_id: String,
    pub step_id: String,
    pub agent_id: String,
    pub stage: String,
    pub instruction: String,
    pub context_toon: String,
    pub output: String,
    pub tool_calls: Vec<ToolCallEntry>,
    pub success: bool,
    pub duration_ms: u64,
    pub timestamp_micros: i64,
}

/// A tool call within a trajectory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEntry {
    pub tool_name: String,
    pub input_toon: String,
    pub output_toon: String,
    pub success: bool,
}

/// Encode a trajectory entry as TOON for compact storage.
pub fn encode_trajectory(entry: &TrajectoryEntry) -> String {
    let mut out = encode_object(&[
        ("run_id", &entry.run_id),
        ("step_id", &entry.step_id),
        ("agent_id", &entry.agent_id),
        ("stage", &entry.stage),
        ("success", if entry.success { "true" } else { "false" }),
        ("duration_ms", &entry.duration_ms.to_string()),
    ]);
    out.push_str(&encode_nested("instruction", &[("text", &entry.instruction)]));
    if !entry.tool_calls.is_empty() {
        let fields = &["tool", "success"];
        let rows: Vec<Vec<String>> = entry.tool_calls.iter().map(|tc| {
            vec![tc.tool_name.clone(), tc.success.to_string()]
        }).collect();
        out.push_str(&encode_table("tool_calls", fields, &rows));
    }
    out
}

// ── Agent Tools Interface ───────────────────────────────────────────
// These are the tools the agent calls to pull context on demand.
// The runtime exposes these as callable functions.

/// Tool: query_memory — agent asks for relevant memory chunks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryQueryRequest {
    pub namespace: String,
    pub query: String,
    pub max_chunks: u32,
}

/// Tool: load_context — agent loads a prompt/knowledge file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadContextRequest {
    pub path: String,
}

/// Tool: get_trajectory — agent reviews its recent execution history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTrajectoryRequest {
    pub run_id: String,
    pub last_n_steps: u32,
}

/// Tool: log_step — agent logs a completed step for trajectory training.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogStepRequest {
    pub entry: TrajectoryEntry,
}

/// The set of context tools available to every agent.
pub const AGENT_CONTEXT_TOOLS: &[&str] = &[
    "query_memory",
    "load_context",
    "get_trajectory",
    "log_step",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toon_object_simple() {
        let result = encode_object(&[
            ("id", "run_01"),
            ("agent", "saturn"),
            ("status", "running"),
        ]);
        assert!(result.contains("id: run_01\n"));
        assert!(result.contains("agent: saturn\n"));
        assert!(result.contains("status: running\n"));
    }

    #[test]
    fn toon_object_quotes_special() {
        let result = encode_object(&[
            ("flag", "true"),
            ("count", "42"),
            ("empty", ""),
            ("colon", "key: value"),
        ]);
        assert!(result.contains("flag: \"true\""));
        assert!(result.contains("count: \"42\""));
        assert!(result.contains("empty: \"\""));
        assert!(result.contains("colon: \"key: value\""));
    }

    #[test]
    fn toon_table_encodes_rows() {
        let result = encode_table(
            "runs",
            &["id", "agent", "status"],
            &[
                vec!["run_01".into(), "saturn".into(), "completed".into()],
                vec!["run_02".into(), "voyager".into(), "running".into()],
            ],
        );
        assert!(result.contains("runs[2]{id,agent,status}:"));
        assert!(result.contains("  run_01,saturn,completed"));
        assert!(result.contains("  run_02,voyager,running"));
    }

    #[test]
    fn toon_nested_object() {
        let result = encode_nested("deployment", &[
            ("plane", "cloud"),
            ("execution", "vercel-edge"),
        ]);
        assert!(result.contains("deployment:\n"));
        assert!(result.contains("  plane: cloud\n"));
        assert!(result.contains("  execution: vercel-edge\n"));
    }

    #[test]
    fn token_estimate_reasonable() {
        assert_eq!(estimate_tokens(""), 0); // empty string = 0 tokens
        assert_eq!(estimate_tokens("hello world"), 3); // 11 chars / 4 ≈ 3
        assert!(estimate_tokens("a]").to_string().parse::<u32>().is_ok());
    }

    #[test]
    fn fit_to_budget_respects_limit() {
        let frags = vec![
            ContextFragment::new("a", "short".into()),       // ~2 tokens
            ContextFragment::new("b", "medium length text".into()), // ~5 tokens
            ContextFragment::new("c", "this is a much longer piece of context that takes many tokens and should be cut".into()),
        ];
        let result = fit_to_budget(&frags, 10);
        assert!(result.len() <= 3);
        let total: u32 = result.iter().map(|f| f.tokens).sum();
        assert!(total <= 10);
    }

    #[test]
    fn fit_to_budget_preserves_priority_order() {
        let frags = vec![
            ContextFragment::new("high", "important".into()),
            ContextFragment::new("low", "less important".into()),
        ];
        let result = fit_to_budget(&frags, 100);
        assert_eq!(result[0].source, "high");
        assert_eq!(result[1].source, "low");
    }

    #[test]
    fn assemble_joins_fragments() {
        let frags = vec![
            ContextFragment::new("a", "first".into()),
            ContextFragment::new("b", "second".into()),
        ];
        let refs: Vec<&ContextFragment> = frags.iter().collect();
        let result = assemble(&refs);
        assert_eq!(result, "first\nsecond");
    }

    #[test]
    fn trajectory_encodes_as_toon() {
        let entry = TrajectoryEntry {
            run_id: "run_01".into(),
            step_id: "step_route".into(),
            agent_id: "saturn".into(),
            stage: "route".into(),
            instruction: "Triage the deploy incident".into(),
            context_toon: String::new(),
            output: "Classified as incident, routing to container-runner".into(),
            tool_calls: vec![
                ToolCallEntry {
                    tool_name: "query_memory".into(),
                    input_toon: "namespace: operations".into(),
                    output_toon: "chunks: 3".into(),
                    success: true,
                },
            ],
            success: true,
            duration_ms: 1200,
            timestamp_micros: 1700000000000000,
        };
        let result = encode_trajectory(&entry);
        assert!(result.contains("run_id: run_01"));
        assert!(result.contains("agent_id: saturn"));
        assert!(result.contains("tool_calls[1]{tool,success}:"));
        assert!(result.contains("  query_memory,true"));
    }
}
