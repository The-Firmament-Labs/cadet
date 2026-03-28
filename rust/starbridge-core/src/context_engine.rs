//! Context Engine — Rust-native programmatic trigger matching and context assembly.
//!
//! Inspired by Hermes agent trajectories, TOON encoding for token efficiency,
//! and SpacetimeDB v2 subscription-driven events.
//!
//! The context engine watches agent events (goal text, step outputs, memory queries)
//! and dynamically assembles the right prompts, memories, and knowledge graph
//! fragments for each agent step — maximizing context relevance while minimizing
//! token usage.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Trigger System ──────────────────────────────────────────────────

/// A trigger pattern that matches against agent events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerPattern {
    /// Unique identifier for this trigger
    pub id: String,
    /// What kind of event activates this trigger
    pub event_type: TriggerEventType,
    /// Match conditions — all must pass for the trigger to fire
    pub conditions: Vec<TriggerCondition>,
    /// What context to inject when the trigger fires
    pub context_actions: Vec<ContextAction>,
    /// Priority — higher priority triggers inject context first
    pub priority: u32,
}

/// Events that can activate triggers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TriggerEventType {
    /// A new workflow run is created
    RunCreated,
    /// A workflow step begins execution
    StepStarted,
    /// A goal text is received (from any channel)
    GoalReceived,
    /// A memory retrieval query is issued
    MemoryQuery,
    /// An approval gate is created
    ApprovalCreated,
    /// A browser task is queued
    BrowserTaskQueued,
    /// A schedule fires
    ScheduleWakeup,
    /// A message arrives from a social channel
    ChannelMessage,
    /// A step completes (for trajectory logging)
    StepCompleted,
    /// A run completes (for learning triggers)
    RunCompleted,
}

/// Conditions that must match for a trigger to fire.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerCondition {
    /// Goal text contains any of these phrases (case-insensitive)
    GoalContains(Vec<String>),
    /// Agent ID matches
    AgentIs(String),
    /// Current workflow stage matches
    StageIs(String),
    /// Channel matches (web, slack, github, system)
    ChannelIs(String),
    /// Risk level at or above threshold
    RiskAtLeast(String),
    /// Memory namespace matches
    NamespaceIs(String),
    /// Custom tag is present on the agent manifest
    HasTag(String),
    /// Run has completed N+ steps (for trajectory triggers)
    StepCountAtLeast(u32),
}

/// Actions to take when a trigger fires — what context to assemble.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextAction {
    /// Inject a system prompt by path (relative to .cadet/prompts/)
    InjectPrompt(String),
    /// Query memory namespace for relevant chunks
    QueryMemory { namespace: String, query: String, max_chunks: u32 },
    /// Inject the agent's manifest as context
    InjectManifest,
    /// Inject recent trajectory (last N step outputs) for continuity
    InjectTrajectory { last_n_steps: u32 },
    /// Inject knowledge graph fragment by topic
    InjectKnowledge(String),
    /// Log this event as a trajectory entry for future training
    LogTrajectory,
    /// Trigger a memory consolidation pass (Hermes "dream" pattern)
    ConsolidateMemory,
    /// Inject channel-specific formatting rules
    InjectChannelFormat(String),
}

// ── Context Assembly ────────────────────────────────────────────────

/// A fragment of assembled context ready for injection into an agent prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFragment {
    /// Source of this fragment (prompt path, memory chunk ID, trajectory)
    pub source: String,
    /// The actual content to inject
    pub content: String,
    /// Estimated token count (for budget management)
    pub estimated_tokens: u32,
    /// Priority — higher priority fragments survive budget cuts
    pub priority: u32,
}

/// The assembled context for a single agent step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssembledContext {
    /// System prompt fragments (core + agent personality + workflow stage)
    pub system_fragments: Vec<ContextFragment>,
    /// Memory fragments (retrieved from vector store)
    pub memory_fragments: Vec<ContextFragment>,
    /// Trajectory fragments (recent step outputs for continuity)
    pub trajectory_fragments: Vec<ContextFragment>,
    /// Knowledge graph fragments (topic-specific context)
    pub knowledge_fragments: Vec<ContextFragment>,
    /// Total estimated tokens across all fragments
    pub total_estimated_tokens: u32,
    /// Token budget (from model's context window minus reserved space)
    pub token_budget: u32,
}

