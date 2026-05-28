// [Codex 2026-05-27] S102 chamber prompts require macro event-risk cognition.
// [claude-code 2026-05-03] S58-T1: Arbitrum seat metadata uses DeepSeek direct.
// [claude-code 2026-04-29] DeepSeek migration: all Arbitrum seats now run
// `deepseek-reasoner` via DeepSeek's OpenAI-compat API. Seat divergence still
// comes from persona/role + temperature, not separate model IDs.
//
// 2-layer Mixture-of-Agents (MoA) per seat:
//   L1 — 2 parallel deepseek-reasoner drafts at higher temperature
//   L2 — seat's deepseek-reasoner distills both drafts + task into a single
//        JSON-parseable {probability, confidence, rationale, risks[]} answer.
//
// [claude-code 2026-05-01] S56 Track A: loadSeatOverride + buildSeatSystemPrompt
//   now appends per-seat overrides (prompt, context sources, category filter)
//   from arbitrum_seat_overrides table.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { seatChat, type SeatChatResult } from "./adapters.js";
import type {
  ArbitrumCommentaryContext,
  ArbitrumDeliberateInput,
  ArbitrumEconContext,
  ArbitrumRiskContext,
  ArbitrumSeatConfig,
  ArbitrumSeatRound,
  SeatOverrideRow,
} from "./types.js";

const log = createLogger("ArbitrumSeats");

const SEAT_MODEL = "deepseek-reasoner";

export const ARBITRUM_SEATS: readonly ArbitrumSeatConfig[] = [
  {
    id: "lead",
    role: "Lead Analyst",
    roleSubtitle: "CAO — executive synthesis",
    displayName: "Harper",
    model: SEAT_MODEL,
    provider: "deepseek-direct",
    weight: 0.3,
    persona: "harper",
    temperature: 0.6,
  },
  {
    id: "forecaster",
    role: "Forecaster",
    roleSubtitle: "Prediction markets + probabilistic reasoning",
    displayName: "Oracle",
    model: SEAT_MODEL,
    provider: "deepseek-direct",
    weight: 0.3,
    persona: "oracle",
    temperature: 0.6,
  },
  {
    id: "risk",
    role: "Risk Manager",
    roleSubtitle: "Futures/risk, technical levels, execution",
    displayName: "Feucht",
    model: SEAT_MODEL,
    provider: "deepseek-direct",
    weight: 0.2,
    persona: "feucht",
    temperature: 0.6,
  },
  {
    id: "quant",
    role: "Quantitative",
    roleSubtitle: "Mega-cap fundamentals, earnings, sector rotation",
    displayName: "Consul",
    model: SEAT_MODEL,
    provider: "deepseek-direct",
    weight: 0.1,
    persona: "consul",
    temperature: 0.6,
  },
  {
    id: "bear",
    role: "Bear Case",
    roleSubtitle: "Breaking news, social sentiment, headline risk",
    displayName: "Herald",
    model: SEAT_MODEL,
    provider: "deepseek-direct",
    weight: 0.1,
    persona: "herald",
    temperature: 0.6,
  },
] as const;

// L1 drafters share the same DeepSeek model; divergence comes from
// independent samples at higher temperature in invokeMoA().
const MOA_LAYER1_MODELS = [SEAT_MODEL, SEAT_MODEL] as const;

export interface MoAInvocationContext {
  round: number;
  peerDraftsSummary?: string; // round-2+: summary of other seats' round-1 drafts
}

// ── S56 Track A: seat override loading ──

async function loadSeatOverride(
  seatId: string,
): Promise<SeatOverrideRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("arbitrum_seat_overrides")
      .select("*")
      .eq("seat_id", seatId)
      .maybeSingle();
    if (error || !data) return null;
    return data as SeatOverrideRow;
  } catch {
    return null;
  }
}

export async function getSeatOverrides(): Promise<
  Array<{
    seat_id: string;
    override_prompt: string;
    context_sources: string[];
    category_filter: string;
    has_override: boolean;
    updated_at: string;
  }>
