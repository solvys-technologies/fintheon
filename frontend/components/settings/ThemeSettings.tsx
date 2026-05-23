import { useEffect, useState } from "react";
import { Check, Pencil, Save, Trash2 } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { DEFAULT_THEME, type ThemeConfig } from "../../lib/theme";
import { DEFAULT_FONT_THEME } from "../../lib/font-theme";
import { getAccessToken } from "../../lib/supabase";

interface ThemeProfile {
  id: string;
  name: string;
  theme: ThemeConfig;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const PROFILE_KEY = "fintheon:theme-profiles:v1";
const colorFields: { key: keyof ThemeConfig; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "bg", label: "Background" },
  { key: "border", label: "Border" },
  { key: "severe", label: "Severity Critical" },
  { key: "neutralSevere", label: "Severity High" },
  { key: "neutral", label: "Severity Medium" },
  { key: "lowNeutral", label: "Severity Low-Mid" },
  { key: "low", label: "Severity Low" },
  { key: "bullish", label: "Bullish" },
  { key: "bearish", label: "Bearish" },
];

function loadLocalProfiles(): ThemeProfile[] {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

async function saveProfiles(profiles: ThemeProfile[]) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${API_BASE}/api/settings`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ settings: { appearance: { savedThemes: profiles } } }),
    });
  } catch {
    /* local theme saving should never block UI */
  }
}

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
  const [profiles, setProfiles] = useState<ThemeProfile[]>(loadLocalProfiles);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/settings`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : null;
      const saved = data?.settings?.appearance?.savedThemes;
      if (!cancelled && Array.isArray(saved)) {
        setProfiles(saved);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const updateThemeColor = (key: keyof ThemeConfig, value: string) => {
    setTheme({
      ...theme,
      [key]: value,
      name: "custom",
      label: profileName.trim() || "Custom Theme",
    });
  };

  const handleSaveProfile = () => {
    const name = profileName.trim() || theme.label || "Custom Theme";
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const nextTheme = { ...theme, name: id || "custom", label: name };
    const next = [
      ...profiles.filter((profile) => profile.id !== nextTheme.name),
      { id: nextTheme.name, name, theme: nextTheme },
    ];
    setProfiles(next);
    setTheme(nextTheme);
    void saveProfiles(next);
  };

  const renameProfile = (profile: ThemeProfile) => {
    const name = window.prompt("Theme name", profile.name)?.trim();
    if (!name) return;
    const next = profiles.map((item) =>
      item.id === profile.id
        ? { ...item, name, theme: { ...item.theme, label: name } }
        : item,
    );
    setProfiles(next);
    void saveProfiles(next);
  };

  const deleteProfile = (id: string) => {
    const next = profiles.filter((profile) => profile.id !== id);
    setProfiles(next);
    void saveProfiles(next);
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--fintheon-accent)]">
          Theme Preset
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.values(presets).map((preset) => {
            const active = theme.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => setTheme(preset)}
                className="settings-soft-panel relative rounded-md p-3 text-left transition-opacity hover:opacity-85"
              >
                {active && <Check className="absolute right-3 top-3 h-4 w-4 text-[var(--fintheon-accent)]" />}
                <div className="mb-2 flex h-4 overflow-hidden rounded-sm">
                  {[preset.accent, preset.bg, preset.bullish, preset.bearish].map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <p className="text-[12px] font-semibold text-[var(--fintheon-text)]">
                  {preset.label}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {preset.glassVariant ?? "solid"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--fintheon-accent)]">
          Theme Variables
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colorFields.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-[10px] uppercase text-[var(--fintheon-text)]/42">
                {label}
              </span>
              <span className="settings-field-shell flex items-center gap-2 rounded-md px-2 py-1.5">
                <input
                  type="color"
                  value={String(theme[key] ?? "#c79f4a")}
                  onChange={(event) => updateThemeColor(key, event.target.value)}
                  className="h-6 w-8 rounded border-0 bg-transparent p-0"
                />
                <input
                  value={String(theme[key] ?? "")}
                  onChange={(event) => updateThemeColor(key, event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--fintheon-text)] outline-none"
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--fintheon-accent)]">
            Saved Themes
          </h3>
          <div className="flex gap-2">
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Name this theme"
              className="flex-1 rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] placeholder:text-[var(--fintheon-text)]/22 focus:outline-none"
            />
            <button onClick={handleSaveProfile} className="fintheon-action-link inline-flex items-center gap-1 text-[11px] font-semibold uppercase">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--fintheon-accent)]/8 px-3 py-2">
                <button onClick={() => setTheme(profile.theme)} className="min-w-0 text-left">
                  <span className="block truncate text-[12px] text-[var(--fintheon-text)]">{profile.name}</span>
                  <span className="text-[10px] text-zinc-500">{profile.theme.glassVariant ?? "solid"}</span>
                </button>
                <span className="flex items-center gap-1">
                  <button onClick={() => renameProfile(profile)} className="fintheon-icon-button" title="Rename theme">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteProfile(profile.id)} className="fintheon-icon-button text-red-400" title="Delete theme">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Font & Mode
          </h3>
          <select
            value={fontTheme.id}
            onChange={(event) => setFontTheme(fontThemes[event.target.value])}
            className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] focus:outline-none"
          >
            {Object.values(fontThemes).map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode(mode === "light" ? "dark" : "light")} className="settings-soft-panel rounded-md px-3 py-2 text-[12px] text-[var(--fintheon-text)]">
              {mode === "light" ? "Light" : "Dark"}
            </button>
            <button onClick={() => setPompaEnabled(!pompaEnabled)} className="settings-soft-panel rounded-md px-3 py-2 text-[12px] text-[var(--fintheon-text)]">
              {pompaEnabled ? "Pompa On" : "Pompa Off"}
            </button>
          </div>
          <button
            onClick={() => {
              setTheme(DEFAULT_THEME);
              setFontTheme(DEFAULT_FONT_THEME);
              setMode("dark");
            }}
            className="fintheon-action-link text-[11px] font-semibold uppercase"
          >
            Reset to Default
          </button>
        </div>
      </section>
    </div>
  );
}
