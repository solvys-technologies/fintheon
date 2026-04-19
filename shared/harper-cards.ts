// [claude-code 2026-04-19] S27-T1 §1 — W1a schema layer for Harper generative UI cards.
// See docs/sprint-briefs/S27-T1-generative-ui-harper.md §1-3 for the spec.
// Consumed by: frontend stream parser + CardPartRenderer (W2a), backend harper-handler prompt (W2a),
// agent-instructions/harper-cards.ts (W2a). Import the Zod schemas, never redefine the shapes inline.

import { z } from "zod";
import { AgentIdSchema } from "./sidecar-contract";

// ─── Stream fence contract ────────────────────────────────────────────────────
//
// Harper streams prose + cards over SSE. A card is emitted as a fenced JSON
// payload. The parser buffers bytes between the open and close fence, then
// JSON-parses + Zod-validates against `HarperCardSchema`. On failure the raw
// payload falls back to a `<pre>` text part with a warning.

export const CARD_FENCE_OPEN = "<<card>>";
export const CARD_FENCE_CLOSE = "<<endcard>>";
export const CARD_KIND = "fintheon-card" as const;

// ─── Variant enum ─────────────────────────────────────────────────────────────

export const CardVariantSchema = z.enum([
  "price-level",
  "probability-table",
  "agent-handoff",
  "risk-flag",
  "backtest-result",
  "narrative-thread",
]);
export type CardVariant = z.infer<typeof CardVariantSchema>;

// ─── Variant: price-level ─────────────────────────────────────────────────────
// Feucht / futures desk output. Symbol + ordered levels around current price.

export const PriceLevelTypeSchema = z.enum([
  "support",
  "resistance",
  "trigger",
]);

export const PriceLevelRowSchema = z.object({
  label: z.string(),
  price: z.number(),
  type: PriceLevelTypeSchema,
  distance: z.number().optional(), // basis points or % from spot; renderer formats
});

export const PriceLevelDataSchema = z.object({
  symbol: z.string(),
  spot: z.number().optional(),
  as_of: z.string().optional(), // ISO 8601
  levels: z.array(PriceLevelRowSchema).min(1),
  note: z.string().optional(),
});

// ─── Variant: probability-table ───────────────────────────────────────────────
// Oracle-style probabilistic output. Headline + rows of outcomes with p.

export const ProbabilityRowSchema = z.object({
  label: z.string(),
  p: z.number().min(0).max(1),
  note: z.string().optional(),
  delta: z.number().optional(), // change vs prior print / prior day
});

export const ProbabilityTableDataSchema = z.object({
  headline: z.string(),
  rows: z.array(ProbabilityRowSchema).min(1),
  source: z.string().optional(),
  as_of: z.string().optional(),
});

// ─── Variant: agent-handoff ───────────────────────────────────────────────────
// Pill card rendered while Harper's handoff-to-{desk} tool is inflight.

export const AgentHandoffDataSchema = z.object({
  from: AgentIdSchema,
  to: AgentIdSchema,
  question: z.string(),
  preview: z.string().optional(),
  status: z.enum(["pending", "complete", "error"]).default("pending"),
  turn_id: z.string().optional(),
});

// ─── Variant: risk-flag ───────────────────────────────────────────────────────
// Herald / RiskFlow promotion. Severity + headline + optional IV context.

export const RiskSeveritySchema = z.enum(["low", "med", "high", "critical"]);

export const RiskFlagDataSchema = z.object({
  severity: RiskSeveritySchema,
  headline: z.string(),
  body: z.string(),
  iv_context: z.string().optional(),
  source: z.string().optional(),
  link: z.string().url().optional(),
  as_of: z.string().optional(),
});

// ─── Variant: backtest-result ─────────────────────────────────────────────────

export const BacktestResultDataSchema = z.object({
  strategy: z.string(),
  period: z.string(),
  pnl: z.number(),
  win_rate: z.number().min(0).max(1),
  max_dd: z.number(),
  trades_shown: z.number().int().nonnegative(),
  sharpe: z.number().optional(),
  notes: z.string().optional(),
});

