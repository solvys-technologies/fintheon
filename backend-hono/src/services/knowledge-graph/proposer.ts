// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Weekly proposer orchestrator: reads recent usage_events, summarizes per-user
// surface activity, asks Harper for proposals (see ./llm.ts), writes accepted
// drafts to feature_proposals. Refuses gracefully when signal is weak.

import { getSupabaseClient } from "../../config/supabase.js";
import {
  callHarperForProposals,
  MIN_EVENTS_FOR_SIGNAL,
  type SurfaceSummary,
} from "./llm.js";

const LOG = "[knowledge-graph/proposer]";
const LOOKBACK_DAYS = 14;
const EVIDENCE_LIMIT = 5;

interface ProposerRunResult {
  usersScanned: number;
  usersWithSignal: number;
  proposalsCreated: number;
  errors: number;
}

interface RawEvent {
  user_id: string;
  ts: string;
  surface: string;
  action: string;
}

interface SurfaceBucket {
  recent: number;
  older: number;
  actions: Set<string>;
}

function summarizeUserSurfaces(
  events: RawEvent[],
  windowDays: number,
): SurfaceSummary[] {
  const halfWindow = Math.max(1, Math.floor(windowDays / 2));
  const cutoff = new Date(
    Date.now() - halfWindow * 24 * 60 * 60 * 1000,
  ).toISOString();

  const buckets = new Map<string, SurfaceBucket>();
  for (const ev of events) {
    const b = buckets.get(ev.surface) ?? {
      recent: 0,
      older: 0,
      actions: new Set<string>(),
    };
    if (ev.ts >= cutoff) b.recent += 1;
    else b.older += 1;
    b.actions.add(ev.action);
    buckets.set(ev.surface, b);
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
        distinctActions: b.actions.size,
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

async function findEvidenceEventIds(
  userId: string,
  surface: string,
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
    .limit(EVIDENCE_LIMIT);
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

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("usage_events")
    .select("user_id, ts, surface, action")
    .gte("ts", since)
    .limit(50000);

  if (error) {
    console.error(`${LOG} usage_events select failed:`, error.message);
    return {
      usersScanned: 0,
      usersWithSignal: 0,
      proposalsCreated: 0,
      errors: 1,
    };
  }

  const byUser = new Map<string, RawEvent[]>();
  for (const ev of (data ?? []) as RawEvent[]) {
    const arr = byUser.get(ev.user_id) ?? [];
    arr.push(ev);
    byUser.set(ev.user_id, arr);
  }

  let usersWithSignal = 0;
  let proposalsCreated = 0;
  let errors = 0;

  for (const [userId, events] of byUser) {
    const surfaces = summarizeUserSurfaces(events, LOOKBACK_DAYS);
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
