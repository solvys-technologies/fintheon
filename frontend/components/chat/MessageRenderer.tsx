import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import { THINKING_TERMS } from './constants';
import { FuturesChart } from './widgets/FuturesChart';
import { EconomicCalendar } from './widgets/EconomicCalendar';

interface MessageRendererProps {
    content: string;
    onRenderWidget?: (widget: any) => React.ReactNode;
}

export function MessageRenderer({ content, onRenderWidget }: MessageRendererProps) {
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

    // Handle undefined or empty content
    const safeContent = content || '';

    // Parse content to separate "thinking" block from response
    // Assuming a format where thinking is potentially enclosed in <thinking> tags
    // or detecting "Thinking..." patterns. 
    // For now, we'll try to detect if the message starts with a thinking term from our list

    // A more robust way might be if the backend sends it in specific tags:
    // <thought>...</thought>
    // Let's support that pattern.

    const thoughtMatch = safeContent.match(/<thought>([\s\S]*?)<\/thought>/);
    const thoughtContent = thoughtMatch ? thoughtMatch[1] : null;
    const mainContent = thoughtMatch ? safeContent.replace(thoughtMatch[0], '') : safeContent;

    // If no explicit tag, maybe look for terms at start? 
    // Ideally backend should structure this. 
    // For now, we'll stick to the tag or just render pure markdown if not found.

    return (
        <div className="message-content space-y-4">
            {thoughtContent && (
                <div className="thinking-block border border-gold-500/20 rounded-lg bg-black/40 overflow-hidden">
                    <button
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="w-full flex items-center gap-2 p-3 text-xs font-mono text-gold-500/80 hover:bg-gold-500/5 transition-colors"
                    >
                        {isThinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <BrainCircuit size={14} />
                        <span className="uppercase tracking-wider">
                            {isThinkingExpanded ? 'Hide Thought Process' : 'View Thought Process'}
                        </span>
                    </button>

                    {isThinkingExpanded && (
                        <div className="p-4 border-t border-gold-500/20 text-sm text-gray-400 font-mono bg-black/60">
                            <div className="prose prose-invert max-w-none prose-sm">
                                <ReactMarkdown>{thoughtContent}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-gray-800">
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
                                } catch (e) {
                                    // Not valid JSON or not a widget, render as code
                                }
                            }

                            return !inline && match ? (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            )
                        }
                    }}
                >
                    {mainContent}
                </ReactMarkdown>
            </div>

            {/* Placeholder for future widget parsing logic */}
            {/* If we detect specific widget patterns in text, onRenderWidget() would be called here */}
        </div>
    );
}
