// [claude-code 2026-04-25] Consensus + chamber-confidence numerals now use DigitGroup
//   (solvys-transitions number pop-in) so the percentages cascade in on every verdict refresh.
// [claude-code 2026-04-24] S35-T3: standalone Arbitrum verdict card — consensus, confidence, digest, dissent
import { NothingFuse } from "../shared/NothingFuse";
import { DigitGroup } from "../shared/DigitGroup";
import { DissentBadge } from "./DissentBadge";
import { StreamdownChat } from "../chat/slots";
import type { ArbitrumVerdict } from "./types";

interface VerdictCardProps {
  verdict: ArbitrumVerdict;
  compact?: boolean;
  className?: string;
}

export function VerdictCard({
  verdict,
  compact = false,
  className,
}: VerdictCardProps) {
  const {
    consensus_probability,
    confidence,
    digest_text,
    dissent,
    created_at,
    trigger,
  } = verdict;
  const pct = Math.round(consensus_probability * 100);
  const conf = Math.max(0, Math.min(10, confidence * 10));

  return (
    <div
      className={`bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 ${compact ? "p-3" : "p-4"} ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <DigitGroup
            value={`${pct}`}
            suffix="%"
            className="text-[var(--fintheon-accent)] leading-none"
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              fontSize: compact ? 28 : 40,
            }}
          />
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
            consensus
          </span>
        </div>
        {dissent && <DissentBadge dissent={dissent} />}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/50">
            chamber confidence
          </span>
          <DigitGroup
            value={conf.toFixed(1)}
            suffix="/10"
            className="text-[var(--fintheon-text)]/80 text-xs"
            style={{ fontFamily: "Doto, ui-monospace, monospace" }}
          />
        </div>
        <NothingFuse
          value={confidence}
          color="var(--fintheon-accent)"
          thickness={3}
          segments={10}
        />
      </div>

      <div
        className={`mt-3 prose prose-invert prose-sm max-w-none
          [&_p]:text-[var(--fintheon-text)]/85 [&_p]:leading-relaxed [&_p]:my-1
          [&_li]:text-[var(--fintheon-text)]/75 [&_ul]:my-1 [&_ul]:pl-4
          [&_strong]:text-[var(--fintheon-accent)] [&_strong]:font-medium
          [&_em]:text-[var(--fintheon-text)]/55 [&_em]:not-italic
          [&_hr]:border-[var(--fintheon-accent)]/15 [&_hr]:my-2
          ${compact ? "text-[11px]" : "text-sm"}`}
      >
        <StreamdownChat content={digest_text} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--fintheon-text)]/40">
        <span className="tabular-nums">
          {new Date(created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {new Date(created_at).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </span>
        {trigger && <span className="uppercase tracking-wider">{trigger}</span>}
      </div>
    </div>
  );
}
