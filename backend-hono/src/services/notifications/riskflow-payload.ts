// [claude-code 2026-04-18] B3: RiskFlow push payload polish + B1 fingerprint
/**
 * RiskFlow → push payload builder
 *
 * Produces iOS-friendly title/body/url/fingerprint from a scored FeedItem.
 * Title: "<instrument> · <event>"   (e.g. "/ES · FOMC Minutes")
 * Body:  "<score> · <headline>"     (e.g. "9.2 · Powell hints at pause…")
 * Fingerprint: riskflow:<hash(normalizedHeadline + instrument)>:<floor(now/5min)>
 */

import type { FeedItem } from "../../types/riskflow.js";

function pickInstrument(item: FeedItem): string {
  const sym = item.symbols?.[0];
  return sym && sym.trim().length > 0 ? sym : "Market";
}

function pickEventLabel(item: FeedItem): string {
  if (item.riskType) {
    return String(item.riskType)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const tag = item.tags?.[0];
  if (tag)
    return tag.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "Alert";
}

function normalizeHeadline(h: string): string {
  return (h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8)
    .join(" ");
}

/** Stable 32-bit hash for fingerprinting — not cryptographic, just collision-resistant for short text. */
function hash32(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export interface RiskFlowPushPayload {
  title: string;
  body: string;
  url: string;
  fingerprint: string;
  eventId: string;
}

export function buildRiskFlowPush(item: FeedItem): RiskFlowPushPayload {
  const instrument = pickInstrument(item);
  const eventLabel = pickEventLabel(item);
  const scoreText =
    typeof item.ivScore === "number" ? item.ivScore.toFixed(1) : "";
  const headline = (item.headline || "").trim();

  const title = `${instrument} · ${eventLabel}`;
  const body = scoreText ? `${scoreText} · ${headline}` : headline;

  const normalized = normalizeHeadline(headline);
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const fingerprint = `riskflow:${hash32(`${normalized}|${instrument}`)}:${bucket}`;

  return {
    title,
    body,
    url: "/riskflow",
    fingerprint,
    eventId: item.id,
  };
}
