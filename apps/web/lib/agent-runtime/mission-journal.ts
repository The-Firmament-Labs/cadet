/**
 * Cadet Mission Journal
 *
 * The Mission Journal is Cadet's personality and memory system — the equivalent
 * of Hermes's SOUL.md, but themed around space exploration.
 *
 * Every operator has a Mission Journal stored in SpacetimeDB that shapes how
 * agents interact with them. It contains:
 *
 * - Flight Plan: operator profile, role, expertise, preferences
 * - Ship's Log: learned facts about the operator's codebase and workflow
 * - Standing Orders: behavioral rules (what to do and not do)
 * - Mission Patches: achievements and completed milestones
 * - Crew Manifest: active agent personas and their specializations
 *
 * The journal is injected into every agent's system prompt and mission brief.
 * It evolves over time as the system learns from interactions.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export interface MissionJournal {
  operatorId: string;
  callsign: string;
  /** Flight Plan: who is this operator? */
  flightPlan: {
    role: string;
    expertise: string[];
    timezone: string;
    communicationStyle: string;
  };
  /** Ship's Log: learned facts */
  shipsLog: string[];
  /** Standing Orders: behavioral rules */
  standingOrders: string[];
  /** Mission Patches: achievements */
  missionPatches: Array<{
    name: string;
    description: string;
    earnedAt: number;
  }>;
  /** Crew Manifest: active agent customizations */
  crewManifest: Record<string, {
    personality: string;
    specialFocus: string;
  }>;
  updatedAt: number;
}

const DEFAULT_JOURNAL: Omit<MissionJournal, "operatorId"> = {
  callsign: "Operator",
  flightPlan: {
    role: "Developer",
    expertise: [],
    timezone: "UTC",
    communicationStyle: "direct",
  },
  shipsLog: [],
  standingOrders: [
    "Match the existing code style exactly",
    "Don't add comments to code you didn't change",
    "Run tests after every change",
    "Prefer minimal, focused changes over broad refactors",
  ],
  missionPatches: [],
  crewManifest: {
    cadet: {
      personality: "Helpful mission control operator. Professional, concise, space-themed acknowledgments.",
      specialFocus: "routing and delegation",
    },
    voyager: {
      personality: "Deep-space explorer. Methodical, thorough, documents everything in the ship's log.",
      specialFocus: "coding and architecture",
    },
    saturn: {
      personality: "Orbital ops specialist. Calm under pressure, status-oriented, deployment-focused.",
      specialFocus: "operations and infrastructure",
    },
  },
  updatedAt: Date.now(),
};

/** Load the operator's Mission Journal from SpacetimeDB. */
export async function loadMissionJournal(operatorId: string): Promise<MissionJournal> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT content FROM memory_document WHERE document_id = 'journal_${sqlEscape(operatorId)}' LIMIT 1`,
    )) as Record<string, unknown>[];

    if (rows.length > 0) {
      const stored = JSON.parse(String(rows[0]!.content)) as Partial<MissionJournal>;
      return { ...DEFAULT_JOURNAL, ...stored, operatorId };
    }
  } catch { /* fall through */ }

  return { ...DEFAULT_JOURNAL, operatorId };
}

/** Save the Mission Journal to SpacetimeDB. */
export async function saveMissionJournal(journal: MissionJournal): Promise<void> {
  const client = createControlClient();
  await client.callReducer("upsert_memory_document", [
    `journal_${journal.operatorId}`,
    journal.operatorId,
    "journals",
    `Mission Journal: ${journal.callsign}`,
    JSON.stringify(journal),
    "journal",
    "{}",
  ]);
}

/** Add an entry to the Ship's Log. */
export async function addLogEntry(operatorId: string, entry: string): Promise<void> {
  const journal = await loadMissionJournal(operatorId);
  journal.shipsLog.push(entry);
  // Keep bounded — last 50 entries
  if (journal.shipsLog.length > 50) {
    journal.shipsLog = journal.shipsLog.slice(-50);
  }
  journal.updatedAt = Date.now();
  await saveMissionJournal(journal);
}

/** Add a Standing Order (behavioral rule). */
export async function addStandingOrder(operatorId: string, order: string): Promise<void> {
  const journal = await loadMissionJournal(operatorId);
  if (!journal.standingOrders.includes(order)) {
    journal.standingOrders.push(order);
  }
  journal.updatedAt = Date.now();
  await saveMissionJournal(journal);
}

/** Award a Mission Patch (achievement). */
export async function awardMissionPatch(
  operatorId: string,
  name: string,
  description: string,
): Promise<void> {
  const journal = await loadMissionJournal(operatorId);
  if (!journal.missionPatches.some((p) => p.name === name)) {
    journal.missionPatches.push({ name, description, earnedAt: Date.now() });
  }
  journal.updatedAt = Date.now();
  await saveMissionJournal(journal);
}

/** Update the Flight Plan (operator profile). */
export async function updateFlightPlan(
  operatorId: string,
  updates: Partial<MissionJournal["flightPlan"]>,
): Promise<void> {
  const journal = await loadMissionJournal(operatorId);
  journal.flightPlan = { ...journal.flightPlan, ...updates };
  journal.updatedAt = Date.now();
  await saveMissionJournal(journal);
}

/** Customize a crew member's personality. */
export async function customizeCrewMember(
  operatorId: string,
  agentId: string,
  personality: string,
  specialFocus?: string,
): Promise<void> {
  const journal = await loadMissionJournal(operatorId);
  journal.crewManifest[agentId] = {
    personality,
    specialFocus: specialFocus ?? journal.crewManifest[agentId]?.specialFocus ?? "",
  };
  journal.updatedAt = Date.now();
  await saveMissionJournal(journal);
}

/**
 * Render the Mission Journal as a system prompt section.
 * This is injected into every agent's context.
 */
export function renderJournalForPrompt(journal: MissionJournal): string {
  const sections: string[] = [];

  sections.push(`# Mission Journal — ${journal.callsign}`);
  sections.push("");

  // Flight Plan
  sections.push("## Flight Plan");
  sections.push(`- Role: ${journal.flightPlan.role}`);
  if (journal.flightPlan.expertise.length > 0) {
    sections.push(`- Expertise: ${journal.flightPlan.expertise.join(", ")}`);
  }
  sections.push(`- Timezone: ${journal.flightPlan.timezone}`);
  sections.push(`- Comms style: ${journal.flightPlan.communicationStyle}`);
  sections.push("");

  // Standing Orders
  if (journal.standingOrders.length > 0) {
    sections.push("## Standing Orders");
    for (const order of journal.standingOrders) {
      sections.push(`- ${order}`);
    }
    sections.push("");
  }

  // Ship's Log (last 10)
  if (journal.shipsLog.length > 0) {
    sections.push("## Ship's Log (recent)");
    for (const entry of journal.shipsLog.slice(-10)) {
      sections.push(`- ${entry}`);
    }
    sections.push("");
  }

  // Mission Patches
  if (journal.missionPatches.length > 0) {
    sections.push("## Mission Patches");
    for (const patch of journal.missionPatches) {
      sections.push(`- **${patch.name}**: ${patch.description}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
