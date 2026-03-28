//! SpacetimeDB subscription types and builders for multi-agent coordination.
//!
//! Agents subscribe to shared SpacetimeDB tables with agent-specific SQL filters.
//! This module defines the subscription shapes — actual SDK calls happen in runner crates.
//!
//! Pattern: shared inbox + per-agent routing
//! - All agents subscribe to `raw_message` (shared inbox)
//! - `message_route` determines which agent owns each message
//! - Agents subscribe to their own workflow_step, approval_request, etc.

use serde::{Deserialize, Serialize};

/// A single subscription: a table name and a SQL WHERE filter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub table: String,
    pub filter: String,
    pub description: String,
}

impl Subscription {
    pub fn new(table: &str, filter: &str, description: &str) -> Self {
        Self {
            table: table.to_string(),
            filter: filter.to_string(),
            description: description.to_string(),
        }
    }

    /// Generate the SQL subscription query.
    pub fn to_sql(&self) -> String {
        if self.filter.is_empty() {
            format!("SELECT * FROM {}", self.table)
        } else {
            format!("SELECT * FROM {} WHERE {}", self.table, self.filter)
        }
    }
}

/// A set of subscriptions for an agent. Built from the agent's manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionSet {
    pub agent_id: String,
    pub subscriptions: Vec<Subscription>,
}

impl SubscriptionSet {
    /// Build a subscription set for an agent.
    pub fn for_agent(agent_id: &str) -> SubscriptionSetBuilder {
        SubscriptionSetBuilder {
            agent_id: agent_id.to_string(),
            subscriptions: Vec::new(),
        }
    }

    /// Get all SQL queries for this subscription set.
    pub fn queries(&self) -> Vec<String> {
        self.subscriptions.iter().map(|s| s.to_sql()).collect()
    }

    /// Get subscriptions for a specific table.
    pub fn for_table(&self, table: &str) -> Vec<&Subscription> {
        self.subscriptions.iter().filter(|s| s.table == table).collect()
    }
}

/// Builder for creating agent subscription sets.
pub struct SubscriptionSetBuilder {
    agent_id: String,
    subscriptions: Vec<Subscription>,
}

impl SubscriptionSetBuilder {
    /// Subscribe to the shared message inbox (all inbound messages).
    pub fn shared_inbox(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "raw_message",
            "status = 'received'",
            "Shared inbox — all inbound messages",
        ));
        self
    }

    /// Subscribe to messages routed to this agent.
    pub fn own_routes(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "message_route",
            &format!("target_agent_id = '{}'", self.agent_id),
            "Messages routed to this agent",
        ));
        self
    }

    /// Subscribe to this agent's workflow steps.
    pub fn own_workflow_steps(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "workflow_step",
            &format!("agent_id = '{}'", self.agent_id),
            "Workflow steps assigned to this agent",
        ));
        self
    }

    /// Subscribe to this agent's workflow runs.
    pub fn own_workflow_runs(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "workflow_run",
            &format!("agent_id = '{}'", self.agent_id),
            "Workflow runs for this agent",
        ));
        self
    }

    /// Subscribe to approval requests for this agent.
    pub fn own_approvals(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "approval_request",
            &format!("agent_id = '{}'", self.agent_id),
            "Approval requests created by this agent",
        ));
        self
    }

    /// Subscribe to the shared entity graph (all message entities).
    pub fn shared_entities(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "message_entity",
            "",
            "Shared entity identity graph",
        ));
        self
    }

    /// Subscribe to this agent's memory documents.
    pub fn own_memory(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "memory_document",
            &format!("namespace = '{}'", self.agent_id),
            "Memory documents in agent's namespace",
        ));
        self
    }

    /// Subscribe to scheduled jobs for this agent.
    pub fn own_schedules(mut self) -> Self {
        self.subscriptions.push(Subscription::new(
            "agent_schedule",
            &format!("agent_id = '{}' AND status = 'ready'", self.agent_id),
            "Ready scheduled jobs for this agent",
        ));
        self
    }

    /// Subscribe to a custom table with a custom filter.
    pub fn custom(mut self, table: &str, filter: &str, description: &str) -> Self {
        self.subscriptions.push(Subscription::new(table, filter, description));
        self
    }

    /// Build the subscription set.
    pub fn build(self) -> SubscriptionSet {
        SubscriptionSet {
            agent_id: self.agent_id,
            subscriptions: self.subscriptions,
        }
    }
}

// ── Preset Subscription Profiles ───────────────────────────────────

