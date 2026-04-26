// [claude-code 2026-04-25] S42-T3 mobile: per-message footer rendered beneath
//   the assistant bubble. Mirrors the frontend MessageFooter contract so the
//   `agent · gen HH:MM:SS · Ns · N sources` line reads identically across
//   web + mobile. Collapses gracefully when fields are absent.

import type { CSSProperties } from "react";
import type { CompleteEvent } from "@frontend/types/bridge-stream";

interface MessageFooterProps {
  agent?: string;
  generatedAt?: Date | string;
  latencyMs?: number;
  sourceCount?: number;
  model?: string;
  align?: "start" | "end";
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
  align = "start",
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

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-data)",
    fontSize: 10,
    color: "var(--text-disabled)",
    alignSelf: align === "end" ? "flex-end" : "flex-start",
    paddingLeft: align === "end" ? 0 : 4,
    paddingRight: align === "end" ? 4 : 0,
  };

  return (
    <div style={containerStyle} role="contentinfo">
      {segments.map((seg, i) => (
        <span
          key={`seg-${i}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {i > 0 && (
            <span style={{ color: "var(--accent)" }} aria-hidden="true">
              ·
            </span>
          )}
          <span>{seg}</span>
        </span>
      ))}
    </div>
  );
}

export function MessageFooterFromEvent({
  complete,
  fallbackAgent,
  align,
}: {
  complete?: CompleteEvent;
  fallbackAgent?: string;
  align?: "start" | "end";
}) {
  if (!complete) return null;
  return (
    <MessageFooter
      agent={complete.agent ?? fallbackAgent}
      generatedAt={complete.generatedAt}
      latencyMs={complete.latencyMs}
      sourceCount={complete.sourceCount}
      model={complete.model}
      align={align}
    />
  );
}
