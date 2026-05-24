// [codex 2026-05-23] Default inference provider config after local gateway cleanup.
// [claude-code 2026-03-14] Default inference provider config.
import priceSystemPrompt from "../prompts/price-system-prompt.js";
import type {
  AiProviderType,
  CrossProviderFallback,
} from "../types/ai-types.js";

type Env = Record<string, string | undefined>;

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env;
  return env?.[key];
};

// Model keys
export type AiModelKey =
  | "sonnet"
  | "deepseek-direct"
  | "opencode-go"
  | "hermes-cao"
  | "hermes-research"
  | "hermes-fast"
  | "hermes-realtime"
  | "claude-local"
  | "nous-direct";

export type AiProvider = "openai-compatible";

export interface AiModelConfig {
  id: string;
  displayName: string;
  provider: AiProvider;
  providerType: AiProviderType;
  apiKeyEnv: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  costPer1kInputUsd: number;
  costPer1kOutputUsd: number;
  contextWindow?: number;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
}

export interface AiRoutingConfig {
  defaultModel: AiModelKey;
  taskModelMap: Record<string, AiModelKey>;
  fallbackMap: Record<AiModelKey, AiModelKey>;
  crossProviderFallbacks: CrossProviderFallback[];
}

export interface AiProviderSettings {
  primary: AiProviderType;
  enableFallback: boolean;
  vercelGateway: {
    baseUrl: string;
  };
  deepseek: {
    baseUrl: string;
  };
  opencodeGo: {
    baseUrl: string;
  };
}

export interface AiConversationConfig {
  maxHistoryMessages: number;
  maxContextTokens: number;
  summarizationThreshold: number;
}

export interface AiPerformanceConfig {
  slowResponseMs: number;
}

export interface AiConfig {
  models: Record<AiModelKey, AiModelConfig>;
  routing: AiRoutingConfig;
  providers: AiProviderSettings;
  conversation: AiConversationConfig;
  performance: AiPerformanceConfig;
  systemPrompt?: string;
}

// Provider base URLs
const vercelGatewayBaseUrl =
  getEnv("VERCEL_AI_GATEWAY_BASE_URL") ??
  "https://ai-gateway.vercel.sh/v1/chat/completions";

const DEEPSEEK_BASE_URL = "https://deepseek-direct.ai/api/v1";

const normalizeHermesBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
};

const getHermesOpenAIBaseUrl = (): string => {
  const base = normalizeHermesBaseUrl(
    getEnv("HERMES_BASE_URL") ??
      getEnv("HERMES_API_URL") ??
      "https://api.deepseek.com",
  );
  return `${base}/v1`;
};

// Model aliases for backward compatibility
const modelAliases: Record<string, AiModelKey> = {
  // Vercel Gateway models
  sonnet: "sonnet",
  "claude-sonnet": "sonnet",
  "sonnet-4.5": "sonnet",
  opus: "sonnet",
  grok: "opencode-go",
  "grok-4.1": "opencode-go",
  general: "opencode-go",
  groq: "deepseek-direct",
  "llama-3.3-70b": "deepseek-direct",
  haiku: "deepseek-direct",
  tech: "deepseek-direct",
  "deepseek-direct": "deepseek-direct",
  "opencode-go": "opencode-go",
  "oc-go": "opencode-go",
  "llama-70b": "deepseek-direct",
  "grok-4.20": "deepseek-direct",
  "grok-420": "deepseek-direct",
  // Hermes P.I.C. agent routes
  "hermes-cao": "deepseek-direct",
  harper: "deepseek-direct",
  cao: "deepseek-direct",
  "hermes-research": "deepseek-direct",
  "pic-research": "deepseek-direct",
  "hermes-fast": "deepseek-direct",
  "pic-fast": "deepseek-direct",
  "hermes-realtime": "deepseek-direct",
  "pic-realtime": "deepseek-direct",
  pma: "deepseek-direct",
  // Claude Code SDK Bridge (Max subscription)
  "claude-local": "claude-local",
  "claude-sdk": "claude-local",
  "claude-max": "claude-local",
  "opus-local": "claude-local",
  // Nous Direct (fallback)
  "nous-direct": "nous-direct",
  nous: "nous-direct",
  "hermes-direct": "nous-direct",
  "nous-fallback": "nous-direct",
};

