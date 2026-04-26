// [claude-code 2026-04-25] S42-T3: thread citations through to TextPartRenderer
//   so `[N]` markers route to CitationChip lookup.
// [claude-code 2026-03-06] Composite renderer dispatching each MessagePart to its typed renderer
import type { MessagePart, ToolResultPart } from "../types";
import type { CitationEvent } from "../../../types/bridge-stream";
import { TextPartRenderer } from "./TextPart";
import { ReasoningPartRenderer } from "./ReasoningPart";
import { ToolCallPartRenderer } from "./ToolCallPart";

interface MessagePartRendererProps {
  parts: MessagePart[];
  isStreaming?: boolean;
  citations?: readonly CitationEvent[];
}

export function MessagePartRenderer({
  parts,
  isStreaming,
  citations,
}: MessagePartRendererProps) {
  // Build lookup of tool-result parts keyed by toolInvocationId
  const resultMap = new Map<string, ToolResultPart>();
  for (const p of parts) {
    if (p.type === "tool-result") {
      resultMap.set(p.toolInvocationId, p);
    }
  }

  // Find the index of the last text part (for streaming cursor)
  let lastTextIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].type === "text") {
      lastTextIndex = i;
      break;
    }
  }

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const key = `part-${i}-${part.type}`;

        switch (part.type) {
          case "text":
            return (
              <TextPartRenderer
                key={key}
                text={part.text}
                isStreaming={isStreaming && i === lastTextIndex}
                citations={citations}
              />
            );
          case "reasoning":
            // Reasoning is shown by FintheonThinkingIndicator — skip inline rendering
            return null;
          case "tool-invocation":
            return (
              <ToolCallPartRenderer
                key={key}
                part={part}
                result={resultMap.get(part.id)}
              />
            );
          case "tool-result":
            // Handled by tool-invocation above
            return null;
          default:
            return null;
        }
      })}
    </div>
  );
}
