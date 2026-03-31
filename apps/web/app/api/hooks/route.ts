import { requireOperatorApiSession } from "@/lib/auth";
import { listHooks, registerHook, toggleHook, deleteHook } from "@/lib/agent-runtime/hooks";
import { apiError, apiUnauthorized } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const hooks = await listHooks(operatorId!);
    return Response.json({ ok: true, hooks });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "register") {
      const { event, name, description, handler, priority } = body as {
        event: string; name: string; description: string; handler: string; priority?: number;
      };
      if (!event || !name || !handler) return apiError("event, name, handler required", 400);

      const hookId = await registerHook({
        event: event as never,
        name,
        description: description ?? "",
        handler,
        enabled: true,
        priority: priority ?? 0,
        operatorId: operatorId!,
      });
      return Response.json({ ok: true, hookId });
    }

    if (action === "toggle") {
      const { hookId, enabled } = body as { hookId: string; enabled: boolean };
      if (!hookId) return apiError("hookId required", 400);
      await toggleHook(hookId, enabled);
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const { hookId } = body as { hookId: string };
      if (!hookId) return apiError("hookId required", 400);
      await deleteHook(hookId);
      return Response.json({ ok: true });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (error) {
    return apiError(error, 400);
  }
}
