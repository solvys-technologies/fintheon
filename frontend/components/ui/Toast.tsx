// [claude-code 2026-03-20] S3:T5 — Toast: bottom-left, theme colors, Don't Show Again on all types
import { useEffect, useState } from 'react';
import { X, Check, AlertTriangle, Loader2, Info, BellOff, Activity } from 'lucide-react';
import { useToast, type Toast, type ToastVariant } from '../../contexts/ToastContext';

/* ------------------------------------------------------------------ */
/*  Variant config                                                     */
/* ------------------------------------------------------------------ */

const VARIANT_CONFIG: Record<ToastVariant, { border: string; color: string; Icon: typeof Check }> = {
  success: { border: '#34D399', color: '#34D399', Icon: Check },
  error: { border: '#EF4444', color: '#EF4444', Icon: AlertTriangle },
  updating: { border: 'var(--fintheon-accent)', color: 'var(--fintheon-accent)', Icon: Loader2 },
  info: { border: 'var(--fintheon-accent)', color: 'var(--fintheon-text)', Icon: Info },
  reminder: { border: 'var(--fintheon-accent)', color: 'var(--fintheon-accent)', Icon: AlertTriangle },
  vix: { border: '#EF4444', color: '#EF4444', Icon: Activity },
};

/* ------------------------------------------------------------------ */
/*  Single toast item                                                  */
/* ------------------------------------------------------------------ */

function ToastItem({ toast, onDismiss, onBlock }: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onBlock: (toast: Toast) => void;
}) {
  const [entered, setEntered] = useState(false);
  const cfg = VARIANT_CONFIG[toast.variant];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isVisible = entered && !toast.exiting;
  const hasDND = !!toast.notificationType;

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(-16px)',
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
                style={{ color: 'var(--fintheon-muted)' }}
              >
                {toast.description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: '2px', marginLeft: '8px' }}>
          {hasDND && (
            <button
              onClick={() => onBlock(toast)}
              title="Don't show again"
              className="flex items-center justify-center rounded transition-colors"
              style={{ width: '20px', height: '20px', color: 'var(--fintheon-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fintheon-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fintheon-muted)'; }}
            >
              <BellOff size={11} />
            </button>
          )}
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex items-center justify-center rounded transition-colors"
            style={{ width: '20px', height: '20px', color: 'var(--fintheon-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fintheon-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fintheon-muted)'; }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Container — all toasts bottom-left                                 */
/* ------------------------------------------------------------------ */

export function ToastContainer() {
  const { toasts, dismissToast, blockNotificationType } = useToast();

  if (toasts.length === 0) return null;

  const handleBlock = (toast: Toast) => {
    if (toast.notificationType) {
      blockNotificationType(toast.notificationType);
    }
    dismissToast(toast.id);
  };

  return (
    <div
      className="fixed z-[100] flex flex-col items-start"
      style={{ bottom: '24px', left: '24px', gap: '10px', pointerEvents: 'none' }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onBlock={handleBlock}
        />
      ))}
    </div>
  );
}
