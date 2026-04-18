// [claude-code 2026-04-18] S25-T7: 24h RiskFlow harness — four scenarios that must pass
// before shipping to users. Outputs JSONL to .test-artifacts/ and exits non-zero on failure.
//
// Usage:
//   bun scripts/riskflow-24h-harness.ts          # local (default http://localhost:8080)
//   API=https://fintheon.fly.dev bun scripts/riskflow-24h-harness.ts  # prod smoke

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = process.env.API || "http://localhost:8080";
const ARTIFACT_DIR = join(process.cwd(), ".test-artifacts");

interface ScenarioResult {
  scenario: string;
  passed: boolean;
  details: Record<string, unknown>;
  ms: number;
}

const results: ScenarioResult[] = [];

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(`[harness] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);
}

async function fetchJson<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

interface SourcesResponse {
  newsfeedHealthy: boolean;
  newsfeedDegraded: boolean;
  sources: {
    agentReach: {
      active: boolean;
      lastRunAt: string | null;
      domains: Record<string, string>;
    };
    rettiwt: {
      active: boolean;
      lastRunAt: string | null;
      rateLimited: boolean;
      poolKeys: number;
    };
    feedPoller: { active: boolean; lastRunAt: string | null };
  };
  userPollStats: Record<
    string,
    { lastSuccessAt: string | null; totalContributions: number }
  >;
}

// ── Scenario 1: Backend autonomous — Agent Reach ticks regardless of clients ──
async function scenario1(): Promise<ScenarioResult> {
  const t0 = Date.now();
  log("S1: Agent Reach autonomous heartbeat");
  const a = await fetchJson<SourcesResponse>("/api/riskflow/sources");
  const arLast = a.sources.agentReach.lastRunAt;
  if (!arLast) {
    return {
      scenario: "1_autonomous_heartbeat",
      passed: false,
      details: { reason: "agentReach has never run" },
      ms: Date.now() - t0,
    };
  }
  const age = Date.now() - new Date(arLast).getTime();
  const MAX_AGE_MS = 10 * 60_000; // must have run within 10 min
  const passed = age < MAX_AGE_MS;
  return {
    scenario: "1_autonomous_heartbeat",
    passed,
    details: {
      agentReachLastRunAt: arLast,
      ageMs: age,
      maxAllowedMs: MAX_AGE_MS,
    },
    ms: Date.now() - t0,
  };
}

// ── Scenario 2: Rettiwt rate-limited → Agent Reach carries ────────────────────
async function scenario2(): Promise<ScenarioResult> {
  const t0 = Date.now();
  log("S2: Rettiwt unavailable → Agent Reach carries");
  const a = await fetchJson<SourcesResponse>("/api/riskflow/sources");
  // Assert: even if rettiwt is inactive/rate-limited, newsfeedHealthy stays true
  const rettiwtInactive = !a.sources.rettiwt.active;
  const agentReachActive = a.sources.agentReach.active;
  const healthy = a.newsfeedHealthy;
  // Pass condition: if rettiwt is inactive, agentReach MUST cover.
  const passed = !rettiwtInactive || (agentReachActive && healthy);
  return {
    scenario: "2_rettiwt_degraded_fallthrough",
    passed,
    details: {
      rettiwtActive: a.sources.rettiwt.active,
      rettiwtPoolKeys: a.sources.rettiwt.poolKeys,
      rettiwtRateLimited: a.sources.rettiwt.rateLimited,
      agentReachActive,
      newsfeedHealthy: healthy,
    },
    ms: Date.now() - t0,
  };
}

// ── Scenario 3: Per-user attribution recorded (team card "time ago" data) ────
async function scenario3(): Promise<ScenarioResult> {
  const t0 = Date.now();
  log("S3: Per-user polling attribution populated");
  const a = await fetchJson<SourcesResponse>("/api/riskflow/sources");
  const stats = a.userPollStats;
  const entries = Object.entries(stats);
  // Pass if at least one entry (backend sentinel or real user) has lastSuccessAt
  const anyAttributed = entries.some(([, s]) => s.lastSuccessAt !== null);
  return {
    scenario: "3_per_user_attribution",
    passed: anyAttributed,
    details: {
      userCount: entries.length,
      users: Object.fromEntries(
        entries.map(([k, v]) => [
          k,
          {
            lastSuccessAt: v.lastSuccessAt,
            totalContributions: v.totalContributions,
          },
        ]),
      ),
    },
    ms: Date.now() - t0,
  };
}

// ── Scenario 4: Domain budgets report no tripped circuits ─────────────────────
async function scenario4(): Promise<ScenarioResult> {
  const t0 = Date.now();
  log("S4: Domain circuit breakers healthy");
  const a = await fetchJson<SourcesResponse>("/api/riskflow/sources");
  const domains = a.sources.agentReach.domains;
  const tripped = Object.entries(domains).filter(
    ([, status]) => status === "tripped",
  );
  const passed = tripped.length === 0;
  return {
    scenario: "4_domain_circuit_breakers",
    passed,
    details: {
      totalDomains: Object.keys(domains).length,
      tripped: tripped.map(([name]) => name),
      domainStatus: domains,
    },
    ms: Date.now() - t0,
  };
}

async function main() {
  log(`Starting against ${API}`);
  results.push(await scenario1().catch(errToResult("1_autonomous_heartbeat")));
  results.push(
    await scenario2().catch(errToResult("2_rettiwt_degraded_fallthrough")),
  );
  results.push(await scenario3().catch(errToResult("3_per_user_attribution")));
  results.push(
    await scenario4().catch(errToResult("4_domain_circuit_breakers")),
  );

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const outPath = join(ARTIFACT_DIR, `24h-${stamp}.jsonl`);
  const lines = results
    .map((r) => JSON.stringify({ ...r, timestamp: new Date().toISOString() }))
    .join("\n");
  writeFileSync(outPath, lines + "\n");

  log(`Results written to ${outPath}`);
  for (const r of results) {
    console.log(
      `  ${r.passed ? "✓" : "✗"} ${r.scenario} (${r.ms}ms) ${JSON.stringify(r.details).slice(0, 120)}`,
    );
  }
  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    console.error("\n[harness] FAILED");
    process.exit(1);
  }
  console.log("\n[harness] ALL PASSED");
}

function errToResult(scenario: string) {
  return (err: unknown): ScenarioResult => ({
    scenario,
    passed: false,
    details: { error: String(err) },
    ms: 0,
  });
}

main().catch((err) => {
  console.error("[harness] Fatal:", err);
  process.exit(1);
});
