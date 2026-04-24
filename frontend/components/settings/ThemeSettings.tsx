// [claude-code 2026-04-20] S25-T6b: Category color keys section (narrative-*) + narrative overrides bundled into saved custom themes (restore on activation, cleared on Reset to Default).
// [claude-code 2026-04-18] Remove Digit Size slider (digits reverted to Inter via unicode-range override)
// [claude-code 2026-04-18] Nothing Font Kit card
// [claude-code 2026-04-15] Special themes section — Nothing Design (Something Solvys/Monochrome)
// [claude-code 2026-03-24] Theme settings — font style, color presets, custom color picker, severity colors, save custom themes
import { useState, useEffect } from "react";
import { Check, Save } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { type ThemeConfig, DEFAULT_THEME } from "../../lib/theme";
import { DEFAULT_FONT_THEME } from "../../lib/font-theme";
import { ColorSwatchInput } from "../ui/ColorPicker";

const COLOR_FIELDS: { key: keyof ThemeConfig; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "bg", label: "Background" },
  { key: "text", label: "Text" },
  { key: "bullish", label: "Bullish" },
  { key: "bearish", label: "Bearish" },
];

const SEVERITY_FIELDS: { key: keyof ThemeConfig; label: string }[] = [
  { key: "severe", label: "Severe" },
  { key: "neutralSevere", label: "Neutral Severe" },
  { key: "neutral", label: "Neutral" },
  { key: "lowNeutral", label: "Low Neutral" },
  { key: "low", label: "Low" },
];

const DEFAULT_SEVERITY: Record<string, string> = {
  severe: "#EF4444",
  neutralSevere: "#F59E0B",
  neutral: "#6B7280",
  lowNeutral: "#3B82F6",
  low: "#34D399",
};

// Narrative category color tokens — mirrors index.css :root + NarrativeColorKey
const NARRATIVE_FIELDS: {
  id: NarrativeCategoryKey;
  label: string;
  token: string;
  fallback: string;
}[] = [
  {
    id: "geopolitical",
    label: "Geopolitical",
    token: "--narrative-geopolitical",
    fallback: "#F59E0B",
  },
  {
    id: "monetary",
    label: "Monetary",
    token: "--narrative-monetary",
    fallback: "#8B5CF6",
  },
  {
    id: "macroeconomic",
    label: "Macro",
    token: "--narrative-macroeconomic",
    fallback: "#3B82F6",
  },
  {
    id: "market-structure",
    label: "Market Structure",
    token: "--narrative-market-structure",
    fallback: "#EC4899",
  },
  {
    id: "earnings",
    label: "Earnings",
    token: "--narrative-earnings",
    fallback: "#34D399",
  },
  {
    id: "supply-chain",
    label: "Supply Chain",
    token: "--narrative-supply-chain",
    fallback: "#14B8A6",
  },
  {
    id: "black-swan",
    label: "Black Swan",
    token: "--narrative-black-swan",
    fallback: "#EF4444",
  },
];

type NarrativeCategoryKey =
  | "geopolitical"
  | "monetary"
  | "macroeconomic"
  | "market-structure"
  | "earnings"
  | "supply-chain"
  | "black-swan";

type NarrativeOverrides = Partial<Record<NarrativeCategoryKey, string>>;

const NARRATIVE_STORAGE_KEY = "fintheon:narrative-color-overrides";

function loadNarrativeOverrides(): NarrativeOverrides {
  try {
    const raw = localStorage.getItem(NARRATIVE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NarrativeOverrides) : {};
  } catch {
    return {};
  }
}

