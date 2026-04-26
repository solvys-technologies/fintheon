// [claude-code 2026-04-25] S42-T3 mobile: streamdown text adapter. Uses
//   Streamdown directly (no slot system on mobile) and overlays `[N]`
//   citation chips via component overrides for inline/block text tags. The
//   streaming caret keeps the same accent-blink as the web bubble for
//   visual parity.

import { Children, Fragment, type ReactNode } from "react";
import { Streamdown, type Components } from "streamdown";
import { CitationChip, renderTextWithCitations } from "./CitationChip";
import type { CitationEvent } from "@frontend/types/bridge-stream";

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
        components={components}
      >
        {content}
      </Streamdown>
      {isStreaming && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            marginLeft: 2,
            verticalAlign: "text-bottom",
            background: "var(--accent)",
            animation: "p 1.5s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}
