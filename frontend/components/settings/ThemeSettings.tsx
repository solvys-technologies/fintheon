// [claude-code 2026-03-14] Theme settings — font style with samples + color presets + custom HEX
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { type ThemeConfig, DEFAULT_THEME } from '../../lib/theme';
import { DEFAULT_FONT_THEME } from '../../lib/font-theme';

const COLOR_FIELDS: { key: keyof ThemeConfig; label: string }[] = [
  { key: 'accent', label: 'Accent' },
  { key: 'bg', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'bullish', label: 'Bullish' },
  { key: 'bearish', label: 'Bearish' },
];

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

const SAMPLE_HEADING = 'The quick brown fox';
const SAMPLE_BODY = 'Market conditions remain volatile as traders assess incoming economic data and geopolitical developments.';

export function ThemeSettings() {
  const { theme, setTheme, presets, fontTheme, setFontTheme, fontThemes, pompaEnabled, setPompaEnabled } = useTheme();
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  const presetList = Object.values(presets);

  const handleCustomChange = (key: keyof ThemeConfig, value: string) => {
    setCustomDraft((d) => ({ ...d, [key]: value }));
    if (isValidHex(value)) {
      setTheme({ ...theme, name: 'custom', label: 'Custom', [key]: value });
    }
  };

  const getFieldValue = (key: keyof ThemeConfig): string => {
    return customDraft[key] ?? (theme[key] as string);
  };

  return (
    <div className="space-y-6">
      {/* Font Style — with live samples */}
      <section>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--fintheon-accent)' }}>
          Font Style
        </h3>

        {/* Live sample preview — uses current active font */}
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{
            borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
            backgroundColor: 'rgba(10,10,0,0.3)',
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.values(fontThemes).map((ft) => {
            const active = fontTheme.id === ft.id;
            return (
              <button
                key={ft.id}
                onClick={() => setFontTheme(ft)}
                className="relative text-left p-3 rounded-lg border transition-all hover:scale-[1.01]"
                style={{
                  borderColor: active ? 'var(--fintheon-accent)' : 'rgba(255,255,255,0.08)',
                  backgroundColor: active ? 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)' : 'rgba(10,10,0,0.4)',
                }}
              >
                {active && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--fintheon-accent)' }}
                  >
                    <Check size={12} className="text-black" />
                  </div>
                )}
                <div className="text-[12px] font-medium text-white">{ft.label}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{ft.description}</div>
                {/* Inline font sample per card */}
                <div
                  className="mt-2 text-[14px] font-semibold text-zinc-300 leading-tight"
                  style={{ fontFamily: ft.fontHeading }}
                >
                  Aa Bb Cc
                </div>
                <div
                  className="text-[11px] text-zinc-500 mt-0.5"
                  style={{ fontFamily: ft.fontBody }}
                >
                  0123456789
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pompa Mode */}
      <section>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--fintheon-accent)' }}>
          Pompa
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Ceremonial mode — Roman-themed effects, sounds &amp; animations
        </p>
        <button
          onClick={() => setPompaEnabled(!pompaEnabled)}
          className="flex items-center gap-3 w-full p-3 rounded-lg border transition-all"
          style={{
            borderColor: pompaEnabled ? '#c79f4a' : 'rgba(255,255,255,0.08)',
            backgroundColor: pompaEnabled ? 'rgba(199,159,74,0.1)' : 'rgba(10,10,0,0.4)',
          }}
        >
          <div
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ backgroundColor: pompaEnabled ? '#c79f4a' : '#3f3f46' }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ transform: pompaEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
          <span className="text-[13px] font-medium" style={{ color: pompaEnabled ? '#f0ead6' : '#71717a' }}>
            {pompaEnabled ? 'Pompa Active' : 'Pompa Disabled'}
          </span>
        </button>
      </section>

      {/* Color Presets */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
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
                  borderColor: active ? preset.accent : 'rgba(255,255,255,0.08)',
                  backgroundColor: active ? `${preset.accent}10` : 'rgba(10,10,0,0.4)',
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
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex -space-x-1">
                    {[preset.accent, preset.bg, preset.bullish, preset.bearish].map((c, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-black/30"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-[12px] font-medium text-white">{preset.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom Colors */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
          Custom Colors
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COLOR_FIELDS.map(({ key, label }) => {
            const value = getFieldValue(key);
            const valid = isValidHex(value);
            return (
              <div key={key} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md border border-white/10 shrink-0"
                  style={{ backgroundColor: valid ? value : '#333' }}
                />
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleCustomChange(key, e.target.value)}
                    onFocus={() => {
                      if (!customDraft[key]) setCustomDraft((d) => ({ ...d, [key]: theme[key] as string }));
                    }}
                    className="w-full bg-transparent border-b text-[13px] text-white py-0.5 outline-none font-mono"
                    style={{ borderColor: valid ? 'var(--fintheon-accent)' : '#EF4444' }}
                    placeholder="#000000"
                    spellCheck={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="pt-2">
        <button
          onClick={() => {
            setTheme(DEFAULT_THEME);
            setFontTheme(DEFAULT_FONT_THEME);
            setCustomDraft({});
          }}
          className="px-4 py-2 rounded-md text-xs font-medium transition-colors border"
          style={{
            color: 'var(--fintheon-accent)',
            borderColor: 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
          }}
        >
          Reset to Default
        </button>
      </div>
    </div>
  );
}
