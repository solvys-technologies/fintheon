// [claude-code 2026-04-26] S35-T12: OpenRouter dropped per TP — no paid APIs.
// Active providers are all free: VProxy (claude-local), Hermes sidecar
// (Qwen3.5:397b-cloud via ollama-hermes), Nous Research direct (nous-direct).
// [claude-code 2026-04-23] Rollback: drop GitHub-backed inference provider type
/**
 * Shared AI types for multi-provider architecture
 * Free chain: VProxy (Claude Code subscription) → Ollama Cloud via Hermes →
 * Nous Research (Hermes-4 405B).
 */

// Provider type discriminator
export type AiProviderType =
  | "vercel-gateway"
  | "hermes"
  | "claude-local"
  | "nous-direct"
  // [claude-code 2026-04-23] S32-T3 Ollama fallback chain provider identifier
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
