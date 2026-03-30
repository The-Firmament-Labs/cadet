import { verifyCronAuth, cronUnauthorized } from "@/lib/cron-auth";
import { runSandboxWatchdog } from "@/lib/sandbox";
import { apiError } from "@/lib/api-response";

async function handle(request: Request): Promise<Response> {
  const { authorized } = verifyCronAuth(request);
  if (!authorized) return cronUnauthorized();

  try {
    const report = await runSandboxWatchdog();
    return Response.json({ ok: true, action: "sandbox-watchdog", ...report });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
