import { createControlClient } from "@/lib/server";
import { parseSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!parseSessionFromRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      send("connected", { ts: Date.now() });

      const poll = async () => {
        while (!cancelled) {
          try {
            const client = createControlClient();

            const [runs, approvals, browserTasks, agents, steps] = await Promise.all([
              client.sql("SELECT run_id, agent_id, goal, status, current_stage, priority FROM workflow_run ORDER BY updated_at_micros DESC LIMIT 20").catch(() => []),
              client.sql("SELECT approval_id, agent_id, title, status, risk FROM approval_request WHERE status = 'pending' ORDER BY created_at_micros DESC LIMIT 20").catch(() => []),
              client.sql("SELECT task_id, agent_id, status, url FROM browser_task ORDER BY updated_at_micros DESC LIMIT 10").catch(() => []),
              client.sql("SELECT agent_id, display_name, runtime, control_plane FROM agent_record").catch(() => []),
              client.sql("SELECT step_id, run_id, stage, status, owner_execution, updated_at_micros FROM workflow_step ORDER BY updated_at_micros DESC LIMIT 50").catch(() => []),
            ]);

            send("snapshot", {
              ts: Date.now(),
              runs,
              approvals,
              browserTasks,
              agents,
              steps,
              metrics: {
                activeRuns: (runs as Array<Record<string, unknown>>).filter((r) => r.status === "running").length,
                pendingApprovals: (approvals as unknown[]).length,
                browserTasks: (browserTasks as unknown[]).length,
                connectedAgents: (agents as unknown[]).length,
              },
            });
          } catch {
            send("error", { message: "SpacetimeDB poll failed" });
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      };

      poll();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
