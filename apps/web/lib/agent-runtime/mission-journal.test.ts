/**
 * Tests for apps/web/lib/agent-runtime/mission-journal.ts
 *
 * Strategy:
 *   - createControlClient is mocked; sql / callReducer stubs control all I/O.
 *   - loadMissionJournal: default journal when nothing stored, merges when stored.
 *   - saveMissionJournal: calls upsert_memory_document with correct args.
 *   - addLogEntry: appends to shipsLog; bounds at 50 entries.
 *   - addStandingOrder: adds unique orders; skips duplicates.
 *   - awardMissionPatch: adds unique patches; skips duplicates by name.
 *   - updateFlightPlan: merges partial updates into existing flight plan.
 *   - customizeCrewMember: adds new crew; updates existing crew.
 *   - renderJournalForPrompt: all sections formatted as expected markdown.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock: @/lib/server
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  loadMissionJournal,
  saveMissionJournal,
  addLogEntry,
  addStandingOrder,
  awardMissionPatch,
  updateFlightPlan,
  customizeCrewMember,
  renderJournalForPrompt,
  type MissionJournal,
} from "./mission-journal";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.callReducer.mockResolvedValue(undefined);
  mockClient.sql.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStoredJournal(overrides: Partial<MissionJournal> = {}): MissionJournal {
  return {
    operatorId: "op_001",
    callsign: "Eagle One",
    flightPlan: {
      role: "Lead Engineer",
      expertise: ["TypeScript", "React"],
      timezone: "America/New_York",
      communicationStyle: "concise",
    },
    shipsLog: ["Deployed version 1.0.0"],
    standingOrders: ["Always write tests"],
    missionPatches: [{ name: "First Launch", description: "First deployment", earnedAt: 1_000_000 }],
    crewManifest: {
      voyager: { personality: "Methodical explorer", specialFocus: "backend" },
    },
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadMissionJournal — default journal
// ---------------------------------------------------------------------------

describe("loadMissionJournal — no stored journal", () => {
  it("returns a journal with the correct operatorId", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.operatorId).toBe("op_001");
  });

  it("returns default callsign 'Operator' when nothing is stored", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.callsign).toBe("Operator");
  });

  it("returns default flightPlan with role 'Developer'", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.flightPlan.role).toBe("Developer");
  });

  it("returns default flightPlan with timezone 'UTC'", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.flightPlan.timezone).toBe("UTC");
  });

  it("returns default shipsLog as empty array", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.shipsLog).toEqual([]);
  });

  it("returns default standingOrders (4 built-in orders)", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.standingOrders.length).toBe(4);
  });

  it("returns default missionPatches as empty array", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.missionPatches).toEqual([]);
  });

  it("returns default crewManifest with cadet, voyager, and saturn entries", async () => {
    mockClient.sql.mockResolvedValue([]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.crewManifest).toHaveProperty("cadet");
    expect(journal.crewManifest).toHaveProperty("voyager");
    expect(journal.crewManifest).toHaveProperty("saturn");
  });

  it("returns default journal when SQL throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("Connection refused"));

    const journal = await loadMissionJournal("op_001");
    expect(journal.operatorId).toBe("op_001");
    expect(journal.callsign).toBe("Operator");
  });

  it("queries memory_document with the correct journal document ID", async () => {
    mockClient.sql.mockResolvedValue([]);

    await loadMissionJournal("op_001");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("memory_document");
    expect(query).toContain("journal_op_001");
  });
});

describe("loadMissionJournal — stored journal found", () => {
  it("merges stored callsign over the default", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ callsign: "Eagle One" })) },
    ]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.callsign).toBe("Eagle One");
  });

  it("merges stored flightPlan over the default", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          flightPlan: { role: "Lead Engineer", expertise: ["TypeScript"], timezone: "America/New_York", communicationStyle: "concise" },
        })),
      },
    ]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.flightPlan.role).toBe("Lead Engineer");
    expect(journal.flightPlan.timezone).toBe("America/New_York");
  });

  it("overrides operatorId with the argument (not stored value)", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ operatorId: "old_op" })) },
    ]);

    const journal = await loadMissionJournal("op_fresh");
    expect(journal.operatorId).toBe("op_fresh");
  });

  it("preserves stored shipsLog entries", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ shipsLog: ["Entry A", "Entry B"] })) },
    ]);

    const journal = await loadMissionJournal("op_001");
    expect(journal.shipsLog).toContain("Entry A");
    expect(journal.shipsLog).toContain("Entry B");
  });
});

// ---------------------------------------------------------------------------
// saveMissionJournal
// ---------------------------------------------------------------------------

describe("saveMissionJournal", () => {
  it("calls the upsert_memory_document reducer", async () => {
    const journal = makeStoredJournal();
    await saveMissionJournal(journal);

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("upsert_memory_document");
  });

  it("uses document_id 'journal_{operatorId}'", async () => {
    const journal = makeStoredJournal({ operatorId: "op_007" });
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[0]).toBe("journal_op_007");
  });

  it("passes operatorId as the second argument", async () => {
    const journal = makeStoredJournal({ operatorId: "op_007" });
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[1]).toBe("op_007");
  });

  it("uses namespace 'journals'", async () => {
    const journal = makeStoredJournal();
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[2]).toBe("journals");
  });

  it("sets title to 'Mission Journal: {callsign}'", async () => {
    const journal = makeStoredJournal({ callsign: "Eagle One" });
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[3]).toBe("Mission Journal: Eagle One");
  });

  it("serialises the journal as JSON in the content argument", async () => {
    const journal = makeStoredJournal({ callsign: "Eagle One" });
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const content = JSON.parse(args[4] as string) as MissionJournal;
    expect(content.callsign).toBe("Eagle One");
    expect(content.operatorId).toBe("op_001");
  });

  it("uses type 'journal' in the reducer args", async () => {
    const journal = makeStoredJournal();
    await saveMissionJournal(journal);

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[5]).toBe("journal");
  });
});

// ---------------------------------------------------------------------------
// addLogEntry
// ---------------------------------------------------------------------------

describe("addLogEntry", () => {
  it("appends the entry to shipsLog", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ shipsLog: ["Existing entry"] })) },
    ]);

    await addLogEntry("op_001", "New deployment");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.shipsLog).toContain("New deployment");
    expect(saved.shipsLog).toContain("Existing entry");
  });

  it("saves the journal after appending", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal()) },
    ]);

    await addLogEntry("op_001", "New entry");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
  });

  it("bounds shipsLog at 50 entries", async () => {
    const fiftyEntries = Array.from({ length: 50 }, (_, i) => `Entry ${i}`);
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ shipsLog: fiftyEntries })) },
    ]);

    await addLogEntry("op_001", "Entry 50 (overflow)");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.shipsLog.length).toBe(50);
  });

  it("keeps the most recent entries when bounding at 50", async () => {
    const fiftyEntries = Array.from({ length: 50 }, (_, i) => `Entry ${i}`);
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ shipsLog: fiftyEntries })) },
    ]);

    await addLogEntry("op_001", "Most recent entry");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.shipsLog[saved.shipsLog.length - 1]).toBe("Most recent entry");
    // Entry 0 should have been dropped
    expect(saved.shipsLog).not.toContain("Entry 0");
  });
});

// ---------------------------------------------------------------------------
// addStandingOrder
// ---------------------------------------------------------------------------

describe("addStandingOrder", () => {
  it("adds a new standing order", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ standingOrders: ["Write tests"] })) },
    ]);

    await addStandingOrder("op_001", "Never use any");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.standingOrders).toContain("Never use any");
  });

  it("does not add a duplicate standing order", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ standingOrders: ["Write tests"] })) },
    ]);

    await addStandingOrder("op_001", "Write tests");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    const count = saved.standingOrders.filter((o) => o === "Write tests").length;
    expect(count).toBe(1);
  });

  it("saves the journal after adding the order", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal()) },
    ]);

    await addStandingOrder("op_001", "New order");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// awardMissionPatch
// ---------------------------------------------------------------------------

describe("awardMissionPatch", () => {
  it("adds a new mission patch", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ missionPatches: [] })) },
    ]);

    await awardMissionPatch("op_001", "Speed Runner", "Completed in record time");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    const patch = saved.missionPatches.find((p) => p.name === "Speed Runner");
    expect(patch).toBeDefined();
    expect(patch!.description).toBe("Completed in record time");
  });

  it("does not add a duplicate patch (same name)", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          missionPatches: [{ name: "First Launch", description: "Already earned", earnedAt: 1_000 }],
        })),
      },
    ]);

    await awardMissionPatch("op_001", "First Launch", "Duplicate attempt");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    const patches = saved.missionPatches.filter((p) => p.name === "First Launch");
    expect(patches).toHaveLength(1);
  });

  it("sets earnedAt to a current timestamp", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ missionPatches: [] })) },
    ]);

    const before = Date.now();
    await awardMissionPatch("op_001", "New Patch", "Achievement unlocked");
    const after = Date.now();

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    const patch = saved.missionPatches.find((p) => p.name === "New Patch")!;
    expect(patch.earnedAt).toBeGreaterThanOrEqual(before);
    expect(patch.earnedAt).toBeLessThanOrEqual(after);
  });

  it("saves the journal after awarding the patch", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal()) },
    ]);

    await awardMissionPatch("op_001", "Test Patch", "desc");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// updateFlightPlan
// ---------------------------------------------------------------------------

describe("updateFlightPlan", () => {
  it("merges partial updates into the existing flight plan", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          flightPlan: { role: "Engineer", expertise: ["TS"], timezone: "UTC", communicationStyle: "direct" },
        })),
      },
    ]);

    await updateFlightPlan("op_001", { timezone: "America/Los_Angeles" });

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.flightPlan.timezone).toBe("America/Los_Angeles");
    // Other fields should be preserved
    expect(saved.flightPlan.role).toBe("Engineer");
    expect(saved.flightPlan.communicationStyle).toBe("direct");
  });

  it("can update multiple fields at once", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          flightPlan: { role: "Engineer", expertise: ["TS"], timezone: "UTC", communicationStyle: "direct" },
        })),
      },
    ]);

    await updateFlightPlan("op_001", { role: "Architect", expertise: ["TS", "Go"] });

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.flightPlan.role).toBe("Architect");
    expect(saved.flightPlan.expertise).toEqual(["TS", "Go"]);
  });

  it("saves the journal after updating the flight plan", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal()) },
    ]);

    await updateFlightPlan("op_001", { role: "Lead" });

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// customizeCrewMember
// ---------------------------------------------------------------------------

describe("customizeCrewMember", () => {
  it("adds a new crew member when agentId is not in the manifest", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal({ crewManifest: {} })) },
    ]);

    await customizeCrewMember("op_001", "apollo", "Research specialist", "data analysis");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.crewManifest["apollo"]).toBeDefined();
    expect(saved.crewManifest["apollo"]!.personality).toBe("Research specialist");
    expect(saved.crewManifest["apollo"]!.specialFocus).toBe("data analysis");
  });

  it("updates an existing crew member's personality", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          crewManifest: {
            voyager: { personality: "Old personality", specialFocus: "coding" },
          },
        })),
      },
    ]);

    await customizeCrewMember("op_001", "voyager", "New personality");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.crewManifest["voyager"]!.personality).toBe("New personality");
  });

  it("preserves existing specialFocus when not provided", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          crewManifest: {
            voyager: { personality: "Old personality", specialFocus: "coding and architecture" },
          },
        })),
      },
    ]);

    await customizeCrewMember("op_001", "voyager", "Updated personality");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.crewManifest["voyager"]!.specialFocus).toBe("coding and architecture");
  });

  it("overrides specialFocus when explicitly provided", async () => {
    mockClient.sql.mockResolvedValue([
      {
        content: JSON.stringify(makeStoredJournal({
          crewManifest: {
            voyager: { personality: "Old", specialFocus: "old focus" },
          },
        })),
      },
    ]);

    await customizeCrewMember("op_001", "voyager", "New personality", "new focus");

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    const saved = JSON.parse(args[4] as string) as MissionJournal;
    expect(saved.crewManifest["voyager"]!.specialFocus).toBe("new focus");
  });

  it("saves the journal after customizing the crew member", async () => {
    mockClient.sql.mockResolvedValue([
      { content: JSON.stringify(makeStoredJournal()) },
    ]);

    await customizeCrewMember("op_001", "voyager", "Test personality");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// renderJournalForPrompt
// ---------------------------------------------------------------------------

describe("renderJournalForPrompt", () => {
  it("includes the callsign in the header", () => {
    const journal = makeStoredJournal({ callsign: "Eagle One" });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("Eagle One");
    expect(prompt).toContain("# Mission Journal");
  });

  it("includes the Flight Plan section", () => {
    const journal = makeStoredJournal({
      flightPlan: { role: "Lead Engineer", expertise: [], timezone: "UTC", communicationStyle: "direct" },
    });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("## Flight Plan");
    expect(prompt).toContain("Lead Engineer");
    expect(prompt).toContain("UTC");
    expect(prompt).toContain("direct");
  });

  it("includes expertise list when non-empty", () => {
    const journal = makeStoredJournal({
      flightPlan: { role: "Dev", expertise: ["TypeScript", "React"], timezone: "UTC", communicationStyle: "direct" },
    });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("React");
  });

  it("omits Expertise line when expertise array is empty", () => {
    const journal = makeStoredJournal({
      flightPlan: { role: "Dev", expertise: [], timezone: "UTC", communicationStyle: "direct" },
    });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).not.toContain("Expertise:");
  });

  it("includes the Standing Orders section when orders exist", () => {
    const journal = makeStoredJournal({ standingOrders: ["Write tests", "Keep it simple"] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("## Standing Orders");
    expect(prompt).toContain("Write tests");
    expect(prompt).toContain("Keep it simple");
  });

  it("omits Standing Orders section when standingOrders is empty", () => {
    const journal = makeStoredJournal({ standingOrders: [] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).not.toContain("## Standing Orders");
  });

  it("includes the Ship's Log section when entries exist", () => {
    const journal = makeStoredJournal({ shipsLog: ["Deployed v1.0", "Fixed auth bug"] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("## Ship's Log");
    expect(prompt).toContain("Deployed v1.0");
    expect(prompt).toContain("Fixed auth bug");
  });

  it("omits Ship's Log section when shipsLog is empty", () => {
    const journal = makeStoredJournal({ shipsLog: [] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).not.toContain("## Ship's Log");
  });

  it("includes only the last 10 log entries", () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => `Entry ${i}`);
    const journal = makeStoredJournal({ shipsLog: manyEntries });
    const prompt = renderJournalForPrompt(journal);
    // Entry 14 (last) should be present
    expect(prompt).toContain("Entry 14");
    // Entry 0–4 (outside last 10) should not be present
    expect(prompt).not.toContain("Entry 4");
  });

  it("includes the Mission Patches section when patches exist", () => {
    const journal = makeStoredJournal({
      missionPatches: [
        { name: "First Launch", description: "Completed first deployment", earnedAt: 1_000 },
      ],
    });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("## Mission Patches");
    expect(prompt).toContain("First Launch");
    expect(prompt).toContain("Completed first deployment");
  });

  it("omits Mission Patches section when patches array is empty", () => {
    const journal = makeStoredJournal({ missionPatches: [] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).not.toContain("## Mission Patches");
  });

  it("formats each standing order as a markdown list item", () => {
    const journal = makeStoredJournal({ standingOrders: ["Write tests"] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("- Write tests");
  });

  it("formats each log entry as a markdown list item", () => {
    const journal = makeStoredJournal({ shipsLog: ["Deployed v2.0"] });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("- Deployed v2.0");
  });

  it("formats each patch with bold name", () => {
    const journal = makeStoredJournal({
      missionPatches: [{ name: "Alpha Tester", description: "Early adopter", earnedAt: 1_000 }],
    });
    const prompt = renderJournalForPrompt(journal);
    expect(prompt).toContain("**Alpha Tester**");
  });

  it("returns a non-empty string for a minimal journal", () => {
    const journal: MissionJournal = {
      operatorId: "op_minimal",
      callsign: "Operator",
      flightPlan: { role: "Developer", expertise: [], timezone: "UTC", communicationStyle: "direct" },
      shipsLog: [],
      standingOrders: [],
      missionPatches: [],
      crewManifest: {},
      updatedAt: Date.now(),
    };
    const prompt = renderJournalForPrompt(journal);
    expect(prompt.length).toBeGreaterThan(0);
  });
});