function persistNarrativeOverrides(next: NarrativeOverrides): void {
  try {
    localStorage.setItem(NARRATIVE_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function applyNarrativeOverride(token: string, hex: string | null): void {
  if (typeof document === "undefined") return;
  if (hex) document.documentElement.style.setProperty(token, hex);
  else document.documentElement.style.removeProperty(token);
}

/** ThemeConfig extension: bundles narrative category overrides into a saved theme. */
interface ThemeConfigWithNarrative extends ThemeConfig {
  narrativeColors?: NarrativeOverrides;
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

const SAMPLE_HEADING = "AAPL 189.42  +2.31%";
const SAMPLE_BODY =
  "ES broke above 5,420 resistance — watching $1,234.56 target with 62% probability. Risk/reward favors long above the VWAP.";

export function ThemeSettings() {
  const {
    theme,
    setTheme,
    presets,
    specialPresets,
    fontTheme,
    setFontTheme,
    fontThemes,
    pompaEnabled,
    setPompaEnabled,
  } = useTheme();

  const isSpecialActive = theme.special === true;
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});
  const [customThemes, setCustomThemes] = useState<ThemeConfigWithNarrative[]>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("fintheon-custom-themes") || "[]",
        );
      } catch {
        return [];
      }
    },
  );
  const [narrativeOverrides, setNarrativeOverrides] =
    useState<NarrativeOverrides>(() => loadNarrativeOverrides());

  // Hydrate CSS vars from persisted overrides once on mount
  useEffect(() => {
    for (const { id, token } of NARRATIVE_FIELDS) {
      if (narrativeOverrides[id]) {
        applyNarrativeOverride(token, narrativeOverrides[id]!);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presetList = Object.values(presets);

  const handleNarrativeChange = (cat: NarrativeCategoryKey, hex: string) => {
    if (!isValidHex(hex)) return;
    const field = NARRATIVE_FIELDS.find((f) => f.id === cat);
    if (!field) return;
    const next = { ...narrativeOverrides, [cat]: hex };
    setNarrativeOverrides(next);
    persistNarrativeOverrides(next);
    applyNarrativeOverride(field.token, hex);
  };

  const getNarrativeFieldValue = (cat: NarrativeCategoryKey): string => {
    const override = narrativeOverrides[cat];
    if (override && isValidHex(override)) return override;
    const field = NARRATIVE_FIELDS.find((f) => f.id === cat);
    return field?.fallback ?? "#333333";
  };

  const resetNarrativeOverrides = () => {
    for (const { token } of NARRATIVE_FIELDS) {
      applyNarrativeOverride(token, null);
    }
    setNarrativeOverrides({});
    persistNarrativeOverrides({});
  };

  const applyNarrativeBundle = (bundle: NarrativeOverrides | undefined) => {
    // First clear every override, then apply what the bundle provides
    for (const { token } of NARRATIVE_FIELDS) {
      applyNarrativeOverride(token, null);
    }
    const next = bundle ?? {};
    for (const { id, token } of NARRATIVE_FIELDS) {
      if (next[id]) applyNarrativeOverride(token, next[id]!);
    }
    setNarrativeOverrides(next);
    persistNarrativeOverrides(next);
  };

  const handleCustomChange = (key: keyof ThemeConfig, value: string) => {
    setCustomDraft((d) => ({ ...d, [key]: value }));
    if (isValidHex(value)) {
      setTheme({ ...theme, name: "custom", label: "Custom", [key]: value });
    }
  };

  const getFieldValue = (key: keyof ThemeConfig): string => {
    return (
      customDraft[key] ??
      (theme[key] as string) ??
      DEFAULT_SEVERITY[key] ??
      "#333333"
    );
  };

  return (
    <div className="space-y-6">
      {/* Font Style — with live samples */}
      <section>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Font Style
        </h3>

        {/* Live sample preview — uses current active font */}
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{
            borderColor:
              "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
            backgroundColor: "rgba(10,10,0,0.3)",
          }}
        >
          <div
            className="text-lg font-semibold text-white mb-1.5"
            style={{ fontFamily: fontTheme.fontHeading }}
          >
            {SAMPLE_HEADING}
          </div>
          <div
            className="text-[13px] leading-relaxed text-zinc-400"
            style={{ fontFamily: fontTheme.fontBody }}
          >
            {SAMPLE_BODY}
          </div>
          <div className="mt-2 text-[10px] text-zinc-600 font-mono">
            Active: {fontTheme.label}
          </div>
        </div>

        {/* Font override notice for special themes */}
        {isSpecialActive && (
          <div
            className="mb-3 px-3 py-2 rounded-md text-[11px]"
            style={{
              background: "rgba(199,159,74,0.08)",
              border: "1px solid rgba(199,159,74,0.15)",
              color: "var(--fintheon-accent)",
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            [OVERRIDDEN BY {theme.label?.toUpperCase()}]
          </div>
        )}

        {/* Font theme cards — each with its own inline sample */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          style={
            isSpecialActive
              ? { opacity: 0.4, pointerEvents: "none" }
              : undefined
          }
        >
          {Object.values(fontThemes).map((ft) => {
            const active = fontTheme.id === ft.id;
            return (
              <button
                key={ft.id}
                onClick={() => setFontTheme(ft)}
                className="relative text-left p-3 rounded-lg border transition-all hover:scale-[1.01]"
                style={{
                  borderColor: active
                    ? "var(--fintheon-accent)"
                    : "rgba(255,255,255,0.08)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)"
                    : "rgba(10,10,0,0.4)",
                }}
              >
                {active && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--fintheon-accent)" }}
                  >
                    <Check size={12} className="text-black" />
                  </div>
                )}
                <div className="text-[12px] font-medium text-white">
                  {ft.label}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {ft.description}
                </div>
                {/* Inline font sample — trading context */}
                <div
                  className="mt-2 text-[14px] font-semibold text-zinc-300 leading-tight"
                  style={{ fontFamily: ft.fontHeading }}
                >
                  $1,234.56
                </div>
                <div
                  className="text-[11px] text-zinc-500 mt-0.5"
                  style={{ fontFamily: ft.fontBody }}
                >
                  AAPL +2.3%
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pompa Mode */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Pompa
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Ceremonial mode — Roman-themed effects, sounds &amp; animations
        </p>
        <button
          role="switch"
          aria-checked={pompaEnabled}
          aria-label="Toggle Pompa ceremonial mode"
          onClick={() => setPompaEnabled(!pompaEnabled)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setPompaEnabled(!pompaEnabled);
            }
          }}
          className="flex items-center gap-3 w-full p-3 rounded-lg border transition-all"
          style={{
            borderColor: pompaEnabled ? "#c79f4a" : "rgba(255,255,255,0.08)",
            backgroundColor: pompaEnabled
              ? "rgba(199,159,74,0.1)"
              : "rgba(10,10,0,0.4)",
          }}
        >
          <div
            className="relative w-10 h-5 rounded-full transition-colors duration-200"
            style={{ backgroundColor: pompaEnabled ? "#c79f4a" : "#3f3f46" }}
          >
            <div
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
              style={{
                transform: pompaEnabled ? "translateX(20px)" : "translateX(0)",
              }}
            />
          </div>
          <span
            className="text-[13px] font-medium"
            style={{ color: pompaEnabled ? "#f0ead6" : "#71717a" }}
          >
            {pompaEnabled ? "Pompa Active" : "Pompa Disabled"}
          </span>
        </button>
      </section>

      {/* Special — Nothing Design themes */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Special
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Nothing Design — industrial typography, flat surfaces, sharp geometry.
          Overlays on top of color palettes.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.values(specialPresets).map((preset) => {
            const active = theme.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  if (active) {
                    // Deselect — return to default Solvys Gold
                    setTheme(DEFAULT_THEME);
                  } else {
                    setTheme(preset);
                  }
                  setCustomDraft({});
                }}
                className="relative text-left p-3 rounded-lg border transition-all hover:scale-[1.01]"
                style={{
                  borderColor: active
                    ? preset.accent
                    : "rgba(255,255,255,0.08)",
                  backgroundColor: active
                    ? `${preset.accent}10`
                    : "rgba(10,10,0,0.4)",
                }}
              >
                {active && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: preset.accent }}
                  >
                    <Check size={12} className="text-black" />
                  </div>
                )}
                {/* Color swatch strip */}
                <div className="flex gap-0 rounded overflow-hidden mb-2 h-5">
                  {[
                    { color: preset.accent, label: "Accent" },
                    { color: preset.bg, label: "BG" },
                    { color: preset.bullish, label: "Bull" },
                    { color: preset.bearish, label: "Bear" },
                    { color: preset.text, label: "Text" },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ backgroundColor: s.color }}
                      title={`${s.label}: ${s.color}`}
                    />
                  ))}
                </div>
                {/* Label + font preview */}
                <div
                  className="text-[12px] font-medium text-white"
                  style={
                    preset.fontHeading
                      ? { fontFamily: preset.fontHeading }
                      : undefined
                  }
                >
                  {preset.label}
                </div>
                <div
                  className="text-[11px] text-zinc-500 mt-0.5"
                  style={
                    preset.fontBody
                      ? { fontFamily: preset.fontBody }
                      : undefined
                  }
                >
                  Doto + Space Grotesk
                </div>
                {/* Inline font sample */}
                <div
                  className="mt-2 text-[14px] font-semibold leading-tight"
                  style={{
                    fontFamily: preset.fontHeading ?? "inherit",
                    color: preset.accent,
                  }}
                >
                  $1,234.56
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{
                    fontFamily: preset.fontBody ?? "inherit",
                    color: preset.text,
                  }}
                >
                  AAPL +2.3%
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Color Presets */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Theme Presets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {presetList.map((preset) => {
            const active = theme.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  setTheme(preset);
                  setCustomDraft({});
                }}
                className="relative text-left p-3 rounded-lg border transition-all hover:scale-[1.01]"
                style={{
                  borderColor: active
                    ? preset.accent
                    : "rgba(255,255,255,0.08)",
                  backgroundColor: active
                    ? `${preset.accent}10`
                    : "rgba(10,10,0,0.4)",
                }}
              >
                {active && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: preset.accent }}
                  >
                    <Check size={12} className="text-black" />
                  </div>
                )}
                {/* Color swatch strip */}
                <div className="flex gap-0 rounded overflow-hidden mb-2 h-5">
                  {[
                    { color: preset.accent, label: "Accent" },
                    { color: preset.bg, label: "BG" },
                    { color: preset.bullish, label: "Bull" },
                    { color: preset.bearish, label: "Bear" },
                    { color: preset.text, label: "Text" },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ backgroundColor: s.color }}
                      title={`${s.label}: ${s.color}`}
                    />
                  ))}
                </div>
                <div className="text-[12px] font-medium text-white">
                  {preset.label}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom Colors — in-app color picker */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Custom Colors
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COLOR_FIELDS.map(({ key, label }) => {
            const value = getFieldValue(key);
            return (
              <ColorSwatchInput
                key={key}
                color={value}
                label={label}
                onChange={(hex) => handleCustomChange(key, hex)}
              />
            );
          })}
        </div>
      </section>

      {/* Severity Colors */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Severity Colors
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Controls RiskFlow badges, alerts, and status indicators across the app
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SEVERITY_FIELDS.map(({ key, label }) => {
            const value = getFieldValue(key);
            return (
              <ColorSwatchInput
                key={key}
                color={value}
                label={label}
                onChange={(hex) => handleCustomChange(key, hex)}
              />
            );
          })}
        </div>
      </section>

      {/* Narrative Category Colors */}
      <section>
        <div className="flex items-baseline justify-between mb-1">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--fintheon-accent)" }}
          >
            Narrative Category Colors
          </h3>
          {Object.keys(narrativeOverrides).length > 0 && (
            <button
              onClick={resetNarrativeOverrides}
              className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              Reset categories
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 mb-3">
          Controls node, edge and legend colors on the Narrative Flow map and
          Active Narratives category tags. Saved inside custom themes so they
          travel with your palette.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {NARRATIVE_FIELDS.map(({ id, label }) => {
            const value = getNarrativeFieldValue(id);
            return (
              <ColorSwatchInput
                key={id}
                color={value}
                label={label}
                onChange={(hex) => handleNarrativeChange(id, hex)}
              />
            );
          })}
        </div>
      </section>

      {/* Save Custom Theme + Reset */}
      <div className="pt-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            const name = prompt("Theme name:");
            if (!name) return;
            const custom: ThemeConfigWithNarrative = {
              ...theme,
              name: `custom-${Date.now()}`,
              label: name,
              narrativeColors:
                Object.keys(narrativeOverrides).length > 0
                  ? { ...narrativeOverrides }
                  : undefined,
            };
            const saved = JSON.parse(
              localStorage.getItem("fintheon-custom-themes") || "[]",
            ) as ThemeConfigWithNarrative[];
            saved.push(custom);
            localStorage.setItem(
              "fintheon-custom-themes",
              JSON.stringify(saved),
            );
            setCustomThemes(saved);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors border"
          style={{
            color: "var(--fintheon-accent)",
            borderColor:
              "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
          }}
        >
          <Save className="w-3.5 h-3.5" />
          Save as Custom Theme
        </button>
        <button
          onClick={() => {
            setTheme(DEFAULT_THEME);
            setFontTheme(DEFAULT_FONT_THEME);
            setCustomDraft({});
            resetNarrativeOverrides();
          }}
          className="px-4 py-2 rounded-md text-xs font-medium transition-colors border border-zinc-700 text-zinc-500 hover:text-zinc-300"
        >
          Reset to Default
        </button>
      </div>

      {/* Saved Custom Themes */}
      {customThemes.length > 0 && (
        <section>
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--fintheon-accent)" }}
          >
            Your Saved Themes
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {customThemes.map((ct, i) => {
              const active = theme.name === ct.name;
              return (
                <button
                  key={ct.name}
                  onClick={() => {
                    // Strip the narrative bundle before handing the base theme to ThemeContext.
                    const { narrativeColors, ...baseTheme } = ct;
                    setTheme(baseTheme as ThemeConfig);
                    setCustomDraft({});
                    applyNarrativeBundle(narrativeColors);
                  }}
                  className="relative text-left p-3 rounded-lg border transition-all hover:scale-[1.01]"
                  style={{
                    borderColor: active ? ct.accent : "rgba(255,255,255,0.08)",
                    backgroundColor: active
                      ? `${ct.accent}10`
                      : "rgba(10,10,0,0.4)",
                  }}
                >
                  {active && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: ct.accent }}
                    >
                      <Check size={12} className="text-black" />
                    </div>
                  )}
                  <div className="flex gap-0 rounded overflow-hidden mb-2 h-4">
                    {[ct.accent, ct.bg, ct.bullish, ct.bearish].map((c, j) => (
                      <div
                        key={j}
                        className="flex-1"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-white">
                      {ct.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = customThemes.filter(
                          (_, idx) => idx !== i,
                        );
                        localStorage.setItem(
                          "fintheon-custom-themes",
                          JSON.stringify(updated),
                        );
                        setCustomThemes(updated);
                      }}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
