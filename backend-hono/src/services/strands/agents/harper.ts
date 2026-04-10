// [claude-code 2026-04-05] Harper-Opus agent — Strands-based CAO with tools + streaming + cognition telemetry
import { createAgent, type HarperProvider } from "../agent-factory.js";
import { createHarperTools } from "../harper-tools.js";
import { getAllSolvysTools } from "../skills/index.js";
import { strandsToUIStream, uiStreamToSSEResponse } from "../stream-adapter.js";
import { withCognition } from "../telemetry.js";
import { createConversationManager } from "../memory-store.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("HarperAgent");

export interface UserContext {
  traderName?: string;
  selectedSymbol?: { symbol: string; name: string };
  tradingGoals?: string;
  instrumentsTraded?: string[];
  riskSettings?: Record<string, unknown>;
}

export interface HarperChatOptions {
  message: string;
  conversationId: string;
  requestId: string;
  userId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  thinkHarder?: boolean;
  persona?: string;
  riskFlowContext?: string;
  activeConnectors?: string[];
  userContext?: UserContext;
  /** AI provider override: local (VProxy), nous (Sonnet via Nous), orouter (Opus via OpenRouter) */
  provider?: HarperProvider;
}

/**
 * Create a Harper-Opus agent instance with tools bound to the request.
 * Each chat request gets its own agent + tools for correct approval gating.
 * Optionally wired to DB-backed conversation memory.
 */
export function createHarperAgent(
  requestId: string,
  opts?: {
    conversationId?: string;
    userId?: string;
    provider?: HarperProvider;
  },
) {
  const coreTools = createHarperTools(requestId);
  const solvysTools = getAllSolvysTools();
  const systemPrompt = getAgentSystemPrompt("harper-cao", {});

  const conversationManager =
    opts?.conversationId && opts?.userId
      ? createConversationManager(opts.conversationId, opts.userId)
      : undefined;

  return createAgent({
    name: "harper-opus",
    description:
      "Chief Agentic Officer — coordinates PIC agent network, runs tools, manages the Fintheon platform",
    systemPrompt,
    tools: [...coreTools, ...solvysTools],
    model: {
      model: "claude-opus-4-6",
      temperature: 0.3,
      maxTokens: 16384,
    },
    conversationManager,
    provider: opts?.provider,
  });
}

/**
 * Stream a Harper chat response as a UIMessageStream SSE Response.
 * Drop-in replacement for the old createUIMessageStreamResponse pattern.
 */
export function streamHarperChat(
  options: HarperChatOptions,
  responseHeaders?: Record<string, string>,
): Response {
  const { message, requestId, conversationId, userId } = options;
  const agent = createHarperAgent(requestId, {
    conversationId,
    userId,
    provider: options.provider,
  });

  // Instrument agent with cognition telemetry for SSE observability
  const cleanupCognition = withCognition(agent, requestId);

  log.info("Harper chat stream", { requestId, messageLen: message.length });

  // Build the full prompt with history context
  let prompt = message;
  if (options.history && options.history.length > 0) {
    const historyBlock = options.history
      .slice(-10)
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    prompt = `[Conversation history]\n${historyBlock}\n\n[Current message]\n${message}`;
  }

  if (options.riskFlowContext) {
    prompt = `[RiskFlow Context]\n${options.riskFlowContext}\n\n${prompt}`;
  }

  // Inject user context so Harper addresses the user correctly and knows their setup
  if (options.userContext) {
    const uc = options.userContext;
    const lines: string[] = [];
    if (uc.traderName)
      lines.push(
        `The user's name/callsign is "${uc.traderName}". Always address them as ${uc.traderName}, never "TP" or "Trader".`,
      );
    if (uc.selectedSymbol)
      lines.push(
        `Active instrument: ${uc.selectedSymbol.symbol} (${uc.selectedSymbol.name})`,
      );
    if (uc.tradingGoals) lines.push(`Trading goals: ${uc.tradingGoals}`);
    if (uc.instrumentsTraded?.length)
      lines.push(`Instruments traded: ${uc.instrumentsTraded.join(", ")}`);
    if (uc.riskSettings)
      lines.push(`Risk settings: ${JSON.stringify(uc.riskSettings)}`);
    if (lines.length > 0) {
      prompt = `[User Profile]\n${lines.join("\n")}\n\n${prompt}`;
    }
  }

  const stream = strandsToUIStream(agent, prompt, {
    messageId: `harper-${Date.now()}`,
    onFinish: async (text) => {
      cleanupCognition();
      log.info("Harper response complete", { requestId, textLen: text.length });
    },
  });

  return uiStreamToSSEResponse(stream, {
    "X-Conversation-Id": options.conversationId,
    "X-Request-Id": requestId,
    "X-Hermes-Agent": "harper-opus",
    ...responseHeaders,
  });
}
