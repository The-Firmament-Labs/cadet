export async function detectLocalControlPlane(): Promise<{
  reachable: boolean;
  url: string;
  agents?: Array<{ id: string; name: string; status: string }>;
}> {
  const url = "http://localhost:3010";
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!res.ok) return { reachable: false, url };

    // Try to get agent list
    const agentRes = await fetch(`${url}/agents`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    const agents = agentRes.ok ? await agentRes.json() : [];
    return { reachable: true, url, agents };
  } catch {
    return { reachable: false, url };
  }
}