// ── TOON Encoding ───────────────────────────────────────────────────

/// Encode a context fragment as TOON format for ~40% token savings vs JSON.
///
/// TOON uses indentation instead of braces, minimizes quoting, and provides
/// tabular encoding for uniform arrays.
pub fn encode_toon_object(fields: &[(&str, &str)]) -> String {
    let mut out = String::new();
    for (key, value) in fields {
        // Only quote if the value needs it (contains special chars)
        let needs_quote = value.is_empty()
            || value.contains(':')
            || value.contains('"')
            || value.contains('\n')
            || *value == "true"
            || *value == "false"
            || *value == "null"
            || value.parse::<f64>().is_ok();

        if needs_quote {
            out.push_str(&format!("{}: \"{}\"\n", key, value.replace('"', "\\\"")));
        } else {
            out.push_str(&format!("{}: {}\n", key, value));
        }
    }
    out
}

/// Encode a tabular array as TOON format.
/// Example output:
/// ```toon
/// items[3]{id,name,status}:
///   run_01,Deploy check,completed
///   run_02,Incident sweep,running
///   run_03,Memory consolidation,queued
/// ```
pub fn encode_toon_table(key: &str, fields: &[&str], rows: &[Vec<String>]) -> String {
    let header = format!(
        "{}[{}]{{{}}}:\n",
        key,
        rows.len(),
        fields.join(",")
    );
    let body: String = rows
        .iter()
        .map(|row| {
            let encoded: Vec<String> = row
                .iter()
                .map(|val| {
                    if val.contains(',') || val.contains('"') || val.is_empty() {
                        format!("\"{}\"", val.replace('"', "\\\""))
                    } else {
                        val.clone()
                    }
                })
                .collect();
            format!("  {}\n", encoded.join(","))
        })
        .collect();
    format!("{}{}", header, body)
}

// ── Trigger Engine ──────────────────────────────────────────────────

/// The trigger engine — matches events against registered patterns and
/// produces context assembly instructions.
#[derive(Debug, Default)]
pub struct TriggerEngine {
    patterns: Vec<TriggerPattern>,
}

impl TriggerEngine {
    pub fn new() -> Self {
        Self { patterns: Vec::new() }
    }

    /// Register a trigger pattern.
    pub fn register(&mut self, pattern: TriggerPattern) {
        self.patterns.push(pattern);
    }

    /// Match an event against all registered patterns.
    /// Returns context actions from all matching patterns, sorted by priority.
    pub fn match_event(&self, event: &AgentEvent) -> Vec<ContextAction> {
        let mut matches: Vec<(u32, &[ContextAction])> = self
            .patterns
            .iter()
            .filter(|pattern| {
                pattern.event_type == event.event_type
                    && pattern.conditions.iter().all(|cond| evaluate_condition(cond, event))
            })
            .map(|pattern| (pattern.priority, pattern.context_actions.as_slice()))
            .collect();

        // Sort by priority descending (highest first)
        matches.sort_by(|a, b| b.0.cmp(&a.0));

        matches
            .into_iter()
            .flat_map(|(_, actions)| actions.iter().cloned())
            .collect()
    }

