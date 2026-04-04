// [claude-code 2026-03-28] S8-T7: Kill kanban borders on assistant messages, add agent name header
// [claude-code 2026-03-11] T2b: Image part in user bubbles, T2c: CoT auto-open/close via useEffect
// [claude-code 2026-03-10] Enhanced FintheonThread — hover actions, scroll-to-bottom, CoT, fade-in
import { type FC, type RefObject, Component, type ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { ThreadPrimitive, useMessage, useThread } from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, Copy, Bookmark, ArrowDown, Check } from 'lucide-react';
import { ChatGreeting } from './ChatGreeting';
import { FintheonThinkingIndicator } from './FintheonThinkingIndicator';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { CognitionPanel } from './CognitionPanel';
import { ToolApprovalCard } from './ToolApprovalCard';
import { useToolApprovals } from './hooks/useToolApprovals';

/* ------------------------------------------------------------------ */
/*  Message-level error boundary                                        */
/* ------------------------------------------------------------------ */
class MessageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('[MessageErrorBoundary]', error.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs text-red-400/60 italic px-2 py-1">
          Failed to render message
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Markdown renderer                                                   */
/* ------------------------------------------------------------------ */

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 list-decimal pl-5 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-zinc-200 mb-1.5 mt-2 first:mt-0">{children}</h3>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-');
    return isBlock ? (
      <code className="block bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 overflow-x-auto my-2">
        {children}
      </code>
    ) : (
      <code className="bg-zinc-800/80 rounded px-1 py-0.5 text-xs font-mono text-zinc-300">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto">{children}</pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l border-[var(--fintheon-accent)]/20 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  hr: () => <hr className="border-white/10 my-3" />,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--fintheon-accent)] hover:text-[#C5A030] underline underline-offset-2">
      {children}
    </a>
  ),
} as const;

/* ------------------------------------------------------------------ */
/*  Timestamp formatter                                                 */
/* ------------------------------------------------------------------ */

function formatTimestamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${mm}/${dd}/${yy} ${time}`;
}

/* ------------------------------------------------------------------ */
/*  Text part — Markdown renderer                                       */
/* ------------------------------------------------------------------ */

const FintheonTextPart: FC<{ text: string }> = ({ text }) => {
  // Bypass MarkdownTextPrimitive entirely — it reads from assistant-ui context
  // which can produce non-string values during streaming, crashing ReactMarkdown (#185).
  // Instead, use the `text` prop directly (always a string from MessagePrimitive.Parts).
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  if (!safeText) return null;
  return (
    <div className="text-sm text-zinc-300 max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS as any}>
        {safeText}
      </ReactMarkdown>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Reasoning part — collapsible thinking pane                         */
/* ------------------------------------------------------------------ */

const FintheonReasoningPart: FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <details className="mb-2 group/reason">
      <summary className="text-[11px] text-zinc-500 cursor-pointer select-none hover:text-zinc-400 transition-colors flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open/reason:rotate-90" fill="currentColor">
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Thinking
      </summary>
      <div className="mt-1.5 pl-3 text-[11px] text-zinc-500 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </details>
  );
};

/* ------------------------------------------------------------------ */
/*  Chain of Thought display — gold-bordered thinking panel             */
/* ------------------------------------------------------------------ */

const ChainOfThoughtDisplay: FC<{ text: string; isStreaming?: boolean }> = ({ text, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else if (text) {
      const timer = setTimeout(() => setIsOpen(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, text]);

  if (!text) return null;

  return (
    <div className="mb-3 rounded-lg bg-[var(--fintheon-accent)]/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[var(--fintheon-accent)]/80 hover:text-[var(--fintheon-accent)] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
          <path d="M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
          <circle cx="8" cy="8" r="2" />
        </svg>
        <span>Chain of Thought</span>
        {isStreaming && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse ml-1" />
        )}
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="currentColor"
        >
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Hover action bar — Copy, Retry, Checkpoint                         */
/* ------------------------------------------------------------------ */

const ActionBar: FC<{ textContent: string; messageId?: string; onTakeNote?: (id: string, content: string) => void }> = ({
  textContent,
  messageId,
  onTakeNote,
}) => {
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [textContent]);

  const handleNote = useCallback(() => {
    if (!onTakeNote || !messageId || !textContent) return;
    onTakeNote(messageId, textContent);
    setNoted(true);
    setTimeout(() => setNoted(false), 2000);
  }, [onTakeNote, messageId, textContent]);

  return (
    <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
        title="Copy"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {onTakeNote && messageId && textContent && (
        <button
          onClick={handleNote}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Take Note — save to Harper memory"
        >
          <Bookmark size={10} />
          <span className="text-[9px]">{noted ? 'Noted' : 'Note'}</span>
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  User message                                                        */
/* ------------------------------------------------------------------ */

const FintheonUserMessage: FC = () => {
  const message = useMessage();
  const createdAt = (message as any).createdAt as Date | undefined;
  // AI SDK v6 UIMessage uses .parts, assistant-ui may expose .content — try both
  const rawContent = (message as any).parts ?? (message as any).content;
  const parts = Array.isArray(rawContent) ? rawContent : [];

  // Extract text and images directly — bypass MessagePrimitive.Parts (#185)
  const userText = parts
    .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n');
  const images = parts
    .filter((p: any) => p.type === 'image' && typeof p.image === 'string')
    .map((p: any) => p.image as string);

  return (
    <div className="group/msg flex flex-col items-end animate-fade-slide-in">
      <div className="max-w-[82%] rounded-2xl p-4 backdrop-blur-md border transition-colors fintheon-user-bubble">
        <MessageErrorBoundary>
          {userText && (
            <p className="text-sm text-white whitespace-pre-wrap break-words">{userText}</p>
          )}
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Attached"
              className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-white/10"
            />
          ))}
        </MessageErrorBoundary>
      </div>
      {createdAt && (
        <span className="text-[10px] text-zinc-600 mt-1 mr-1 opacity-0 group-hover/msg:opacity-100 transition-opacity tabular-nums">
          {formatTimestamp(createdAt)}
        </span>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Assistant message                                                   */
/* ------------------------------------------------------------------ */

const FintheonAssistantMessage: FC<{ onTakeNote?: (id: string, content: string) => void }> = ({ onTakeNote }) => {
  const message = useMessage();
  const createdAt = (message as any).createdAt as Date | undefined;
  const id = (message as any).id as string | undefined;

  const msg = message as any;

  // Try every known property: .parts (AI SDK v6), .content (assistant-ui), .text (plain string)
  const rawContent = msg.parts ?? msg.content;
  const parts = Array.isArray(rawContent) ? rawContent :
    typeof rawContent === 'string' ? [{ type: 'text', text: rawContent }] :
    typeof msg.text === 'string' ? [{ type: 'text', text: msg.text }] : [];

  // Extract full text for checkpoint / copy
  const currentText = parts
    .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n') ?? '';

  // Extract reasoning content for CoT display
  const currentReasoning = parts
    .filter((p: any) => p.type === 'reasoning' && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n');

  // Hold last known good content — prevents flicker when assistant-ui
  // reconciles the message (briefly empties content between stream end and finalization)
  const lastTextRef = useRef(currentText);
  const lastReasoningRef = useRef(currentReasoning);
  if (currentText) lastTextRef.current = currentText;
  if (currentReasoning) lastReasoningRef.current = currentReasoning;

  const textContent = currentText || lastTextRef.current;
  const reasoningContent = currentReasoning || lastReasoningRef.current;
  const hasReasoningContent = !!reasoningContent;

  // Don't render empty bubble while waiting for first stream tokens
  if (!textContent && !hasReasoningContent) return null;

  return (
    <div className="group/msg flex flex-col items-start animate-fade-slide-in">
      {/* Chain of Thought — gold-bordered, above message */}
      {hasReasoningContent && (
        <div className="max-w-[82%] mb-1">
          <ChainOfThoughtDisplay text={reasoningContent} />
        </div>
      )}

      <div className="max-w-[82%] px-1 transition-colors">
        <MessageErrorBoundary>
          {/* Render directly from extracted parts — bypass MessagePrimitive.Parts
              which crashes (#185) due to assistant-ui context/smooth-streaming internals */}
          {textContent && <FintheonTextPart text={textContent} />}
        </MessageErrorBoundary>
      </div>

      {/* Hover row: timestamp + action bar */}
      <div className="flex items-center gap-2 mt-1 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
        {createdAt && (
          <span className="text-[10px] text-zinc-600 tabular-nums">
            {formatTimestamp(createdAt)}
          </span>
        )}
      </div>
      <ActionBar
        textContent={textContent}
        messageId={id}
        onTakeNote={onTakeNote}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Scroll-to-bottom button                                             */
/* ------------------------------------------------------------------ */

const ScrollToBottomButton: FC<{ containerRef: RefObject<HTMLElement | null> }> = ({ containerRef }) => {
  const [showButton, setShowButton] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowButton(!entry.isIntersecting);
      },
      { root: containerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [containerRef]);

  return (
    <>
      {/* Sentinel element — placed at the bottom of scrollable content */}
      <div ref={sentinelRef} className="h-1 w-full" />

      {/* Floating button */}
      {showButton && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn fixed z-30 flex items-center justify-center rounded-full border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-surface)] text-[var(--fintheon-accent)] shadow-lg hover:bg-[var(--fintheon-accent)]/10"
          style={{
            width: '36px',
            height: '36px',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  AI Loader — initial hydration spinner                               */
/* ------------------------------------------------------------------ */

export const AiLoader: FC = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-2 border-[var(--fintheon-accent)]/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--fintheon-accent)] animate-spin" />
    </div>
    <span className="text-[11px] text-zinc-500">Loading conversation...</span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Direct-render message components — bypass useMessage() entirely     */
/*  These take the ThreadMessage as a prop, no context dependency        */
/* ------------------------------------------------------------------ */

function extractText(msg: any): string {
  const parts = msg.content ?? msg.parts ?? [];
  if (!Array.isArray(parts)) return typeof parts === 'string' ? parts : '';
  return parts
    .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n');
}

function extractReasoning(msg: any): string {
  const parts = msg.content ?? msg.parts ?? [];
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => p.type === 'reasoning' && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n');
}

function extractImages(msg: any): string[] {
  const parts = msg.content ?? msg.parts ?? [];
  if (!Array.isArray(parts)) return [];
  return parts
    .filter((p: any) => p.type === 'image' && typeof p.image === 'string')
    .map((p: any) => p.image as string);
}

const DirectUserMessage: FC<{ msg: any }> = ({ msg }) => {
  const text = extractText(msg);
  const images = extractImages(msg);
  return (
    <div className="group/msg flex flex-col items-end animate-fade-slide-in">
      <div className="max-w-[82%] rounded-2xl p-4 backdrop-blur-md border transition-colors fintheon-user-bubble">
        {text && <p className="text-sm text-white whitespace-pre-wrap break-words">{text}</p>}
        {images.map((src, i) => (
          <img key={i} src={src} alt="Attached" className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-white/10" />
        ))}
      </div>
    </div>
  );
};

const DirectAssistantMessage: FC<{ msg: any; agentName?: string; onTakeNote?: (id: string, content: string) => void }> = ({ msg, agentName, onTakeNote }) => {
  const textContent = extractText(msg);
  const reasoningContent = extractReasoning(msg);

  if (!textContent && !reasoningContent) return null;

  return (
    <div className="group/msg flex flex-col items-start animate-fade-slide-in">
      {/* Agent name header — small, borderless */}
      {agentName && (
        <span className="text-[10px] font-medium text-[var(--fintheon-accent)]/60 uppercase tracking-wider ml-1 mb-1">
          {agentName}
        </span>
      )}
      {reasoningContent && (
        <div className="max-w-[82%] mb-1">
          <ChainOfThoughtDisplay text={reasoningContent} />
        </div>
      )}
      <div className="max-w-[82%] px-1 transition-colors">
        {textContent && <FintheonTextPart text={textContent} />}
      </div>
      <ActionBar
        textContent={textContent}
        messageId={msg.id}
        onTakeNote={onTakeNote}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Thread                                                              */
/* ------------------------------------------------------------------ */

interface FintheonThreadProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  agentName?: string;
  onTakeNote?: (messageId: string, content: string) => void;
  messageRefs?: RefObject<Record<string, HTMLDivElement | null>>;
  lastError?: string | null;
  lastRequestId?: string | null;
  compact?: boolean;
}

export function FintheonThread({ onSend, isLoading, agentName, onTakeNote, lastError, lastRequestId, compact }: FintheonThreadProps) {
  const { activeAgent } = useFintheonAgents();
  const viewportRef = useRef<HTMLDivElement>(null);
  const { approvals, sendDecision } = useToolApprovals(lastRequestId ?? null);

  // Read messages directly from the thread store — bypasses ThreadPrimitive.Messages
  // which caused flicker/disappearance due to assistant-ui reconciliation issues
  const messages = useThread((s) => s.messages);

  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0 relative">
      <ThreadPrimitive.Viewport ref={viewportRef as any} className="flex-1 overflow-y-auto p-6 pb-8">
        <div className={`${compact ? 'max-w-full' : 'max-w-3xl'} mx-auto space-y-4 mb-8`}>
          {/* Greeting screen — shown when thread is empty */}
          {!compact && messages.length === 0 && (
            <ChatGreeting onSend={onSend} isLoading={isLoading} />
          )}
          {/* Sidebar compact greeting */}
          {compact && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm text-[var(--fintheon-accent)]/60 font-medium">Ave, Trader.</p>
              <p className="text-[11px] text-zinc-600 mt-1">Quick dispatch from the Forum.</p>
            </div>
          )}

          {/* Message list — rendered directly from thread store */}
          {messages.map((msg: any) => {
            if (msg.role === 'user') {
              return <DirectUserMessage key={msg.id} msg={msg} />;
            }
            if (msg.role === 'assistant') {
              return <DirectAssistantMessage key={msg.id} msg={msg} agentName={agentName ?? activeAgent?.name} onTakeNote={onTakeNote} />;
            }
            return null;
          })}

          {/* Tool approval cards — shown when Harper needs permission */}
          {approvals.length > 0 && (
            <div className="space-y-2">
              {approvals.map((approval) => (
                <ToolApprovalCard
                  key={approval.approvalId}
                  approval={approval}
                  onApprove={(id) => sendDecision(id, 'approved')}
                  onDeny={(id) => sendDecision(id, 'denied')}
                />
              ))}
            </div>
          )}

          {/* Thinking indicator — shown while streaming */}
          <ThreadPrimitive.If running>
            <div className="flex justify-start items-center">
              <FintheonThinkingIndicator
                isThinking
                agentName={agentName ?? activeAgent?.name}
              />
            </div>
          </ThreadPrimitive.If>

          {/* Agent cognition panel — shows live pipeline steps */}
          {lastRequestId && !compact && (
            <CognitionPanel requestId={lastRequestId} isStreaming={isLoading} />
          )}

          {/* Error banner — visible in thread, not just input area */}
          {lastError && !isLoading && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 animate-fade-slide-in">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-red-300 leading-relaxed">{lastError}</p>
              </div>
            </div>
          )}

          {/* Scroll-to-bottom sentinel + button */}
          <ScrollToBottomButton containerRef={viewportRef} />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
