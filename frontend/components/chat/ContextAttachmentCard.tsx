// [claude-code 2026-04-25] v5.29.2 hotfix: Ask About This was inlining a JSON
// blob into the user's chat message. This card replaces the JSON block with a
// theme-sensitive surface that mounts via solvys-transitions `t-panel-slide`.
//
// Usage: parse the user's text via `extractAttachedContext()`. If a context
// block is present, render <ContextAttachmentCard> above the cleaned text and
// pass `cleanedText` to the existing TextPart renderer.

import { useEffect, useState } from "react";

export interface AttachedContext {
  surface: string;
  payload: Record<string, unknown> | null;
  /** Text with the [Context surface=...] block stripped — pass to TextPart. */
  cleanedText: string;
}

const CONTEXT_BLOCK_RE =
  /\n*\[Context surface=([\w-]+)\]\n([\s\S]*?)(?:\n\n|$)/;

export function extractAttachedContext(text: string): AttachedContext | null {
  const m = text.match(CONTEXT_BLOCK_RE);
  if (!m) return null;
  const surface = m[1];
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(m[2]) as Record<string, unknown>;
  } catch {
    payload = null;
  }
  const cleanedText = text.replace(CONTEXT_BLOCK_RE, "").trim();
  return { surface, payload, cleanedText };
}

function prettySurface(surface: string): string {
  return surface.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

interface CardProps {
  surface: string;
  payload: Record<string, unknown> | null;
}

export function ContextAttachmentCard({ surface, payload }: CardProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const headline =
    (payload?.headline as string | undefined) ??
    (payload?.title as string | undefined) ??
    (payload?.label as string | undefined) ??
    null;

  const meta: Array<[string, unknown]> = [];
  if (payload) {
    for (const [k, v] of Object.entries(payload)) {
      if (k === "headline" || k === "title" || k === "label") continue;
      if (k === "itemId") continue;
      meta.push([k, v]);
    }
  }

  return (
    <div
      className="t-panel-slide mb-2 rounded-md border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)]/80 p-3"
      data-open={open}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
          {prettySurface(surface)}
        </span>
        {payload?.itemId ? (
          <span className="font-mono text-[10px] text-[var(--fintheon-text)]/40">
            {String(payload.itemId).slice(0, 18)}
          </span>
        ) : null}
      </div>
      {headline ? (
        <div className="mt-1.5 text-[13px] leading-snug text-[var(--fintheon-text)]">
          {headline}
        </div>
      ) : null}
      {meta.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--fintheon-text)]/65">
          {meta.map(([k, v]) => (
            <span key={k} className="inline-flex items-baseline gap-1">
              <span className="text-[var(--fintheon-text)]/45">{k}:</span>
              <span className="text-[var(--fintheon-text)]/80">
                {formatValue(v)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
