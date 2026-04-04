/**
 * Tests for apps/web/lib/agent-runtime/skill-directories.ts
 *
 * The module's core logic depends on the filesystem (readdir, readFile, stat).
 * We use vi.mock("fs/promises") to provide a controlled virtual filesystem
 * so tests run without touching the real home directory.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock fs/promises so the scanner never touches real disk.
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Provide a deterministic home directory.
vi.mock("os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { readdir, readFile, stat } from "fs/promises";
import {
  listSkillDirectories,
  listFilesystemSkills,
  readSkillContent,
} from "./skill-directories";

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe("skill-directories module exports", () => {
  it("exports listSkillDirectories", () => {
    expect(typeof listSkillDirectories).toBe("function");
  });

  it("exports listFilesystemSkills", () => {
    expect(typeof listFilesystemSkills).toBe("function");
  });

  it("exports readSkillContent", () => {
    expect(typeof readSkillContent).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// listSkillDirectories
// ---------------------------------------------------------------------------

describe("listSkillDirectories()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 4 skill directory entries (claude, codex, agents, cadet)", async () => {
    // All directories throw ENOENT (don't exist)
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const dirs = await listSkillDirectories();
    expect(dirs).toHaveLength(4);
    const ids = dirs.map((d) => d.id);
    expect(ids).toContain("claude");
    expect(ids).toContain("codex");
    expect(ids).toContain("agents");
    expect(ids).toContain("cadet");
  });

  it("sets skillCount=0 for directories that don't exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const dirs = await listSkillDirectories();
    for (const dir of dirs) {
      expect(dir.skillCount).toBe(0);
    }
  });

  it("counts directories and .md files as skills", async () => {
    mockReaddir
      .mockResolvedValueOnce(["my-skill", "another-skill", "notes.md", "ignore.json"] as never)
      .mockRejectedValue(new Error("ENOENT")); // remaining dirs don't exist

    mockStat
      .mockResolvedValueOnce({ isDirectory: () => true } as never) // my-skill
      .mockResolvedValueOnce({ isDirectory: () => true } as never) // another-skill
      .mockResolvedValueOnce({ isDirectory: () => false } as never) // notes.md
      .mockResolvedValueOnce({ isDirectory: () => false } as never); // ignore.json

    const dirs = await listSkillDirectories();
    const claudeDir = dirs.find((d) => d.id === "claude");
    // 2 directories + 1 .md file = 3 skills
    expect(claudeDir?.skillCount).toBe(3);
  });

  it("sets enabled=true by default for all entries", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const dirs = await listSkillDirectories();
    for (const dir of dirs) {
      expect(dir.enabled).toBe(true);
    }
  });

  it("includes absolute path in each entry", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const dirs = await listSkillDirectories();
    for (const dir of dirs) {
      expect(dir.path).toMatch(/^\/home\/testuser/);
    }
  });
});

// ---------------------------------------------------------------------------
// listFilesystemSkills
// ---------------------------------------------------------------------------

describe("listFilesystemSkills()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no directories exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const skills = await listFilesystemSkills();
    expect(skills).toHaveLength(0);
  });

  it("returns skills from directory entries", async () => {
    // claude dir has one skill directory, the rest don't exist
    mockReaddir
      .mockResolvedValueOnce(["my-skill"] as never)
      .mockRejectedValue(new Error("ENOENT"));

    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    // README.md inside my-skill
    mockReadFile.mockResolvedValueOnce("This skill does stuff\nMore details" as never);

    const skills = await listFilesystemSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.id).toBe("claude:my-skill");
    expect(skills[0]!.directory).toBe("claude");
    expect(skills[0]!.description).toContain("This skill does stuff");
  });

  it("formats skill name with title case", async () => {
    mockReaddir
      .mockResolvedValueOnce(["my-cool-skill"] as never)
      .mockRejectedValue(new Error("ENOENT"));
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT")); // no README

    const skills = await listFilesystemSkills();
    expect(skills[0]!.name).toBe("My Cool Skill");
  });

  it("includes .md files as skills with empty description", async () => {
    mockReaddir
      .mockResolvedValueOnce(["guide.md"] as never)
      .mockRejectedValue(new Error("ENOENT"));
    mockStat.mockResolvedValue({ isDirectory: () => false } as never);

    const skills = await listFilesystemSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.id).toBe("claude:guide");
    expect(skills[0]!.description).toBe("");
  });

  it("filters to enabled directories when enabledDirs is provided", async () => {
    // Only cadet should be scanned
    mockReaddir
      .mockResolvedValueOnce(["cadet-skill"] as never)
      .mockRejectedValue(new Error("ENOENT"));
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const skills = await listFilesystemSkills(["cadet"]);
    expect(skills.every((s) => s.directory === "cadet")).toBe(true);
  });

  it("returns skills from multiple enabled directories", async () => {
    mockReaddir
      .mockResolvedValueOnce(["skill-a"] as never) // claude
      .mockResolvedValueOnce(["skill-b"] as never) // agents
      .mockRejectedValue(new Error("ENOENT")); // others
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const skills = await listFilesystemSkills(["claude", "agents"]);
    expect(skills).toHaveLength(2);
    const dirs = skills.map((s) => s.directory);
    expect(dirs).toContain("claude");
    expect(dirs).toContain("agents");
  });

  it("caps description at 120 characters", async () => {
    const longLine = "x".repeat(200);
    mockReaddir
      .mockResolvedValueOnce(["verbose-skill"] as never)
      .mockRejectedValue(new Error("ENOENT"));
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockResolvedValueOnce(`${longLine}\n` as never);

    const skills = await listFilesystemSkills();
    expect(skills[0]!.description.length).toBeLessThanOrEqual(120);
  });
});

// ---------------------------------------------------------------------------
// readSkillContent
// ---------------------------------------------------------------------------

describe("readSkillContent()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unknown directory prefix", async () => {
    const result = await readSkillContent("unknown:my-skill");
    expect(result).toBeNull();
  });

  it("returns README.md content for a directory-based skill", async () => {
    mockStat.mockResolvedValueOnce({ isDirectory: () => true } as never);
    mockReadFile.mockResolvedValueOnce("# My Skill\nDoes great things" as never);

    const result = await readSkillContent("claude:my-skill");
    expect(result).toContain("Does great things");
  });

  it("falls back to .md file when directory read yields no README", async () => {
    // stat says it's a directory, but all README attempts fail
    mockStat.mockResolvedValueOnce({ isDirectory: () => true } as never);
    mockReadFile
      .mockRejectedValueOnce(new Error("ENOENT")) // README.md
      .mockRejectedValueOnce(new Error("ENOENT")) // index.md
      .mockRejectedValueOnce(new Error("ENOENT")) // skill.md
      .mockRejectedValueOnce(new Error("ENOENT")) // my-skill.md inside dir
      .mockResolvedValueOnce("fallback content" as never); // my-skill.md as file

    const result = await readSkillContent("claude:my-skill");
    expect(result).toBe("fallback content");
  });

  it("returns null when neither directory nor .md file is found", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await readSkillContent("claude:no-such-skill");
    expect(result).toBeNull();
  });

  it("handles skill ids with colon-containing names", async () => {
    // e.g. "cadet:foo:bar" — the name part is "foo:bar"
    mockStat.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValueOnce("nested skill content" as never);

    const result = await readSkillContent("cadet:foo:bar");
    expect(result).toBe("nested skill content");
  });
});
