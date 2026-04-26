// [claude-code 2026-04-25] S42-T3: streamdown text adapter. Layers `[N]`
//   citation-chip parsing onto Streamdown via component overrides for the
//   text-bearing inline/block tags (p, li, td, strong, em, a, span). Keeps
//   the existing slot system from `./slots/StreamdownChat` intact and adds
//   a streaming caret at the tail. The `@assistant-ui/react-streamdown`
//   primitive is the canonical adapter when a runtime context is present;
//   this wrapper is the prop-driven equivalent until that lands.

import { Children, Fragment, type ReactNode } from "react";
import { Streamdown, type Components, type CustomRenderer } from "streamdown";
import { CitationChip, renderTextWithCitations } from "./CitationChip";
import { SLOT_LANGUAGES, SLOT_RENDERERS } from "./slots/StreamdownChat";
import type { CitationEvent } from "../../types/bridge-stream";

const RENDERERS: CustomRenderer[] = SLOT_LANGUAGES.map((language) => ({
  language,
  component: SLOT_RENDERERS[language],
}));

interface StreamdownTextProps {
  content: string;
  isStreaming?: boolean;
  citations?: readonly CitationEvent[];
  onCitationClick?: (citation: CitationEvent | { id: number }) => void;
  className?: string;
}

export function StreamdownText({
  content,
  isStreaming,
  citations,
  onCitationClick,
  className,
}: StreamdownTextProps) {
  const lookup = new Map<number, CitationEvent>();
  if (citations) for (const c of citations) lookup.set(c.id, c);

  const handleClick = (id: number) => {
    const c = lookup.get(id);
    if (onCitationClick) {
      onCitationClick(c ?? { id });
      return;
    }
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("fintheon:artifact", {
        detail: { kind: "citation", payload: c ?? { id } },
      }),
    );
  };

  const walkChildren = (children: ReactNode, keyPrefix: string): ReactNode =>
    Children.map(children, (child, i) => {
      if (typeof child === "string") {
        const tokens = renderTextWithCitations(child);
        if (tokens.length === 1 && typeof tokens[0] === "string") return child;
        return (
          <Fragment key={`${keyPrefix}-${i}`}>
            {tokens.map((tok, j) =>
              typeof tok === "string" ? (
                <Fragment key={`${keyPrefix}-${i}-${j}`}>{tok}</Fragment>
              ) : (
                <CitationChip
                  key={`${keyPrefix}-${i}-${j}`}
                  id={tok.id}
                  source={lookup.get(tok.id)?.source}
                  url={lookup.get(tok.id)?.url}
                  excerpt={lookup.get(tok.id)?.excerpt}
                  onClick={handleClick}
                />
              ),
            )}
          </Fragment>
        );
      }
      return child;
    });

  // Tags whose children are inline text (where `[N]` can appear directly).
  const components: Components = {
    p: ({ children, ...props }) => (
      <p {...props}>{walkChildren(children, "p")}</p>
    ),
    li: ({ children, ...props }) => (
      <li {...props}>{walkChildren(children, "li")}</li>
    ),
    td: ({ children, ...props }) => (
      <td {...props}>{walkChildren(children, "td")}</td>
    ),
    th: ({ children, ...props }) => (
      <th {...props}>{walkChildren(children, "th")}</th>
    ),
    strong: ({ children, ...props }) => (
      <strong {...props}>{walkChildren(children, "strong")}</strong>
    ),
    em: ({ children, ...props }) => (
      <em {...props}>{walkChildren(children, "em")}</em>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote {...props}>{walkChildren(children, "bq")}</blockquote>
    ),
  };

  return (
    <div className={className} data-streamdown-text>
      <Streamdown
        mode={isStreaming ? "streaming" : "static"}
        parseIncompleteMarkdown={isStreaming}
        plugins={{ renderers: RENDERERS }}
        components={components}
      >
        {content}
      </Streamdown>
      {isStreaming && (
        <span
          className="ml-0.5 inline-block h-[1em] w-[2px] align-text-bottom bg-[var(--fintheon-accent)]"
          style={{ animation: "p 1.5s ease-in-out infinite" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
