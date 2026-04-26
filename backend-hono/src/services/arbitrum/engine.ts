// [claude-code 2026-04-24] S35-T1/T12 Phase B: Arbitrum chamber orchestrator.
// Glues ARBITRUM_SEATS → invokeMoA → synthesize → computeGates → saveVerdict.
// No execution side-effects: the verdict is signal-only, digest text surfaced
// to UI (T3) and PMDB (T11). Callers fire this from (a) the 17:00 ET session
// scheduler and (b) the iv_score event trigger. Manual invocations come via
// POST /api/arbitrum/deliberate.

import { randomUUID } from "node:crypto";
import { createLogger } from "../../lib/logger.js";
import { ARBITRUM_SEATS, invokeMoA } from "./seats.js";
import { synthesize } from "./facilitator.js";
import { computeGates } from "./gates.js";
import { saveVerdict } from "./verdict-store.js";
import { loadArbitrumEconContext } from "./econ-context.js";
import type {
  ArbitrumDeliberateInput,
  ArbitrumSeatRound,
  ArbitrumSeatTranscript,
  ArbitrumTriggerSource,
  ArbitrumTriggerType,
  ArbitrumVerdict,
} from "./types.js";

const log = createLogger("ArbitrumEngine");

const DEFAULT_ROUNDS = 1;
const MAX_ROUNDS = 3;

export interface RunChamberOptions {
  rounds?: number;
  triggerSource?: ArbitrumTriggerSource | null;
}

export interface RunChamberResult {
  verdict: ArbitrumVerdict;
  persisted: boolean;
}

function clampRounds(requested: number | undefined): number {
  if (!Number.isFinite(requested)) return DEFAULT_ROUNDS;
  const n = Math.floor(Number(requested));
  if (n < 1) return 1;
  if (n > MAX_ROUNDS) return MAX_ROUNDS;
  return n;
}

function summarizePeerDrafts(rounds: ArbitrumSeatRound[]): string {
  if (rounds.length === 0) return "";
  return rounds
    .map(
      (r) =>
        `• prob=${(r.probability * 100).toFixed(0)}%, conf=${(r.confidence * 100).toFixed(0)}%, ${r.rationale.slice(0, 180)}`,
    )
    .join("\n");
}

/**
 * Run the 5-seat chamber. Each seat runs round-1 independently; if
 * `rounds > 1`, subsequent rounds feed a summary of other seats' prior
 * rounds back in so positions can adjust. Fire-and-forget safe: failures
 * at individual seats degrade to low-confidence stubs (see seats.ts).
 */
export async function runChamber(
  input: ArbitrumDeliberateInput,
  triggerType: ArbitrumTriggerType,
  opts: RunChamberOptions = {},
): Promise<RunChamberResult> {
  const t0 = Date.now();
  const rounds = clampRounds(opts.rounds);

  // Load recent econ prints + upcoming releases so every seat reasons over the
  // same data the Aquarium event-card surfaces. Caller-supplied context wins.
  const econ_context =
    input.econ_context !== undefined
      ? input.econ_context
      : await loadArbitrumEconContext().catch((err) => {
          log.warn("Econ context load failed — proceeding without it", {
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        });
  const enrichedInput: ArbitrumDeliberateInput = { ...input, econ_context };

  const transcripts: ArbitrumSeatTranscript[] = ARBITRUM_SEATS.map((seat) => ({
    id: seat.id,
    role: seat.role,
    model: seat.model,
    provider: seat.provider,
    weight: seat.weight,
    rounds: [],
  }));

  for (let round = 1; round <= rounds; round++) {
    const peerDraftsSummary =
      round > 1
        ? transcripts
            .map((t) => {
              const last = t.rounds[t.rounds.length - 1];
              if (!last) return "";
              return `[${t.role}] prob=${(last.probability * 100).toFixed(0)}%, conf=${(last.confidence * 100).toFixed(0)}%\n${last.rationale.slice(0, 200)}`;
            })
            .filter(Boolean)
            .join("\n---\n")
        : undefined;

    const results = await Promise.all(
      ARBITRUM_SEATS.map((seat) =>
        invokeMoA(seat, enrichedInput, { round, peerDraftsSummary }),
      ),
    );

    for (let i = 0; i < transcripts.length; i++) {
      transcripts[i].rounds.push(results[i]);
    }
  }
  // Silence unused var lint on summarizePeerDrafts when MAX_ROUNDS=1 path.
  void summarizePeerDrafts;

  const synthesis = synthesize(transcripts, enrichedInput);
  const gates = computeGates(transcripts, enrichedInput.category);

  const verdict: ArbitrumVerdict = {
    verdict_id: randomUUID(),
    created_at: new Date().toISOString(),
    trigger_type: triggerType,
    question: input.question,
    category: input.category,
    seats: transcripts,
    consensus_probability: synthesis.consensus_probability,
    confidence: synthesis.confidence,
    dissent: synthesis.dissent,
    gates_surfaced: gates,
    digest_text: synthesis.digest_text,
    iv_simulation: input.iv_simulation ?? null,
    trigger_source: opts.triggerSource ?? null,
    latency_ms: Date.now() - t0,
  };

  const persisted = await saveVerdict(verdict);
  if (!persisted) {
    log.warn("Chamber verdict NOT persisted — Supabase unavailable", {
      verdict_id: verdict.verdict_id,
      trigger_type: triggerType,
    });
  } else {
    log.info("Chamber verdict persisted", {
      verdict_id: verdict.verdict_id,
      trigger_type: triggerType,
      consensus_probability: verdict.consensus_probability,
      dissent: verdict.dissent?.seat ?? null,
      latency_ms: verdict.latency_ms,
    });
  }

  return { verdict, persisted };
}
