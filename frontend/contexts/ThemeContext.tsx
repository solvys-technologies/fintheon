// [claude-code 2026-05-16] Added light/dark mode support
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getAccessToken } from "../lib/supabase";
import {
  type ThemeConfig,
  THEME_PRESETS,
  DEFAULT_THEME,
  loadStoredTheme,
  saveTheme,
} from "../lib/theme";
import {
  type FontTheme,
  type FontThemeId,
  FONT_THEMES,
  DEFAULT_FONT_THEME,
  loadStoredFontTheme,
  saveFontTheme,
} from "../lib/font-theme";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
const BACKEND_SETTINGS_URL = `${API_BASE}/api/settings`;
const MODE_STORAGE_KEY = "fintheon:theme-mode:desktop";
const ZEN_STORAGE_KEY = "fintheon:zen-mode:desktop";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  presets: Record<string, ThemeConfig>;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
  fontThemes: Record<string, FontTheme>;
  pompaEnabled: boolean;
  setPompaEnabled: (v: boolean) => void;
  zenModeEnabled: boolean;
  setZenModeEnabled: (v: boolean) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const LIGHT_SURFACE = {
  bg: "#f2ede1",
  surface: "#e9e2cf",
  text: "#171310",
  muted: "#6b6455",
  border: "#1a1612",
};

function loadStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function saveMode(mode: ThemeMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {}
}

