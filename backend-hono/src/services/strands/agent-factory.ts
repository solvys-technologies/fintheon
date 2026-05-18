// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// [claude-code 2026-04-23] S32-T3 Ollama fallback chain — local provider now goes through createChainModel
// [codex 2026-05-18] v6.7.3: default Strands agent routing is DeepSeek direct.
// [claude-code 2026-04-10] S8-T2: added createAgentForTask() for DAG dispatch.
// [claude-code 2026-04-08] Nous provider tries arcee trinity-large first, then qwen3.6-plus
// [claude-code 2026-04-07] Strands agent factory — VProxy, OpenRouter, or Nous Direct provider selection
// [claude-code 2026-05-07] S61-T2: Sub-agent tools wired from capability registry
import { Agent, tool, type ConversationManager } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import {
  createVProxyModel,
  checkDeepSeekDirectHealth,
  createChainModel,
  createOllamaFallbackModel,
  createDeepSeekDirectModel,
  createDeepSeekOcApiModel,
  type VProxyModelOptions,
} from "./provider.js";
import { isOllamaFallbackEnabled } from "../ai/ollama-hermes-client.js";
import { createLogger } from "../../lib/logger.js";
import type { HermesAgentId } from "../agent-bus/types.js";
import { BASE_PROMPTS } from "../ai/agent-instructions/base-prompts.js";
import { getAgentSystemPrompt } from "../ai/agent-instructions/index.js";
import { getRequiredTools } from "../capability-registry/registry.js";

const log = createLogger("StrandsFactory");

/** Provider override — which backend to route through */
// [claude-code 2026-04-26] Removed "orouter" — paid path retired per TP.
// "grok" kept as a labeled provider but it routes through Nous Research's
// inference API now too, since OpenRouter is no longer a sanctioned backend.
// [claude-code 2026-04-23] S32-T3 added "ollama-qwen" fallback chain provider
export type HarperProvider =
  | "deepseek-direct"
  | "opencode-go"
  | "deepseek-oc-api"
  | "local"
  | "ollama-qwen"
  | "nous"
  | "grok";

/** Nous fallback model chain — tried in order. Hits inference-api.nousresearch.com
 *  directly with NOUS_API_KEY. These are the actually-free Hermes models, not
 *  OpenRouter routes. */
export const NOUS_MODELS = [
  "nousresearch/hermes-4-405b",
  "nousresearch/hermes-4-70b",
];

export interface CreateAgentOptions {
  name: string;
  description?: string;
  systemPrompt: string;
  model?: VProxyModelOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
  printer?: boolean;
  conversationManager?: ConversationManager;
  /** Override the AI provider (default: DeepSeek direct) */
  provider?: HarperProvider;
  /** Override model ID when provider is 'nous' */
  nousModelId?: string;
  /** Per-user BYOK API key — overrides the server-wide env var when set. */
  userApiKey?: string | null;
}

// [claude-code 2026-04-26] OpenRouter rung removed entirely. createNousModelWithId
// now hits Nous Research's direct inference API at inference-api.nousresearch.com
// with NOUS_API_KEY — gives us the free Hermes-4 405B and 70B models without
// touching OpenRouter at all.

/** Create any model via Nous Research's direct inference API */
function createNousModelWithId(
  modelId: string,
  temperature = 0.3,
  maxTokens = 16384,
): OpenAIModel {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) throw new Error("NOUS_API_KEY not set");
  return new OpenAIModel({
    api: "chat",
    apiKey,
    clientConfig: { baseURL: "https://inference-api.nousresearch.com/v1" },
    modelId,
    temperature,
    maxTokens,
  });
}