> {
  const supabase = getSupabaseClient();
  if (!supabase)
    return ARBITRUM_SEATS.map((s) => ({
      seat_id: s.id,
      override_prompt: "",
      context_sources: [],
      category_filter: "all",
      has_override: false,
      updated_at: "",
    }));
  try {
    const { data, error } = await supabase
      .from("arbitrum_seat_overrides")
      .select("*");
    if (error)
      return ARBITRUM_SEATS.map((s) => ({
        seat_id: s.id,
        override_prompt: "",
        context_sources: [],
        category_filter: "all",
        has_override: false,
        updated_at: "",
      }));
    const byId = new Map(
      (data ?? []).map((r: SeatOverrideRow) => [r.seat_id, r]),
    );
    return ARBITRUM_SEATS.map((s) => {
      const row = byId.get(s.id);
      return {
        seat_id: s.id,
        override_prompt: row?.override_prompt ?? "",
        context_sources: row?.context_sources ?? [],
        category_filter: row?.category_filter ?? "all",
        has_override: !!row?.override_prompt?.trim(),
        updated_at: row?.updated_at ?? "",
      };
    });
  } catch {
    return ARBITRUM_SEATS.map((s) => ({
      seat_id: s.id,
      override_prompt: "",
      context_sources: [],
      category_filter: "all",
      has_override: false,
      updated_at: "",
    }));
  }
}

