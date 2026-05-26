import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Pencil, Save, Trash2, Tv } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { DEFAULT_THEME, type ThemeConfig } from "../../lib/theme";
import { DEFAULT_FONT_THEME } from "../../lib/font-theme";
import type { FontTheme } from "../../lib/font-theme";
import { getAccessToken } from "../../lib/supabase";
import {
  DotMatrixLoader,
  DotMatrixSuccess,
} from "../icon-bank/DotMatrixLoader";
import { SettingsActionStatus } from "./SettingsActionStatus";

interface ThemeProfile {
  id: string;
  name: string;
  theme: ThemeConfig;
}

type SavePhase = "idle" | "saving" | "saved";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const PROFILE_KEY = "fintheon:theme-profiles:v1";

const severityFields: ColorFieldConfig[] = [
  { key: "severe", label: "Critical", detail: "Highest urgency" },
  { key: "neutralSevere", label: "High", detail: "Elevated risk" },
  { key: "neutral", label: "Medium", detail: "Baseline attention" },
  { key: "lowNeutral", label: "Low-Mid", detail: "Watchlist signal" },
  { key: "low", label: "Low", detail: "Calm / routine" },
];

const visualFields: ColorFieldConfig[] = [
  { key: "primary", label: "Primary", detail: "Lead controls" },
  { key: "secondary", label: "Secondary", detail: "Supporting UI" },
  { key: "accent", label: "Accent", detail: "Action emphasis" },
  { key: "bg", label: "Background", detail: "Canvas tone" },
  { key: "border", label: "Border", detail: "Input outlines" },
];

const reactionFields: ColorFieldConfig[] = [
  { key: "bullish", label: "Bullish", detail: "Positive reaction" },
  { key: "bearish", label: "Bearish", detail: "Negative reaction" },
  { key: "neutral", label: "Neutral", detail: "Balanced state" },
];

