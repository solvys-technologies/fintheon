import { AgentActivityRail, type ActivityEntry } from "./AgentActivityRail";
import { CitationChip, type Citation } from "./CitationChip";

interface AssistantMessagePrimitiveProps {
  rawContent: unknown;
  messageId?: string;
  agentName?: string;
  genTime?: Date;
  citations?: Citation[];
  onPinCitation?: (citation: Citation) => void;
  pinnedCitationIndex?: number;
  onTakeNote?: (messageId: string, content: string) => void;
  isStreaming?: boolean;
  activityEntries?: ActivityEntry[];
}

function textFromRawContent(rawContent: unknown): string {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as { type?: string; text?: string };
      if (p.type === "text" && typeof p.text === "string") return p.text;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function AssistantMessagePrimitive({
  rawContent,
  messageId,
  agentName,
  citations = [],
  onPinCitation,
  pinnedCitationIndex,
  onTakeNote,
  isStreaming,
  activityEntries = [],
}: AssistantMessagePrimitiveProps) {
  const text = textFromRawContent(rawContent);
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          border: "1px solid #27272a",
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        {agentName ? (
          <div style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 6 }}>
            {agentName}
          </div>
        ) : null}
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 13,
            color: "var(--fintheon-text)",
          }}
        >
          {text || (isStreaming ? "…" : "")}
        </div>
        {citations.length > 0 ? (
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}
          >
            {citations.map((citation) => (
              <CitationChip
                key={`${citation.index}-${citation.title}`}
                citation={citation}
                onClick={onPinCitation}
                active={citation.index === pinnedCitationIndex}
              />
            ))}
          </div>
        ) : null}
        <AgentActivityRail entries={activityEntries} />
        {onTakeNote && messageId && text ? (
          <button
            type="button"
            onClick={() => onTakeNote(messageId, text)}
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--fintheon-accent)",
              background: "transparent",
              border: "none",
            }}
          >
            Take Note
          </button>
        ) : null}
      </div>
    </div>
  );
}