function loadStoredZenMode(): boolean {
  try {
    return localStorage.getItem(ZEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveZenMode(enabled: boolean) {
  try {
    localStorage.setItem(ZEN_STORAGE_KEY, String(enabled));
  } catch {}
}

function applyZenModeToDOM(enabled: boolean) {
  document.documentElement.dataset.zenMode = enabled ? "true" : "false";
}

function applyThemeToDOM(theme: ThemeConfig, mode?: ThemeMode) {
  const root = document.documentElement;
  const body = document.body;
  const isLight = mode === "light";
  const bg = isLight ? LIGHT_SURFACE.bg : theme.bg;
  const text = isLight ? LIGHT_SURFACE.text : theme.text;
  const surface = isLight ? LIGHT_SURFACE.surface : theme.surface;
  const muted = isLight ? LIGHT_SURFACE.muted : theme.muted;
  const border = isLight ? LIGHT_SURFACE.border : theme.border;

  root.setAttribute("data-theme", mode || "dark");
  root.dataset.fintheonSurfaceTheme = theme.glassVariant ?? "solid";
  if (body) body.dataset.fintheonSurfaceTheme = theme.glassVariant ?? "solid";
  root.style.setProperty("--fintheon-primary", theme.primary ?? theme.accent);
  root.style.setProperty("--fintheon-secondary", theme.secondary ?? theme.muted);
  root.style.setProperty("--fintheon-accent", theme.accent);
  root.style.setProperty("--fintheon-bg", bg);
  root.style.setProperty("--fintheon-text", text);
  root.style.setProperty("--fintheon-bullish", theme.bullish);
  root.style.setProperty("--fintheon-bearish", theme.bearish);
  root.style.setProperty("--fintheon-surface", surface);
  root.style.setProperty("--fintheon-border", border);
  root.style.setProperty("--fintheon-muted", muted);
  root.style.setProperty("--fintheon-severe", theme.severe ?? "#EF4444");
  root.style.setProperty("--fintheon-neutral-severe", theme.neutralSevere ?? "#F59E0B");
  root.style.setProperty("--fintheon-neutral", theme.neutral ?? "#6B7280");
  root.style.setProperty("--fintheon-low-neutral", theme.lowNeutral ?? "#3B82F6");
  root.style.setProperty("--fintheon-low", theme.low ?? "#34D399");
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-subtle", `${theme.accent}1f`);

  if (theme.special && theme.fontBody) {
    const bodyStack = `'Readable Digits', ${theme.fontBody}`;
    const headingStack = `'Readable Digits', ${theme.fontHeading ?? theme.fontBody}`;
    root.style.setProperty("--font-body", bodyStack);
    root.style.setProperty("--font-heading", headingStack);
    document.body.style.fontFamily = bodyStack;
    if (theme.borderRadius) {
      root.style.setProperty("--radius", theme.borderRadius);
    }
    if (theme.easeDefault) {
      root.style.setProperty("--ease-spring", theme.easeDefault);
      root.style.setProperty("--ease-bounce", theme.easeDefault);
    }
  }
}

function applyFontThemeToDOM(fontTheme: FontTheme, activeTheme?: ThemeConfig) {
  const root = document.documentElement;
  const specialOwnsFont = activeTheme?.special && activeTheme.fontBody;

  // Toggle .nothing-active for Nothing Font Kit OR legacy Special theme.
  const nothingActive = fontTheme.nothingKit || !!specialOwnsFont;
  if (nothingActive) {
    root.classList.add("nothing-active");
  } else {
    root.classList.remove("nothing-active");
  }

  if (specialOwnsFont) return;

  // Readable Digits leads so digits render consistently in Inter across themes.
  const bodyStack = `'Readable Digits', ${fontTheme.fontBody}`;
  const headingStack = `'Readable Digits', ${fontTheme.fontHeading}`;
  root.style.setProperty("--font-body", bodyStack);
  root.style.setProperty("--font-heading", headingStack);
  document.body.style.fontFamily = bodyStack;

  if (fontTheme.fontMono) {
    root.style.setProperty("--font-mono", fontTheme.fontMono);
  } else {
    root.style.removeProperty("--font-mono");
  }

  if (fontTheme.nothingKit) {
    if (fontTheme.borderRadius) {
      root.style.setProperty("--radius", fontTheme.borderRadius);
    }
    if (fontTheme.easeDefault) {
      root.style.setProperty("--ease-spring", fontTheme.easeDefault);
      root.style.setProperty("--ease-bounce", fontTheme.easeDefault);
    }
  } else {
    root.style.removeProperty("--radius");
    root.style.removeProperty("--ease-spring");
    root.style.removeProperty("--ease-bounce");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => loadStoredMode());

  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    const stored = loadStoredTheme();
    applyThemeToDOM(stored, mode);
    return stored;
  });

  const [fontTheme, setFontThemeState] = useState<FontTheme>(() => {
    const stored = loadStoredFontTheme();
    applyFontThemeToDOM(stored);
    return stored;
  });

  const [pompaEnabled, setPompaEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("fintheon:pompa-mode");
    return stored !== null ? stored === "true" : true;
  });
  const [zenModeEnabled, setZenModeState] = useState<boolean>(() => {
    const stored = loadStoredZenMode();
    if (typeof document !== "undefined") applyZenModeToDOM(stored);
    return stored;
  });

  useEffect(() => {
    localStorage.setItem("fintheon:pompa-mode", String(pompaEnabled));
  }, [pompaEnabled]);

  const setZenModeEnabled = useCallback((next: boolean) => {
    setZenModeState(next);
    applyZenModeToDOM(next);
    saveZenMode(next);
  }, []);

  const backendSynced = useRef(false);

  const setTheme = useCallback(
    (next: ThemeConfig) => {
      setThemeState(next);
      applyThemeToDOM(next, mode);
      saveTheme(next);
      applyFontThemeToDOM(fontTheme, next);
    },
    [fontTheme, mode],
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      applyThemeToDOM(theme, next);
      saveMode(next);
    },
    [theme],
  );

  const setFontTheme = useCallback(
    (next: FontTheme) => {
      setFontThemeState(next);
      applyFontThemeToDOM(next, theme);
      saveFontTheme(next);
    },
    [theme],
  );

  useEffect(() => {
    applyThemeToDOM(theme, mode);
    applyFontThemeToDOM(fontTheme, theme);

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          backendSynced.current = true;
          return;
        }
        const res = await fetch(BACKEND_SETTINGS_URL, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : null;
        const remote = data?.settings;
        if (remote?.appearance) {
          const { colorTheme, fontThemeId, pompaMode, themeMode, zenModeEnabled: remoteZenMode, zenMode } = remote.appearance;
          const remoteMode = themeMode === "light" ? "light" : mode;
          if (themeMode === "light" || themeMode === "dark") {
            setModeState(themeMode);
            saveMode(themeMode);
          }
          let nextTheme = theme;
          if (
            colorTheme &&
            typeof colorTheme === "object" &&
            colorTheme.accent
          ) {
            nextTheme = colorTheme as ThemeConfig;
            setThemeState(nextTheme);
            applyThemeToDOM(nextTheme, remoteMode);
            saveTheme(nextTheme);
          }
          if (fontThemeId && FONT_THEMES[fontThemeId as FontThemeId]) {
            const ft = FONT_THEMES[fontThemeId as FontThemeId];
            setFontThemeState(ft);
            applyFontThemeToDOM(ft, nextTheme);
            saveFontTheme(ft);
          }
          if (pompaMode !== undefined) {
            setPompaEnabled(pompaMode as boolean);
          }
          if (remoteZenMode !== undefined || zenMode !== undefined) {
            const nextZen = Boolean(remoteZenMode ?? zenMode);
            setZenModeState(nextZen);
            applyZenModeToDOM(nextZen);
            saveZenMode(nextZen);
          }
        }
      } finally {
        backendSynced.current = true;
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!backendSynced.current) return;
    const appearance = {
      colorTheme: theme,
      fontThemeId: fontTheme.id,
      pompaMode: pompaEnabled,
      themeMode: mode,
      zenModeEnabled,
    };
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      fetch(BACKEND_SETTINGS_URL, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: { appearance } }),
      }).catch(() => {});
    })();
  }, [theme, fontTheme, pompaEnabled, mode, zenModeEnabled]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        presets: THEME_PRESETS,
        fontTheme,
        setFontTheme,
        fontThemes: FONT_THEMES,
        pompaEnabled,
        setPompaEnabled,
        zenModeEnabled,
        setZenModeEnabled,
        mode,
        setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
