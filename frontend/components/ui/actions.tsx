// [claude-code 2026-03-10] Action container + action button primitives
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* ─── ActionContainer ─── */
interface ActionContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const ActionContainer = forwardRef<HTMLDivElement, ActionContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-1', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
ActionContainer.displayName = 'ActionContainer';

/* ─── ActionButton ─── */
interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon, label, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        'transition-colors hover:bg-white/10 active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      style={{ color: 'var(--fintheon-muted)' }}
      aria-label={label}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
);
ActionButton.displayName = 'ActionButton';