// ─── Variant: narrative-thread ────────────────────────────────────────────────
// Link-through to a Sanctum narrative thread.

export const NarrativeThreadDataSchema = z.object({
  catalyst: z.string(),
  symbols: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  last_update: z.string(), // ISO 8601
  thread_id: z.string().optional(),
  summary: z.string().optional(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────
// Every card is `{kind: 'fintheon-card', variant, id, data}`. Downstream renderer
// switches on `variant` and the narrowed `data` is already the right shape.

const base = {
  kind: z.literal(CARD_KIND),
  id: z.string().min(1),
};

export const HarperCardSchema = z.discriminatedUnion("variant", [
  z.object({
    ...base,
    variant: z.literal("price-level"),
    data: PriceLevelDataSchema,
  }),
  z.object({
    ...base,
    variant: z.literal("probability-table"),
    data: ProbabilityTableDataSchema,
  }),
  z.object({
    ...base,
    variant: z.literal("agent-handoff"),
    data: AgentHandoffDataSchema,
  }),
  z.object({
    ...base,
    variant: z.literal("risk-flag"),
    data: RiskFlagDataSchema,
  }),
  z.object({
    ...base,
    variant: z.literal("backtest-result"),
    data: BacktestResultDataSchema,
  }),
  z.object({
    ...base,
    variant: z.literal("narrative-thread"),
    data: NarrativeThreadDataSchema,
  }),
]);

export type HarperCard = z.infer<typeof HarperCardSchema>;
export type PriceLevelRow = z.infer<typeof PriceLevelRowSchema>;
export type PriceLevelData = z.infer<typeof PriceLevelDataSchema>;
export type ProbabilityRow = z.infer<typeof ProbabilityRowSchema>;
export type ProbabilityTableData = z.infer<typeof ProbabilityTableDataSchema>;
export type AgentHandoffData = z.infer<typeof AgentHandoffDataSchema>;
export type RiskFlagData = z.infer<typeof RiskFlagDataSchema>;
export type BacktestResultData = z.infer<typeof BacktestResultDataSchema>;
export type NarrativeThreadData = z.infer<typeof NarrativeThreadDataSchema>;

// ─── Parse helpers ────────────────────────────────────────────────────────────

export type CardParseResult =
  | { ok: true; card: HarperCard }
  | {
      ok: false;
      reason: "invalid-json" | "schema-mismatch";
      raw: string;
      issues?: string[];
    };

export function parseCardPayload(raw: string): CardParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json", raw };
  }
  const parsed = HarperCardSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema-mismatch",
      raw,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
    };
  }
  return { ok: true, card: parsed.data };
}

// ─── Variant catalog (for prompt generation + UI registry) ────────────────────
// Exported so the W2a prompt builder can list variants without duplicating strings.

export interface CardVariantDescriptor {
  variant: CardVariant;
  summary: string;
  when_to_use: string;
}

export const CARD_VARIANT_CATALOG: readonly CardVariantDescriptor[] = [
  {
    variant: "price-level",
    summary: "Symbol + ordered support / resistance / trigger levels",
    when_to_use: "Any futures or equity request for intraday or swing levels",
  },
  {
    variant: "probability-table",
    summary: "Headline + rows of outcomes with probabilities",
    when_to_use: "Prediction-market / macro-print / event distribution asks",
  },
  {
    variant: "agent-handoff",
    summary: "Pill card while a desk handoff is inflight",
    when_to_use: "Emitted by the handoff tool, not by free-text prose",
  },
  {
    variant: "risk-flag",
    summary: "Severity-tagged news / IV / flow risk callout",
    when_to_use: "Breaking headlines, IV regime shifts, headline-tape risk",
  },
  {
    variant: "backtest-result",
    summary: "Strategy performance numerics",
    when_to_use: "Returning a backtest or walk-forward result",
  },
  {
    variant: "narrative-thread",
    summary: "Catalyst + symbols + confidence link-through to Sanctum",
    when_to_use: "Promoting a story to a NarrativeFlow thread",
  },
] as const;
