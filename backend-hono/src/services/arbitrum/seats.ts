// [claude-code 2026-04-24] S35-T1: Arbitrum seat definitions + 2-layer Mixture-of-Agents
// (MoA). Each seat generates a position by:
//   L1 — 2 sibling Qwens draft independent answers
//   L2 — the seat's primary model receives both drafts + task and distills a
//        single refined position with JSON-parseable {probability, confidence,
//        rationale, risks[]} structure.

import { createLogger } from "../../lib/logger.js";
import { seatChat, type SeatChatResult } from "./adapters.js";
import type {
  ArbitrumDeliberateInput,
  ArbitrumEconContext,
  ArbitrumSeatConfig,
  ArbitrumSeatRound,
} from "./types.js";

const log = createLogger("ArbitrumSeats");

export const ARBITRUM_SEATS: readonly ArbitrumSeatConfig[] = [
  {
    id: "lead",
    role: "Lead Analyst",
    model: "qwen3-235b-a22b",
    provider: "dashscope",
    weight: 0.3,
    persona: "harper",
  },
  {
    id: "forecaster",
    role: "Forecaster",
    model: "qwen2.5-72b-instruct",
    provider: "ollama",
    weight: 0.3,
    persona: "oracle",
  },
  {
    id: "risk",
    role: "Risk Manager",
    model: "qwq-32b-preview",
    provider: "ollama",
    weight: 0.2,
    persona: "feucht",
  },
  {
    id: "quant",
    role: "Quantitative",
    model: "qwen2.5-coder-32b",
    provider: "ollama",
    weight: 0.1,
    persona: "consul",
  },
  {
    id: "bear",
    role: "Bear Case",
    model: "qwen3-14b",
    provider: "ollama",
    weight: 0.1,
    persona: "feucht-alt",
    fallback: { model: "llama3.3-70b", provider: "ollama" },
  },
] as const;

// Sibling Qwens used as L1 drafters. Picked to be small + divergent from the
// seat's primary model so the distillation actually gains signal.
const MOA_LAYER1_MODELS = ["qwen2.5-coder-32b", "qwen3-14b"] as const;

export interface MoAInvocationContext {
  round: number;
  peerDraftsSummary?: string; // round-2+: summary of other seats' round-1 drafts
}

function buildSeatSystemPrompt(seat: ArbitrumSeatConfig): string {
  return `You are the "${seat.role}" seat of the Arbitrum deliberation chamber for Priced In Capital (PIC), a multi-agent research desk. Persona: ${seat.persona}.

Your job: produce a calibrated probabilistic answer to the chamber's question with concrete risks. Be specific, avoid hedging prose. Output MUST be a single JSON object with fields:
  - probability: number between 0 and 1
  - confidence: number between 0 and 1
  - rationale: 2-4 sentence analytical summary
  - risks: array of 2-4 concise risk strings

Return ONLY the JSON object. No markdown fences, no commentary.`;
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
  return [
    `Task:\n${input.question}`,
    `Category: ${input.category}`,
    input.context ? `Context:\n${input.context}` : "",
    econLines ? `Econ data:\n${econLines}` : "",
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
  const system = buildSeatSystemPrompt(seat);
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
