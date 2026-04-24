// [claude-code 2026-04-24] S35-T1/T12 Phase B: Arbitrum event trigger.
// Fire-and-forget gate called from central-scorer.ts after writeScoredItems.
// Fires a chamber deliberation when a newly-scored riskflow item clears:
//   - ivScore >= ARBITRUM_EVENT_IV_THRESHOLD (default 8.5)
//   - speaker resolves (fuzzy-match) to one of the top-N tier-weighted
//     commentators (default top-10)
// Never throws; never awaits the chamber — the scorer pipeline must stay
// snappy. Per-speaker cooldown prevents a single commentator from flooding
// the chamber if they drop multiple L8.5+ headlines in a row.

import { createLogger } from "../../lib/logger.js";
import {
  fuzzyMatchSpeaker,
  getTopNCommentators,
} from "../commentator/commentator-service.js";
import { runChamber } from "./engine.js";
import type { FeedItem } from "../../types/riskflow.js";

const log = createLogger("ArbitrumEventTrigger");

const DEFAULT_THRESHOLD = 8.5;
const DEFAULT_TOP_N = 10;
const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes per speaker

const lastFiredBySpeaker = new Map<string, number>();

function envThreshold(): number {
  const raw = process.env.ARBITRUM_EVENT_IV_THRESHOLD;
  if (!raw) return DEFAULT_THRESHOLD;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

function envTopN(): number {
  const raw = process.env.ARBITRUM_EVENT_TOP_N;
  if (!raw) return DEFAULT_TOP_N;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TOP_N;
}

function extractSpeaker(item: FeedItem): string | null {
  const fromSub = item.subScores?.speaker;
  if (fromSub && fromSub.trim().length > 0) return fromSub.trim();
  return null;
}

function onCooldown(speaker: string): boolean {
  const last = lastFiredBySpeaker.get(speaker.toLowerCase());
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function markFired(speaker: string): void {
  lastFiredBySpeaker.set(speaker.toLowerCase(), Date.now());
}

/**
 * Synchronous gate + fire-and-forget chamber invocation.
 * Callers MUST use `void checkAndFire(item).catch(log.error)` so the
 * scorer pipeline never blocks on this.
 */
export async function checkAndFire(item: FeedItem): Promise<void> {
  if (process.env.ARBITRUM_EVENT_TRIGGER_ENABLED === "false") return;

  const iv = item.ivScore ?? 0;
  if (iv < envThreshold()) return;

  const speaker = extractSpeaker(item);
  if (!speaker) return;

  if (onCooldown(speaker)) {
    log.info("Arbitrum trigger skipped — speaker on cooldown", {
      speaker,
      iv_score: iv,
      item_id: item.id,
    });
    return;
  }

  const top = await getTopNCommentators(envTopN());
  const match = fuzzyMatchSpeaker(speaker, top);
  if (!match) return;

  markFired(speaker);

  log.info("Arbitrum event trigger firing chamber", {
    speaker,
    matched_as: match.name,
    tier: match.tier,
    iv_score: iv,
    item_id: item.id,
  });

  const question = `Does this warrant a macro re-read? "${item.headline.slice(0, 240)}"`;
  const contextParts: string[] = [];
  if (item.body) contextParts.push(item.body.slice(0, 600));
  if (item.symbols.length > 0)
    contextParts.push(`Symbols: ${item.symbols.join(", ")}`);
  if (item.riskType) contextParts.push(`Risk type: ${item.riskType}`);

  await runChamber(
    {
      question,
      category: item.category ?? item.riskType ?? "commentary",
      context: contextParts.length > 0 ? contextParts.join("\n\n") : undefined,
    },
    "event",
    {
      triggerSource: {
        riskflow_item_id: item.id,
        speaker,
        iv_score: iv,
      },
    },
  );
}
