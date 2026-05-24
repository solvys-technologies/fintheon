// [claude-code 2026-04-19] S26-P2 T5: mode state ("dark" | "light") + global palette
//   flip per TP — "people should have the option to switch between the light theme and
//   the dark theme on a toggle inside of the menu that pops up from the hamburger menu."
//   Dark remains the default. Light mode paints bg/surface as paper and flips text to
//   near-black; accent stays the theme accent so brand identity survives the switch.
//   Persists to localStorage as `fintheon:theme-mode`.
// [claude-code 2026-04-19] Expose ALL_PRESETS so mobile settings can show both standard
//   themes and the Nothing Design special presets (Something Solvys / Something Monochrome).
// [claude-code 2026-04-15] T2: Mobile theme — dual CSS var mapping (Fintheon + Nothing tokens)
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  type ThemeConfig,
  THEME_PRESETS,
  loadStoredTheme,
  saveTheme,
} from "@frontend/lib/theme";
import {
  type FontTheme,
  type FontThemeId,
  FONT_THEMES,
  loadStoredFontTheme,
  saveFontTheme,
} from "@frontend/lib/font-theme";
import { useAuth } from "./AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MODE_STORAGE_KEY = "fintheon:theme-mode";
const GLASS_TRANSPARENCY_STORAGE_KEY = "fintheon:glass-transparency:mobile";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
  glassTransparencyEnabled: boolean;
  setGlassTransparencyEnabled: (enabled: boolean) => void;
  availableThemes: Record<string, ThemeConfig>;
  availableFonts: Record<string, FontTheme>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Paper / near-black inversion used when mode === "light". Accent keeps the
 *  theme's accent so brand identity doesn't vanish. Surface sits slightly darker
 *  than bg so glass/cards still have depth. */
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
  } catch {
    /* ignore */
  }
}

