import { requireOperatorApiSession } from "@/lib/auth";
import {
  loadMissionJournal,
  saveMissionJournal,
  addLogEntry,
  addStandingOrder,
  updateFlightPlan,
  customizeCrewMember,
} from "@/lib/agent-runtime/mission-journal";
import { apiError, apiUnauthorized } from "@/lib/api-response";

/** GET /api/journal — load operator's Mission Journal */
export async function GET(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const journal = await loadMissionJournal(operatorId!);
    return Response.json({ ok: true, journal });
  } catch (error) {
    return apiError(error, 500);
  }
}

/** POST /api/journal — update Mission Journal */
export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case "updateFlightPlan": {
        const { role, expertise, timezone, communicationStyle } = body as Record<string, unknown>;
        await updateFlightPlan(operatorId!, {
          ...(role ? { role: String(role) } : {}),
          ...(expertise ? { expertise: expertise as string[] } : {}),
          ...(timezone ? { timezone: String(timezone) } : {}),
          ...(communicationStyle ? { communicationStyle: String(communicationStyle) } : {}),
        });
        break;
      }
      case "addStandingOrder": {
        const { order } = body as { order: string };
        if (!order) return apiError("order is required", 400);
        await addStandingOrder(operatorId!, order);
        break;
      }
      case "addLogEntry": {
        const { entry } = body as { entry: string };
        if (!entry) return apiError("entry is required", 400);
        await addLogEntry(operatorId!, entry);
        break;
      }
      case "customizeCrew": {
        const { agentId, personality, specialFocus } = body as { agentId: string; personality: string; specialFocus?: string };
        if (!agentId || !personality) return apiError("agentId and personality required", 400);
        await customizeCrewMember(operatorId!, agentId, personality, specialFocus);
        break;
      }
      case "save": {
        const { journal } = body as { journal: Record<string, unknown> };
        if (!journal) return apiError("journal is required", 400);
        await saveMissionJournal({ ...journal, operatorId: operatorId! } as never);
        break;
      }
      default:
        return apiError(`Unknown action: ${action}`, 400);
    }

    const updated = await loadMissionJournal(operatorId!);
    return Response.json({ ok: true, journal: updated });
  } catch (error) {
    return apiError(error, 400);
  }
}
