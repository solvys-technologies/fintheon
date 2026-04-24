// [claude-code 2026-04-24] S35-T3: compact peek for IV hover portal — consensus + dissent + digest line
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { DissentBadge } from "./DissentBadge";

const EMPTY_COPY = "No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5.";

export function ArbitrumPeek() {
  const { verdict, isLoading } = useArbitrumLatest();

  if (isLoading) {
    return (
      <div className="border-t border-[var(--fintheon-accent)]/20 pt-2 mt-3 text-xs text-[var(--fintheon-text)]/50">
        Loading chamber read…
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="border-t border-[var(--fintheon-accent)]/20 pt-2 mt-3 text-xs text-[var(--fintheon-text)]/50">
        {EMPTY_COPY}
      </div>
    );
  }

  const {
    consensus_probability,
    confidence,
    dissent,
    digest_text,
    created_at,
  } = verdict;

  return (
    <div className="border-t border-[var(--fintheon-accent)]/20 pt-2 mt-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[var(--fintheon-accent)] text-sm leading-none"
          style={{ fontFamily: "Doto, ui-monospace, monospace" }}
        >
          {Math.round(consensus_probability * 100)}%
        </span>
        <span className="text-[var(--fintheon-text)]/70">
          conf {Math.round(confidence * 100)}%
        </span>
        {dissent && <DissentBadge dissent={dissent} />}
      </div>
      <p className="mt-1 text-[var(--fintheon-text)]/80 line-clamp-2">
        {digest_text}
      </p>
      <div className="mt-1 text-[var(--fintheon-text)]/40 text-[10px]">
        {new Date(created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · Sanctum for full
      </div>
    </div>
  );
}
