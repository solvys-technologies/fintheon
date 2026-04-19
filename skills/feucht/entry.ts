// [claude-code 2026-04-19] S27-T10: Feucht skill entry.
import { handleHermesChat } from "../../backend-hono/src/services/hermes-handler.js";

export async function feucht_chat(args: {
  message: string;
  conversationId: string;
  userId?: string;
}) {
  return handleHermesChat({
    message: args.message,
    conversationId: args.conversationId,
    userId: args.userId,
    agentOverride: "futures-desk" as never,
  });
}
