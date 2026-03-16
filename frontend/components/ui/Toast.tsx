// [claude-code 2026-03-16] Toast with fade-in/out, error descriptions, 2.5s error auto-dismiss
import { useEffect, useState } from 'react';
import { X, Check, AlertTriangle, Loader2, Info } from 'lucide-react';
import { useToast, type Toast, type ToastVariant } from '../../contexts/ToastContext';

/* ------------------------------------------------------------------ */
/*  Variant config                                                     */
/* ------------------------------------------------------------------ */

const VARIANT_CONFIG: Record<ToastVariant, { border: string; color: string; Icon: typeof Check }> = {
  success: { border: '#34D399', color: '#34D399', Icon: Check },
  error: { border: '#EF4444', color: '#EF4444', Icon: AlertTriangle },
  updating: { border: 'var(--fintheon-accent)', color: 'var(--fintheon-accent)', Icon: Loader2 },
  info: { border: 'rgba(212,175,55,0.4)', color: '#9CA3AF', Icon: Info },
  reminder: { border: 'var(--fintheon-accent)', color: 'var(--fintheon-accent)', Icon: AlertTriangle },
};

/* ------------------------------------------------------------------ */
/*  Single toast item (handles its own enter animation)                */
/* ------------------------------------------------------------------ */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [entered, setEntered] = useState(false);
  const cfg = VARIANT_CONFIG[toast.variant];

  // Trigger enter animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isVisible = entered && !toast.exiting;

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(16px)',
        pointerEvents: 'auto',
        minWidth: '280px',
        maxWidth: '400px',
        borderRadius: '10px',
        border: `1px solid ${cfg.border}`,
        backgroundColor: 'var(--fintheon-surface)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-start justify-between" style={{ padding: '10px 12px' }}>
        <div className="flex items-start" style={{ gap: '8px' }}>
          <cfg.Icon
            size={14}
            className={`flex-shrink-0 mt-0.5 ${toast.variant === 'updating' ? 'animate-spin' : ''}`}
            style={{ color: cfg.color }}
          />
          <div className="flex flex-col" style={{ gap: '2px' }}>
            <span
              className="text-[13px] font-medium leading-tight"
              style={{ color: cfg.color }}
            >
              {toast.message}
            </span>
            {toast.description && (
              <span
                className="text-[11px] leading-tight"
                style={{ color: 'rgba(156,163,175,0.7)' }}
              >
                {toast.description}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors flex-shrink-0"
          style={{ width: '20px', height: '20px', marginLeft: '8px' }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Container                                                          */
/* ------------------------------------------------------------------ */

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  const normalToasts = toasts.filter(t => t.variant !== 'reminder');
  const reminderToasts = toasts.filter(t => t.variant === 'reminder');

  return (
    <>
      {normalToasts.length > 0 && (
        <div
          className="fixed z-[100] flex flex-col items-end"
          style={{ bottom: '24px', right: '24px', gap: '10px', pointerEvents: 'none' }}
        >
          {normalToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}
      {reminderToasts.length > 0 && (
        <div
          className="fixed z-[100] flex flex-col items-start"
          style={{ bottom: '24px', left: '24px', gap: '10px', pointerEvents: 'none' }}
        >
          {reminderToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </>
  );
}
