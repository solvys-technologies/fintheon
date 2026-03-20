// [claude-code 2026-03-10] Conversation — message list with scroll-to-bottom via IntersectionObserver
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ConversationProps {
  children: ReactNode;
  className?: string;
  /** Auto-scroll on new children. Default true. */
  autoScroll?: boolean;
}

export function Conversation({ children, className, autoScroll = true }: ConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Observe the sentinel element at the bottom
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsAtBottom(entry.isIntersecting),
      { root: containerRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll when children update
  useEffect(() => {
    if (autoScroll && isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [children, autoScroll, isAtBottom]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className={cn('relative flex flex-col h-full', className)}>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 px-4 py-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--fintheon-accent) transparent' }}
      >
        {children}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Scroll-to-bottom fab */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 rounded-full p-2 border transition-all hover:brightness-110 active:scale-90"
          style={{
            background: 'var(--fintheon-surface)',
            borderColor: 'var(--fintheon-accent)',
            color: 'var(--fintheon-accent)',
          }}
          aria-label="Scroll to bottom"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