function loadStoredGlassTransparency(): boolean {
  try {
    return localStorage.getItem(GLASS_TRANSPARENCY_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function saveGlassTransparency(enabled: boolean) {
  try {
    localStorage.setItem(
      GLASS_TRANSPARENCY_STORAGE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    /* ignore */
  }
}

function applyGlassTransparencyToDOM(enabled: boolean) {
  const value = enabled ? "true" : "false";
  document.documentElement.setAttribute(
    "data-fintheon-glass-transparency",
    value,
  );
  document.body?.setAttribute("data-fintheon-glass-transparency", value);
}

function applyThemeToDOM(theme: ThemeConfig, mode: ThemeMode) {
  const root = document.documentElement;
  const isLight = mode === "light";

  // Accent stays the same regardless of mode — brand continuity.
  const bg = isLight ? LIGHT_SURFACE.bg : theme.bg;
  const text = isLight ? LIGHT_SURFACE.text : theme.text;
  const surface = isLight ? LIGHT_SURFACE.surface : theme.surface;
  const muted = isLight ? LIGHT_SURFACE.muted : theme.muted;
  const border = isLight ? LIGHT_SURFACE.border : theme.border;

  root.setAttribute("data-theme", mode);
  // Fintheon tokens (shared components)
  root.style.setProperty("--fintheon-accent", theme.accent);
  root.style.setProperty("--fintheon-primary", theme.primary ?? theme.accent);
  root.style.setProperty("--fintheon-bg", bg);
  root.style.setProperty("--fintheon-text", text);
  root.style.setProperty("--fintheon-bullish", theme.bullish);
  root.style.setProperty("--fintheon-bearish", theme.bearish);
  root.style.setProperty("--fintheon-surface", surface);
  root.style.setProperty("--fintheon-border", border);
  root.style.setProperty("--fintheon-muted", muted);
  root.style.setProperty("--fintheon-severe", theme.severe ?? "#EF4444");
  root.style.setProperty(
    "--fintheon-neutral-severe",
    theme.neutralSevere ?? "#F59E0B",
  );
  root.style.setProperty("--fintheon-neutral", theme.neutral ?? "#6B7280");
  root.style.setProperty(
    "--fintheon-low-neutral",
    theme.lowNeutral ?? "#3B82F6",
  );
  root.style.setProperty("--fintheon-low", theme.low ?? "#34D399");
  // Only --accent crosses into Nothing tokens — all others stay immutable
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-subtle", `${theme.accent}1f`);
}

function applyFontThemeToDOM(fontTheme: FontTheme) {
  const root = document.documentElement;
  // Prepend 'Readable Digits' so digits/numbers always render in Doto
  const bodyStack = `'Readable Digits', ${fontTheme.fontBody}`;
  const headingStack = `'Readable Digits', ${fontTheme.fontHeading}`;
  root.style.setProperty("--font-body", bodyStack);
  root.style.setProperty("--font-heading", headingStack);
  document.body.style.fontFamily = bodyStack;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isAuthenticated } = useAuth();

  const [mode, setModeState] = useState<ThemeMode>(() => loadStoredMode());

  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    const stored = loadStoredTheme();
    applyThemeToDOM(stored, loadStoredMode());
    return stored;
  });

  const [fontTheme, setFontThemeState] = useState<FontTheme>(() => {
    const stored = loadStoredFontTheme();
    applyFontThemeToDOM(stored);
    return stored;
  });

  const [glassTransparencyEnabled, setGlassTransparencyState] =
    useState<boolean>(() => {
      const stored = loadStoredGlassTransparency();
      applyGlassTransparencyToDOM(stored);
      return stored;
    });

  const backendSynced = useRef(false);

  const setTheme = useCallback(
    (next: ThemeConfig) => {
      setThemeState(next);
      applyThemeToDOM(next, mode);
      saveTheme(next);
    },
    [mode],
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      applyThemeToDOM(theme, next);
      saveMode(next);
    },
    [theme],
  );

  const setFontTheme = useCallback((next: FontTheme) => {
    setFontThemeState(next);
    applyFontThemeToDOM(next);
    saveFontTheme(next);
  }, []);

  const setGlassTransparencyEnabled = useCallback((enabled: boolean) => {
    setGlassTransparencyState(enabled);
    applyGlassTransparencyToDOM(enabled);
    saveGlassTransparency(enabled);
  }, []);

  // Fetch backend theme on mount (backend is source of truth when authenticated)
  useEffect(() => {
    applyThemeToDOM(theme, mode);
    applyFontThemeToDOM(fontTheme);
    applyGlassTransparencyToDOM(glassTransparencyEnabled);

    if (!isAuthenticated) {
      backendSynced.current = true;
      return;
    }

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/settings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          backendSynced.current = true;
          return;
        }
        const data = await res.json();
        const remote = data?.settings?.appearance;
        if (remote?.colorTheme?.accent) {
          const restored = remote.colorTheme as ThemeConfig;
          setThemeState(restored);
          applyThemeToDOM(restored, mode);
          saveTheme(restored);
        }
        if (
          remote?.fontThemeId &&
          FONT_THEMES[remote.fontThemeId as FontThemeId]
        ) {
          const ft = FONT_THEMES[remote.fontThemeId as FontThemeId];
          setFontThemeState(ft);
          applyFontThemeToDOM(ft);
          saveFontTheme(ft);
        }
        if (typeof remote?.glassTransparencyEnabled === "boolean") {
          setGlassTransparencyState(remote.glassTransparencyEnabled);
          applyGlassTransparencyToDOM(remote.glassTransparencyEnabled);
          saveGlassTransparency(remote.glassTransparencyEnabled);
        }
      } catch {}
      backendSynced.current = true;
    })();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync theme changes to backend
  useEffect(() => {
    if (!backendSynced.current || !isAuthenticated) return;
    const appearance = {
      colorTheme: theme,
      fontThemeId: fontTheme.id,
      glassTransparencyEnabled,
    };
    (async () => {
      try {
        const token = await getAccessToken();
        await fetch(`${API_BASE}/api/settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ settings: { appearance } }),
        });
      } catch {}
    })();
  }, [theme, fontTheme, glassTransparencyEnabled, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        mode,
        setMode,
        fontTheme,
        setFontTheme,
        glassTransparencyEnabled,
        setGlassTransparencyEnabled,
        availableThemes: THEME_PRESETS,
        availableFonts: FONT_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
