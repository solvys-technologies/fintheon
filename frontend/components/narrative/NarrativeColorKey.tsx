// [claude-code 2026-04-19] S25-T6: Bottom-right narrative color key + micro popover. Click the swatch strip to open; click any category swatch to edit its color via a native <input type="color">. Edits write to the --narrative-* CSS variable on :root and persist in localStorage under fintheon:narrative-color-overrides so they survive reloads. Global Personalization Settings still owns the long-form UI; this is the in-canvas fast path.
import { useEffect, useRef, useState } from "react";
import { Palette, RotateCcw, X } from "lucide-react";
import type { NarrativeCategory } from "../../lib/narrative-types";
import { getCategoryColor } from "../../lib/narrative-force-layout";

const CATEGORIES: { id: NarrativeCategory; label: string; token: string }[] = [
  {
    id: "geopolitical",
    label: "Geopolitical",
    token: "--narrative-geopolitical",
  },
  { id: "monetary", label: "Monetary", token: "--narrative-monetary" },
  { id: "macroeconomic", label: "Macro", token: "--narrative-macroeconomic" },
  {
    id: "market-structure",
    label: "Mkt Structure",
    token: "--narrative-market-structure",
  },
  { id: "earnings", label: "Earnings", token: "--narrative-earnings" },
  {
    id: "supply-chain",
    label: "Supply Chain",
    token: "--narrative-supply-chain",
  },
  { id: "black-swan", label: "Black Swan", token: "--narrative-black-swan" },
];

const STORAGE_KEY = "fintheon:narrative-color-overrides";

type Overrides = Partial<Record<NarrativeCategory, string>>;

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

function persistOverrides(next: Overrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function applyOverride(token: string, hex: string | null): void {
  if (typeof document === "undefined") return;
  if (hex) document.documentElement.style.setProperty(token, hex);
  else document.documentElement.style.removeProperty(token);
}

export function NarrativeColorKey() {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const rootRef = useRef<HTMLDivElement>(null);

  // Hydrate CSS vars from persisted overrides once on mount
  useEffect(() => {
    for (const { id, token } of CATEGORIES) {
      if (overrides[id]) applyOverride(token, overrides[id]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const updateColor = (cat: NarrativeCategory, token: string, hex: string) => {
    const next = { ...overrides, [cat]: hex };
    setOverrides(next);
    persistOverrides(next);
    applyOverride(token, hex);
  };

  const resetCategory = (cat: NarrativeCategory, token: string) => {
    const next = { ...overrides };
    delete next[cat];
    setOverrides(next);
    persistOverrides(next);
    applyOverride(token, null);
  };

  const resetAll = () => {
    for (const { id, token } of CATEGORIES) {
      applyOverride(token, null);
    }
    setOverrides({});
    persistOverrides({});
  };

  return (
    <div ref={rootRef} className="absolute bottom-3 right-3 z-40">
      {/* Collapsed swatch strip — click to open */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--fintheon-accent)]/20 bg-[#050402]/85 backdrop-blur-sm px-2.5 py-1 hover:border-[var(--fintheon-accent)]/40 transition-colors"
        title="Narrative color key"
      >
        <Palette size={10} className="text-[var(--fintheon-accent)]/70" />
        <div className="flex items-center gap-0.5">
          {CATEGORIES.slice(0, 7).map((c) => (
            <span
              key={c.id}
              className="w-[6px] h-[6px] rounded-full"
              style={{ backgroundColor: `var(${c.token})` }}
            />
          ))}
        </div>
        <span
          className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-muted)]/55"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Narratives
        </span>
      </button>

      {/* Popover */}
      <div
        className="absolute bottom-full right-0 mb-2 w-[260px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-[opacity,transform] duration-200 ease-out"
        style={{
          opacity: open ? 1 : 0,
          transform: open
            ? "translateY(0) scale(1)"
            : "translateY(4px) scale(0.97)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
          <span
            className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/80"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Narrative Colors
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetAll}
              className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
              title="Reset all to theme defaults"
            >
              <RotateCcw size={10} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          {CATEGORIES.map((c) => {
            const current = getCategoryColor(c.id);
            const hasOverride = overrides[c.id] != null;
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
              >
                <label className="relative cursor-pointer shrink-0">
                  <input
                    type="color"
                    value={current}
                    onChange={(e) => updateColor(c.id, c.token, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span
                    className="block w-4 h-4 rounded border border-[var(--fintheon-border)]/20"
                    style={{ backgroundColor: `var(${c.token})` }}
                  />
                </label>
                <span className="flex-1 text-[10px] text-[var(--fintheon-text)]/70">
                  {c.label}
                </span>
                <span
                  className="text-[9px] font-mono text-[var(--fintheon-muted)]/50"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {current.toUpperCase()}
                </span>
                {hasOverride && (
                  <button
                    type="button"
                    onClick={() => resetCategory(c.id, c.token)}
                    className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-muted)]/40 hover:text-[var(--fintheon-accent)] transition-colors"
                    title="Reset"
                  >
                    <RotateCcw size={9} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-[var(--fintheon-accent)]/10 text-[9px] text-[var(--fintheon-muted)]/35">
          Tip — open Personalization Settings for named themes +
          severity/priority keys.
        </div>
      </div>
    </div>
  );
}
