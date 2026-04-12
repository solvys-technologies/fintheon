// [claude-code 2026-04-12] Renders URLs embedded in text as clickable links (opens new tab)
import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s)<>]+/g;

export function linkifyText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const idx = match.index!;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <a
        key={idx}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-zinc-600 hover:decoration-[var(--fintheon-accent)] hover:text-[var(--fintheon-accent)] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    lastIndex = idx + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 1 ? <>{parts}</> : text;
}
