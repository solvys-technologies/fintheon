// [claude-code 2026-04-25] v5.29.2 hotfix: extract `[Context surface=...]`
//   blocks before rendering and mount a theme-aware ContextAttachmentCard so
//   "Ask About This" prompts no longer dump JSON into the user bubble.
// [claude-code 2026-04-25] S42-T3: route text rendering through StreamdownText
//   so `[N]` citation markers become CitationChip nodes. Streaming caret +
//   slot system live inside the adapter.
// [claude-code 2026-04-23] S32-T5 streamdown + TV charts — swapped ReactMarkdown
//   for Streamdown with registered slot renderers (catalyst-card, narrative-preview,
//   psych-table, perf-table, tv-chart, vision-insight). Legacy ```json widget= hooks
//   retained as onRenderWidget passthrough.
// [claude-code 2026-03-06] Part renderer for text content with markdown and widget detection

import { StreamdownText } from "../StreamdownText";
import {
  ContextAttachmentCard,
  extractAttachedContext,
} from "../ContextAttachmentCard";
import type { CitationEvent } from "../../../types/bridge-stream";

interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  citations?: readonly CitationEvent[];
}

export function TextPartRenderer({
  text,
  isStreaming,
  citations,
}: TextPartProps) {
  const attached = extractAttachedContext(text);
  const renderText = attached ? attached.cleanedText : text;

  return (
    <div className="text-sm text-zinc-300">
      {attached ? (
        <ContextAttachmentCard
          surface={attached.surface}
          payload={attached.payload}
        />
      ) : null}
      <StreamdownText
        content={renderText}
        isStreaming={isStreaming}
        citations={citations}
        className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-gray-800 prose-sm"
      />
    </div>
  );
}
