import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { HarperProvider } from "./ProviderDropdown";

interface ProviderDef {
  id: HarperProvider;
  label: string;
  model: string;
  managed: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "deepseek-direct",
    label: "DeepSeek v4 Pro",
    model: "Direct API",
    managed: false,
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    model: "Self-hosted proxy",
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
  const [shouldRender, setShouldRender] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setShouldRender(false);
      setIsClosing(false);
    }, 140);
  };

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (!shouldRender) return;
    setIsClosing(true);
    const id = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, 140);
    return () => window.clearTimeout(id);
  }, [open, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [requestClose, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node))
        requestClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [requestClose, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Provider Selection"
      className="pointer-events-none"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 116,
      }}
    >
      <div
        ref={dialogRef}
        className={`fintheon-popover-motion pointer-events-auto rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0905]/92 backdrop-blur-xl ${
          isClosing ? "is-closing" : ""
        }`}
        style={{
          width: 230,
          maxWidth: "calc(100vw - 40px)",
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
            padding: "9px 11px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 10,
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
            onClick={requestClose}
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
        <div style={{ padding: "4px" }}>
          {PROVIDERS.map((p) => {
            const active = p.id === provider;
            const pDotColor = getDotColor(p.id);

            return (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  requestClose();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 9px",
                  background: active
                    ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
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
                  {active ? (
                    <Check
                      size={11}
                      strokeWidth={2.5}
                      color="var(--fintheon-accent)"
                    />
                  ) : null}
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
      </div>
    </div>
  );
}