export async function saveSeatOverrides(
  overrides: Array<{
    seat_id: string;
    override_prompt?: string;
    context_sources?: string[];
    category_filter?: string;
  }>,
): Promise<{ updated: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");
  let updated = 0;
  for (const o of overrides) {
    const { error } = await supabase.from("arbitrum_seat_overrides").upsert(
      {
        seat_id: o.seat_id,
        override_prompt: o.override_prompt ?? "",
        context_sources: o.context_sources ?? [],
        category_filter: o.category_filter ?? "all",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seat_id" },
    );
    if (!error) updated++;
  }
  return { updated };
}

export async function resetSeatOverrides(
  seatIds: string[],
): Promise<{ cleared: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");
  let cleared = 0;
  for (const sid of seatIds) {
    const { error } = await supabase.from("arbitrum_seat_overrides").upsert(
      {
        seat_id: sid,
        override_prompt: "",
        context_sources: [],
        category_filter: "all",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seat_id" },
    );
    if (!error) cleared++;
  }
  return { cleared };
}

async function buildSeatSystemPrompt(
  seat: ArbitrumSeatConfig,
): Promise<string> {
  let prompt = `You are the "${seat.role}" seat of the Arbitrum deliberation chamber for Priced In Capital (PIC), a multi-agent research desk. Persona: ${seat.persona}.

Your job: produce a calibrated probabilistic answer to the chamber's question with concrete risks. Be specific, avoid hedging prose. Output MUST be a single JSON object with fields:
  - probability: number between 0 and 1
  - confidence: number between 0 and 1
  - rationale: 2-4 sentence analytical summary
  - risks: array of 2-4 concise risk strings

## Discernment Guidelines
- Anchor your read to the supplied RiskFlow, econ, commentary, IV simulation, and user-provided context. Name the specific catalyst or missing context that drives your probability.
- Consensus is baseline only. Deliberate as PIC's macro event-risk desk: internal forecast, miss/beat paths, confidence, data-cycle stage, cross-asset transmission, and second-order read.
- Every run must compare seven-day headwinds vs tailwinds, then state a first-order conclusion and what Harper should synthesize second-order for the week/session.
- Futures entries require fractal time: HTF context, LTF trigger, and multi-instrument correlation. Missing GEX/HVL is pending context, not permission to fabricate levels.
- If context is sparse, lower confidence and say exactly what evidence is missing. Do not fill gaps with generic macro commentary.
- Probability answers the chamber question, not broad market direction. Confidence measures evidence quality and agreement with your seat's domain.
- Surface one concrete implication for the desk: revise, hold, wait for a print, reduce exposure, or escalate for a wider run.
- Risks should be falsifiable: what would make your answer wrong in the next 24-72 hours.

Return ONLY the JSON object. No markdown fences, no commentary.`;

  // S56 Track A: append per-seat override if configured
  const override = await loadSeatOverride(seat.id);
  if (override?.override_prompt?.trim()) {
    prompt += `\n\n## Seat-Specific Instructions (Override)\n${override.override_prompt}`;
  }
  if (override?.context_sources?.length) {
    prompt += `\n\n## Available Context Sources\n${override.context_sources.join(", ")}`;
  }
  if (override?.category_filter && override.category_filter !== "all") {
    prompt += `\n\n## Category Focus\nPrioritize analysis through the lens of: ${override.category_filter}`;
  }

  return prompt;
}

function formatEconContext(
  econ: ArbitrumEconContext | null | undefined,
): string | null {
  if (!econ) return null;
  const lines: string[] = [];
  if (econ.prints.length > 0) {
    lines.push(`Recent econ prints (last ${econ.windowDays}d, newest first):`);
    for (const p of econ.prints.slice(0, 12)) {
      const surprise =
        p.surprise != null
          ? `${p.surprise > 0 ? "+" : ""}${p.surprise.toFixed(2)}%`
          : "—";
      lines.push(
        `  ${p.date ?? "—"} | ${p.name} | actual ${p.actual ?? "—"} vs fc ${p.forecast ?? "—"} vs prev ${p.previous ?? "—"} → ${p.direction ?? "—"} (${surprise})`,
      );
    }
  }
  if (econ.upcoming.length > 0) {
    lines.push(`Upcoming releases:`);
    for (const u of econ.upcoming.slice(0, 8)) {
      lines.push(
        `  ${u.date}${u.time ? " " + u.time : ""} | ${u.country ?? "?"} | ${u.name}`,
      );
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function formatCommentaryContext(
  commentary: ArbitrumCommentaryContext | null | undefined,
): string | null {
  if (!commentary || commentary.entries.length === 0) return null;
  const lines: string[] = [];
  lines.push(`Recent commentary watched (last ${commentary.windowHours}h):`);
  for (const e of commentary.entries.slice(0, 5)) {
    const date = e.watchedAt
      ? new Date(e.watchedAt).toISOString().slice(0, 10)
      : "—";
    lines.push(`  ${date} | ${e.title}`);
    if (e.summary) {
      const summary = e.summary.replace(/\n/g, " ");
      lines.push(
        `    Summary: ${summary.slice(0, 240)}${summary.length > 240 ? "…" : ""}`,
      );
    }
    lines.push(`    Source: ${e.sourceUrl}`);
  }
  return lines.join("\n");
}

function formatRiskContext(
  risk: ArbitrumRiskContext | null | undefined,
): string | null {
  if (!risk) return null;
  return [
    `Risk signal window: ${risk.riskSignalWindowDays}d`,
    `Headwinds: ${risk.headwindRisks.join(" | ")}`,
    `Tailwinds: ${risk.tailwindRisks.join(" | ")}`,
    `Positioning: ${risk.wallStreetPrepositioning}`,
    `Wall Street forecasts: ${risk.wallStreetForecasts.join(" | ") || "unavailable"}`,
    `Rate futures: ${risk.rateFuturesRead}`,
    `Sector rotation: ${risk.sectorRotationRisk}`,
    `Fractal time: ${risk.htfLtfConfluence}`,
    `Correlation: ${risk.multiInstrumentCorrelation}`,
    `Vol gate: ${risk.volatilityGate.status} | VIX ${risk.volatilityGate.vix} | bonds ${risk.volatilityGate.bonds} | Greeks ${risk.volatilityGate.greeks}`,
    `GEX/HVL: ${risk.basisAdjustedGexReference ?? "unavailable"}`,
    `Entry read: ${risk.eventRiskTimedEntryRead}`,
    `Point opportunity: ${risk.expectedPointOpportunity}`,
  ].join("\n");
}

function buildUserPrompt(
  input: ArbitrumDeliberateInput,
  ctx: MoAInvocationContext,
): string {
  const parts: string[] = [];
  parts.push(`Question: ${input.question}`);
  parts.push(`Category: ${input.category}`);
  if (input.context) parts.push(`Context:\n${input.context}`);
  const econLines = formatEconContext(input.econ_context);
  if (econLines) parts.push(`Econ data:\n${econLines}`);
  const riskLines = formatRiskContext(input.risk_context);
  if (riskLines) parts.push(`Mandatory macro risk context:\n${riskLines}`);
  const commentaryLines = formatCommentaryContext(input.commentary_context);
  if (commentaryLines) parts.push(`Commentary context:\n${commentaryLines}`);
  if (input.iv_simulation) {
    parts.push(`IV simulation: ${JSON.stringify(input.iv_simulation)}`);
  }
  parts.push(`Round: ${ctx.round}`);
  if (ctx.peerDraftsSummary) {
    parts.push(`Peer drafts (for your revision):\n${ctx.peerDraftsSummary}`);
  }
  return parts.join("\n\n");
}

function buildDistillPrompt(
  input: ArbitrumDeliberateInput,
  l1Drafts: string[],
  ctx: MoAInvocationContext,
): string {
  const econLines = formatEconContext(input.econ_context);
  const riskLines = formatRiskContext(input.risk_context);
  const commentaryLines = formatCommentaryContext(input.commentary_context);
  return [
    `Task:\n${input.question}`,
    `Category: ${input.category}`,
    input.context ? `Context:\n${input.context}` : "",
    econLines ? `Econ data:\n${econLines}` : "",
    riskLines ? `Mandatory macro risk context:\n${riskLines}` : "",
    commentaryLines ? `Commentary context:\n${commentaryLines}` : "",
    `Round: ${ctx.round}`,
    ctx.peerDraftsSummary
      ? `Peer drafts (for revision):\n${ctx.peerDraftsSummary}`
      : "",
    `Layer-1 sibling drafts (reconcile, do not average blindly):`,
    ...l1Drafts.map((d, i) => `--- Draft ${i + 1} ---\n${d}`),
    `Produce your own calibrated JSON answer now.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function safeParseRound(raw: string, round: number): ArbitrumSeatRound {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: Partial<ArbitrumSeatRound> | null = null;
  try {
    parsed = JSON.parse(cleaned) as Partial<ArbitrumSeatRound>;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(
          cleaned.slice(firstBrace, lastBrace + 1),
        ) as Partial<ArbitrumSeatRound>;
      } catch {
        /* fall through */
      }
    }
  }
  const probability = clamp01(Number(parsed?.probability ?? 0.5));
  const confidence = clamp01(Number(parsed?.confidence ?? 0.3));
  const rationale =
    typeof parsed?.rationale === "string" && parsed.rationale.length > 0
      ? parsed.rationale
      : cleaned.slice(0, 400);
  const risks =
    Array.isArray(parsed?.risks) && parsed.risks.length > 0
      ? parsed.risks.map((r) => String(r)).slice(0, 6)
      : [];
  return { round, probability, confidence, rationale, risks };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

async function runSeatModel(
  seat: ArbitrumSeatConfig,
  system: string,
  user: string,
): Promise<string> {
  try {
    const res = await seatChat({
      modelId: seat.model,
      system,
      user,
      temperature: 0.6,
    });
    return res.content;
  } catch (err) {
    if (seat.fallback) {
      log.warn("Seat primary failed, trying fallback", {
        seat: seat.id,
        primary: seat.model,
        fallback: seat.fallback.model,
        error: err instanceof Error ? err.message : String(err),
      });
      const res = await seatChat({
        modelId: seat.fallback.model,
        system,
        user,
        temperature: 0.6,
      });
      return res.content;
    }
    throw err;
  }
}

/**
 * Invoke a single seat for a single round using 2-layer Mixture-of-Agents.
 * Returns the seat's round answer. Never throws — on any failure returns a
 * stub round with low confidence so the chamber can still synthesize.
 */
export async function invokeMoA(
  seat: ArbitrumSeatConfig,
  input: ArbitrumDeliberateInput,
  ctx: MoAInvocationContext,
): Promise<ArbitrumSeatRound> {
  const system = await buildSeatSystemPrompt(seat);
  const user = buildUserPrompt(input, ctx);

  // Layer 1: 2 sibling Qwens draft independently. Failures degrade L2 but
  // don't kill the seat.
  const l1Results = await Promise.allSettled(
    MOA_LAYER1_MODELS.map((modelId) =>
      seatChat({ modelId, system, user, temperature: 0.8 }),
    ),
  );
  const l1Drafts = l1Results
    .filter(
      (r): r is PromiseFulfilledResult<SeatChatResult> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value.content)
    .filter((c) => c.trim().length > 0);

  // Layer 2: seat's own model distills the L1 drafts into the final answer.
  const distillUser =
    l1Drafts.length > 0 ? buildDistillPrompt(input, l1Drafts, ctx) : user;

  try {
    const raw = await runSeatModel(seat, system, distillUser);
    return safeParseRound(raw, ctx.round);
  } catch (err) {
    log.warn("Seat invocation failed — emitting low-confidence stub", {
      seat: seat.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      round: ctx.round,
      probability: 0.5,
      confidence: 0.1,
      rationale: `Seat ${seat.id} unavailable this round (${seat.model}).`,
      risks: ["model-unavailable"],
    };
  }
}
