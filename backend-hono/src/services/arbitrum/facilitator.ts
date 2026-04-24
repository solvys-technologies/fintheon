// [claude-code 2026-04-24] S35-T1: Arbitrum facilitator — weighted consensus,
// dissent detection, and human-readable digest. No `decision` field, no
// `recommended_action`, no auto-trade output. Human-in-the-loop by design.

import type {
  ArbitrumDeliberateInput,
  ArbitrumDissent,
  ArbitrumSeatTranscript,
} from "./types.js";

const DISSENT_THRESHOLD_PP = 0.18; // 18 percentage points from weighted mean

export interface SynthesisResult {
  consensus_probability: number;
  confidence: number;
  dissent: ArbitrumDissent | null;
  digest_text: string;
}

interface SeatFinal {
  seat: ArbitrumSeatTranscript;
  probability: number;
  confidence: number;
  rationale: string;
  risks: string[];
}

function extractFinal(seat: ArbitrumSeatTranscript): SeatFinal | null {
  const last = seat.rounds[seat.rounds.length - 1];
  if (!last) return null;
  return {
    seat,
    probability: last.probability,
    confidence: last.confidence,
    rationale: last.rationale,
    risks: last.risks,
  };
}

function weightedMean(
  finals: SeatFinal[],
  key: "probability" | "confidence",
): number {
  let wSum = 0;
  let acc = 0;
  for (const f of finals) {
    wSum += f.seat.weight;
    acc += f.seat.weight * f[key];
  }
  if (wSum === 0) return 0;
  return acc / wSum;
}

function detectDissent(
  finals: SeatFinal[],
  weightedProb: number,
): ArbitrumDissent | null {
  let worst: { f: SeatFinal; magnitude: number } | null = null;
  for (const f of finals) {
    const magnitude = Math.abs(f.probability - weightedProb);
    if (magnitude > DISSENT_THRESHOLD_PP) {
      if (!worst || magnitude > worst.magnitude) {
        worst = { f, magnitude };
      }
    }
  }
  if (!worst) return null;
  return {
    seat: worst.f.seat.id,
    rationale: worst.f.rationale,
    magnitude_pp: Math.round(worst.magnitude * 10000) / 100,
  };
}

function pctFmt(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function buildDigest(
  input: ArbitrumDeliberateInput,
  finals: SeatFinal[],
  weightedProb: number,
  weightedConf: number,
  dissent: ArbitrumDissent | null,
): string {
  const lines: string[] = [];
  lines.push(`Chamber reads ${pctFmt(weightedProb)} on: ${input.question}`);
  lines.push(
    `Weighted confidence ${pctFmt(weightedConf)} across ${finals.length} seats (category: ${input.category}).`,
  );

  const sorted = [...finals].sort((a, b) => b.seat.weight - a.seat.weight);
  const bodyLines = sorted.map(
    (f) =>
      `- ${f.seat.role} (${pctFmt(f.probability)}, conf ${pctFmt(f.confidence)}): ${f.rationale.trim()}`,
  );
  lines.push("");
  lines.push("Seat reads:");
  lines.push(...bodyLines);

  if (dissent) {
    lines.push("");
    lines.push(
      `Dissent: ${dissent.seat} is ${dissent.magnitude_pp}pp off the weighted mean — ${dissent.rationale.trim()}`,
    );
  }

  const topRisks = Array.from(
    new Set(sorted.flatMap((f) => f.risks).filter(Boolean)),
  ).slice(0, 5);
  if (topRisks.length > 0) {
    lines.push("");
    lines.push(`Top risks: ${topRisks.join("; ")}`);
  }

  lines.push("");
  lines.push(
    "This is a signal landscape, not an execution instruction. Human review required.",
  );

  return lines.join("\n");
}

export function synthesize(
  seats: ArbitrumSeatTranscript[],
  input: ArbitrumDeliberateInput,
): SynthesisResult {
  const finals = seats
    .map(extractFinal)
    .filter((f): f is SeatFinal => f !== null);

  if (finals.length === 0) {
    return {
      consensus_probability: 0.5,
      confidence: 0,
      dissent: null,
      digest_text:
        "Chamber produced no seat reads this cycle — all providers unreachable or drafts empty.",
    };
  }

  const weightedProb = weightedMean(finals, "probability");
  const weightedConf = weightedMean(finals, "confidence");
  const dissent = detectDissent(finals, weightedProb);
  const digest_text = buildDigest(
    input,
    finals,
    weightedProb,
    weightedConf,
    dissent,
  );

  return {
    consensus_probability: weightedProb,
    confidence: weightedConf,
    dissent,
    digest_text,
  };
}
