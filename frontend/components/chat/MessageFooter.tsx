// [claude-code 2026-04-25] S42-T3: per-message footer rendered beneath the
//   assistant bubble. Shows `agent · gen HH:MM:SS · Ns · N sources` from the
//   `complete` BridgeStreamEvent. Collapses gracefully when fields are absent
//   so the bubble keeps rendering during the T1 dark period.

import type { CompleteEvent } from "../../types/bridge-stream";

interface MessageFooterProps {
  agent?: string;
  generatedAt?: Date | string;
  latencyMs?: number;
  sourceCount?: number;
  model?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLatency(ms: number) {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function MessageFooter({
  agent,
  generatedAt,
  latencyMs,
  sourceCount,
  model,
}: MessageFooterProps) {
  const segments: string[] = [];
  if (agent) segments.push(agent);
  if (generatedAt) {
    const d = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
    if (!Number.isNaN(d.getTime())) segments.push(`gen ${formatTime(d)}`);
  }
  if (typeof latencyMs === "number" && latencyMs > 0) {
    segments.push(formatLatency(latencyMs));
  }
  if (typeof sourceCount === "number" && sourceCount > 0) {
    segments.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
  }
  if (model) segments.push(model);

  if (segments.length === 0) return null;

  return (
    <div
      className="mt-1 flex items-center gap-1.5 px-1 text-[10px] font-mono tabular-nums text-[#f0ead6]/40"
      role="contentinfo"
    >
      {segments.map((seg, i) => (
        <span key={`seg-${i}`} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-[#c79f4a]/40" aria-hidden="true">
              ·
            </span>
          )}
          <span>{seg}</span>
        </span>
      ))}
    </div>
  );
}

/** Convenience overload that takes the raw complete event. */
export function MessageFooterFromEvent({
  complete,
  fallbackAgent,
}: {
  complete?: CompleteEvent;
  fallbackAgent?: string;
}) {
  if (!complete) return null;
  return (
    <MessageFooter
      agent={complete.agent ?? fallbackAgent}
      generatedAt={complete.generatedAt}
      latencyMs={complete.latencyMs}
      sourceCount={complete.sourceCount}
      model={complete.model}
    />
  );
}
