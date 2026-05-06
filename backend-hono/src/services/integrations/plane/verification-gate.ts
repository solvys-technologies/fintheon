// [claude-code 2026-05-06] S60-T5: Verification gate — requires frontend pass + health checks before deploy

import { createLogger } from "../../../lib/logger.js";

const log = createLogger("VerificationGate");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationInput {
  frontendPass: boolean;
  healthChecks: Record<string, boolean>;
  buildStatus?: "passed" | "failed" | "unknown";
  testResults?: { passed: number; failed: number; skipped: number };
  deployTarget?: string;
}

export interface HealthStatus {
  key: string;
  label: string;
  passed: boolean;
}

export interface VerificationResult {
  passed: boolean;
  failures: string[];
  healthStatuses: HealthStatus[];
}

// ---------------------------------------------------------------------------
// Required health check keys (empty = no required checks, everything advisory)
// ---------------------------------------------------------------------------

const REQUIRED_HEALTH_CHECKS: string[] = [
  "database",
  "supabase",
];

const HEALTH_LABELS: Record<string, string> = {
  database: "Database connectivity",
  supabase: "Supabase auth",
  ai_gateway: "AI Gateway",
  riskflow_worker: "RiskFlow Worker",
  autopilot: "Autopilot scheduler",
  plane_relay: "Plane relay",
};

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export function checkVerification(input: VerificationInput): VerificationResult {
  const failures: string[] = [];
  const healthStatuses: HealthStatus[] = [];

  if (!input.frontendPass) {
    failures.push("Frontend build/verification has not passed");
  }

  if (input.buildStatus === "failed") {
    failures.push("Backend build failed");
  }

  if (input.testResults && input.testResults.failed > 0) {
    failures.push(`Tests have ${input.testResults.failed} failures`);
  }

  for (const key of REQUIRED_HEALTH_CHECKS) {
    const passed = input.healthChecks[key] ?? false;
    healthStatuses.push({
      key,
      label: HEALTH_LABELS[key] ?? key,
      passed,
    });
    if (!passed) {
      failures.push(`Health check "${key}" failed`);
    }
  }

  // Include non-required health checks for informational purposes
  for (const [key, passed] of Object.entries(input.healthChecks)) {
    if (!REQUIRED_HEALTH_CHECKS.includes(key)) {
      healthStatuses.push({
        key,
        label: HEALTH_LABELS[key] ?? key,
        passed,
      });
    }
  }

  const passed = failures.length === 0;

  if (!passed) {
    log.warn("verification gate failed", { failures });
  } else {
    log.info("verification gate passed", { checks: healthStatuses.length });
  }

  return { passed, failures, healthStatuses };
}

// ---------------------------------------------------------------------------
// Quick check: can we deploy?
// ---------------------------------------------------------------------------

let cachedVerification: VerificationResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export function setVerificationResult(result: VerificationResult): void {
  cachedVerification = result;
  cacheTimestamp = Date.now();
}

export function getVerificationResult(): VerificationResult | null {
  if (
    cachedVerification &&
    Date.now() - cacheTimestamp < CACHE_TTL_MS
  ) {
    return cachedVerification;
  }
  return null;
}

export function isVerificationPassed(): boolean {
  const result = getVerificationResult();
  return result !== null && result.passed;
}
