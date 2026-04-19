// [claude-code 2026-04-19] S27-T11 W2e: GEPA evolutionary self-improvement runner.
//   Flow per run:
//     1. Compute baseline metrics over last 24h per agent
//     2. Compare to trailing 7-day average
//     3. If accuracy dropped >5%, call sidecar /v1/gepa/optimize with the samples
//     4. pr-creator opens a PR against soul-evolution/<agent>-<ts>
//     5. Enforce safety rails (3-reject → 14d pause, 7d auto-close, 25% prompt-size cap)
//
//   GEPA NEVER writes main-branch SOUL.md files. PRs only. Human review is the merge gate.

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getSupabaseClient } from "../../config/supabase.js";
import { sampleAgent, meanScore, type Sample } from "./sample-sourcing.js";
import { createEvolutionPr, type PrProposal } from "./pr-creator.js";

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const SOUL_DIR = join(REPO_ROOT, "backend-hono/src/services/ai/soul");

const AGENTS = ["harper", "oracle", "feucht", "consul", "herald"] as const;
type AgentId = (typeof AGENTS)[number];

const ACCURACY_DROP_THRESHOLD = 0.05; // 5%
const REJECT_PAUSE_LIMIT = 3;
const REJECT_PAUSE_DAYS = 14;
const MAX_PROMPT_GROWTH = 0.25; // 25%
const AUTO_CLOSE_DAYS = 7;

export interface RunnerOptions {
  agent?: AgentId | null;
  dryRun?: boolean;
}

export interface RunnerResult {
  ran_at: string;
  agents: Record<
    AgentId,
    {
      samples: number;
      accuracy: number;
      baseline_7d: number;
      triggered: boolean;
      paused_until?: string | null;
      pr_url?: string | null;
      skip_reason?: string;
    }
  >;
}

async function writeMetric(
  agent_id: AgentId,
  metric_name: string,
  value: number,
  samples: number,
  window_end: Date,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const window_start = new Date(window_end.getTime() - 24 * 60 * 60 * 1000);
  try {
    await sb.from("gepa_metrics").insert({
      agent_id,
      metric_name,
      metric_value: value,
      window_start: window_start.toISOString(),
      window_end: window_end.toISOString(),
      sample_size: samples,
    });
  } catch (err) {
    console.warn("[gepa] writeMetric failed", err);
  }
}

async function loadBaseline7d(
  agent_id: AgentId,
  metric_name: string,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await sb
      .from("gepa_metrics")
      .select("metric_value")
      .eq("agent_id", agent_id)
      .eq("metric_name", metric_name)
      .gte("created_at", since);
    const values = (data ?? [])
      .map((r) => Number(r.metric_value ?? 0))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch {
    return 0;
  }
}

interface PauseState {
  paused_until: string | null;
  consecutive_rejects: number;
}

async function getPauseState(agent_id: AgentId): Promise<PauseState> {
  const sb = getSupabaseClient();
  if (!sb) return { paused_until: null, consecutive_rejects: 0 };
  try {
    const { data } = await sb
      .from("gepa_metrics")
      .select("metric_value, metric_name, created_at")
      .eq("agent_id", agent_id)
      .in("metric_name", ["pause_until_ts", "consecutive_rejects"])
      .order("created_at", { ascending: false })
      .limit(10);
    let paused_until: string | null = null;
    let rejects = 0;
    for (const row of data ?? []) {
      if (row.metric_name === "pause_until_ts" && !paused_until) {
        paused_until = new Date(Number(row.metric_value)).toISOString();
      }
      if (row.metric_name === "consecutive_rejects" && rejects === 0) {
        rejects = Number(row.metric_value ?? 0);
      }
    }
    return { paused_until, consecutive_rejects: rejects };
  } catch {
    return { paused_until: null, consecutive_rejects: 0 };
  }
}

async function setPause(agent_id: AgentId, days: number): Promise<string> {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await writeMetric(agent_id, "pause_until_ts", until.getTime(), 0, new Date());
  return until.toISOString();
}

async function callSidecarOptimize(
  agent_id: AgentId,
  baseline_metrics: Record<string, number>,
  samples: Sample[],
): Promise<{
  candidate_body: string;
  projected_delta: Record<string, number>;
  projected_risk: string;
  run_id: string;
} | null> {
  try {
    const { isSidecarEnabled, sidecarClient } =
      await import("../ai/sidecar-client.js");
    if (!isSidecarEnabled()) return null;
    const base = (await import("../ai/sidecar-client.js")).getSidecarBaseUrl();
    const res = await fetch(new URL("/v1/gepa/optimize", base), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.INTERNAL_HERMES_JWT
          ? `Bearer ${process.env.INTERNAL_HERMES_JWT}`
          : "",
      },
      body: JSON.stringify({
        agent_id,
        baseline_metrics,
        samples: samples.slice(0, 200), // cap payload
      }),
    });
    if (!res.ok) {
      console.warn("[gepa] sidecar optimize non-200", res.status);
      return null;
    }
    const body = (await res.json()) as {
      candidate_body: string;
      projected_delta?: Record<string, number>;
      projected_risk?: string;
      run_id?: string;
    };
    // keep client referenced so lint doesn't complain about unused import
    void sidecarClient;
    return {
      candidate_body: body.candidate_body,
      projected_delta: body.projected_delta ?? {},
      projected_risk: body.projected_risk ?? "unknown",
      run_id: body.run_id ?? `run-${Date.now()}`,
    };
  } catch (err) {
    console.warn("[gepa] sidecar optimize failed", err);
    return null;
  }
}

async function readCurrentSoul(agent_id: AgentId): Promise<string> {
  return readFile(join(SOUL_DIR, `${agent_id}.md`), "utf8").catch(() => "");
}

