// [claude-code 2026-04-19] S26-P1 T7: toast now fires haptic on success (positive buzz)
//   and error (deny pattern). Info toasts stay silent. Module-level gate respects the
//   hapticEnabled setting.
// [claude-code 2026-04-15] T2: Mobile inline status system — [SAVED], [ERROR: ...] style, auto-dismiss 3s
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { haptic } from "../lib/haptics";

interface StatusMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
}

interface StatusContextValue {
  statuses: StatusMessage[];
  showStatus: (message: string, type?: "success" | "error" | "info") => void;
}

const StatusContext = createContext<StatusContextValue>({
  statuses: [],
  showStatus: () => {},
});

const STATUS_CONFIG = {
  success: { Icon: Check, label: "OK" },
  error: { Icon: AlertTriangle, label: "ALERT" },
  info: { Icon: Info, label: "INFO" },
} as const;

function StatusToast({
  status,
  onDismiss,
}: {
  status: StatusMessage;
  onDismiss: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[status.type];
  return (
    <div
      className="fintheon-toast-surface"
      style={{
        width: "min(340px, calc(100vw - 32px))",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span
            className="fintheon-toast-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "var(--font-data)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <cfg.Icon size={10} />
            {cfg.label}
          </span>
          <span
            style={{
              color: "var(--fintheon-text)",
              fontSize: 12,
              lineHeight: 1.35,
              fontFamily: "var(--font-body)",
            }}
          >
            {status.message}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(status.id)}
          aria-label="Dismiss status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            border: "none",
            borderRadius: 4,
            background: "transparent",
            color: "var(--fintheon-muted)",
            flexShrink: 0,
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export function StatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMessage[]>([]);

  const showStatus = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = `status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: StatusMessage = { id, message, type, timestamp: Date.now() };
      setStatuses((prev) => [...prev, entry]);
      if (type === "success") haptic.success();
      else if (type === "error") haptic.deny();
      setTimeout(() => {
        setStatuses((prev) => prev.filter((s) => s.id !== id));
      }, 3000);
    },
    [],
  );

  return (
    <StatusContext.Provider value={{ statuses, showStatus }}>
      {children}
      {statuses.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
            zIndex: 1800,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
            pointerEvents: "none",
          }}
        >
          {statuses.map((status) => (
            <StatusToast
              key={status.id}
              status={status}
              onDismiss={(id) =>
                setStatuses((prev) => prev.filter((s) => s.id !== id))
              }
            />
          ))}
        </div>
      )}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  return useContext(StatusContext);
}
