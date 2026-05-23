// [claude-code 2026-04-23] S32-T5 streamdown + TV charts — swapped ReactMarkdown
//   for Streamdown with registered slot renderers (catalyst-card, narrative-preview,
//   psych-table, perf-table, tv-chart, vision-insight). Legacy ```json widget= hooks
//   retained as onRenderWidget passthrough.
// [claude-code 2026-03-06] Part renderer for text content with markdown and widget detection

import { StreamdownChat } from "../slots";

interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  onRenderWidget?: (widget: any) => React.ReactNode | null;
}

export function TextPartRenderer({ text, isStreaming }: TextPartProps) {
  return (
    <div className="fintheon-chat-markdown text-sm text-zinc-300">
      <StreamdownChat content={text} streaming={isStreaming} />
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-[var(--fintheon-accent)] animate-pulse ml-0.5" />
      )}
    </div>
  );
}
