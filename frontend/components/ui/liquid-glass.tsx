// [claude-code 2026-03-10] Liquid Glass component system — GlassEffect, GlassDock, GlassButton, GlassFilter
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* ─── Shared glass style tokens ─── */
const GLASS_BG = 'rgba(255, 255, 255, 0.06)';
const GLASS_BORDER = 'rgba(212, 175, 55, 0.18)'; // pulse-accent tint
const GLASS_BLUR = 16;

/* ─── GlassFilter (SVG blur primitive, mount once) ─── */
export function GlassFilter({ id = 'glass-blur' }: { id?: string }) {
  return (
    <svg className="sr-only" aria-hidden="true">
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={GLASS_BLUR / 2} />
        </filter>
      </defs>
    </svg>
  );
}

/* ─── GlassEffect (container with frosted overlay) ─── */
interface GlassEffectProps extends HTMLAttributes<HTMLDivElement> {
  blur?: number;
  tint?: string;
  children: ReactNode;
}

export const GlassEffect = forwardRef<HTMLDivElement, GlassEffectProps>(
  ({ blur = GLASS_BLUR, tint = GLASS_BG, className, style, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl border overflow-hidden',
        className,
      )}
      style={{
        background: tint,
        borderColor: GLASS_BORDER,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  ),
);
GlassEffect.displayName = 'GlassEffect';

/* ─── GlassDock (horizontal bar with frosted glass) ─── */
interface GlassDockProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const GlassDock = forwardRef<HTMLDivElement, GlassDockProps>(
  ({ className, children, ...props }, ref) => (
    <GlassEffect
      ref={ref}
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        className,
      )}
      {...props}
    >
      {children}
    </GlassEffect>
  ),
);
GlassDock.displayName = 'GlassDock';

/* ─── GlassButton (CTA button with glass treatment) ─── */
type GlassButtonVariant = 'default' | 'accent';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant = 'default', className, style, children, ...props }, ref) => {
    const isAccent = variant === 'accent';

    return (
      <button
        ref={ref}
        className={cn(
          'relative rounded-lg px-4 py-2 font-medium transition-all duration-200',
          'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          'border',
          isAccent
            ? 'text-black hover:brightness-110'
            : 'text-[var(--fintheon-text)] hover:brightness-110',
          className,
        )}
        style={{
          background: isAccent
            ? 'var(--fintheon-accent)'
            : GLASS_BG,
          borderColor: isAccent
            ? 'var(--fintheon-accent)'
            : GLASS_BORDER,
          backdropFilter: isAccent ? undefined : `blur(${GLASS_BLUR}px)`,
          WebkitBackdropFilter: isAccent ? undefined : `blur(${GLASS_BLUR}px)`,
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
GlassButton.displayName = 'GlassButton';