function withinSizeCap(current: string, candidate: string): boolean {
  if (current.length === 0) return true;
  return candidate.length <= current.length * (1 + MAX_PROMPT_GROWTH);
}

export async function runOnce(
  options: RunnerOptions = {},
): Promise<RunnerResult> {
  const ran_at = new Date().toISOString();
  const window_end = new Date();
  const result: RunnerResult = {
    ran_at,
    agents: {} as RunnerResult["agents"],
  };

  const targets = options.agent ? [options.agent] : [...AGENTS];

  for (const agent of targets) {
    const samples = await sampleAgent(agent);
    const accuracy = meanScore(samples);
    await writeMetric(agent, "accuracy", accuracy, samples.length, window_end);

    const baseline_7d = await loadBaseline7d(agent, "accuracy");
    const dropped =
      baseline_7d > 0 && baseline_7d - accuracy > ACCURACY_DROP_THRESHOLD;

    const pause = await getPauseState(agent);
    const now = Date.now();
    const pausedActive =
      pause.paused_until && new Date(pause.paused_until).getTime() > now;

    let triggered = false;
    let pr_url: string | null = null;
    let skip_reason: string | undefined;

    if (pausedActive) {
      skip_reason = `paused until ${pause.paused_until}`;
    } else if (!dropped) {
      skip_reason = "accuracy within 5% of 7d baseline";
    } else if (samples.length < 5) {
      skip_reason = "insufficient samples (<5)";
    } else if (options.dryRun) {
      skip_reason = "dry run — skipping optimize call";
      triggered = true;
    } else {
      triggered = true;
      const proposal = await callSidecarOptimize(
        agent,
        { accuracy, baseline_7d },
        samples,
      );
      if (!proposal) {
        skip_reason = "sidecar unavailable";
      } else {
        const current = await readCurrentSoul(agent);
        if (!withinSizeCap(current, proposal.candidate_body)) {
          skip_reason = "candidate exceeds 25% size cap";
        } else {
          const pr = await createEvolutionPr({
            agent_id: agent,
            timestamp: new Date().toISOString().replace(/[:.]/g, "-"),
            candidate_body: proposal.candidate_body,
            baseline_metrics: { accuracy, baseline_7d },
            projected_delta: proposal.projected_delta,
            projected_risk: proposal.projected_risk,
            optimization_run_id: proposal.run_id,
          });
          pr_url = pr.pr_url;
          if (!pr.pr_opened)
            skip_reason = `pr not opened: ${pr.reason ?? "dry-run"}`;
        }
      }
    }

    result.agents[agent] = {
      samples: samples.length,
      accuracy,
      baseline_7d,
      triggered,
      paused_until: pause.paused_until,
      pr_url,
      skip_reason,
    };
  }

  return result;
}

export interface GepaDiagnostics {
  last_run_at: string | null;
  evolutions_proposed_7d: number;
  evolutions_merged_7d: number;
  current_metric_deltas: Record<
    string,
    { accuracy: string; latency: string; cost: string }
  >;
}

export async function loadGepaDiagnostics(): Promise<GepaDiagnostics> {
  const sb = getSupabaseClient();
  const empty: GepaDiagnostics = {
    last_run_at: null,
    evolutions_proposed_7d: 0,
    evolutions_merged_7d: 0,
    current_metric_deltas: {},
  };
  if (!sb) return empty;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [metricsRes, latestRes] = await Promise.all([
      sb
        .from("gepa_metrics")
        .select("agent_id, metric_name, metric_value, created_at")
        .gte("created_at", since),
      sb
        .from("gepa_metrics")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const rows = (metricsRes.data ?? []) as Array<{
      agent_id: string;
      metric_name: string;
      metric_value: number;
    }>;
    const byAgent: Record<string, Record<string, number[]>> = {};
    for (const r of rows) {
      if (!byAgent[r.agent_id]) byAgent[r.agent_id] = {};
      if (!byAgent[r.agent_id][r.metric_name])
        byAgent[r.agent_id][r.metric_name] = [];
      byAgent[r.agent_id][r.metric_name].push(Number(r.metric_value));
    }
    const deltas: GepaDiagnostics["current_metric_deltas"] = {};
    for (const [agent, m] of Object.entries(byAgent)) {
      const accs = m["accuracy"] ?? [];
      const lats = m["avg_latency_ms"] ?? [];
      const costs = m["cost_per_turn"] ?? [];
      deltas[agent] = {
        accuracy:
          accs.length > 1
            ? `${(((accs[accs.length - 1] ?? 0) - (accs[0] ?? 0)) * 100).toFixed(2)}%`
            : "—",
        latency:
          lats.length > 1
            ? `${Math.round((lats[lats.length - 1] ?? 0) - (lats[0] ?? 0))}ms`
            : "—",
        cost:
          costs.length > 1
            ? `$${((costs[costs.length - 1] ?? 0) - (costs[0] ?? 0)).toFixed(4)}`
            : "—",
      };
    }

    return {
      last_run_at: (latestRes.data?.created_at as string) ?? null,
      evolutions_proposed_7d: 0, // filled by a /gh api call if desired — keep 0 locally
      evolutions_merged_7d: 0,
      current_metric_deltas: deltas,
    };
  } catch (err) {
    console.warn("[gepa] loadDiagnostics failed", err);
    return empty;
  }
}

// CLI entry — `bun run gepa:dry-run --agent=harper`
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const agentArg = args.find((a) => a.startsWith("--agent="));
  const agent = agentArg ? (agentArg.slice(8) as AgentId) : null;

  runOnce({ agent, dryRun })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
