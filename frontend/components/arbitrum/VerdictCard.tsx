// [claude-code 2026-04-25] Consensus + chamber-confidence numerals now use DigitGroup
//   (solvys-transitions number pop-in) so the percentages cascade in on every verdict refresh.
// [claude-code 2026-04-24] S35-T3: standalone Arbitrum verdict card — consensus, confidence, digest, dissent
import { NothingFuse } from "../shared/NothingFuse";
import { DigitGroup } from "../shared/DigitGroup";
import { DissentBadge } from "./DissentBadge";
import type { ArbitrumVerdict } from "./types";

interface VerdictCardProps {
  verdict: ArbitrumVerdict;
  compact?: boolean;
  className?: string;
}

function cleanDigestText(text: string): string {
  return text
    .replace(
      /\s*,?\s*conf\s+\d+(?:\.\d+)?%?(?:\s*(?:\/|out of)\s*\d+(?:\.\d+)?%?)?/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
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
  const consensusScore = Math.max(0, Math.min(10, consensus_probability * 10));
  const confidenceScore = Math.max(0, Math.min(10, confidence * 10));
  const cleanedDigest = cleanDigestText(digest_text);

  return (
    <div
      className={`bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 ${compact ? "p-3" : "p-4"} ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <DigitGroup
            value={consensusScore.toFixed(1)}
            className="text-[var(--fintheon-accent)] leading-none"
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              fontSize: compact ? 28 : 40,
            }}
          />
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
            consensus score
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
            value={confidenceScore.toFixed(1)}
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

      {!compact && (
        <p
          className={`mt-3 text-[var(--fintheon-text)]/85 text-sm leading-relaxed`}
        >
          {cleanedDigest}
        </p>
      )}

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
