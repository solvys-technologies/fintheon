import { useEffect, useRef } from "react";
import { Cpu, Cloud, X, Check, Settings } from "lucide-react";
import type { HarperProvider } from "./ProviderDropdown";

interface ProviderDef {
  id: HarperProvider;
  label: string;
  model: string;
  sub: string;
  icon: typeof Cloud;
  managed: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "deepseek-direct",
    label: "DeepSeek v4 Pro",
    model: "Direct API",
    sub: "Bring your own key",
    icon: Cloud,
    managed: false,
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    model: "Self-hosted proxy",
    sub: "Bring your own key + endpoint",
    icon: Cpu,
    managed: false,
  },
];

const DEEPSEEK_KEY_STATUS = "fintheon:deepseek-key-status";
const OC_API_KEY_STATUS = "fintheon:opencode-go-key-status";

function hasCachedKey(storageKey: string) {
  try {
    return localStorage.getItem(storageKey) === "set";
  } catch {
    return false;
  }
}

function getDotColor(provider: HarperProvider): string {
  if (provider === "deepseek-direct")
    return hasCachedKey(DEEPSEEK_KEY_STATUS) ? "#22c55e" : "#ca8a04";
  if (provider === "opencode-go")
    return hasCachedKey(OC_API_KEY_STATUS) ? "#22c55e" : "#ca8a04";
  return "#ca8a04";
}

interface FintheonProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider: HarperProvider;
  onChange: (p: HarperProvider) => void;
}

export function FintheonProviderModal({
  open,
  onClose,
  provider,
  onChange,
}: FintheonProviderModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const openSettings = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("fintheon:open-settings-api"));
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Provider Selection"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(5, 4, 2, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialogRef}
        style={{
          width: 380,
          maxWidth: "calc(100vw - 40px)",
          background: "rgba(10, 8, 5, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cpu size={14} strokeWidth={2.2} color="var(--fintheon-accent)" />
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--fintheon-accent)",
              }}
            >
              Provider
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fintheon-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Provider list */}
        <div style={{ padding: "6px" }}>
          {PROVIDERS.map((p, i) => {
            const PIcon = p.icon;
            const active = p.id === provider;
            const pDotColor = getDotColor(p.id);
            const keyMissing =
              !p.managed &&
              !hasCachedKey(
                p.id === "deepseek-direct"
                  ? DEEPSEEK_KEY_STATUS
                  : OC_API_KEY_STATUS,
              );

            return (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  onClose();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: active
                    ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                <PIcon
                  className="w-4 h-4 shrink-0"
                  style={{
                    color: active
                      ? "var(--fintheon-accent)"
                      : "rgba(240,234,214,0.5)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: active
                          ? "var(--fintheon-accent)"
                          : "var(--fintheon-text)",
                      }}
                    >
                      {p.label}
                    </span>
                    {active && (
                      <Check
                        size={12}
                        strokeWidth={2.5}
                        color="var(--fintheon-accent)"
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: active
                        ? "color-mix(in srgb, var(--fintheon-accent) 60%, transparent)"
                        : "rgba(240,234,214,0.35)",
                      marginTop: 2,
                    }}
                  >
                    {p.model}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: pDotColor,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* API Key hint footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(240,234,214,0.35)",
            }}
          >
            API keys managed in Settings
          </span>
          <button
            onClick={openSettings}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              background: "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
              color: "var(--fintheon-accent)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <Settings size={10} />
            API Settings
          </button>
        </div>
      </div>
    </div>
  );
}
