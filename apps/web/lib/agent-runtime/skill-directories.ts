/**
 * Filesystem skill directory scanner.
 *
 * Scans ~/.claude/skills, ~/.codex/skills, ~/.agents/skills, and ~/.cadet
 * for available skills. Each directory can be toggled on/off.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";

export interface SkillDirectory {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  skillCount: number;
}

export interface FilesystemSkill {
  id: string;
  name: string;
  directory: string;
  directoryLabel: string;
  path: string;
  description: string;
}

const SKILL_DIRS: Array<{ id: string; label: string; relPath: string }> = [
  { id: "claude", label: "Claude Code", relPath: ".claude/skills" },
  { id: "codex", label: "Codex", relPath: ".codex/skills" },
  { id: "agents", label: "Agents", relPath: ".agents/skills" },
  { id: "cadet", label: "Cadet", relPath: ".cadet" },
];

/**
 * List all skill directories with their skill counts.
 */
export async function listSkillDirectories(): Promise<SkillDirectory[]> {
  const home = homedir();
  const dirs: SkillDirectory[] = [];

  for (const { id, label, relPath } of SKILL_DIRS) {
    const fullPath = join(home, relPath);
    let skillCount = 0;
    try {
      const entries = await readdir(fullPath);
      // Count directories (each is a skill) or .md files
      for (const entry of entries) {
        try {
          const s = await stat(join(fullPath, entry));
          if (s.isDirectory() || entry.endsWith(".md")) {
            skillCount++;
          }
        } catch { /* skip unreadable */ }
      }
    } catch {
      // Directory doesn't exist
    }

    dirs.push({
      id,
      path: fullPath,
      label,
      enabled: true, // default all enabled
      skillCount,
    });
  }

  return dirs;
}

/**
 * List skills from specified directories.
 */
export async function listFilesystemSkills(
  enabledDirs?: string[],
): Promise<FilesystemSkill[]> {
  const home = homedir();
  const skills: FilesystemSkill[] = [];
  const filter = enabledDirs ? new Set(enabledDirs) : null;

  for (const { id, label, relPath } of SKILL_DIRS) {
    if (filter && !filter.has(id)) continue;

    const fullPath = join(home, relPath);
    try {
      const entries = await readdir(fullPath);

      for (const entry of entries) {
        const entryPath = join(fullPath, entry);
        try {
          const s = await stat(entryPath);
          if (s.isDirectory()) {
            // Look for a README.md or index.md or skill.md inside
            let description = "";
            for (const descFile of ["README.md", "index.md", "skill.md", `${entry}.md`]) {
              try {
                const content = await readFile(join(entryPath, descFile), "utf-8");
                // Extract first non-empty, non-heading line as description
                const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
                description = lines[0]?.trim().slice(0, 120) ?? "";
                break;
              } catch { /* file doesn't exist */ }
            }

            skills.push({
              id: `${id}:${entry}`,
              name: entry.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              directory: id,
              directoryLabel: label,
              path: entryPath,
              description,
            });
          } else if (entry.endsWith(".md")) {
            const name = basename(entry, ".md");
            skills.push({
              id: `${id}:${name}`,
              name: name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              directory: id,
              directoryLabel: label,
              path: entryPath,
              description: "",
            });
          }
        } catch { /* skip */ }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return skills;
}

/**
 * Read the full content of a filesystem skill.
 */
export async function readSkillContent(skillId: string): Promise<string | null> {
  const home = homedir();

  const [dirId, ...nameParts] = skillId.split(":");
  const name = nameParts.join(":");
  const dirDef = SKILL_DIRS.find((d) => d.id === dirId);
  if (!dirDef) return null;

  const basePath = join(home, dirDef.relPath, name);

  // Try directory with README
  try {
    const s = await stat(basePath);
    if (s.isDirectory()) {
      for (const descFile of ["README.md", "index.md", "skill.md", `${name}.md`]) {
        try {
          return await readFile(join(basePath, descFile), "utf-8");
        } catch { /* next */ }
      }
    }
  } catch { /* not a directory */ }

  // Try as .md file
  try {
    return await readFile(`${basePath}.md`, "utf-8");
  } catch { /* not found */ }

  return null;
}
