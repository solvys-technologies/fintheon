// [claude-code 2026-04-19] S27-T10: Oracle skill entry — routes through hermes-handler
// with agentOverride=pma-merged. Model is selected by Smart Model Routing (T9).
import { handleHermesChat } from "../../backend-hono/src/services/hermes-handler.js";

export async function oracle_chat(args: {
  message: string;
  conversationId: string;
  userId?: string;
}) {
  return handleHermesChat({
    message: args.message,
    conversationId: args.conversationId,
    userId: args.userId,
    agentOverride: "pma-merged" as never,
  });
}
