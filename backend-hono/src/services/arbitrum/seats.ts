// [claude-code 2026-04-26] S35-T13: Original Arbitrum framework
// (Lead/Forecaster/Risk/Quant/Bear @ 30/30/20/10/10 weights + 2-layer MoA +
// JSON schema + rounds) MERGED with PIC's actual agent personas. Each seat
// binds the framework role to a real agent's full domain dossier — Harper-CAO
// leads, Oracle forecasts, Feucht runs risk, Consul handles fundamentals,
// Herald owns the contrarian/sentiment seat.
//
// Anti-groupthink design (3 layers):
//   1. Cross-family models per seat (Anthropic / Qwen / Minimax / GLM)
//   2. Each seat's persona dossier supplies a unique worldview + biases
//   3. Seat frame INVITES divergence from the strict role — each agent is
//      encouraged to "express the opinion that makes them valuable",
//      leveraging their unique angle, not just play the framework hat.
//
// 2-layer Mixture-of-Agents (MoA) per seat:
//   L1 — 2 cross-family Ollama Cloud drafts at higher temperature
//   L2 — seat's own model distills both drafts + task into a single
//        JSON-parseable {probability, confidence, rationale, risks[],
//        forward_5d:{thesis, catalysts_to_watch[], confidence}} answer.

import { createLogger } from "../../lib/logger.js";
import { seatChat, type SeatChatResult } from "./adapters.js";
import { getAgentSystemPrompt } from "../ai/agent-instructions/index.js";
import { formatNewsContext } from "./news-context.js";
import type { HermesAgentRole } from "../hermes-service.js";
import type {
  ArbitrumDeliberateInput,
  ArbitrumEconContext,
  ArbitrumForward5d,
  ArbitrumSeatConfig,
  ArbitrumSeatRound,
} from "./types.js";

const log = createLogger("ArbitrumSeats");

// Anchor model — universal fallback when a seat's primary cloud model isn't
// installed locally. Always pulled per S35-T11 baseline.
const ANCHOR_MODEL = "qwen3.5:397b-cloud";

// L1 MoA drafters intentionally span families different from any seat's
// primary so the layer-1 layer adds real architectural signal. DeepSeek +
// Minimax give the L2 distiller cross-lineage drafts to reconcile.
const MOA_LAYER1_MODELS = [
  "deepseek-v3.2:cloud",
  "minimax-m2.7:cloud",
] as const;

// PIC persona → HermesAgentRole (the key getAgentSystemPrompt() takes).
// Each seat loads its agent's full dossier (SOUL.md + role base + capabilities
// + philosophy + commandment gates) so the seat reasons WITH ITS ACTUAL
// EXPERTISE, not a generic role hat.
const PERSONA_TO_ROLE: Record<string, HermesAgentRole> = {
  harper: "harper-cao",
  oracle: "pma-merged",
  feucht: "futures-desk",
  consul: "fundamentals-desk",
  herald: "herald",
};

export const ARBITRUM_SEATS: readonly ArbitrumSeatConfig[] = [
  {
    id: "lead",
    role: "Lead Analyst",
    model: "claude-opus-4-7",
    provider: "vproxy",
    weight: 0.3,
    persona: "harper",
    fallback: { model: ANCHOR_MODEL, provider: "ollama" },
  },
  {
    id: "forecaster",
    role: "Forecaster",
    model: "qwen3.5:397b-cloud",
    provider: "ollama",
    weight: 0.3,
    persona: "oracle",
    fallback: { model: ANCHOR_MODEL, provider: "ollama" },
  },
  {
    id: "risk",
    role: "Risk Manager",
    model: "minimax-m2.7:cloud",
    provider: "ollama",
    weight: 0.2,
    persona: "feucht",
    fallback: { model: ANCHOR_MODEL, provider: "ollama" },
  },
  {
    id: "quant",
    role: "Quantitative",
    // [claude-code 2026-04-26] S35-T13: glm-5.1:cloud + kimi-k2.6:cloud
    // both require a paid Ollama Cloud subscription (smoke test 403). Swapped
    // to mistral-large-3:675b-cloud — free, Mistral family (cross-lineage
    // diversity from the Qwen/Minimax/Anthropic seats), strong on
    // structured/analytic reasoning fitting Consul's fundamentals lens.
    model: "mistral-large-3:675b-cloud",
    provider: "ollama",
    weight: 0.1,
    persona: "consul",
    fallback: { model: ANCHOR_MODEL, provider: "ollama" },
  },
  {
    id: "bear",
    role: "Bear Case",
    model: "qwen3.5:397b-cloud",
    provider: "ollama",
    weight: 0.1,
    persona: "herald",
    fallback: { model: ANCHOR_MODEL, provider: "ollama" },
  },
] as const;