    /// Load default trigger patterns for the Cadet platform.
    pub fn load_defaults(&mut self) {
        // Core system prompt — always injected on step start
        self.register(TriggerPattern {
            id: "core-system".into(),
            event_type: TriggerEventType::StepStarted,
            conditions: vec![],
            context_actions: vec![
                ContextAction::InjectPrompt("system/core.md".into()),
                ContextAction::InjectManifest,
            ],
            priority: 100,
        });

        // Autonomy rules — injected for all agents
        self.register(TriggerPattern {
            id: "autonomy-rules".into(),
            event_type: TriggerEventType::StepStarted,
            conditions: vec![],
            context_actions: vec![
                ContextAction::InjectPrompt("system/autonomy.md".into()),
            ],
            priority: 99,
        });

        // UX guidelines — injected on summarize stage
        self.register(TriggerPattern {
            id: "ux-on-summarize".into(),
            event_type: TriggerEventType::StepStarted,
            conditions: vec![TriggerCondition::StageIs("summarize".into())],
            context_actions: vec![
                ContextAction::InjectPrompt("system/user-experience.md".into()),
            ],
            priority: 90,
        });

        // Saturn agent personality
        self.register(TriggerPattern {
            id: "saturn-personality".into(),
            event_type: TriggerEventType::StepStarted,
            conditions: vec![TriggerCondition::AgentIs("saturn".into())],
            context_actions: vec![
                ContextAction::InjectPrompt("agents/saturn.md".into()),
                ContextAction::QueryMemory {
                    namespace: "operations".into(),
                    query: String::new(), // will be filled from goal
                    max_chunks: 8,
                },
            ],
            priority: 80,
        });

        // Voyager agent personality
        self.register(TriggerPattern {
            id: "voyager-personality".into(),
            event_type: TriggerEventType::StepStarted,
            conditions: vec![TriggerCondition::AgentIs("voyager".into())],
            context_actions: vec![
                ContextAction::InjectPrompt("agents/voyager.md".into()),
                ContextAction::QueryMemory {
                    namespace: "research".into(),
                    query: String::new(),
                    max_chunks: 8,
                },
            ],
            priority: 80,
        });

        // Incident trigger words
        self.register(TriggerPattern {
            id: "incident-context".into(),
            event_type: TriggerEventType::GoalReceived,
            conditions: vec![TriggerCondition::GoalContains(vec![
                "incident".into(),
                "outage".into(),
                "down".into(),
                "error".into(),
                "failure".into(),
                "broken".into(),
                "crash".into(),
            ])],
            context_actions: vec![
                ContextAction::InjectPrompt("system/core.md".into()),
                ContextAction::InjectTrajectory { last_n_steps: 5 },
                ContextAction::QueryMemory {
                    namespace: "operations".into(),
                    query: "incident response playbook".into(),
                    max_chunks: 4,
                },
            ],
            priority: 95,
        });

        // Research trigger words
        self.register(TriggerPattern {
            id: "research-context".into(),
            event_type: TriggerEventType::GoalReceived,
            conditions: vec![TriggerCondition::GoalContains(vec![
                "research".into(),
                "audit".into(),
                "analyze".into(),
                "investigate".into(),
                "compare".into(),
                "review".into(),
                "scan".into(),
            ])],
            context_actions: vec![
                ContextAction::QueryMemory {
                    namespace: "research".into(),
                    query: String::new(),
                    max_chunks: 8,
                },
                ContextAction::InjectTrajectory { last_n_steps: 3 },
            ],
            priority: 85,
        });

        // Social channel formatting
        self.register(TriggerPattern {
            id: "slack-format".into(),
            event_type: TriggerEventType::ChannelMessage,
            conditions: vec![TriggerCondition::ChannelIs("slack".into())],
            context_actions: vec![
                ContextAction::InjectChannelFormat("slack".into()),
                ContextAction::InjectPrompt("social/channels.md".into()),
            ],
            priority: 70,
        });

        self.register(TriggerPattern {
            id: "github-format".into(),
            event_type: TriggerEventType::ChannelMessage,
            conditions: vec![TriggerCondition::ChannelIs("github".into())],
            context_actions: vec![
                ContextAction::InjectChannelFormat("github".into()),
                ContextAction::InjectPrompt("social/channels.md".into()),
            ],
            priority: 70,
        });

        // Trajectory logging — log every completed step for training data
        self.register(TriggerPattern {
            id: "trajectory-log".into(),
            event_type: TriggerEventType::StepCompleted,
            conditions: vec![],
            context_actions: vec![ContextAction::LogTrajectory],
            priority: 50,
        });

        // Memory consolidation — trigger after 5+ step runs (Hermes "dream")
        self.register(TriggerPattern {
            id: "memory-dream".into(),
            event_type: TriggerEventType::RunCompleted,
            conditions: vec![TriggerCondition::StepCountAtLeast(5)],
            context_actions: vec![ContextAction::ConsolidateMemory],
            priority: 40,
        });

        // High-risk approval — inject autonomy guidelines
        self.register(TriggerPattern {
            id: "high-risk-gate".into(),
            event_type: TriggerEventType::ApprovalCreated,
            conditions: vec![TriggerCondition::RiskAtLeast("high".into())],
            context_actions: vec![
                ContextAction::InjectPrompt("system/autonomy.md".into()),
            ],
            priority: 95,
        });
    }
}

