// [claude-code 2026-04-18] Attach JWT to backend-settings sync. Pairs with SettingsContext fix:
//   absolute URL alone produced 401 because we weren't sending Authorization.
// [claude-code 2026-04-18] Revert digit-scale runtime override — Readable Digits back to Inter via static @font-face
// [claude-code 2026-04-18] Nothing Font Kit (color-agnostic Nothing Design typography)
// [claude-code 2026-04-15] Special themes — Nothing Design visual overrides (Something Solvys/Monochrome)
// [claude-code 2026-03-14] Theme context — color + font theme, applies CSS variables to :root
// [claude-code 2026-03-24] Add backend settings sync for per-user theme persistence
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
  SPECIAL_PRESETS,
  ALL_PRESETS,
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

// [claude-code 2026-04-18] Absolute URL — relative paths resolve against file:// under Electron
//   and return ERR_FILE_NOT_FOUND, leaving theme sync broken without a visible error.
const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
const BACKEND_SETTINGS_URL = `${API_BASE}/api/settings`;

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  presets: Record<string, ThemeConfig>;
  specialPresets: Record<string, ThemeConfig>;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
  fontThemes: Record<string, FontTheme>;
  pompaEnabled: boolean;
  setPompaEnabled: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDOM(theme: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty("--fintheon-accent", theme.accent);
  root.style.setProperty("--fintheon-bg", theme.bg);
  root.style.setProperty("--fintheon-text", theme.text);
  root.style.setProperty("--fintheon-bullish", theme.bullish);
  root.style.setProperty("--fintheon-bearish", theme.bearish);
  root.style.setProperty("--fintheon-surface", theme.surface);
  root.style.setProperty("--fintheon-border", theme.border);
  root.style.setProperty("--fintheon-muted", theme.muted);
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

  // Legacy Special themes (Something Solvys / Monochrome) bundle their own
  // font stack. Kept for backward compat — Nothing Font Kit is the preferred
  // path going forward.
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
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    const stored = loadStoredTheme();
    applyThemeToDOM(stored);
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

  useEffect(() => {
    localStorage.setItem("fintheon:pompa-mode", String(pompaEnabled));
  }, [pompaEnabled]);

  const backendSynced = useRef(false);

  const setTheme = useCallback(
    (next: ThemeConfig) => {
      setThemeState(next);
      applyThemeToDOM(next);
      saveTheme(next);
      applyFontThemeToDOM(fontTheme, next);
    },
    [fontTheme],
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
    applyThemeToDOM(theme);
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
          const { colorTheme, fontThemeId, pompaMode } = remote.appearance;
          let nextTheme = theme;
          if (
            colorTheme &&
            typeof colorTheme === "object" &&
            colorTheme.accent
          ) {
            nextTheme = colorTheme as ThemeConfig;
            setThemeState(nextTheme);
            applyThemeToDOM(nextTheme);
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
  }, [theme, fontTheme, pompaEnabled]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        presets: THEME_PRESETS,
        specialPresets: SPECIAL_PRESETS,
        fontTheme,
        setFontTheme,
        fontThemes: FONT_THEMES,
        pompaEnabled,
        setPompaEnabled,
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

export { ALL_PRESETS };
