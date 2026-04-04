import { requireOperatorApiSession } from "@/lib/auth";
import { listSkills, viewSkill, installSkill, removeSkill } from "@/lib/agent-runtime/skills";
import { listSkillDirectories, listFilesystemSkills, readSkillContent } from "@/lib/agent-runtime/skill-directories";
import { apiError, apiUnauthorized, apiNotFound } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("id");
  const source = searchParams.get("source");

  try {
    // Filesystem skill directories
    if (source === "directories") {
      const dirs = await listSkillDirectories();
      return Response.json({ ok: true, directories: dirs });
    }

    // Filesystem skills (from ~/.claude, ~/.codex, ~/.agents, ~/.cadet)
    if (source === "filesystem") {
      const enabledDirs = searchParams.get("dirs")?.split(",").filter(Boolean);
      const skills = await listFilesystemSkills(enabledDirs ?? undefined);
      return Response.json({ ok: true, skills });
    }

    // Read a specific filesystem skill
    if (skillId?.includes(":")) {
      // Try filesystem first (format: "dirId:skillName")
      const content = await readSkillContent(skillId);
      if (content) {
        return Response.json({ ok: true, skill: { id: skillId, content } });
      }
      // Fall through to database
    }

    if (skillId) {
      const skill = await viewSkill(skillId);
      if (!skill) return apiNotFound(`Skill '${skillId}' not found`);
      return Response.json({ ok: true, skill });
    }

    const skills = await listSkills();
    return Response.json({ ok: true, skills });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "install") {
      const { id, name, description, category, version, author, content, activationPatterns, tokenEstimate } = body as {
        id: string; name: string; description: string; category: string;
        version: string; author: string; content: string;
        activationPatterns?: string[]; tokenEstimate?: number;
      };
      if (!id || !name || !content) return apiError("id, name, content required", 400);

      await installSkill({
        id, name, description: description ?? "", category: category ?? "general",
        version: version ?? "1.0.0", author: author ?? "operator",
        tokenEstimate: tokenEstimate ?? Math.ceil(content.length / 4),
        content, activationPatterns,
      });
      return Response.json({ ok: true, skillId: id });
    }

    if (action === "remove") {
      const { id } = body as { id: string };
      if (!id) return apiError("id required", 400);
      await removeSkill(id);
      return Response.json({ ok: true });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (error) {
    return apiError(error, 400);
  }
}
