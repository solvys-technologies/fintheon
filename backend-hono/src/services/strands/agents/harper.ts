// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// [claude-code 2026-04-05] Harper agent — Strands-based CAO with tools + streaming + cognition telemetry
import { createAgent, type HarperProvider } from "../agent-factory.js";
import { createHarperTools } from "../harper-tools.js";
import { getAllSolvysTools } from "../skills/index.js";
import { strandsToUIStream, uiStreamToSSEResponse } from "../stream-adapter.js";
import { TextBlock, ImageBlock } from "@strands-agents/sdk";
import type { ContentBlock } from "@strands-agents/sdk";
import { withCognition } from "../telemetry.js";
import { createConversationManager } from "../memory-store.js";
import { checkDeepSeekDirectHealth } from "../provider.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { getUserApiKey } from "../../ai/api-key-crypto.js";
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
  /** Base64 data-URI images attached to the message (vision support) */
  images?: string[];
  conversationId: string;
  requestId: string;
  userId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  thinkHarder?: boolean;
  persona?: string;
  riskFlowContext?: string;
  activeConnectors?: string[];
  /** [S23-T3] Active Consilium surface — auto-enables surface-specific context injection (e.g. "aquarium"). */
  surface?: string;
  userContext?: UserContext;
  /** AI provider override: DeepSeek direct/OC API, local VProxy, or legacy fallbacks. */
  provider?: HarperProvider;
  /** Per-user OpenCode Go model choice from Hermes:Admin. */
  model?: string;
  /** When true, tool approvals block indefinitely (no 30s auto-approve) — mobile user decides */
  relayOriginated?: boolean;
}

/**
 * Create a Harper agent instance with tools bound to the request.
 * Each chat request gets its own agent + tools for correct approval gating.
 * Optionally wired to DB-backed conversation memory.
 */
export async function createHarperAgent(
  requestId: string,
  opts?: {
    conversationId?: string;
    userId?: string;
    provider?: HarperProvider;
    model?: string;
    relayOriginated?: boolean;
  },
) {
  const coreTools = createHarperTools(requestId, {
    noTimeout: opts?.relayOriginated,
    userId: opts?.userId,
  });
  const solvysTools = getAllSolvysTools();
  const systemPrompt = await getAgentSystemPrompt("harper-cao", {});

  const conversationManager =
    opts?.conversationId && opts?.userId
      ? createConversationManager(opts.conversationId, opts.userId)
      : undefined;

  // DeepSeek direct primary. If unavailable, try opencode-go. No VProxy.
  let effectiveProvider = opts?.provider;
  if (!effectiveProvider) {
    const deepseekHealth = await checkDeepSeekDirectHealth();
    if (deepseekHealth.available) {
      effectiveProvider = "deepseek-direct";
    } else {
      effectiveProvider = "opencode-go";
      log.warn("DeepSeek direct unavailable, trying opencode-go", {
        deepseekError: deepseekHealth.error,
      });
    }
  }

  return createAgent({
    name: "harper",
    description:
      "Chief Agentic Officer — coordinates PIC agent network, runs tools, manages the Fintheon platform",
    systemPrompt,
    tools: [...coreTools, ...solvysTools],
    model: {
      model: opts?.model || "deepseek-reasoner",
      temperature: 0.3,
      maxTokens: 16384,
    },
    conversationManager,
    provider: effectiveProvider,
    userApiKey:
      opts?.userId
        ? await getUserApiKey(
            opts.userId,
            effectiveProvider === "opencode-go" ||
            effectiveProvider === "deepseek-oc-api"
              ? "opencode-go"
              : "deepseek",
          )
        : undefined,
  });
}

/**
 * Stream a Harper chat response as a UIMessageStream SSE Response.
 * Drop-in replacement for the old createUIMessageStreamResponse pattern.
 */
export async function streamHarperChat(
  options: HarperChatOptions,
  responseHeaders?: Record<string, string>,
): Promise<Response> {
  const { message, requestId, conversationId, userId } = options;
  const agent = await createHarperAgent(requestId, {
    conversationId,
    userId,
    provider: options.provider,
    model: options.model,
    relayOriginated: options.relayOriginated,
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

  // [S23-T3] Aquarium awareness: when the user is on the Aquarium surface (or the connector is
  // explicitly active), inject the latest AgentDesk simulation with interpretation scaffolding so
  // Harper reads her own output as ground truth instead of treating it as debug noise.
  const aquariumActive =
    options.surface === "aquarium" ||
    !!options.activeConnectors?.includes("aquarium");
  if (aquariumActive) {
    try {
      const { buildAquariumContext } = await import("../../harper-handler.js");
      const aquariumContext = await buildAquariumContext();
      if (aquariumContext) {
        prompt = `${aquariumContext}\n\n${prompt}`;
        log.info("aquarium context injected (strands)", {
          requestId,
          surface: options.surface,
        });
      }
    } catch (err) {
      log.warn("failed to build aquarium context (non-fatal, strands)", {
        error: String(err),
      });
    }
  }

  // [claude-code 2026-04-23] Harper Vision — inject recent screen + audio context
  if (options.userId) {
    try {
      const { buildVisionContext } =
        await import("../../harper-vision/engine.js");
      const visionContext = await buildVisionContext(options.userId, {
        lookbackSeconds: 120,
      });
      if (visionContext) {
        prompt = `${visionContext}\n\n${prompt}`;
        log.info("Harper Vision context injected (strands)", { requestId });
      }
    } catch (err) {
      log.warn("failed to build Harper Vision context (non-fatal, strands)", {
        error: String(err),
      });
    }
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

  // Build agent input — multipart ContentBlock[] when images are attached, plain string otherwise
  let agentInput: string | ContentBlock[] = prompt;
  if (options.images && options.images.length > 0) {
    const blocks: ContentBlock[] = [new TextBlock(prompt)];
    for (const dataUri of options.images) {
      // Parse data URI: "data:image/png;base64,iVBOR..."
      const match = dataUri.match(
        /^data:image\/(png|jpeg|gif|webp);base64,(.+)$/,
      );
      if (match) {
        const format = match[1] as "png" | "jpeg" | "gif" | "webp";
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        blocks.push(new ImageBlock({ format, source: { bytes } }));
      }
    }
    agentInput = blocks;
    log.info("Harper vision request", {
      requestId,
      imageCount: options.images.length,
    });
  }

  const stream = strandsToUIStream(agent, agentInput, {
    messageId: `harper-${Date.now()}`,
    onFinish: async (text) => {
      cleanupCognition();
      log.info("Harper response complete", { requestId, textLen: text.length });
    },
  });

  return uiStreamToSSEResponse(stream, {
    "X-Conversation-Id": options.conversationId,
    "X-Request-Id": requestId,
    "X-Hermes-Agent": "harper",
    ...responseHeaders,
  });
}
