import type { ArbitrumSeatRound, ArbitrumSeatTranscript } from "./types.js";

export function hasUsableSeatRead(seats: ArbitrumSeatTranscript[]): boolean {
  return seats.some((seat) => {
    const last = seat.rounds[seat.rounds.length - 1];
    return last ? !isUnavailableSeatRound(last) : false;
  });
}

export function isStoredVerdictDegraded(row: Record<string, unknown>): boolean {
  const digest = String(row.digest_text ?? "").toLowerCase();
  if (
    digest.includes("chamber unavailable") ||
    digest.includes("chamber produced no seat reads")
  )
    return true;

  const seats = Array.isArray(row.seats) ? row.seats : [];
  if (seats.length === 0) return false;
  return seats.every((seat) => isUnavailableStoredSeatRound(seat));
}

function isUnavailableSeatRound(round: ArbitrumSeatRound): boolean {
  const rationale = round.rationale.toLowerCase();
  const risks = round.risks.map((risk) => risk.toLowerCase());
  return (
    round.confidence <= 0.11 &&
    (rationale.includes("unavailable this round") ||
      risks.includes("model-unavailable"))
  );
}

function isUnavailableStoredSeatRound(seat: unknown): boolean {
  if (!seat || typeof seat !== "object") return false;
  const rounds = (seat as { rounds?: unknown[] }).rounds;
  const last = Array.isArray(rounds) ? rounds[rounds.length - 1] : null;
  if (!last || typeof last !== "object") return false;

  const round = last as {
    confidence?: unknown;
    rationale?: unknown;
    risks?: unknown;
  };
  const confidence = Number(round.confidence ?? 1);
  const rationale = String(round.rationale ?? "").toLowerCase();
  const risks = Array.isArray(round.risks)
    ? round.risks.map((risk) => String(risk).toLowerCase())
    : [];
  return (
    confidence <= 0.11 &&
    (rationale.includes("unavailable this round") ||
      risks.includes("model-unavailable"))
  );
}
