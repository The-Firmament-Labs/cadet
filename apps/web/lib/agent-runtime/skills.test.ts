import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockSql = vi.hoisted(() => vi.fn());
const mockCallReducer = vi.hoisted(() => vi.fn());
const mockCreateControlClient = vi.hoisted(() =>
  vi.fn(() => ({ sql: mockSql, callReducer: mockCallReducer }))
);

vi.mock("../server", () => ({
  createControlClient: mockCreateControlClient,
}));

vi.mock("../sql", () => ({
  sqlEscape: (v: string) => v.replace(/'/g, "''"),
}));

import {
  listSkills,
  viewSkill,
  matchSkills,
  installSkill,
  removeSkill,
  type SkillMetadata,
  type Skill,
} from "./skills";

// ── Helpers ───────────────────────────────────────────────────────────

const BUILTIN_IDS = [
  "git-workflow",
  "testing-patterns",
  "security-checklist",
  "api-design",
  "performance",
];

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockResolvedValue([]);
});

// ── listSkills ────────────────────────────────────────────────────────

describe("listSkills", () => {
  it("returns 5 built-in skills without content field", async () => {
    const skills = await listSkills();

    expect(skills).toHaveLength(5);
    for (const skill of skills) {
      expect(skill).not.toHaveProperty("content");
      expect(skill).toHaveProperty("id");
      expect(skill).toHaveProperty("name");
      expect(skill).toHaveProperty("description");
      expect(skill).toHaveProperty("category");
      expect(skill).toHaveProperty("version");
      expect(skill).toHaveProperty("author");
      expect(skill).toHaveProperty("tokenEstimate");
      expect(skill).toHaveProperty("source");
    }
  });

  it("returns all 5 built-in IDs", async () => {
    const skills = await listSkills();
    const ids = skills.map((s) => s.id);
    for (const id of BUILTIN_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("merges DB skills with builtins", async () => {
    mockSql.mockResolvedValueOnce([
      {
        skill_id: "db-skill-1",
        name: "DB Skill",
        description: "From database",
        category: "custom",
        version: "2.0.0",
        author: "operator",
        token_estimate: 300,
        source: "installed",
      },
    ]);

    const skills = await listSkills();

    expect(skills).toHaveLength(6);
    const dbSkill = skills.find((s) => s.id === "db-skill-1");
    expect(dbSkill).toBeDefined();
    expect(dbSkill!.name).toBe("DB Skill");
    expect(dbSkill!.tokenEstimate).toBe(300);
    expect(dbSkill!.source).toBe("installed");
  });

  it("returns only built-ins when DB fails", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB connection failed"));

    const skills = await listSkills();

    expect(skills).toHaveLength(5);
    const ids = skills.map((s) => s.id);
    for (const id of BUILTIN_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("falls back to token_estimate default of 500 when missing", async () => {
    mockSql.mockResolvedValueOnce([
      {
        skill_id: "no-estimate",
        name: "No Estimate",
        description: "Missing token_estimate",
        category: "misc",
        version: "1.0.0",
        author: "test",
        token_estimate: null,
        source: null,
      },
    ]);

    const skills = await listSkills();
    const dbSkill = skills.find((s) => s.id === "no-estimate");
    expect(dbSkill!.tokenEstimate).toBe(500);
    expect(dbSkill!.source).toBe("installed");
  });
});

// ── viewSkill ─────────────────────────────────────────────────────────

describe("viewSkill", () => {
  it("returns full content for built-in git-workflow skill", async () => {
    const skill = await viewSkill("git-workflow");

    expect(skill).not.toBeNull();
    expect(skill!.id).toBe("git-workflow");
    expect(skill!.content).toContain("Git Workflow");
    expect(skill!.source).toBe("builtin");
  });

  it("returns full content for built-in testing-patterns skill", async () => {
    const skill = await viewSkill("testing-patterns");

    expect(skill).not.toBeNull();
    expect(skill!.content).toContain("Testing Patterns");
  });

  it("returns full content for built-in security-checklist skill", async () => {
    const skill = await viewSkill("security-checklist");
    expect(skill).not.toBeNull();
    expect(skill!.content).toContain("Security Checklist");
  });

  it("returns full content for built-in api-design skill", async () => {
    const skill = await viewSkill("api-design");
    expect(skill).not.toBeNull();
    expect(skill!.content).toContain("API Design");
  });

  it("returns full content for built-in performance skill", async () => {
    const skill = await viewSkill("performance");
    expect(skill).not.toBeNull();
    expect(skill!.content).toContain("Performance");
  });

  it("does not call DB for built-in skills", async () => {
    await viewSkill("git-workflow");
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns null for unknown skill when DB returns empty", async () => {
    mockSql.mockResolvedValueOnce([]);

    const skill = await viewSkill("nonexistent-skill");
    expect(skill).toBeNull();
  });

  it("queries DB for non-builtin skills", async () => {
    mockSql.mockResolvedValueOnce([
      {
        skill_id: "custom-skill",
        name: "Custom Skill",
        description: "Operator-created skill",
        category: "custom",
        version: "1.0.0",
        author: "operator",
        token_estimate: 400,
        source: "operator",
        content: "# Custom Skill Content\n\nThis is custom content.",
      },
    ]);

    const skill = await viewSkill("custom-skill");

    expect(skill).not.toBeNull();
    expect(skill!.id).toBe("custom-skill");
    expect(skill!.content).toBe("# Custom Skill Content\n\nThis is custom content.");
    expect(skill!.source).toBe("operator");
    expect(mockSql).toHaveBeenCalledOnce();
    expect(mockSql.mock.calls[0]![0]).toContain("custom-skill");
  });

  it("returns null when DB throws for non-builtin skill", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB error"));
    const skill = await viewSkill("broken-skill");
    expect(skill).toBeNull();
  });
});

// ── matchSkills ───────────────────────────────────────────────────────

describe("matchSkills", () => {
  it("returns matching skills for git-related goal", async () => {
    const skills = await matchSkills("I need to create a git commit");

    expect(skills.length).toBeGreaterThan(0);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("git-workflow");
  });

  it("returns matching skills for test-related goal", async () => {
    const skills = await matchSkills("write unit tests with vitest");
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("testing-patterns");
  });

  it("returns matching skills for security-related goal", async () => {
    const skills = await matchSkills("check auth and security");
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("security-checklist");
  });

  it("returns matching skills for API-related goal", async () => {
    const skills = await matchSkills("design a REST api endpoint");
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("api-design");
  });

  it("returns matching skills for performance-related goal", async () => {
    const skills = await matchSkills("optimize slow cache queries");
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("performance");
  });

  it("returns empty array for unrelated goal", async () => {
    // Use words that don't match any activation pattern
    const skills = await matchSkills("xyz zzz foo barbaz");
    expect(skills).toHaveLength(0);
  });

  it("returns empty array for empty goal", async () => {
    const skills = await matchSkills("");
    expect(skills).toHaveLength(0);
  });

  it("does case-insensitive matching", async () => {
    const skills = await matchSkills("GIT COMMIT BRANCH");
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("git-workflow");
  });
});

// ── Built-in skill structure validation ──────────────────────────────

describe("built-in skills structure", () => {
  const requiredMetaFields: (keyof SkillMetadata)[] = [
    "id",
    "name",
    "description",
    "category",
    "version",
    "author",
    "tokenEstimate",
    "source",
  ];

  it.each(BUILTIN_IDS)(
    "skill %s has all required fields and full content",
    async (skillId) => {
      const skill = await viewSkill(skillId);

      expect(skill).not.toBeNull();
      for (const field of requiredMetaFields) {
        expect(skill).toHaveProperty(field);
      }
      expect(skill!.content).toBeTruthy();
      expect(skill!.content.length).toBeGreaterThan(0);
      expect(skill!.activationPatterns).toBeDefined();
      expect(skill!.activationPatterns!.length).toBeGreaterThan(0);
      expect(skill!.source).toBe("builtin");
    }
  );
});

// ── installSkill ──────────────────────────────────────────────────────

describe("installSkill", () => {
  it("calls upsert_agent_skill reducer with correct args", async () => {
    mockCallReducer.mockResolvedValueOnce(undefined);

    const skill: Omit<Skill, "source"> = {
      id: "my-skill",
      name: "My Skill",
      description: "A test skill",
      category: "testing",
      version: "1.0.0",
      author: "test-author",
      tokenEstimate: 500,
      content: "# My Skill\n\nContent here.",
      activationPatterns: ["test", "spec"],
    };

    await installSkill(skill);

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("upsert_agent_skill");
    expect(args[0]).toBe("my-skill");
    expect(args[1]).toBe("My Skill");
    expect(args[2]).toBe("A test skill");
    expect(args[3]).toBe("testing");
    expect(args[4]).toBe("1.0.0");
    expect(args[5]).toBe("test-author");
    expect(args[6]).toBe(500);
    expect(args[7]).toBe("# My Skill\n\nContent here.");
    expect(args[8]).toBe(JSON.stringify(["test", "spec"]));
    expect(args[9]).toBe("installed");
  });

  it("uses empty array JSON when activationPatterns is undefined", async () => {
    mockCallReducer.mockResolvedValueOnce(undefined);

    const skill: Omit<Skill, "source"> = {
      id: "no-patterns",
      name: "No Patterns",
      description: "Skill without patterns",
      category: "misc",
      version: "1.0.0",
      author: "test",
      tokenEstimate: 200,
      content: "content",
    };

    await installSkill(skill);

    const [, args] = mockCallReducer.mock.calls[0]!;
    expect(args[8]).toBe("[]");
  });
});

// ── removeSkill ───────────────────────────────────────────────────────

describe("removeSkill", () => {
  it("calls delete_agent_skill reducer with the skill ID", async () => {
    mockCallReducer.mockResolvedValueOnce(undefined);

    await removeSkill("my-skill");

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("delete_agent_skill");
    expect(args[0]).toBe("my-skill");
  });
});
