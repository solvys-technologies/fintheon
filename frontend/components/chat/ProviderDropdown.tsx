// [claude-code 2026-05-03] S38-T5: Provider Dropdown v2 — 3 providers, RECOMMENDED badge, flat palette, API key hints.
import { useState, useRef, useEffect } from "react";
import { Cpu } from "lucide-react";
import { DeepSeekWhaleIcon } from "../icons";
import { useSettings } from "../../contexts/SettingsContext";

/* ─────────────────────────────────────────────────────── HarperProvider ── */

export type HarperProvider = "deepseek-direct" | "opencode-go";

interface ProviderDef {
  id: HarperProvider;
  label: string;
  model: string;
  sub: string;
  icon: "deepseek" | "opencode";
  managed: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "deepseek-direct",
    label: "DeepSeek v4 Pro",
    model: "Direct API",
    sub: "Bring your own key",
    icon: "deepseek",
    managed: false,
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    model: "Self-hosted proxy",
    sub: "Bring your own key + endpoint",
    icon: "opencode",
    managed: false,
  },
];

function normalizeProvider(raw: string | null): HarperProvider {
  if (raw === "deepseek-direct" || raw === "opencode-go") return raw;
  return "deepseek-direct"; // default to BYOK Direct
}

function initialProvider(): HarperProvider {
  try {
    return normalizeProvider(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "deepseek-direct";
  }
}

/* ─────────────────────────────────────────────────────── Storage Keys ── */

const STORAGE_KEY = "fintheon:harper-provider";
const DEEPSEEK_KEY_STATUS = "fintheon:deepseek-key-status";
const OC_API_KEY_STATUS = "fintheon:opencode-go-key-status";

function hasCachedKey(storageKey: string) {
  try {
    return localStorage.getItem(storageKey) === "set";
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────── Dot Color ── */

function getDotColor(provider: HarperProvider): string {
  if (provider === "deepseek-direct")
    return hasCachedKey(DEEPSEEK_KEY_STATUS) ? "#22c55e" : "#ca8a04";
  if (provider === "opencode-go")
    return hasCachedKey(OC_API_KEY_STATUS) ? "#22c55e" : "#ca8a04";
  return "#ca8a04";
}

/* ─────────────────────────────────────────────────────── Hook ── */

export function useHarperProvider() {
  const { defaultChatProvider, setDefaultChatProvider } = useSettings();
  const [provider, setProviderState] = useState<HarperProvider>(() => {
    if (
      defaultChatProvider === "deepseek-direct" ||
      defaultChatProvider === "opencode-go"
    ) {
      return defaultChatProvider;
    }
    return initialProvider();
  });

  useEffect(() => {
    if (
      defaultChatProvider === "deepseek-direct" ||
      defaultChatProvider === "opencode-go"
    ) {
      setProviderState(defaultChatProvider);
      try {
        localStorage.setItem(STORAGE_KEY, defaultChatProvider);
      } catch {
        /* ignore */
      }
    }
  }, [defaultChatProvider]);

  const setProvider = (p: HarperProvider) => {
    setProviderState(p);
    setDefaultChatProvider(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  };

  return { provider, setProvider };
}

/* ─────────────────────────────────────────────────────── Component ── */

interface ProviderDropdownProps {
  provider: HarperProvider;
  onChange: (p: HarperProvider) => void;
  compact?: boolean;
}

export function ProviderDropdown({
  provider,
  onChange,
  compact,
}: ProviderDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[1];
  const dotColor = getDotColor(provider);

  const keyMissingHint =
    provider === "deepseek-direct" && !hasCachedKey(DEEPSEEK_KEY_STATUS)
      ? "Set API key in Settings"
      : provider === "opencode-go" && !hasCachedKey(OC_API_KEY_STATUS)
        ? "Set API key in Settings"
        : null;

  const openSettings = () => {
    window.dispatchEvent(new CustomEvent("fintheon:open-settings-api"));
  };

  return (
    <div ref={ref} className="relative flex items-center">
      {/* ── Trigger row ── */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border transition-colors ${
            compact ? "px-1.5" : "px-2"
          }`}
          style={{
            borderColor: "rgba(199, 159, 74, 0.2)",
            color: "var(--fintheon-accent)",
            height: "28px",
          }}
          title={`Provider: ${current.label} (${current.model})`}
        >
          {/* colored status dot */}
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <DeepSeekWhaleIcon className="h-[10.88px] w-[13.6px] shrink-0" />

          {!compact && (
            <>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(240, 234, 214, 0.8)",
                }}
              >
                {current.label}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "rgba(240, 234, 214, 0.45)",
                }}
              >
                {current.model}
              </span>
            </>
          )}
        </button>

        {/* inline key-missing hint next to trigger */}
        {!compact && keyMissingHint && (
          <span
            role="button"
            tabIndex={0}
            className="max-w-[140px] truncate cursor-pointer"
            style={{ fontSize: "10px", color: "rgba(199, 159, 74, 0.7)" }}
            onClick={openSettings}
            onKeyDown={(e) => {
              if (e.key === "Enter") openSettings();
            }}
          >
            {keyMissingHint}
          </span>
        )}
      </div>

      {/* ── Expanded dropdown ── */}
      {open && (
        <div
          className="absolute bottom-full right-0 mb-1 min-w-[220px] rounded-2xl border overflow-hidden z-50"
          style={{
            backgroundColor: "#050402",
            borderColor: "rgba(199, 159, 74, 0.3)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.6)",
          }}
        >
          {PROVIDERS.map((p, i) => {
            const active = p.id === provider;
            const pDotColor = getDotColor(p.id);
            const pKeyMissing =
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
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  i < PROVIDERS.length - 1
                    ? "border-b border-[rgba(199,159,74,0.08)]"
                    : ""
                } ${
                  active
                    ? "bg-[rgba(199,159,74,0.1)] text-[#c79f4a]"
                    : "text-[rgba(240,234,214,0.6)] hover:bg-[rgba(199,159,74,0.05)] hover:text-[rgba(240,234,214,0.8)]"
                }`}
              >
                {p.icon === "deepseek" ? (
                  <DeepSeekWhaleIcon className="h-[10.88px] w-[13.6px] shrink-0 text-[var(--fintheon-accent)]" />
                ) : (
                  <Cpu className="h-3.5 w-3.5 shrink-0" />
                )}

                <div className="flex flex-col flex-1 min-w-0">
                  {/* label row */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{p.label}</span>
                  </div>

                  {/* model name */}
                  <span style={{ fontSize: "9px", opacity: 0.6 }}>
                    {p.model}
                  </span>

                  {/* key-missing hint inside item */}
                  {pKeyMissing && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer mt-0.5"
                      style={{
                        fontSize: "9px",
                        color: "rgba(199, 159, 74, 0.7)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSettings();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          openSettings();
                        }
                      }}
                    >
                      Set API key in Settings
                    </span>
                  )}
                </div>

                {/* status dot (right-aligned) */}
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: pDotColor }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
