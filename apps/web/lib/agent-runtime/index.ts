/**
 * Cadet Agent Runtime
 *
 * Platform-native agent execution runtime. Sessions in SpacetimeDB,
 * execution in Vercel Sandbox, queuing via Vercel Queues.
 *
 * Modules:
 * - registry: 6 built-in coding agents with spawn commands
 * - session: persistent sessions scoped by operator+agent+repo
 * - executor: runs agents in sandboxes with mission briefs
 * - output: normalizes all agent output to typed events
 * - mission-brief: generates CLAUDE.md context before spawning
 * - skills: on-demand knowledge documents (progressive disclosure)
 * - checkpoints: sandbox snapshots before changes, rollback support
 * - provider-routing: cost/speed/quality model selection with fallbacks
 * - hooks: pre/post lifecycle extensibility
 * - session-search: full-text search across conversations and artifacts
 * - context-refs: @ references to inject files, runs, memory, threads
 */

export { AGENT_REGISTRY, getAgentConfig, getAgentsByCapability, getAllCapabilities, type AgentConfig } from "./registry";
export { createAgentSession, getActiveSession, loadAgentSession, closeAgentSession, markSessionCrashed, ensureSession, requestCancel, isCancelRequested, type AgentSession } from "./session";
export { executeAgentPrompt, installAgent } from "./executor";
export { parseAcpLine, parseRawOutput, type AgentOutputEvent } from "./output";
export { generateMissionBrief, writeMissionBrief, runVerification, type MissionBrief } from "./mission-brief";
export { listSkills, viewSkill, matchSkills, installSkill, removeSkill, type Skill, type SkillMetadata } from "./skills";
export { createCheckpoint, listCheckpoints, rollbackToCheckpoint, type Checkpoint } from "./checkpoints";
export { selectModel, buildFallbackChain, getOperatorRouting, saveOperatorRouting, getProviderCatalog, type RoutingStrategy, type RoutingPreference, type ProviderConfig } from "./provider-routing";
export { executeHooks, registerHook, listHooks, toggleHook, deleteHook, type HookEvent, type HookDefinition, type HookContext } from "./hooks";
export { searchSessions, type SearchResult } from "./session-search";
export { parseRefs, resolveRefs, stripRefs, type ResolvedRef } from "./context-refs";
