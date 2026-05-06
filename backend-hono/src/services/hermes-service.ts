// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// [claude-code 2026-03-28] S9-T4: Switch boardroom agents to Grok 4.20 Fast, Harper stays Claude Opus
// [claude-code 2026-03-14] Hermes inference via OpenRouter (Nous) + Claude Opus 4.6
/**
 * Hermes Service
 * Agentic backend layer for Priced In Capital (P.I.C.)
 * Orchestrates AI agents: Harper (CAO), Oracle (All-Seer), Feucht (Futures & Risk), Consul (Fundamentals), Herald (News)
 *
 * Architecture: HERMES AGENT → FINTHEON UI → H.E's (Human Executives)
 * Inference: OpenRouter (Nous subscription) + Claude Opus 4.6
 */

// [claude-code 2026-04-05] Strands Phase 8: Removed @ai-sdk/openai import — types/interfaces kept for consumers
import type { AiProviderType, AiRequestCost } from "../types/ai-types.js";

// [claude-code 2026-03-16] Agent roster v7.9: merged PMA, added Herald
// P.I.C. Agent Hierarchy
export type HermesAgentRole =
  | "harper-cao" // Chief Agentic Officer - Executive level
  | "pma-merged" // Oracle: All-Seer (merged PMA-1 + PMA-2)
  | "futures-desk" // Feucht: Futures, Execution & Risk
  | "fundamentals-desk" // Consul: Tech Mega-Cap Analyst
  | "herald"; // Herald: News & Sentiment

export type HermesAgentStatus =
  | "operational"
  | "monitoring"
  | "awaiting-approval"
  | "hedging"
  | "standby"
  | "offline";

export interface HermesAgent {
  id: string;
  role: HermesAgentRole;
  displayName: string;
  status: HermesAgentStatus;
  lastCheckin: Date;
  scope: string;
  reportsTo: HermesAgentRole | "human-executives";
}

export interface HermesTradeProposal {
  id: string;
  sourceAgent: HermesAgentRole;
  symbol: string;
  direction: "long" | "short";
  instrument: "futures" | "prediction-market";
  platform: "topstep" | "kalshi";
  entry: number;
  stop: number;
  target: number;
  rationale: string;
  conviction: "high" | "medium" | "low";
  riskReward: number;
  strategy: string;
  timestamp: Date;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  approvedBy?: string;
  approvedAt?: Date;
}

export interface HermesAlert {
  id: string;
  type:
    | "session-open"
    | "off-schedule-event"
    | "hot-print"
    | "black-swan"
    | "risk-warning";
  sourceAgent: HermesAgentRole;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  symbols?: string[];
  timestamp: Date;
  acknowledged: boolean;
}

export interface HermesDailyReport {
  id: string;
  date: string;
  pnl: number;
  trades: HermesTradeProposal[];
  bias: "bullish" | "bearish" | "neutral" | "selective";
  mdbReport: string; // Morning Daily Brief report
  timestamp: Date;
}

export interface HermesClientConfig {
  apiKey: string;
  baseUrl?: string;
  appName?: string;
}

// Agent definitions following P.I.C. hierarchy (v7.9)
const HERMES_AGENTS: Record<
  HermesAgentRole,
  Omit<HermesAgent, "id" | "lastCheckin" | "status">
> = {
  "harper-cao": {
    role: "harper-cao",
    displayName: "Harper / CAO",
    scope: "Macro oversight, approvals, trade consolidation",
    reportsTo: "human-executives",
  },
  "pma-merged": {
    role: "pma-merged",
    displayName: "Oracle (All-Seer)",
    scope:
      "Prediction markets (S&P, Crypto, Econ, Political) + execution oversight",
    reportsTo: "harper-cao",
  },
  "futures-desk": {
    role: "futures-desk",
    displayName: "Feucht (Futures & Risk)",
    scope: "/NQ, /MNQ, /ES trading via TopStepX + risk management",
    reportsTo: "harper-cao",
  },
  "fundamentals-desk": {
    role: "fundamentals-desk",
    displayName: "Consul (Fundamentals)",
    scope: "Top 10 S&P/NDX tech watchlist + mega-cap analysis",
    reportsTo: "harper-cao",
  },
  herald: {
    role: "herald",
    displayName: "Herald (News & Sentiment)",
    scope: "News sentiment, social signals, headline impact",
    reportsTo: "harper-cao",
  },
};

// [claude-code 2026-04-29] DeepSeek migration — every Hermes-routed sub-agent
// task now uses `deepseek-reasoner` (DeepSeek's thinking model) via DeepSeek's
// OpenAI-compatible API. Harper-cao keeps its Claude-Opus path; Arbitrum seats
// route through the new 'deepseek' provider. Local Ollama still works as a
// fallback when DEEPSEEK_API_KEY is unset (the ollama-hermes-client honours
// OLLAMA_BASE_URL).
export const HERMES_TASK_MODEL_MAP: Record<string, string> = {
  "harper-cao": "deepseek-reasoner",
  "cao-approval": "deepseek-reasoner",
  "cao-consolidation": "deepseek-reasoner",
  "pma-merged": "deepseek-reasoner",
  "prediction-market": "deepseek-reasoner",
  "futures-desk": "deepseek-reasoner",
  "fa-rippers": "deepseek-reasoner",
  "economic-analysis": "deepseek-reasoner",
  "fundamentals-desk": "deepseek-reasoner",
  "earnings-analysis": "deepseek-reasoner",
  "tech-mega-cap": "deepseek-reasoner",
  herald: "deepseek-reasoner",
  "arbitrum-seat-lead": "deepseek-reasoner",
  "arbitrum-seat-forecaster": "deepseek-reasoner",
  "arbitrum-seat-risk": "deepseek-reasoner",
  "arbitrum-seat-quant": "deepseek-reasoner",
  "arbitrum-seat-bear": "deepseek-reasoner",
};

