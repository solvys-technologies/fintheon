// [claude-code 2026-03-10] Message layout primitives — MessageRoot, MessageAvatar, MessageContent
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* ─── MessageRoot ─── */
type MessageRole = 'user' | 'assistant' | 'system';

interface MessageRootProps extends HTMLAttributes<HTMLDivElement> {
  role?: MessageRole;
  children: ReactNode;
}

export const MessageRoot = forwardRef<HTMLDivElement, MessageRootProps>(
  ({ role = 'assistant', className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-role={role}
      className={cn(
        'flex gap-3',
        role === 'user' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
MessageRoot.displayName = 'MessageRoot';

/* ─── MessageAvatar ─── */
interface MessageAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
}

export function MessageAvatar({ src, alt = 'Avatar', fallback, className }: MessageAvatarProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold',
        className,
      )}
      style={{
        background: src ? undefined : 'var(--fintheon-accent)',
        color: src ? undefined : 'var(--fintheon-bg)',
      }}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span>{fallback ?? alt.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

/* ─── MessageContent ─── */
interface MessageContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex-1 min-w-0 rounded-lg px-3 py-2 text-sm',
        className,
      )}
      style={{ color: 'var(--fintheon-text)' }}
      {...props}
    >
      {children}
    </div>
  ),
);
MessageContent.displayName = 'MessageContent';
