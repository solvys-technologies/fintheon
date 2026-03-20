// [claude-code 2026-03-10] AI actions bar — Copy, Retry, Like/Dislike
import { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { ActionContainer, ActionButton } from './actions';

/* ─── Icons (inline SVG, no next/image) ─── */
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}
function ThumbUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  );
}
function ThumbDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
    </svg>
  );
}

/* ─── AiActions bar ─── */
type Feedback = 'like' | 'dislike' | null;

interface AiActionsProps {
  content?: string;
  onRetry?: () => void;
  onFeedback?: (feedback: Feedback) => void;
  className?: string;
}

export function AiActions({ content, onRetry, onFeedback, className }: AiActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleFeedback = useCallback(
    (fb: 'like' | 'dislike') => {
      const next = feedback === fb ? null : fb;
      setFeedback(next);
      onFeedback?.(next);
    },
    [feedback, onFeedback],
  );

  return (
    <ActionContainer className={cn('mt-1', className)}>
      {content && (
        <ActionButton
          icon={copied ? <CheckIcon /> : <CopyIcon />}
          label="Copy"
          onClick={handleCopy}
          style={copied ? { color: 'var(--fintheon-bullish)' } : undefined}
        />
      )}

      {onRetry && (
        <ActionButton icon={<RetryIcon />} label="Retry" onClick={onRetry} />
      )}

      <ActionButton
        icon={<ThumbUpIcon />}
        label="Like"
        onClick={() => handleFeedback('like')}
        style={feedback === 'like' ? { color: 'var(--fintheon-bullish)' } : undefined}
      />
      <ActionButton
        icon={<ThumbDownIcon />}
        label="Dislike"
        onClick={() => handleFeedback('dislike')}
        style={feedback === 'dislike' ? { color: 'var(--fintheon-bearish)' } : undefined}
      />
    </ActionContainer>
  );
}
