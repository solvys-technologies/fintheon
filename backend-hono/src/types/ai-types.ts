// [claude-code 2026-04-23] Rollback: drop GitHub-backed inference provider type
// [claude-code 2026-03-14] Default: OpenRouter (Nous) + Opus 4.6
/**
 * Shared AI types for multi-provider architecture
 * OpenRouter (Nous subscription) + Claude Opus 4.6 primary
 * Hermes integration for P.I.C. agentic backend (OpenRouter Opus 4.6)
 */

// Provider type discriminator
export type AiProviderType =
  | "deepseek-direct"
  | "opencode-go"
  | "vercel-gateway"
  | "hermes"
  | "claude-local"
  | "nous-direct"
  | "ollama-hermes";

// Circuit breaker states
export type CircuitState = "closed" | "open" | "half-open";

// Provider health tracking
export interface ProviderHealthStatus {
  provider: AiProviderType;
  isHealthy: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  circuitState: CircuitState;
  circuitOpenedAt: string | null;
}

// Provider-level configuration
export interface ProviderConfig {
  type: AiProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  priority: number;
  enabled: boolean;
  headers?: Record<string, string>;
}

// Cost tracking per request
export interface AiRequestCost {
  provider: AiProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  timestamp: string;
}

// Aggregated cost stats
export interface AiCostStats {
  provider: AiProviderType;
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  periodStart: string;
  periodEnd: string;
}

// Cross-provider fallback mapping
export interface CrossProviderFallback {
  from: string; // model key
  to: string; // fallback model key
  provider: AiProviderType; // target provider
}

// OpenRouter-specific response metadata
export interface OpenRouterMetadata {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  // Cost from OpenRouter headers
  cost?: number;
  // Rate limit info
  rateLimit?: {
    remaining?: number;
    reset?: number;
  };
}

// Model selection context
export interface ModelSelectionContext {
  preferredModel?: string;
  taskType?: string;
  messageCount?: number;
  inputChars?: number;
  requiresReasoning?: boolean;
  requiresSpeed?: boolean;
  maxBudgetUsd?: number;
}

// Model selection result with provider info
export interface ModelSelectionResult {
  model: string;
  provider: AiProviderType;
  reason: string;
  fallbackChain: string[];
}

// Request telemetry
export interface AiRequestTelemetry {
  requestId: string;
  provider: AiProviderType;
  model: string;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  status: "pending" | "success" | "error" | "fallback";
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costUsd?: number;
  fallbackUsed?: boolean;
  fallbackFrom?: string;
}

// Provider metrics
export interface ProviderMetrics {
  provider: AiProviderType;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalCostUsd: number;
  errorRate: number;
  lastUpdated: string;
}
