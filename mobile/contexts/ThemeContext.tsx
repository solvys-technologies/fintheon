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

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
  availableThemes: Record<string, ThemeConfig>;
  availableFonts: Record<string, FontTheme>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDOM(theme: ThemeConfig) {
  const root = document.documentElement;
  // Fintheon tokens (shared components)
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

  const backendSynced = useRef(false);

  const setTheme = useCallback((next: ThemeConfig) => {
    setThemeState(next);
    applyThemeToDOM(next);
    saveTheme(next);
  }, []);

  const setFontTheme = useCallback((next: FontTheme) => {
    setFontThemeState(next);
    applyFontThemeToDOM(next);
    saveFontTheme(next);
  }, []);

  // Fetch backend theme on mount (backend is source of truth when authenticated)
  useEffect(() => {
    applyThemeToDOM(theme);
    applyFontThemeToDOM(fontTheme);

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
          applyThemeToDOM(restored);
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
      } catch {}
      backendSynced.current = true;
    })();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync theme changes to backend
  useEffect(() => {
    if (!backendSynced.current || !isAuthenticated) return;
    const appearance = { colorTheme: theme, fontThemeId: fontTheme.id };
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
  }, [theme, fontTheme, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        fontTheme,
        setFontTheme,
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