// ── Event Model ─────────────────────────────────────────────────────

/// An event from the agent runtime that the trigger engine evaluates.
#[derive(Debug, Clone)]
pub struct AgentEvent {
    pub event_type: TriggerEventType,
    pub agent_id: String,
    pub goal: String,
    pub stage: String,
    pub channel: String,
    pub risk: String,
    pub namespace: String,
    pub tags: Vec<String>,
    pub step_count: u32,
    pub metadata: HashMap<String, String>,
}

impl AgentEvent {
    pub fn new(event_type: TriggerEventType, agent_id: &str) -> Self {
        Self {
            event_type,
            agent_id: agent_id.to_string(),
            goal: String::new(),
            stage: String::new(),
            channel: String::new(),
            risk: String::new(),
            namespace: String::new(),
            tags: Vec::new(),
            step_count: 0,
            metadata: HashMap::new(),
        }
    }

    pub fn with_goal(mut self, goal: &str) -> Self {
        self.goal = goal.to_string();
        self
    }

    pub fn with_stage(mut self, stage: &str) -> Self {
        self.stage = stage.to_string();
        self
    }

    pub fn with_channel(mut self, channel: &str) -> Self {
        self.channel = channel.to_string();
        self
    }

    pub fn with_risk(mut self, risk: &str) -> Self {
        self.risk = risk.to_string();
        self
    }

    pub fn with_step_count(mut self, count: u32) -> Self {
        self.step_count = count;
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }
}

// ── Condition Evaluation ────────────────────────────────────────────

fn evaluate_condition(condition: &TriggerCondition, event: &AgentEvent) -> bool {
    match condition {
        TriggerCondition::GoalContains(phrases) => {
            let goal_lower = event.goal.to_lowercase();
            phrases.iter().any(|phrase| goal_lower.contains(&phrase.to_lowercase()))
        }
        TriggerCondition::AgentIs(id) => event.agent_id == *id,
        TriggerCondition::StageIs(stage) => event.stage == *stage,
        TriggerCondition::ChannelIs(channel) => event.channel == *channel,
        TriggerCondition::RiskAtLeast(threshold) => {
            let risk_level = |r: &str| match r {
                "critical" => 4,
                "high" => 3,
                "medium" => 2,
                "low" => 1,
                _ => 0,
            };
            risk_level(&event.risk) >= risk_level(threshold)
        }
        TriggerCondition::NamespaceIs(ns) => event.namespace == *ns,
        TriggerCondition::HasTag(tag) => event.tags.contains(tag),
        TriggerCondition::StepCountAtLeast(n) => event.step_count >= *n,
    }
}

// ── Trajectory Logging ──────────────────────────────────────────────

/// A trajectory entry — records an agent's action for training data generation.
/// Inspired by Hermes agent trajectories for SFT/RL training.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryEntry {
    /// The run this entry belongs to
    pub run_id: String,
    /// The step that produced this entry
    pub step_id: String,
    /// Agent that executed
    pub agent_id: String,
    /// Workflow stage
    pub stage: String,
    /// The goal/instruction given to the agent
    pub instruction: String,
    /// The context that was assembled (TOON-encoded for compactness)
    pub context_toon: String,
    /// The agent's output/response
    pub output: String,
    /// Tool calls made during this step
    pub tool_calls: Vec<TrajectoryToolCall>,
    /// Whether this was a successful execution
    pub success: bool,
    /// Duration in milliseconds
    pub duration_ms: u64,
    /// Timestamp (microseconds since epoch)
    pub timestamp_micros: i64,
}

