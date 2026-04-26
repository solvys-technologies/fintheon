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

// [claude-code 2026-04-26] S35-T12: Every Hermes-routed agent — INCLUDING
// harper-cao + cao-approval + cao-consolidation — now resolves to
// qwen3.5:397b-cloud via Ollama Cloud. OpenRouter is no longer in the
// resolution path. The legacy Claude-Opus OpenRouter rung was retired per
// TP: "There shouldn't be any openrouter instances. They should all route
// thru the ollama cloud provider via hermes."
export const HERMES_TASK_MODEL_MAP: Record<string, string> = {
  "harper-cao": "qwen3.5:397b-cloud",
  "cao-approval": "qwen3.5:397b-cloud",
  "cao-consolidation": "qwen3.5:397b-cloud",
  "pma-merged": "qwen3.5:397b-cloud",
  "prediction-market": "qwen3.5:397b-cloud",
  "futures-desk": "qwen3.5:397b-cloud",
  "fa-rippers": "qwen3.5:397b-cloud",
  "economic-analysis": "qwen3.5:397b-cloud",
  "fundamentals-desk": "qwen3.5:397b-cloud",
  "earnings-analysis": "qwen3.5:397b-cloud",
  "tech-mega-cap": "qwen3.5:397b-cloud",
  herald: "qwen3.5:397b-cloud",
  "arbitrum-seat-lead": "qwen3.5:397b-cloud",
  "arbitrum-seat-forecaster": "qwen3.5:397b-cloud",
  "arbitrum-seat-risk": "qwen3.5:397b-cloud",
  "arbitrum-seat-quant": "qwen3.5:397b-cloud",
  "arbitrum-seat-bear": "qwen3.5:397b-cloud",
};

// [claude-code 2026-04-26] S35-T12: Provider-routing abstraction collapsed
// to ollama-only at the Hermes/Arbitrum layer. Groq retained as an explicit
// alternate that callers can pin via ARBITRUM_MODEL_PROVIDER_MAP if needed.
export type ArbitrumProvider = "ollama" | "groq";

const ARBITRUM_MODEL_PROVIDER_MAP: Record<string, ArbitrumProvider> = {
  "qwen3.5:397b-cloud": "ollama",
};

export function resolveProvider(modelId: string): ArbitrumProvider {
  return ARBITRUM_MODEL_PROVIDER_MAP[modelId] ?? "ollama";
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
    "xai/grok-4-fast": { input: 0.002, output: 0.01 },
  };

  const modelPricing = pricing[model] ?? { input: 0.002, output: 0.01 };

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
  CAO_REASONING: "anthropic/claude-opus-4.6",
  FAST_ANALYSIS: "xai/grok-4-fast",
  NEWS_REALTIME: "xai/grok-4-fast",
  RESEARCH: "xai/grok-4-fast",
} as const;

export type HermesModelId = (typeof HERMES_MODELS)[keyof typeof HERMES_MODELS];
