// [claude-code 2026-04-23] S32-T5 streamdown + TV charts — swapped ReactMarkdown
//   for Streamdown with registered slot renderers (catalyst-card, narrative-preview,
//   psych-table, perf-table, tv-chart, vision-insight). Legacy ```json widget= hooks
//   retained as onRenderWidget passthrough.
// [claude-code 2026-03-06] Part renderer for text content with markdown and widget detection

import { StreamdownChat } from "../slots";
import { RichTextRenderer } from "../../shared/RichTextRenderer";

interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  onRenderWidget?: (widget: any) => React.ReactNode | null;
}

export function TextPartRenderer({ text, isStreaming }: TextPartProps) {
  return (
    <div className="text-sm text-zinc-300">
      {isStreaming ? (
        <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-gray-800 prose-sm">
          <StreamdownChat content={text} streaming={isStreaming} />
        </div>
      ) : (
        <RichTextRenderer text={text} />
      )}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-[var(--fintheon-accent)] animate-pulse ml-0.5" />
      )}
    </div>
  );
}
