// [claude-code 2026-03-27] S3: Plain text detail footer for expanded RiskFlow cards
// Shows IV, deviation, beat/miss, cyclical, sub-scores, speaker, regime as monospace tickers
import type { RiskFlowAlert, SubScoreBreakdown } from "../../lib/riskflow-feed";

interface DetailFooterProps {
  alert: RiskFlowAlert;
}

/** Compute deviation % from econData actual vs forecast */
function computeDeviation(
  alert: RiskFlowAlert,
): { text: string; color: string } | null {
  const ed = alert.econData;
  if (!ed || ed.actual == null || ed.forecast == null || ed.forecast === 0)
    return null;
  const dev = ((ed.actual - ed.forecast) / Math.abs(ed.forecast)) * 100;
  const sign = dev >= 0 ? "+" : "";
  return {
    text: `${sign}${dev.toFixed(2)}%`,
    color:
      dev > 0 ? "text-emerald-400" : dev < 0 ? "text-red-400" : "text-zinc-500",
  };
}

/** Derive beat/miss from econData */
function deriveBeatMiss(
  alert: RiskFlowAlert,
): { label: string; color: string } | null {
  const ed = alert.econData;
  if (ed?.beatMiss) {
    if (ed.beatMiss === "beat")
      return { label: "BEAT", color: "text-emerald-400" };
    if (ed.beatMiss === "miss") return { label: "MISS", color: "text-red-400" };
    if (ed.beatMiss === "inline")
      return { label: "IN LINE", color: "text-zinc-500" };
  }
  // Derive from numbers if no beatMiss field
  if (!ed || ed.actual == null || ed.forecast == null) return null;
  const diff = Math.abs(ed.actual - ed.forecast);
  const threshold = Math.abs(ed.forecast) * 0.005; // 0.5% tolerance
  if (diff <= threshold) return { label: "IN LINE", color: "text-zinc-500" };
  return ed.actual > ed.forecast
    ? { label: "BEAT", color: "text-emerald-400" }
    : { label: "MISS", color: "text-red-400" };
}

/** Infer cyclical/counter-cyclical */
function getCyclicalLabel(
  alert: RiskFlowAlert,
): { label: string; color: string } | null {
  const cyc = alert.cyclical;
  if (!cyc || cyc === "Neutral") return null;
  if (cyc === "Cyclical")
    return { label: "CYC", color: "text-[var(--fintheon-accent)]" };
  return { label: "CTR", color: "text-violet-400" };
}

/** Format a sub-score value */
function fmt(n: number | undefined): string {
  if (n == null) return "—";
  return n.toFixed(n >= 10 ? 0 : n >= 1 ? 1 : 2);
}

export function DetailFooter({ alert }: DetailFooterProps) {
  const sub = alert.subScores;
  const deviation = computeDeviation(alert);
  const beatMiss = deriveBeatMiss(alert);
  const cyclical = getCyclicalLabel(alert);

  // Compute IV display from sub-scores or fall back to ivScore-like calc
  const ivDisplay = sub
    ? Math.min(
        10,
        Math.max(
          0,
          ((sub.eventWeight +
            sub.timing +
            sub.deviation +
            sub.momentum +
            sub.vixContext) *
            (sub.vixMultiplier ?? 1) *
            (sub.regimeMultiplier ?? 1) *
            (sub.commentatorMultiplier ?? 1)) /
            2.8,
        ),
      ).toFixed(1)
    : null;

  const hasRow1 = ivDisplay || deviation || beatMiss || cyclical;
  const hasRow2 = !!sub;
  const hasSpeaker =
    sub?.speaker &&
    sub?.commentatorMultiplier != null &&
    sub.commentatorMultiplier !== 0.8;
  const hasRegime = !!sub?.regimeName;
  const hasRow3 = hasSpeaker || hasRegime;

  if (!hasRow1 && !hasRow2) return null;

  return (
    <div className="border-t border-zinc-800/40 bg-zinc-900/50 px-3 py-1.5 space-y-0.5">
      {/* Row 1: IV · Deviation · Beat/Miss · Cyclical */}
      {hasRow1 && (
        <div className="flex items-center gap-3 font-mono text-[9px] tabular-nums">
          {ivDisplay && (
            <span className="text-zinc-400">
              IV:{" "}
              <span className="text-[var(--fintheon-accent)] font-semibold">
                {ivDisplay}
              </span>
            </span>
          )}
          {deviation && (
            <span className="text-zinc-500">
              Deviation:{" "}
              <span className={deviation.color}>{deviation.text}</span>
            </span>
          )}
          {beatMiss && (
            <span className="text-zinc-500">
              Beat/Miss:{" "}
              <span className={`font-semibold ${beatMiss.color}`}>
                {beatMiss.label}
              </span>
            </span>
          )}
          {cyclical && (
            <span className={`font-semibold ${cyclical.color}`}>
              {cyclical.label}
            </span>
          )}
        </div>
      )}

      {/* Row 2: E · T · D · M · VIX · Regime multiplier */}
      {hasRow2 && sub && (
        <div className="font-mono text-[9px] text-zinc-500 tabular-nums">
          <span>E:{fmt(sub.eventWeight)}</span>
          {"  "}
          <span>T:{fmt(sub.timing)}</span>
          {"  "}
          <span>D:{fmt(sub.deviation)}</span>
          {"  "}
          <span>M:{fmt(sub.momentum)}</span>
          {"  "}
          <span>VIX:×{fmt(sub.vixMultiplier)}</span>
          {sub.regimeMultiplier != null && sub.regimeMultiplier !== 1 && (
            <>
              {"  "}
              <span>Regime:×{fmt(sub.regimeMultiplier)}</span>
            </>
          )}
        </div>
      )}

      {/* Row 3: Speaker + Regime name (only if available) */}
      {hasRow3 && (
        <div className="font-mono text-[9px] text-zinc-500 tabular-nums">
          {hasSpeaker && (
            <span className="text-[var(--fintheon-accent)]/70">
              Speaker: {sub!.speaker} (×{fmt(sub!.commentatorMultiplier)})
            </span>
          )}
          {hasSpeaker && hasRegime && (
            <span>
              {"  "}·{"  "}
            </span>
          )}
          {hasRegime && (
            <span className="text-cyan-400/70">Regime: {sub!.regimeName}</span>
          )}
        </div>
      )}
    </div>
  );
}