interface ColorFieldConfig {
  key: keyof ThemeConfig;
  label: string;
  detail: string;
}

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
      body: JSON.stringify({
        settings: { appearance: { savedThemes: profiles } },
      }),
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
    zenModeEnabled,
    setZenModeEnabled,
    mode,
    setMode,
  } = useTheme();
  const [profiles, setProfiles] = useState<ThemeProfile[]>(loadLocalProfiles);
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState<{
    label: string;
    detail?: string;
    tone?: "muted" | "success" | "error" | "warning";
  } | null>(null);
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [openColorKey, setOpenColorKey] = useState<string | null>(null);
  const [fontOpen, setFontOpen] = useState(false);

  const solidPresets = useMemo(
    () =>
      Object.values(presets).filter(
        (preset) => (preset.glassVariant ?? "solid") === "solid",
      ),
    [presets],
  );

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
    const normalized = normalizeHex(value);
    if (!normalized) return;
    setTheme({
      ...theme,
      [key]: normalized,
      name: "custom",
      label: profileName.trim() || "Custom Theme",
    });
  };

  const setGlassVariant = (variant: "solid" | "frosted" | "liquid") => {
    setTheme({
      ...theme,
      glassEnabled: variant !== "solid",
      glassVariant: variant,
      name: "custom",
      label: profileName.trim() || theme.label || "Custom Theme",
    });
  };

  const handleSaveProfile = async () => {
    const name = profileName.trim() || theme.label || "Custom Theme";
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const nextTheme = { ...theme, name: id || "custom", label: name };
    const next = [
      { id: nextTheme.name, name, theme: nextTheme },
      ...profiles.filter((profile) => profile.id !== nextTheme.name),
    ];
    setSavePhase("saving");
    setProfiles(next);
    setTheme(nextTheme);
    setProfileStatus({
      label: "Theme Saved",
      detail: name,
      tone: "success",
    });
    await saveProfiles(next);
    setSavePhase("saved");
    window.setTimeout(() => setSavePhase("idle"), 1600);
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
    setProfileStatus({
      label: "Theme Renamed",
      detail: name,
      tone: "success",
    });
    void saveProfiles(next);
  };

  const deleteProfile = (id: string) => {
    const removed = profiles.find((profile) => profile.id === id);
    const next = profiles.filter((profile) => profile.id !== id);
    setProfiles(next);
    setProfileStatus({
      label: "Theme Deleted",
      detail: removed?.name ?? id,
      tone: "warning",
    });
    void saveProfiles(next);
  };

  return (
    <div className="space-y-8 text-right">
      <section>
        <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Theme Preset
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {profiles.map((profile) => (
            <ThemeTile
              key={profile.id}
              active={theme.name === profile.theme.name}
              theme={profile.theme}
              label={profile.name}
              detail="custom"
              onSelect={() => setTheme(profile.theme)}
              onRename={() => renameProfile(profile)}
              onDelete={() => deleteProfile(profile.id)}
            />
          ))}
          {solidPresets.map((preset) => (
            <ThemeTile
              key={preset.name}
              active={theme.name === preset.name}
              theme={preset}
              label={preset.label}
              detail="solid"
              onSelect={() =>
                setTheme({
                  ...preset,
                  glassVariant: theme.glassVariant,
                  glassEnabled: theme.glassEnabled,
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Theme Variables
        </h3>
        <div className="grid gap-5 lg:grid-cols-3">
          <ColorGroup
            title="Severity"
            fields={severityFields}
            theme={theme}
            openColorKey={openColorKey}
            setOpenColorKey={setOpenColorKey}
            updateThemeColor={updateThemeColor}
          />
          <ColorGroup
            title="Visuals"
            fields={visualFields}
            theme={theme}
            openColorKey={openColorKey}
            setOpenColorKey={setOpenColorKey}
            updateThemeColor={updateThemeColor}
          />
          <ColorGroup
            title="Reactions"
            fields={reactionFields}
            theme={theme}
            openColorKey={openColorKey}
            setOpenColorKey={setOpenColorKey}
            updateThemeColor={updateThemeColor}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
            Save Theme
          </h3>
          <div className="relative">
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Name this theme"
              className="h-10 w-full rounded-md bg-[var(--fintheon-surface)] px-3 pr-12 text-right text-sm text-[var(--fintheon-text)] placeholder:text-[var(--fintheon-text)]/22 focus:outline-none"
            />
            <button
              onClick={handleSaveProfile}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--fintheon-accent)] transition hover:opacity-80"
              aria-label="Save theme"
              title="Save theme"
            >
              {savePhase === "saving" ? (
                <DotMatrixLoader size={16} />
              ) : savePhase === "saved" ? (
                <DotMatrixSuccess size={16} />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </button>
          </div>
          {profileStatus && (
            <div className="mt-2 flex justify-end">
              <SettingsActionStatus
                label={profileStatus.label}
                detail={profileStatus.detail}
                tone={profileStatus.tone}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-right text-sm font-semibold text-[var(--fintheon-accent)]">
            Font & Mode
          </h3>
          <FontDropdown
            fontTheme={fontTheme}
            fontThemes={fontThemes}
            open={fontOpen}
            setOpen={setFontOpen}
            setFontTheme={setFontTheme}
          />
          <div className="grid grid-cols-2 gap-3">
            <EffectToggle
              label={mode === "light" ? "Light" : "Dark"}
              enabled={mode === "light"}
              onToggle={() => setMode(mode === "light" ? "dark" : "light")}
            />
            <EffectToggle
              label={pompaEnabled ? "Pompa On" : "Pompa Off"}
              enabled={pompaEnabled}
              onToggle={() => setPompaEnabled(!pompaEnabled)}
            />
            <EffectToggle
              label={zenModeEnabled ? "Zen On" : "Zen Off"}
              enabled={zenModeEnabled}
              icon={<Tv className="h-3.5 w-3.5" />}
              onToggle={() => setZenModeEnabled(!zenModeEnabled)}
            />
            <EffectToggle
              label="Frosted Glass"
              enabled={theme.glassVariant === "frosted"}
              onToggle={() =>
                setGlassVariant(
                  theme.glassVariant === "frosted" ? "solid" : "frosted",
                )
              }
            />
            <EffectToggle
              label="Liquid Glass"
              enabled={theme.glassVariant === "liquid"}
              onToggle={() =>
                setGlassVariant(
                  theme.glassVariant === "liquid" ? "solid" : "liquid",
                )
              }
            />
          </div>
          <button
            onClick={() => {
              setTheme(DEFAULT_THEME);
              setFontTheme(DEFAULT_FONT_THEME);
              setMode("dark");
              setZenModeEnabled(false);
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

function ThemeTile({
  active,
  theme,
  label,
  detail,
  onSelect,
  onRename,
  onDelete,
}: {
  active: boolean;
  theme: ThemeConfig;
  label: string;
  detail: string;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative text-right">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-right transition-opacity hover:opacity-85 ${
          active ? "opacity-100" : "opacity-70"
        }`}
      >
        <ThemePreview theme={theme} />
        <span className="mt-2 block truncate text-[12px] font-semibold text-[var(--fintheon-text)]">
          {label}
        </span>
        <span className="block text-[10px] text-zinc-500">{detail}</span>
      </button>
      {active && (
        <Check className="absolute right-1 top-1 h-4 w-4 text-[var(--fintheon-accent)]" />
      )}
      {(onRename || onDelete) && (
        <div className="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onRename && (
            <button
              onClick={onRename}
              className="fintheon-icon-button"
              title="Rename theme"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="fintheon-icon-button text-red-400"
              title="Delete theme"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ThemePreview({ theme }: { theme: ThemeConfig }) {
  return (
    <div className="flex h-4 overflow-hidden rounded-sm">
      {[
        theme.primary ?? theme.accent,
        theme.secondary ?? theme.muted,
        theme.accent,
        theme.border,
      ].map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function ColorGroup({
  title,
  fields,
  theme,
  openColorKey,
  setOpenColorKey,
  updateThemeColor,
}: {
  title: string;
  fields: ColorFieldConfig[];
  theme: ThemeConfig;
  openColorKey: string | null;
  setOpenColorKey: (key: string | null) => void;
  updateThemeColor: (key: keyof ThemeConfig, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/85">
        {title}
      </p>
      {fields.map((field) => (
        <ColorToken
          key={`${title}-${String(field.key)}`}
          field={field}
          color={String(theme[field.key] ?? theme.accent ?? "#c79f4a")}
          open={openColorKey === `${title}-${String(field.key)}`}
          onOpen={() => {
            const id = `${title}-${String(field.key)}`;
            setOpenColorKey(openColorKey === id ? null : id);
          }}
          onChange={(value) => updateThemeColor(field.key, value)}
        />
      ))}
    </div>
  );
}

function ColorToken({
  field,
  color,
  open,
  onOpen,
  onChange,
}: {
  field: ColorFieldConfig;
  color: string;
  open: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex items-center justify-between gap-3 py-2 text-right">
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-medium text-[var(--fintheon-text)]">
          {field.label}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--fintheon-text)]/35">
          {field.detail}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-7 w-12 shrink-0 rounded-[4px] transition-transform hover:scale-[1.04]"
        style={{ backgroundColor: color }}
        title={`${field.label} color`}
      />
      {open && (
        <div className="theme-color-popover fintheon-popover-surface absolute right-0 top-10 z-50 w-48 p-3 text-right">
          <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
            Hex
            <input
              autoFocus
              value={color}
              onChange={(event) => onChange(event.target.value)}
              className="mt-2 h-8 w-full rounded-[4px] bg-[rgba(0,0,0,0.34)] px-2 text-right text-[12px] text-[var(--fintheon-text)] outline-none"
              placeholder="#c79f4a"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function FontDropdown({
  fontTheme,
  fontThemes,
  open,
  setOpen,
  setFontTheme,
}: {
  fontTheme: FontTheme;
  fontThemes: Record<string, FontTheme>;
  open: boolean;
  setOpen: (open: boolean) => void;
  setFontTheme: (theme: FontTheme) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md bg-[var(--fintheon-surface)] px-3 text-right text-sm text-[var(--fintheon-text)]"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span>{fontTheme.label}</span>
      </button>
      {open && (
        <div className="theme-font-popover fintheon-popover-surface absolute right-0 top-12 z-50 w-full p-2 text-right">
          {Object.values(fontThemes).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFontTheme(item);
                setOpen(false);
              }}
              className="w-full rounded-[4px] px-3 py-2 text-right transition hover:bg-white/5"
            >
              <span
                className="block text-[12px] text-[var(--fintheon-text)]"
                style={{ fontFamily: item.fontHeading }}
              >
                {item.label}
              </span>
              <span
                className="mt-1 block text-[10px] text-[var(--fintheon-text)]/42"
                style={{ fontFamily: item.fontBody }}
              >
                The market writes in this voice.
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EffectToggle({
  label,
  enabled,
  icon,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  icon?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="flex items-center justify-between gap-3 py-2 text-right"
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--fintheon-text)]">
        {icon ? (
          <span className="shrink-0 text-[var(--fintheon-accent)]">{icon}</span>
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-[var(--fintheon-accent)]" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-black transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  return null;
}
