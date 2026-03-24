// [claude-code 2026-03-10] Tooltip — CSS group + absolute positioning. No Radix.
import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const sideStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        className={cn(
          'pointer-events-none absolute z-50 scale-95 opacity-0 transition-all duration-150',
          'group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100',
          'rounded-md bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 px-2.5 py-1.5',
          'text-xs text-[var(--fintheon-text)] shadow-lg whitespace-nowrap',
          sideStyles[side],
          className
        )}
      >
        {content}
      </div>
    </div>
  );
}