/// Standard subscription set for an ops agent (like Saturn).
/// Monitors: shared inbox, own routes, own workflows, approvals, entities, memory, schedules.
pub fn ops_subscriptions(agent_id: &str) -> SubscriptionSet {
    SubscriptionSet::for_agent(agent_id)
        .shared_inbox()
        .own_routes()
        .own_workflow_steps()
        .own_workflow_runs()
        .own_approvals()
        .shared_entities()
        .own_memory()
        .own_schedules()
        .build()
}

/// Standard subscription set for a research agent (like Voyager).
/// Monitors: shared inbox, own routes, own workflows, entities, memory.
/// Skips: approvals (research agents don't create approval gates), schedules (less frequent).
pub fn research_subscriptions(agent_id: &str) -> SubscriptionSet {
    SubscriptionSet::for_agent(agent_id)
        .shared_inbox()
        .own_routes()
        .own_workflow_steps()
        .own_workflow_runs()
        .shared_entities()
        .own_memory()
        .build()
}

/// Subscription set for the dashboard (observes everything).
pub fn dashboard_subscriptions() -> SubscriptionSet {
    SubscriptionSet::for_agent("dashboard")
        .custom("raw_message", "", "All messages")
        .custom("workflow_run", "", "All workflow runs")
        .custom("workflow_step", "", "All workflow steps")
        .custom("approval_request", "", "All approval requests")
        .custom("message_entity", "", "All entities")
        .custom("trajectory_log", "", "All trajectories")
        .build()
}

// ── Callback Types ─────────────────────────────────────────────────

/// Event emitted when a subscribed row changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionEvent {
    pub table: String,
    pub event_type: SubscriptionEventType,
    pub row_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SubscriptionEventType {
    Insert,
    Update,
    Delete,
}

/// Callback signature for subscription events.
/// Runner crates implement this to dispatch events to agents.
pub type SubscriptionCallback = Box<dyn Fn(SubscriptionEvent) + Send + Sync>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscription_to_sql_with_filter() {
        let sub = Subscription::new("raw_message", "status = 'received'", "test");
        assert_eq!(sub.to_sql(), "SELECT * FROM raw_message WHERE status = 'received'");
    }

    #[test]
    fn subscription_to_sql_without_filter() {
        let sub = Subscription::new("message_entity", "", "test");
        assert_eq!(sub.to_sql(), "SELECT * FROM message_entity");
    }

    #[test]
    fn ops_subscription_set() {
        let subs = ops_subscriptions("saturn");
        assert_eq!(subs.agent_id, "saturn");
        // Should have 8 subscriptions: inbox, routes, steps, runs, approvals, entities, memory, schedules
        assert_eq!(subs.subscriptions.len(), 8);

        // Check agent-specific filters
        let queries = subs.queries();
        assert!(queries.iter().any(|q| q.contains("target_agent_id = 'saturn'")));
        assert!(queries.iter().any(|q| q.contains("agent_id = 'saturn'")));
        assert!(queries.iter().any(|q| q.contains("namespace = 'saturn'")));
    }

    #[test]
    fn research_subscription_set() {
        let subs = research_subscriptions("voyager");
        assert_eq!(subs.agent_id, "voyager");
        // Research has fewer: inbox, routes, steps, runs, entities, memory (no approvals, no schedules)
        assert_eq!(subs.subscriptions.len(), 6);
    }

    #[test]
    fn dashboard_subscription_set() {
        let subs = dashboard_subscriptions();
        assert_eq!(subs.agent_id, "dashboard");
        // Dashboard subscribes to 6 tables with no filters
        assert_eq!(subs.subscriptions.len(), 6);
        // All should be unfiltered
        for sub in &subs.subscriptions {
            assert!(sub.filter.is_empty(), "Dashboard sub for {} should have no filter", sub.table);
        }
    }

    #[test]
    fn custom_subscription() {
        let subs = SubscriptionSet::for_agent("custom-agent")
            .custom("my_table", "col = 'val'", "Custom sub")
            .build();
        assert_eq!(subs.subscriptions.len(), 1);
        assert_eq!(subs.subscriptions[0].to_sql(), "SELECT * FROM my_table WHERE col = 'val'");
    }

    #[test]
    fn for_table_filters_correctly() {
        let subs = ops_subscriptions("saturn");
        let msg_subs = subs.for_table("raw_message");
        assert_eq!(msg_subs.len(), 1);
        assert_eq!(msg_subs[0].table, "raw_message");

        let missing = subs.for_table("nonexistent");
        assert!(missing.is_empty());
    }
}
