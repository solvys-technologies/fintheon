// [claude-code 2026-04-19] S27-T10 W2e: Harper skill entry — thin wrapper delegating
// to the existing harper-handler via Smart Model Routing (T9). Zero behavior change.
import { harperChat } from "../../backend-hono/src/services/harper-handler.js";
import { handleHermesChat } from "../../backend-hono/src/services/hermes-handler.js";

export interface HarperChatArgs {
  message: string;
  conversationId: string;
  history?: { role: "user" | "assistant"; content: string }[];
  persona?: string;
  riskFlowContext?: string;
  surface?: string;
  userId?: string;
  requestId?: string;
}

export async function harper_chat(args: HarperChatArgs) {
  return harperChat({
    message: args.message,
    conversationId: args.conversationId,
    history: args.history ?? [],
    persona: args.persona,
    riskFlowContext: args.riskFlowContext,
    surface: args.surface,
    userId: args.userId,
    requestId: args.requestId,
  });
}

export interface HarperHandoffArgs {
  target: "oracle" | "feucht" | "consul" | "herald";
  question: string;
  conversationId: string;
  userId?: string;
}

const TARGET_TO_HERMES: Record<string, string> = {
  oracle: "pma-merged",
  feucht: "futures-desk",
  consul: "fundamentals-desk",
  herald: "herald",
};

export async function harper_handoff(args: HarperHandoffArgs) {
  const role = TARGET_TO_HERMES[args.target];
  if (!role) throw new Error(`Unknown handoff target: ${args.target}`);
  return handleHermesChat({
    message: args.question,
    conversationId: args.conversationId,
    userId: args.userId,
    agentOverride: role as never,
  });
}
