// [claude-code 2026-05-16] Simplified to theme mode + 2 presets only
import { Check } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { DEFAULT_THEME } from "../../lib/theme";
import { DEFAULT_FONT_THEME } from "../../lib/font-theme";

const SAMPLE_HEADING = "AAPL 189.42  +2.31%";
const SAMPLE_BODY =
  "ES broke above 5,420 resistance — watching $1,234.56 target with 62% probability. Risk/reward favors long above the VWAP.";

export function ThemeSettings() {
  const {
    theme,
    setTheme,
    presets,
    fontTheme,
    setFontTheme,
    fontThemes,
    pompaEnabled,
    setPompaEnabled,
    mode,
    setMode,
  } = useTheme();

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

        {/* Font theme cards — each with its own inline sample */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
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

      {/* Theme Mode Toggle — Light/Dark */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Theme Mode
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Light or dark appearance
        </p>
        <button
          role="switch"
          aria-checked={mode === "light"}
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
          className="flex items-center gap-3 w-full p-3 rounded-lg border transition-all"
          style={{
            borderColor: mode === "light" ? "#c79f4a" : "rgba(255,255,255,0.08)",
            backgroundColor: mode === "light"
              ? "rgba(199,159,74,0.1)"
              : "rgba(10,10,0,0.4)",
          }}
        >
          <div
            className="relative w-10 h-5 rounded-full transition-colors duration-200"
            style={{ backgroundColor: mode === "light" ? "#c79f4a" : "#3f3f46" }}
          >
            <div
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
              style={{
                transform: mode === "light" ? "translateX(20px)" : "translateX(0)",
              }}
            />
          </div>
          <span
            className="text-[13px] font-medium"
            style={{ color: mode === "light" ? "#f0ead6" : "#71717a" }}
          >
            {mode === "light" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </section>

      {/* Color Presets — only Something Solvys + Something Monochrome */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--fintheon-accent)" }}
        >
          Theme Preset
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(presets).map((preset) => {
            const active = theme.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  setTheme(preset);
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
                <div
                  className="text-[12px] font-medium"
                  style={{ color: "var(--fintheon-text)" }}
                >
                  {preset.label}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {preset.fontHeading?.split(",")[0]?.replace(/'/g, "")} +{" "}
                  {preset.fontBody?.split(",")[0]?.replace(/'/g, "")}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reset to Default */}
      <div className="pt-4">
        <button
          onClick={() => {
            setTheme(DEFAULT_THEME);
            setFontTheme(DEFAULT_FONT_THEME);
            setMode("dark");
          }}
          className="px-4 py-2 rounded-md text-xs font-medium transition-colors border border-zinc-700 text-zinc-500 hover:text-zinc-300"
        >
          Reset to Default
        </button>
      </div>
    </div>
  );
}