// [claude-code 2026-04-29] Provider-routing abstraction. 'deepseek' is the
// primary path for all Hermes sub-agent tasks. 'ollama' stays available for
// local Ollama models (e.g. dev mode without an internet key). Any unmapped
// model defaults to 'openrouter' — preserving harper-cao's Opus path verbatim.
export type ArbitrumProvider =
  | "deepseek-direct"
  | "deepseek-oc-api"
  | "ollama"
  | "groq"
  | "openrouter";

const ARBITRUM_MODEL_PROVIDER_MAP: Record<string, ArbitrumProvider> = {
  "deepseek-reasoner": "deepseek-direct",
  "deepseek-chat": "deepseek-direct",
  "qwen3.5:397b-cloud": "ollama",
};

export function resolveProvider(modelId: string): ArbitrumProvider {
  return ARBITRUM_MODEL_PROVIDER_MAP[modelId] ?? "openrouter";
}

/**
 * Build headers for OpenRouter API calls
 */
export const buildHermesHeaders = (config?: {
  appName?: string;
}): Record<string, string> => {
  const appName =
    config?.appName ?? process.env.HERMES_APP_NAME ?? "Fintheon-PIC-Hermes";

  return {
    "X-Hermes-App": appName,
    "Content-Type": "application/json",
  };
};

/**
 * Check if Hermes / Strands is available
 * Now checks VProxy via Strands provider instead of OpenRouter API key.
 */
export const isHermesAvailable = (): boolean => {
  // VProxy is always configured locally — return true if env isn't explicitly disabled
  return process.env.USE_VPROXY_ANTHROPIC !== "false";
};

/**
 * Get agent definition by role
 */
export const getAgentDefinition = (
  role: HermesAgentRole,
): Omit<HermesAgent, "id" | "lastCheckin" | "status"> => {
  return HERMES_AGENTS[role];
};

/**
 * Get all agent definitions
 */
export const getAllAgentDefinitions = (): typeof HERMES_AGENTS => {
  return HERMES_AGENTS;
};

/**
 * Get the recommended model for a task
 */
export const getModelForTask = (task: string): string | undefined => {
  const normalizedTask = task.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return HERMES_TASK_MODEL_MAP[normalizedTask];
};

/**
 * Map agent role to AI task type for model selection
 */
export const agentRoleToTaskType = (role: HermesAgentRole): string => {
  switch (role) {
    case "harper-cao":
      return "reasoning";
    case "pma-merged":
      return "prediction-market";
    case "herald":
      return "news-sentiment";
    case "futures-desk":
      return "technical";
    case "fundamentals-desk":
      return "research";
    default:
      return "general";
  }
};

/**
 * Calculate cost from token usage (OpenRouter Opus 4.6 pricing)
 */
export const calculateHermesCost = (
  usage: { inputTokens?: number; outputTokens?: number },
  model: string,
): AiRequestCost => {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  const pricing: Record<string, { input: number; output: number }> = {
    "anthropic/claude-opus-4.6": { input: 0.005, output: 0.025 },
    "deepseek-reasoner": { input: 0.0005, output: 0.00219 },
    "xai/grok-4-fast": { input: 0.002, output: 0.01 },
  };

  const modelPricing = pricing[model] ?? pricing["deepseek-reasoner"];

  const inputCostUsd = (inputTokens / 1000) * modelPricing.input;
  const outputCostUsd = (outputTokens / 1000) * modelPricing.output;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return {
    provider: "hermes" as AiProviderType,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Check if an error is a rate limit error
 */
export const isHermesRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const status =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode;
  if (status === 429) return true;

  const message =
    "message" in error ? String((error as { message?: string }).message) : "";
  return (
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("too many requests")
  );
};

/**
 * Check if an error is retryable
 */
export const isHermesRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  if (isHermesRateLimitError(error)) return true;

  const status =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode ??
    null;

  if (status && [408, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message =
    "message" in error
      ? String((error as { message?: string }).message).toLowerCase()
      : "";
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("connection")
  );
};

/**
 * P.I.C. Trading Rules validation
 * Validates proposals against the 13 Commandments
 */
export const validateTradeProposal = (
  proposal: Partial<HermesTradeProposal>,
): {
  valid: boolean;
  violations: string[];
} => {
  const violations: string[] = [];

  // Rule 3: No "shot in the dark" trades — conviction required
  if (!proposal.conviction || proposal.conviction === "low") {
    violations.push(
      'Rule 3: No "shot in the dark" trades - conviction must be medium or high',
    );
  }

  // Rule 8: Good traders buy from good prices
  if (proposal.riskReward && proposal.riskReward < 2) {
    violations.push(
      "Rule 8: Risk/reward must be at least 2:1 for good trade entries",
    );
  }

  // Check stop is defined (Rule 12: Be right or be right out)
  if (!proposal.stop) {
    violations.push("Rule 12: Stop loss must be defined - no painful endings");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Hermes model IDs used by P.I.C.
 * CAO uses Claude Opus 4.6 (CLI bridge), sub-agents use Grok 4.20 Fast
 */
export const HERMES_MODELS = {
  CAO_REASONING: "deepseek-reasoner",
  FAST_ANALYSIS: "deepseek-reasoner",
  NEWS_REALTIME: "deepseek-reasoner",
  RESEARCH: "deepseek-reasoner",
} as const;

export type HermesModelId = (typeof HERMES_MODELS)[keyof typeof HERMES_MODELS];