/** Create a Strands Agent configured with the selected provider */
export function createAgent(options: CreateAgentOptions): Agent {
  const provider = options.provider ?? "deepseek-direct";
  let model: OpenAIModel;

  switch (provider) {
    case "deepseek-direct":
      log.info("Creating Strands agent (DeepSeek direct)", {
        name: options.name,
        hasUserKey: Boolean(options.userApiKey),
      });
      model = createDeepSeekDirectModel(options.model, options.userApiKey);
      break;
    case "opencode-go":
    case "deepseek-oc-api":
      log.info("Creating Strands agent (DeepSeek OC API)", {
        name: options.name,
        hasUserKey: Boolean(options.userApiKey),
      });
      model = createDeepSeekOcApiModel(options.model, options.userApiKey);
      break;
    case "nous":
      // eslint-disable-next-line no-case-declarations
      const nousId = options.nousModelId ?? NOUS_MODELS[0];
      log.info(`Creating Strands agent (Nous: ${nousId})`, {
        name: options.name,
      });
      model = createNousModelWithId(
        nousId,
        options.model?.temperature,
        options.model?.maxTokens,
      );
      break;
    case "grok":
      log.info("Creating Strands agent (Grok 4.20 via Nous/OpenRouter)", {
        name: options.name,
      });
      model = createNousModelWithId(
        "x-ai/grok-4.20",
        options.model?.temperature ?? 0.25,
        options.model?.maxTokens ?? 4096,
      );
      break;
    default:
      log.info("Creating Strands agent (VProxy local)", { name: options.name });
      model = createVProxyModel(options.model);
      break;
  }

  return new Agent({
    model,
    name: options.name,
    description: options.description,
    systemPrompt: options.systemPrompt,
    tools: options.tools,
    printer: options.printer ?? false,
    conversationManager: options.conversationManager,
  });
}

/** Check if the Strands + VProxy stack is operational */
export async function isStrandsAvailable(): Promise<boolean> {
  const deepseek = await checkDeepSeekDirectHealth();
  return deepseek.available;
}

/**
 * Create a one-shot agent for a DAG task.
 * Always uses DeepSeek direct — DAGs run during active sessions and should fail fast.
 * No conversationManager, no tools (one-shot synthesis/analysis only).
 */
export async function createAgentForTask(
  agentId: HermesAgentId,
  _dagId?: string,
): Promise<Agent> {
  switch (agentId) {
    case "oracle":
      return createAgent({
        name: "oracle",
        description:
          "Prediction markets, S&P, Crypto, macro analysis — sees across all domains",
        systemPrompt: await getAgentSystemPrompt("pma-merged"),
        model: { temperature: 0.3, maxTokens: 4096 },
        provider: "deepseek-direct",
        tools: getRequiredTools("oracle"),
      });

    case "feucht":
      return createAgent({
        name: "feucht",
        description:
          "Futures & risk — /NQ, /MNQ, /ES via TopStepX, drawdown limits, proposal validation",
        systemPrompt: await getAgentSystemPrompt("futures-desk"),
        model: { temperature: 0.25, maxTokens: 4096 },
        provider: "deepseek-direct",
        tools: getRequiredTools("feucht"),
      });

    case "consul":
      return createAgent({
        name: "consul",
        description:
          "Fundamentals desk — top 10 S&P/NDX mega-caps, earnings, guidance, fair value",
        systemPrompt: await getAgentSystemPrompt("fundamentals-desk"),
        model: { temperature: 0.3, maxTokens: 4096 },
        provider: "deepseek-direct",
        tools: getRequiredTools("consul"),
      });

    case "herald":
      return createAgent({
        name: "herald",
        description:
          "News & sentiment — headlines, social signals, AAII survey, breaking news",
        systemPrompt: await getAgentSystemPrompt("herald"),
        model: { temperature: 0.3, maxTokens: 4096 },
        provider: "deepseek-direct",
        tools: getRequiredTools("herald"),
      });

    case "harper":
      // Harper in a DAG is a synthesis/coordinator agent — no tools, no memory, local only
      return createAgent({
        name: "harper-dag",
        description:
          "DAG synthesis — consolidates multi-agent findings into a unified outlook",
        systemPrompt: await getAgentSystemPrompt("harper-cao", {}),
        model: {
          model: "deepseek-reasoner",
          temperature: 0.3,
          maxTokens: 8192,
        },
        provider: "deepseek-direct",
      });

    default: {
      const exhaustive: never = agentId;
      throw new Error(`createAgentForTask: unknown agentId "${exhaustive}"`);
    }
  }
}

export { tool } from "@strands-agents/sdk";
export { z } from "zod";
