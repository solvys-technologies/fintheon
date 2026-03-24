// [claude-code 2026-03-10] Avatar — img + onError fallback initials. No Radix.
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ src, alt = '', fallback, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = fallback ?? alt.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] font-medium',
        sizeStyles[size],
        className
      )}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function AvatarFallback({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('flex h-full w-full items-center justify-center text-[var(--fintheon-accent)]', className)}>
      {children}
    </span>
  );
}