/// A tool call within a trajectory entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryToolCall {
    pub tool_name: String,
    pub input_toon: String,
    pub output_toon: String,
    pub success: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toon_object_encodes_simple_fields() {
        let result = encode_toon_object(&[
            ("id", "run_01"),
            ("agent", "saturn"),
            ("status", "running"),
        ]);
        assert!(result.contains("id: run_01"));
        assert!(result.contains("agent: saturn"));
        assert!(result.contains("status: running"));
    }

    #[test]
    fn toon_object_quotes_special_values() {
        let result = encode_toon_object(&[
            ("flag", "true"),
            ("count", "42"),
            ("empty", ""),
        ]);
        assert!(result.contains("flag: \"true\""));
        assert!(result.contains("count: \"42\""));
        assert!(result.contains("empty: \"\""));
    }

    #[test]
    fn toon_table_encodes_rows() {
        let result = encode_toon_table(
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
    fn trigger_engine_matches_goal_keywords() {
        let mut engine = TriggerEngine::new();
        engine.load_defaults();

        let event = AgentEvent::new(TriggerEventType::GoalReceived, "saturn")
            .with_goal("Investigate the production incident from last deploy");

        let actions = engine.match_event(&event);
        assert!(!actions.is_empty(), "Should match incident keywords");

        // Should include memory query for operations namespace
        let has_memory_query = actions.iter().any(|a| matches!(a, ContextAction::QueryMemory { namespace, .. } if namespace == "operations"));
        assert!(has_memory_query, "Should query operations memory for incidents");
    }

    #[test]
    fn trigger_engine_injects_agent_personality() {
        let mut engine = TriggerEngine::new();
        engine.load_defaults();

        let event = AgentEvent::new(TriggerEventType::StepStarted, "saturn")
            .with_stage("plan");

        let actions = engine.match_event(&event);

        let has_core = actions.iter().any(|a| matches!(a, ContextAction::InjectPrompt(p) if p == "system/core.md"));
        let has_saturn = actions.iter().any(|a| matches!(a, ContextAction::InjectPrompt(p) if p == "agents/saturn.md"));
        assert!(has_core, "Should inject core system prompt");
        assert!(has_saturn, "Should inject Saturn personality");
    }

    #[test]
    fn trigger_engine_logs_trajectory_on_step_complete() {
        let mut engine = TriggerEngine::new();
        engine.load_defaults();

        let event = AgentEvent::new(TriggerEventType::StepCompleted, "voyager");
        let actions = engine.match_event(&event);

        let has_log = actions.iter().any(|a| matches!(a, ContextAction::LogTrajectory));
        assert!(has_log, "Should log trajectory on step completion");
    }

    #[test]
    fn trigger_engine_consolidates_memory_after_complex_runs() {
        let mut engine = TriggerEngine::new();
        engine.load_defaults();

        // Run with 3 steps — should NOT trigger consolidation
        let short_event = AgentEvent::new(TriggerEventType::RunCompleted, "voyager")
            .with_step_count(3);
        let short_actions = engine.match_event(&short_event);
        let has_consolidate = short_actions.iter().any(|a| matches!(a, ContextAction::ConsolidateMemory));
        assert!(!has_consolidate, "Should not consolidate after short runs");

        // Run with 7 steps — should trigger consolidation
        let long_event = AgentEvent::new(TriggerEventType::RunCompleted, "voyager")
            .with_step_count(7);
        let long_actions = engine.match_event(&long_event);
        let has_consolidate = long_actions.iter().any(|a| matches!(a, ContextAction::ConsolidateMemory));
        assert!(has_consolidate, "Should consolidate after complex runs (5+ steps)");
    }

    #[test]
    fn trigger_engine_injects_channel_format_for_slack() {
        let mut engine = TriggerEngine::new();
        engine.load_defaults();

        let event = AgentEvent::new(TriggerEventType::ChannelMessage, "saturn")
            .with_channel("slack");

        let actions = engine.match_event(&event);
        let has_format = actions.iter().any(|a| matches!(a, ContextAction::InjectChannelFormat(ch) if ch == "slack"));
        assert!(has_format, "Should inject Slack formatting rules");
    }
}
