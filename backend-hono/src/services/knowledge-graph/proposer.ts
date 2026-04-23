// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Weekly proposer: reads aggregated usage_intent_daily for each user, identifies
// dominant surfaces + sudden spikes, asks Harper for up to 3 concrete feature
// additions per user, writes to feature_proposals. Refuses when signal is weak.

import { getSupabaseClient } from "../../config/supabase.js";
import { llmCall } from "../ai/llm-call.js";

const LOG = "[knowledge-graph/proposer]";
const LOOKBACK_DAYS = 14;
const MIN_EVENTS_FOR_SIGNAL = 25;
const MAX_PROPOSALS_PER_USER = 3;

const PROPOSER_SYSTEM_PROMPT = `You are Harper, the CAO of Fintheon. You analyze a single user's recent usage telemetry and propose concrete feature additions that would deepen their dominant usage patterns.

INPUT shape: a list of {surface, events_last_14d, distinct_actions, trend} rows for one user, ranked by event count.

OUTPUT shape: a JSON array of up to ${MAX_PROPOSALS_PER_USER} proposals. Each proposal:
{
  "title": "short headline (<=80 chars)",
  "description": "1-2 sentence description of the feature and why it fits this user (<=300 chars)",
  "anchorSurface": "exact surface string from the input that drove the proposal"
}

Allowed feature categories:
- new data view (e.g., a new chart, table, or summary)
- new filter (refines an existing list/feed)
- new automation (e.g., a routine, alert, scheduled action)
- new card variant (a different rendering of an existing card)
- new brief section (added to MDB/ADB/PMDB/TOTT)
- new agent invocation shortcut (one-tap path to invoke an agent on something)

REFUSAL: If no surface has at least ${MIN_EVENTS_FOR_SIGNAL} events OR no surface has a clearly dominant or rising trend, respond with exactly: []
Do NOT propose generic features. Do NOT propose features for low-usage surfaces in an attempt to boost engagement. Be concrete.

Respond with ONLY the raw JSON array. No commentary, no markdown, no code fences.`;

interface UsageIntentRow {
  user_id: string;
  day: string;
  surface: string;
  events: number;
  distinct_actions: number;
}

interface SurfaceSummary {
  surface: string;
  events: number;
  distinctActions: number;
  trend: "up" | "down" | "flat";
}

interface ProposalDraft {
  title: string;
  description: string;
  anchorSurface: string;
}

interface ProposerRunResult {
  usersScanned: number;
  usersWithSignal: number;
  proposalsCreated: number;
  errors: number;
}

function summarizeUserSurfaces(
  rows: UsageIntentRow[],
  windowDays: number,
): SurfaceSummary[] {
  const halfWindow = Math.max(1, Math.floor(windowDays / 2));
  const cutoff = new Date(
    Date.now() - halfWindow * 24 * 60 * 60 * 1000,
  ).toISOString();

  const buckets = new Map<
    string,
    { recent: number; older: number; actions: number }
  >();

  for (const row of rows) {
    const b = buckets.get(row.surface) ?? { recent: 0, older: 0, actions: 0 };
    if (row.day >= cutoff) b.recent += row.events;
    else b.older += row.events;
    b.actions = Math.max(b.actions, row.distinct_actions);
    buckets.set(row.surface, b);
  }

  return Array.from(buckets.entries())
    .map(([surface, b]) => {
      const events = b.recent + b.older;
      const delta = b.recent - b.older;
      const trend: SurfaceSummary["trend"] =
        delta > Math.max(2, b.older * 0.25)
          ? "up"
          : delta < -Math.max(2, b.older * 0.25)
            ? "down"
            : "flat";
      return {
        surface,
        events,
        distinctActions: b.actions,
        trend,
      };
    })
    .sort((a, b) => b.events - a.events);
}

function hasStrongSignal(surfaces: SurfaceSummary[]): boolean {
  if (surfaces.length === 0) return false;
  const top = surfaces[0];
  if (top.events < MIN_EVENTS_FOR_SIGNAL) return false;
  const hasRising = surfaces.some((s) => s.trend === "up");
  const dominantTop =
    surfaces.length === 1 || top.events >= (surfaces[1]?.events ?? 0) * 1.6;
  return hasRising || dominantTop;
}

