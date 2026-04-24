// [claude-code 2026-04-24] S35-T3: standalone Arbitrum verdict card — consensus, confidence, digest, dissent
import { NothingFuse } from "../shared/NothingFuse";
import { DissentBadge } from "./DissentBadge";
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
  const conf = Math.round(confidence * 100);

  return (
    <div
      className={`bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 ${compact ? "p-3" : "p-4"} ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[var(--fintheon-accent)] leading-none"
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              fontSize: compact ? 28 : 40,
            }}
          >
            {pct}%
          </span>
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
          <span
            className="text-[var(--fintheon-text)]/80 text-xs"
            style={{ fontFamily: "Doto, ui-monospace, monospace" }}
          >
            {conf}%
          </span>
        </div>
        <NothingFuse
          value={confidence}
          color="var(--fintheon-accent)"
          thickness={3}
          segments={10}
        />
      </div>

      <p
        className={`mt-3 text-[var(--fintheon-text)]/85 ${compact ? "text-xs" : "text-sm"} leading-relaxed`}
      >
        {digest_text}
      </p>

      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--fintheon-text)]/40">
        <span>
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
        {trigger && (
          <span className="uppercase tracking-wider">{trigger}</span>
        )}
      </div>
    </div>
  );
}
