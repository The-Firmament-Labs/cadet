import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { parseSessionFromRequest } from "@/lib/auth";
import { chatTools } from "@/lib/chat-tools";
import { cloudAgentCatalog } from "@/lib/cloud-agents";
import { apiError, apiUnauthorized } from "@/lib/api-response";

const cadetAgent = cloudAgentCatalog.find((a) => a.id === "cadet")!;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  try {
    const { messages } = (await request.json()) as { messages: UIMessage[] };

    const result = streamText({
      model: cadetAgent.model,
      system: cadetAgent.system,
      messages: await convertToModelMessages(messages),
      tools: chatTools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return apiError(error, 500);
  }
}
