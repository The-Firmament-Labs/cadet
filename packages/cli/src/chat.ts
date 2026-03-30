/**
 * CLI chat command — send a message to the Cadet router agent and stream the response.
 *
 * Usage:
 *   cadet chat "deploy the latest changes"
 *   cadet chat "summarize today's PRs"
 *   echo "fix the login bug" | cadet chat
 *
 * Requires:
 *   CADET_URL — The control plane URL (default: http://localhost:3001)
 *   CADET_TOKEN — An auth token (AUTH_SECRET or operator session token)
 */

export async function chatCommand(goal: string, opts: {
  url?: string;
  token?: string;
}) {
  const baseUrl = opts.url ?? process.env.CADET_URL ?? "http://localhost:3001";
  const token = opts.token ?? process.env.CADET_TOKEN ?? process.env.AUTH_SECRET;

  if (!token) {
    console.error("Error: CADET_TOKEN or AUTH_SECRET is required for CLI chat");
    process.exit(1);
  }

  if (!goal.trim()) {
    console.error("Error: Provide a message as an argument or via stdin");
    process.exit(1);
  }

  const messages = [{ id: "cli-1", role: "user", content: goal, parts: [{ type: "text", text: goal }] }];

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cadet_session=${token}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Error ${res.status}: ${body}`);
      process.exit(1);
    }

    // Stream the response to stdout
    const reader = res.body?.getReader();
    if (!reader) {
      console.error("No response body");
      process.exit(1);
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        // Parse SSE data lines for text content
        if (line.startsWith("d:")) {
          try {
            const data = JSON.parse(line.slice(2));
            if (data.type === "text" && data.value) {
              process.stdout.write(data.value);
            }
          } catch {
            // Not JSON — skip
          }
        }
      }
    }

    // Ensure newline at end
    process.stdout.write("\n");
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : "Chat request failed"}`);
    process.exit(1);
  }
}
