// [claude-code 2026-03-06] Part renderer for text content with markdown and widget detection
import ReactMarkdown from 'react-markdown';
import { FuturesChart } from '../widgets/FuturesChart';
import { EconomicCalendar } from '../widgets/EconomicCalendar';

interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  onRenderWidget?: (widget: any) => React.ReactNode | null;
}

export function TextPartRenderer({ text, isStreaming, onRenderWidget }: TextPartProps) {
  return (
    <div className="text-sm text-zinc-300">
      <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-gray-800 prose-sm">
        <ReactMarkdown
          components={{
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const isJson = match && match[1] === 'json';

              if (!inline && isJson) {
                try {
                  const content = String(children).replace(/\n$/, '');
                  const data = JSON.parse(content);

                  if (data.widget === 'chart') {
                    return (
                      <div className="my-4">
                        <FuturesChart symbol={data.data?.symbol} />
                      </div>
                    );
                  }

                  if (data.widget === 'calendar') {
                    return (
                      <div className="my-4">
                        <EconomicCalendar />
                      </div>
                    );
                  }

                  if (onRenderWidget) {
                    const rendered = onRenderWidget(data);
                    if (rendered) return <>{rendered}</>;
                  }
                } catch {
                  // Not valid JSON or not a widget, render as code
                }
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-[var(--fintheon-accent)] animate-pulse ml-0.5" />
      )}
    </div>
  );
}