export interface MoAInvocationContext {
  round: number;
  peerDraftsSummary?: string; // round-2+: summary of other seats' round-1 drafts
}

// Role-specific reasoning frames layered ON TOP of the persona dossier.
// Each frame INVITES the seat to express the unique angle that makes its
// persona valuable — the framework role is a starting point, not a cage.
// All seats reason as SWING TRADERS over the 5-day horizon (not long-term
// value investors). Each persona is paired with a Wall Street great whose
// operational characteristics fit the seat's role.
const SEAT_FRAME: Record<string, string> = {
  lead: `Framework role: Lead Analyst (30% weight) — synthesize across
desks, set the initial probability, own the cross-correlation read.
Mindset: SWING TRADER — 5-day horizon, top-down macro read, big-conviction
positioning when the setup is clean. Operate with the characteristics of
**Stanley Druckenmiller**: high concentration on best ideas, willingness to
pivot hard on regime change, "the way to build long-term returns is through
preservation of capital and home runs." Bring HARPER'S angle: cross-desk
pattern detection, catching divergences others miss, judging when the desk
consensus itself is wrong.`,
  forecaster: `Framework role: Forecaster (30% weight) — calibrated
probability from base rates updated by evidence.
Mindset: SWING TRADER — 5-day horizon, asymmetric R:R obsession, "5:1
minimum or I don't take the trade." Operate with the characteristics of
**Paul Tudor Jones**: probabilistic thinking, defining the loss before the
gain, "losers average losers." Bring ORACLE'S angle: prediction-market
discipline, explicit base rates, pinning a number when others hedge.`,
  risk: `Framework role: Risk Manager (20% weight) — defensive lens, stress-
test the consensus.
Mindset: SWING TRADER — 5-day horizon, levels-aware, stop discipline non-
negotiable, "I don't get paid to be right, I get paid to manage risk."
Operate with the characteristics of **Linda Raschke**: technical-level
precision, holding the trade only while the structure holds, fast cuts when
it breaks. Bring FEUCHT'S angle: futures/levels risk, asymmetric loss
obsession, "where does this trade actually fail."`,
  quant: `Framework role: Quantitative (10% weight) — numerical grounding.
Mindset: SWING TRADER — 5-day horizon, momentum + fundamentals confluence,
cap-table-aware, sector-flow-aware. Operate with the characteristics of
**Mark Minervini**: VCP setups, earnings-cycle alignment, "focus on the
leaders not the laggards." Bring CONSUL'S angle: mega-cap fundamentals,
valuation context, sector rotation reads, earnings-cycle awareness. Argue
from the cap table and the multiple, not from narrative.`,
  bear: `Framework role: Bear Case (10% weight) — explicit contrarian.
Mindset: SWING TRADER — 5-day horizon, sentiment-reversal-hunting, "the
crowd is loudest at the turn." Operate with the characteristics of
**Michael Burry**: short-side conviction backed by primary research,
willingness to be the only voice in the room. Bring HERALD'S angle:
headline-risk lens, sentiment-velocity awareness, "this story will break
the other way." Do NOT play devil's advocate as ritual — disagree only
when the evidence supports it, then disagree HARD.`,
};

