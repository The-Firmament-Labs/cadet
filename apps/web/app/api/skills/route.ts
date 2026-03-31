import { requireOperatorApiSession } from "@/lib/auth";
import { listSkills, viewSkill, installSkill, removeSkill } from "@/lib/agent-runtime/skills";
import { apiError, apiUnauthorized, apiNotFound } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("id");

  try {
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
