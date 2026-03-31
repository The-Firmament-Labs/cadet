/**
 * Cadet Agent Runtime
 *
 * Platform-native agent execution runtime inspired by ACPX patterns.
 * Sessions in SpacetimeDB, execution in Vercel Sandbox, queuing via Vercel Queues.
 */

export { AGENT_REGISTRY, getAgentConfig, getAgentsByCapability, getAllCapabilities, type AgentConfig } from "./registry";
export { createAgentSession, getActiveSession, loadAgentSession, closeAgentSession, markSessionCrashed, ensureSession, requestCancel, isCancelRequested, type AgentSession } from "./session";
export { executeAgentPrompt, installAgent } from "./executor";
export { parseAcpLine, parseRawOutput, type AgentOutputEvent } from "./output";
export { generateMissionBrief, writeMissionBrief, runVerification, type MissionBrief } from "./mission-brief";
