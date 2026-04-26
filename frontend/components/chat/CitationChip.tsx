// [claude-code 2026-04-25] S42-T3: numeric citation chip. `[N]` markers in
//   assistant text route to <CitationChip id={N} />. Click dispatches a
//   `fintheon:artifact` CustomEvent so T4's ArtifactPane can listen — until T4
//   lands the chip still renders + is keyboard-focusable, the dispatch is just
//   a no-op listener slot.

import type { CitationEvent } from "../../types/bridge-stream";

export interface CitationChipProps {
  id: number;
  source?: string;
  url?: string;
  excerpt?: string;
  /** Override the default `fintheon:artifact` window dispatch with a callback. */
  onClick?: (id: number) => void;
}

export function CitationChip({
  id,
  source,
  url,
  excerpt,
  onClick,
}: CitationChipProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onClick) {
      onClick(id);
      return;
    }
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("fintheon:artifact", {
        detail: { kind: "citation", payload: { id, source, url, excerpt } },
      }),
    );
  };

  const title = source
    ? excerpt
      ? `${source} — ${excerpt}`
      : source
    : `Citation ${id}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      data-citation-id={id}
      className="inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[3px] border border-[#c79f4a]/35 bg-[#c79f4a]/10 px-1 align-baseline text-[10px] font-mono tabular-nums leading-none text-[#c79f4a] transition-colors hover:border-[#c79f4a]/70 hover:bg-[#c79f4a]/20 focus:outline-none focus:ring-1 focus:ring-[#c79f4a]/60"
    >
      {id}
    </button>
  );
}

export type CitationLookup = Map<number, CitationEvent>;

export function buildCitationLookup(
  citations: readonly CitationEvent[],
): CitationLookup {
  const map: CitationLookup = new Map();
  for (const c of citations) map.set(c.id, c);
  return map;
}

/**
 * Splits a text run into alternating string + chip nodes by parsing `[N]`
 * markers. Used by both the streamdown text adapter and the plain-text path.
 */
export function renderTextWithCitations(
  text: string,
  lookup?: CitationLookup,
): (string | { type: "chip"; id: number })[] {
  const out: (string | { type: "chip"; id: number })[] = [];
  const re = /\[(\d{1,3})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const id = Number(m[1]);
    if (Number.isFinite(id)) out.push({ type: "chip", id });
    else out.push(m[0]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  // touch lookup so callers can validate ids; missing citations still render.
  void lookup;
  return out;
}