async function buildSeatSystemPrompt(
  seat: ArbitrumSeatConfig,
): Promise<string> {
  const role = PERSONA_TO_ROLE[seat.persona];
  let dossier = "";
  if (role) {
    try {
      dossier = await getAgentSystemPrompt(role);
    } catch (err) {
      log.warn("Seat dossier load failed — falling back to bare frame", {
        seat: seat.id,
        persona: seat.persona,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const frame =
    SEAT_FRAME[seat.id] ??
    `You sit in the "${seat.role}" seat of the Arbitrum chamber.`;

  const taskFrame = `# Arbitrum Chamber — ${seat.role} (${seat.persona})

You are deliberating inside Priced In Capital's Arbitrum chamber. The chamber
runs five weighted seats and synthesizes a calibrated read; do NOT speak for
the chamber, just deliver YOUR seat's position.

${frame}

Express the opinion that makes you valuable. The chamber needs DIVERGENCE,
not consensus — if your honest read disagrees with the framing, say so.

## Output contract (strict)

Return ONLY a single JSON object — no markdown fences, no preamble, no
commentary. Schema:
{
  "probability": <number 0..1>,
  "confidence":  <number 0..1>,
  "rationale":   "<2-4 sentences: your seat's analytical read>",
  "risks":       ["<2-4 concise risk strings>"],
  "forward_5d":  {
    "thesis":             "<single sentence: how this evolves over the next 5 days>",
    "catalysts_to_watch": ["<1-3 concrete events / levels / prints>"],
    "confidence":         <number 0..1: confidence the 5d thesis holds>
  }
}`;

  return dossier ? `${dossier}\n\n${taskFrame}` : taskFrame;
}

function formatEconContext(
  econ: ArbitrumEconContext | null | undefined,
): string | null {
  if (!econ) return null;
  const lines: string[] = [];
  if (econ.prints.length > 0) {
    lines.push(`Recent econ prints (last ${econ.windowDays}d, newest first):`);
    for (const p of econ.prints.slice(0, 24)) {
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
    lines.push(`Upcoming releases (next 5d):`);
    for (const u of econ.upcoming.slice(0, 12)) {
      lines.push(
        `  ${u.date}${u.time ? " " + u.time : ""} | ${u.country ?? "?"} | ${u.name}`,
      );
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function buildUserPrompt(
  input: ArbitrumDeliberateInput,
  ctx: MoAInvocationContext,
): string {
  const parts: string[] = [];
  parts.push(`Question: ${input.question}`);
  parts.push(`Category: ${input.category}`);
  if (input.context) parts.push(`Triggering catalyst:\n${input.context}`);
  const newsLines = formatNewsContext(input.news_context);
  if (newsLines) parts.push(`News tape:\n${newsLines}`);
  const econLines = formatEconContext(input.econ_context);
  if (econLines) parts.push(`Econ data:\n${econLines}`);
  if (input.iv_simulation) {
    parts.push(`IV simulation: ${JSON.stringify(input.iv_simulation)}`);
  }
  parts.push(`Round: ${ctx.round}`);
  if (ctx.peerDraftsSummary) {
    parts.push(`Peer drafts (for your revision):\n${ctx.peerDraftsSummary}`);
  }
  parts.push(
    `Project the next 5 days. Probability + 5d forward thesis required.`,
  );
  return parts.join("\n\n");
}

function buildDistillPrompt(
  input: ArbitrumDeliberateInput,
  l1Drafts: string[],
  ctx: MoAInvocationContext,
): string {
  const econLines = formatEconContext(input.econ_context);
  const newsLines = formatNewsContext(input.news_context);
  return [
    `Task:\n${input.question}`,
    `Category: ${input.category}`,
    input.context ? `Triggering catalyst:\n${input.context}` : "",
    newsLines ? `News tape:\n${newsLines}` : "",
    econLines ? `Econ data:\n${econLines}` : "",
    `Round: ${ctx.round}`,
    ctx.peerDraftsSummary
      ? `Peer drafts (for revision):\n${ctx.peerDraftsSummary}`
      : "",
    `Layer-1 sibling drafts (reconcile, do not average blindly):`,
    ...l1Drafts.map((d, i) => `--- Draft ${i + 1} ---\n${d}`),
    `Produce your own calibrated JSON answer now — including forward_5d.`,
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
  const forward_5d = parseForward5d(parsed?.forward_5d);
  return { round, probability, confidence, rationale, risks, forward_5d };
}

function parseForward5d(raw: unknown): ArbitrumForward5d | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ArbitrumForward5d>;
  const thesis =
    typeof r.thesis === "string" && r.thesis.trim().length > 0
      ? r.thesis.trim().slice(0, 400)
      : "";
  if (!thesis) return null;
  const catalysts_to_watch = Array.isArray(r.catalysts_to_watch)
    ? r.catalysts_to_watch.map((c) => String(c).slice(0, 160)).slice(0, 5)
    : [];
  const confidence = clamp01(Number(r.confidence ?? 0.3));
  return { thesis, catalysts_to_watch, confidence };
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
    // [claude-code 2026-04-26] S35-T13: skip fallback when it's the same
    // model as the primary — retrying the same id wastes a slot and almost
    // always re-fails the same way.
    if (seat.fallback && seat.fallback.model !== seat.model) {
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

  // Layer 1: 2 cross-family Ollama Cloud drafts at higher temperature.
  // Failures degrade L2 but don't kill the seat.
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