export const resolveModelKey = (value?: string): AiModelKey | undefined => {
  if (!value) return undefined;
  return modelAliases[value.toLowerCase()];
};

// Determine primary provider from env
const getPrimaryProvider = (): AiProviderType => {
  const envValue = getEnv("AI_PRIMARY_PROVIDER");
  if (envValue === "vercel-gateway") return "vercel-gateway";
  if (envValue === "deepseek-direct") return "deepseek-direct";
  if (envValue === "hermes") return "hermes";
  return "deepseek-direct";
};

const enableProviderFallback =
  getEnv("AI_ENABLE_PROVIDER_FALLBACK") !== "false";

// Default: deepseek-direct primary
const defaultModel =
  resolveModelKey(getEnv("AI_DEFAULT_MODEL")) ??
  ("deepseek-direct" as AiModelKey);

export const defaultAiConfig: AiConfig = {
  models: {
    // Vercel Gateway models (existing)
    sonnet: {
      id: "anthropic/claude-sonnet-4.5",
      displayName: "Claude Sonnet 4.5",
      provider: "openai-compatible",
      providerType: "vercel-gateway",
      apiKeyEnv: "VERCEL_AI_GATEWAY_API_KEY",
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true,
    },
    // DeepSeek v4 Pro — primary inference
    "deepseek-direct": {
      id: "deepseek-reasoner",
      displayName: "DeepSeek v4 Pro",
      provider: "openai-compatible",
      providerType: "deepseek-direct",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      baseUrl: DEEPSEEK_BASE_URL,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    // OpenCode Go — self-hosted fallback
    "opencode-go": {
      id: "deepseek-reasoner",
      displayName: "OpenCode Go",
      provider: "openai-compatible",
      providerType: "opencode-go",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
      baseUrl: getHermesOpenAIBaseUrl(),
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    // Hermes agent keys
    "hermes-cao": {
      id: "deepseek-reasoner",
      displayName: "DeepSeek v4 Pro (CAO)",
      provider: "openai-compatible",
      providerType: "deepseek-direct",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      baseUrl: DEEPSEEK_BASE_URL,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    "hermes-research": {
      id: "deepseek-reasoner",
      displayName: "DeepSeek v4 Pro (Research)",
      provider: "openai-compatible",
      providerType: "deepseek-direct",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      baseUrl: DEEPSEEK_BASE_URL,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    "hermes-fast": {
      id: "deepseek-reasoner",
      displayName: "DeepSeek v4 Pro (Fast)",
      provider: "openai-compatible",
      providerType: "deepseek-direct",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      baseUrl: DEEPSEEK_BASE_URL,
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    "hermes-realtime": {
      id: "deepseek-reasoner",
      displayName: "DeepSeek v4 Pro (Realtime)",
      provider: "openai-compatible",
      providerType: "deepseek-direct",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      baseUrl: DEEPSEEK_BASE_URL,
      temperature: 0.3,
      maxTokens: 4086,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },
    // Nous Research direct inference fallback.
    "nous-direct": {
      id: "nousresearch/hermes-4-405b",
      displayName: "Hermes 4 405B (Nous Direct)",
      provider: "openai-compatible",
      providerType: "nous-direct",
      apiKeyEnv: "NOUS_API_KEY",
      baseUrl: "https://inference-api.nousresearch.com/v1",
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 60_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false,
    },

    // Claude Code SDK Bridge (free via Max subscription — $0 per-token cost)
    // [claude-code 2026-03-10] Local CLI bridge using claude --print --output-format stream-json
    "claude-local": {
      id: "claude-opus-4-6",
      displayName: "Claude Opus (Local SDK)",
      provider: "openai-compatible",
      providerType: "claude-local",
      apiKeyEnv: "", // No API key needed — uses Max subscription via CLI
      temperature: 0.4,
      maxTokens: 16384,
      timeoutMs: 120_000,
      costPer1kInputUsd: 0,
      costPer1kOutputUsd: 0,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true,
    },
  },

  routing: {
    defaultModel,
    taskModelMap: {
      // All tasks through Hermes-compatible providers.
      analysis: "deepseek-direct",
      research: "deepseek-direct",
      reasoning: "deepseek-direct",
      technical: "deepseek-direct",
      "quick-fintheon": "deepseek-direct",
      quickfintheon: "deepseek-direct",
      news: "deepseek-direct",
      sentiment: "deepseek-direct",
      chat: "deepseek-direct",
      general: "deepseek-direct",
      "harper-cao": "deepseek-direct",
      "cao-approval": "deepseek-direct",
      "cao-consolidation": "deepseek-direct",
      "pma-merged": "deepseek-direct",
      herald: "deepseek-direct",
      "prediction-market": "deepseek-direct",
      "futures-desk": "deepseek-direct",
      "fa-rippers": "deepseek-direct",
      "economic-analysis": "deepseek-direct",
      "fundamentals-desk": "deepseek-direct",
      "earnings-analysis": "deepseek-direct",
      "tech-mega-cap": "deepseek-direct",
    },
    fallbackMap: {
      sonnet: "deepseek-direct",
      "deepseek-direct": "nous-direct",
      "opencode-go": "opencode-go",
      // Hermes fallbacks.
      "hermes-cao": "deepseek-direct",
      "hermes-research": "deepseek-direct",
      "hermes-fast": "deepseek-direct",
      "hermes-realtime": "deepseek-direct",
      // Claude Local SDK fallback.
      "claude-local": "deepseek-direct",
      // Nous Direct is terminal — no further fallback
      "nous-direct": "deepseek-direct",
    },
    crossProviderFallbacks: [],
  },

  providers: {
    primary: getPrimaryProvider(),
    enableFallback: enableProviderFallback,
    vercelGateway: {
      baseUrl: vercelGatewayBaseUrl,
    },
    deepseek: {
      baseUrl: DEEPSEEK_BASE_URL,
    },
    opencodeGo: {
      baseUrl: getHermesOpenAIBaseUrl(),
    },
  },

  conversation: {
    maxHistoryMessages: Number.parseInt(
      getEnv("AI_MAX_HISTORY_MESSAGES") ?? "50",
      10,
    ),
    maxContextTokens: Number.parseInt(
      getEnv("AI_MAX_CONTEXT_TOKENS") ?? "100000",
      10,
    ),
    summarizationThreshold: Number.parseInt(
      getEnv("AI_SUMMARIZATION_THRESHOLD") ?? "80000",
      10,
    ),
  },

  performance: {
    slowResponseMs: Number.parseInt(
      getEnv("AI_SLOW_RESPONSE_MS") ?? "3000",
      10,
    ),
  },

  systemPrompt: priceSystemPrompt,
};

// Hermes agent keys.
export const isHermesModel = (modelKey: AiModelKey): boolean => {
  return modelKey.startsWith("hermes-");
};

// Helper to check if a model uses Claude Local SDK bridge
export const isClaudeLocalModel = (modelKey: AiModelKey): boolean => {
  return modelKey === "claude-local";
};

// Helper to check if a model uses Nous Research direct inference
export const isNousDirectModel = (modelKey: AiModelKey): boolean => {
  return modelKey === "nous-direct";
};

// Get the model ID for Hermes agent keys.
export const getHermesModelId = (modelKey: AiModelKey): string => {
  const config = defaultAiConfig.models[modelKey];
  return config?.id ?? "anthropic/claude-opus-4.6";
};

// Helper to get equivalent model across providers
export const getCrossProviderEquivalent = (
  modelKey: AiModelKey,
  config: AiConfig = defaultAiConfig,
): { model: AiModelKey; provider: AiProviderType } | null => {
  const fallback = config.routing.crossProviderFallbacks.find(
    (f) => f.from === modelKey,
  );
  if (fallback) {
    return { model: fallback.to as AiModelKey, provider: fallback.provider };
  }
  return null;
};

// Get all models for a specific provider
export const getModelsByProvider = (
  providerType: AiProviderType,
  config: AiConfig = defaultAiConfig,
): AiModelKey[] => {
  return (Object.keys(config.models) as AiModelKey[]).filter(
    (key) => config.models[key].providerType === providerType,
  );
};
