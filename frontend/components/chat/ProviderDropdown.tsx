// [claude-code 2026-05-03] S58 deploy fix: make DeepSeek selectable/visible and migrate stale VProxy defaults to DeepSeek.
// [claude-code 2026-05-03] S58-T2: add DeepSeek Direct and OC API provider modes with key-status hints.
// [claude-code 2026-04-07] Harper provider selector — Local / Nous / ORouter
import { useState, useRef, useEffect } from "react";
import { Cpu, Cloud, Server } from "lucide-react";

export type HarperProvider =
  | "deepseek-direct"
  | "deepseek-oc-api"
  | "local"
  | "nous"
  | "orouter";

const PROVIDERS: {
  id: HarperProvider;
  label: string;
  sub: string;
  icon: typeof Cpu;
}[] = [
  { id: "deepseek-direct", label: "DeepSeek", sub: "Direct", icon: Cloud },
  { id: "deepseek-oc-api", label: "DeepSeek", sub: "OC API", icon: Server },
  { id: "local", label: "VProxy", sub: "Local", icon: Cpu },
  { id: "nous", label: "Nous", sub: "Qwen3", icon: Server },
  { id: "orouter", label: "ORouter", sub: "Opus", icon: Cloud },
];

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

function normalizeProvider(raw: string | null): HarperProvider {
  if (raw === "deepseek-direct" || raw === "deepseek-oc-api") return raw;
  if (raw === "nous" || raw === "orouter" || raw === "local") return raw;
  return "deepseek-direct";
}

function initialProvider(): HarperProvider {
  try {
    const saved = normalizeProvider(localStorage.getItem(STORAGE_KEY));
    if (saved === "local" || saved === "orouter") {
      localStorage.setItem(STORAGE_KEY, "deepseek-direct");
      return "deepseek-direct";
    }
    return saved;
  } catch {
    return "deepseek-direct";
  }
}

export function useHarperProvider() {
  const [provider, setProviderState] = useState<HarperProvider>(initialProvider);

  const setProvider = (p: HarperProvider) => {
    setProviderState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  };

  return { provider, setProvider };
}

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const Icon = current.icon;
  const missingHint =
    provider === "deepseek-direct" && !hasCachedKey(DEEPSEEK_KEY_STATUS)
      ? "Set API key in Settings"
      : provider === "deepseek-oc-api" && !hasCachedKey(OC_API_KEY_STATUS)
        ? "Configure OpenCode Go API in Settings"
        : null;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40 transition-colors ${
            compact ? "px-1.5 py-1" : "px-2 py-1"
          }`}
          title={`Provider: ${current.label} (${current.sub})`}
        >
          <Icon className="w-3 h-3 text-[var(--fintheon-accent)]/70" />
          <span className={compact ? "sr-only" : "text-[11px] text-[var(--fintheon-text)]/80"}>
            {current.label}
          </span>
          {!compact && (
            <span className="text-[10px] text-[var(--fintheon-text)]/45">
              {current.sub}
            </span>
          )}
        </button>
        {!compact && missingHint && (
          <span className="max-w-[140px] truncate text-[10px] text-[var(--fintheon-accent)]/70">
            {missingHint}
          </span>
        )}
      </div>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 min-w-[140px] rounded-xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-2xl overflow-hidden z-50"
          style={{
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
          }}
        >
          {PROVIDERS.map((p) => {
            const PIcon = p.icon;
            const active = p.id === provider;
            return (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  active
                    ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/80"
                }`}
              >
                <PIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{p.label}</span>
                  <span className="text-[9px] opacity-60">{p.sub}</span>
                  {p.id === "deepseek-direct" &&
                    !hasCachedKey(DEEPSEEK_KEY_STATUS) && (
                      <span className="text-[9px] text-[var(--fintheon-accent)]/70">
                        Set API key in Settings
                      </span>
                    )}
                  {p.id === "deepseek-oc-api" &&
                    !hasCachedKey(OC_API_KEY_STATUS) && (
                      <span className="text-[9px] text-[var(--fintheon-accent)]/70">
                        Configure OpenCode Go API in Settings
                      </span>
                    )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