function parseProposalArray(raw: string): ProposalDraft[] {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ProposalDraft[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).title === "string" &&
      typeof (item as Record<string, unknown>).description === "string" &&
      typeof (item as Record<string, unknown>).anchorSurface === "string"
    ) {
      const draft = item as Record<string, string>;
      out.push({
        title: draft.title.slice(0, 200),
        description: draft.description.slice(0, 2000),
        anchorSurface: draft.anchorSurface.slice(0, 64),
      });
    }
    if (out.length >= MAX_PROPOSALS_PER_USER) break;
  }
  return out;
}

async function callHarperForProposals(
  userId: string,
  surfaces: SurfaceSummary[],
): Promise<ProposalDraft[]> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    console.warn(`${LOG} OPENROUTER_API_KEY not set; skipping LLM call`);
    return [];
  }

  const baseUrl = "https://openrouter.ai/api/v1";
  const userPayload = JSON.stringify(surfaces.slice(0, 8));

  try {
    const outcome = await llmCall<string>({
      agent: "harper",
      task: "chat",
      conversationId: `kg-proposer-${userId}`,
      userId,
      invoke: async (rule) => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.OPENROUTER_APP_URL ??
              "https://fintheon-solvys.vercel.app",
            "X-Title": process.env.OPENROUTER_APP_NAME ?? "Fintheon-AI-Gateway",
          },
          body: JSON.stringify({
            model: rule.model,
            messages: [
              { role: "system", content: PROPOSER_SYSTEM_PROMPT },
              { role: "user", content: userPayload },
            ],
            max_tokens: 1024,
            temperature: 0.4,
          }),
        });
        if (!response.ok) {
          throw new Error(`OpenRouter ${response.status}`);
        }
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          result: data.choices?.[0]?.message?.content ?? "",
          input_tokens: data.usage?.prompt_tokens,
          output_tokens: data.usage?.completion_tokens,
        };
      },
    });

    return parseProposalArray(outcome.result);
  } catch (err) {
    console.error(`${LOG} LLM call failed for user ${userId}:`, err);
    return [];
  }
}

async function findEvidenceEventIds(
  userId: string,
  surface: string,
  limit = 5,
): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data } = await sb
    .from("usage_events")
    .select("id")
    .eq("user_id", userId)
    .eq("surface", surface)
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export async function runWeeklyProposer(): Promise<ProposerRunResult> {
  const sb = getSupabaseClient();
  if (!sb) {
    console.warn(`${LOG} Supabase not configured`);
    return {
      usersScanned: 0,
      usersWithSignal: 0,
      proposalsCreated: 0,
      errors: 0,
    };
  }

  // Refresh the materialized view so the read sees today's events.
  await sb.rpc("refresh_usage_intent_daily").catch(() => {
    // Best-effort: if the RPC doesn't exist, fall through to direct read.
  });

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("usage_intent_daily")
    .select("user_id, day, surface, events, distinct_actions")
    .gte("day", since)
    .limit(50000);

  if (error) {
    console.error(`${LOG} intent select failed:`, error.message);
    return {
      usersScanned: 0,
      usersWithSignal: 0,
      proposalsCreated: 0,
      errors: 1,
    };
  }

  const byUser = new Map<string, UsageIntentRow[]>();
  for (const row of (data ?? []) as UsageIntentRow[]) {
    const arr = byUser.get(row.user_id) ?? [];
    arr.push(row);
    byUser.set(row.user_id, arr);
  }

  let usersWithSignal = 0;
  let proposalsCreated = 0;
  let errors = 0;

  for (const [userId, rows] of byUser) {
    const surfaces = summarizeUserSurfaces(rows, LOOKBACK_DAYS);
    if (!hasStrongSignal(surfaces)) continue;

    usersWithSignal += 1;
    const drafts = await callHarperForProposals(userId, surfaces);
    if (drafts.length === 0) continue;

    for (const draft of drafts) {
      const evidenceIds = await findEvidenceEventIds(
        userId,
        draft.anchorSurface,
      );
      const { error: insertErr } = await sb.from("feature_proposals").insert({
        user_id: userId,
        anchor_surface: draft.anchorSurface,
        title: draft.title,
        description: draft.description,
        evidence_event_ids: evidenceIds.length ? evidenceIds : null,
      });
      if (insertErr) {
        console.error(`${LOG} insert failed for ${userId}:`, insertErr.message);
        errors += 1;
      } else {
        proposalsCreated += 1;
      }
    }
  }

  return {
    usersScanned: byUser.size,
    usersWithSignal,
    proposalsCreated,
    errors,
  };
}
