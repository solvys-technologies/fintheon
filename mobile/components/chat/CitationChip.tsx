// [claude-code 2026-04-25] S42-T3 mobile: numeric citation chip + `[N]`
//   parser. Click dispatches the same `fintheon:artifact` CustomEvent the
//   web bubble uses so T4's ArtifactPane handler is platform-shared.

import type { CitationEvent } from "@frontend/types/bridge-stream";

export interface CitationChipProps {
  id: number;
  source?: string;
  url?: string;
  excerpt?: string;
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

  return (
    <button
      type="button"
      onClick={handleClick}
      title={source ? (excerpt ? `${source} — ${excerpt}` : source) : `Citation ${id}`}
      data-citation-id={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 16,
        minWidth: 16,
        padding: "0 4px",
        marginLeft: 1,
        marginRight: 1,
        verticalAlign: "baseline",
        border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
        borderRadius: 3,
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--accent)",
        fontFamily: "var(--font-data)",
        fontSize: 10,
        lineHeight: 1,
        cursor: "pointer",
      }}
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

export function renderTextWithCitations(
  text: string,
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
  return out;
}
