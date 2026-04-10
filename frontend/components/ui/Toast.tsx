// [claude-code 2026-04-03] Spring-physics enter/exit transitions (scale+bounce enter, decisive exit)
// [claude-code 2026-04-01] iOS26 Liquid Glass restyle + position-aware animation direction
import { useEffect, useState } from "react";
import {
  X,
  Check,
  AlertTriangle,
  Loader2,
  Info,
  BellOff,
  Activity,
} from "lucide-react";
import {
  useToast,
  type Toast,
  type ToastVariant,
} from "../../contexts/ToastContext";

/* ------------------------------------------------------------------ */
/*  Variant config — Zen: all gold-tinted, subtle icon differentiation */
/* ------------------------------------------------------------------ */

const VARIANT_CONFIG: Record<
  ToastVariant,
  { Icon: typeof Check; label?: string }
> = {
  success: { Icon: Check, label: "OK" },
  error: { Icon: AlertTriangle, label: "ALERT" },
  updating: { Icon: Loader2 },
  info: { Icon: Info },
  reminder: { Icon: AlertTriangle, label: "REMINDER" },
  vix: { Icon: Activity, label: "VIX" },
};

/* ------------------------------------------------------------------ */
/*  Single toast item                                                  */
/* ------------------------------------------------------------------ */

function ToastItem({
  toast,
  onDismiss,
  onBlock,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onBlock: (toast: Toast) => void;
}) {
  const [entered, setEntered] = useState(false);
  const cfg = VARIANT_CONFIG[toast.variant];
  const isTopRight = toast.position === "top-right";

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isVisible = entered && !toast.exiting;
  const hasDND = !!toast.notificationType;
  const slideX = isTopRight ? "16px" : "-16px";

  return (
    <div
      className="group"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translateX(0) scale(1)"
          : `translateX(${slideX}) scale(0.95)`,
        transition: isVisible
          ? "opacity 350ms var(--ease-spring), transform 400ms var(--ease-bounce)"
          : "opacity 200ms ease-out, transform 200ms ease-out",
        pointerEvents: "auto",
        minWidth: "280px",
        maxWidth: "380px",
      }}
    >
      <div
        className="backdrop-blur-2xl overflow-hidden"
        style={{
          borderRadius: "8px",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--fintheon-bg) 45%, color-mix(in srgb, var(--fintheon-accent) 8%, transparent))",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div
          className="flex items-start justify-between"
          style={{ padding: "10px 12px" }}
        >
          <div className="flex items-start" style={{ gap: "8px" }}>
            {cfg.label && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest flex-shrink-0 mt-0.5"
                style={{
                  color: "var(--fintheon-accent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                }}
              >
                {cfg.label}
              </span>
            )}
            {!cfg.label && (
              <cfg.Icon
                size={13}
                className={`flex-shrink-0 mt-0.5 ${toast.variant === "updating" ? "animate-spin" : ""}`}
                style={{ color: "var(--fintheon-accent)", opacity: 0.7 }}
              />
            )}
            <div className="flex flex-col" style={{ gap: "2px" }}>
              <span
                className="text-[12px] font-medium leading-tight"
                style={{ color: "var(--fintheon-text)" }}
              >
                {toast.message}
              </span>
              {toast.description && (
                <span
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--fintheon-muted)" }}
                >
                  {toast.description}
                </span>
              )}
              {toast.cta && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.cta!.onClick();
                  }}
                  className="mt-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors"
                  style={{
                    color: "var(--fintheon-bg)",
                    backgroundColor: "var(--fintheon-accent)",
                  }}
                >
                  {toast.cta.label}
                </button>
              )}
            </div>
          </div>
          <div
            className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ gap: "2px", marginLeft: "8px" }}
          >
            {hasDND && (
              <button
                onClick={() => onBlock(toast)}
                title="Don't show again"
                className="flex items-center justify-center rounded transition-colors hover:bg-[var(--fintheon-accent)]/10"
                style={{
                  width: "20px",
                  height: "20px",
                  color: "var(--fintheon-muted)",
                }}
              >
                <BellOff size={11} />
              </button>
            )}
            <button
              onClick={() => onDismiss(toast.id)}
              className="flex items-center justify-center rounded transition-colors hover:bg-[var(--fintheon-accent)]/10"
              style={{
                width: "20px",
                height: "20px",
                color: "var(--fintheon-muted)",
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Container — split by position: bottom-left (system) + top-right   */
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

  const bottomLeft = toasts.filter((t) => t.position !== "top-right");
  const topRight = toasts.filter((t) => t.position === "top-right");

  return (
    <>
      {/* System toasts — bottom-left */}
      {bottomLeft.length > 0 && (
        <div
          className="fixed z-[100] flex flex-col items-start"
          style={{
            bottom: "24px",
            left: "24px",
            gap: "10px",
            pointerEvents: "none",
          }}
        >
          {bottomLeft.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onBlock={handleBlock}
            />
          ))}
        </div>
      )}
      {/* Trading/market toasts — top-right */}
      {topRight.length > 0 && (
        <div
          className="fixed z-[100] flex flex-col items-end"
          style={{
            top: "70px",
            right: "24px",
            gap: "10px",
            pointerEvents: "none",
          }}
        >
          {topRight.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onBlock={handleBlock}
            />
          ))}
        </div>
      )}
    </>
  );
}
