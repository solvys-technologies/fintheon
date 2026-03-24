// [claude-code 2026-03-14] Theme context — color + font theme, applies CSS variables to :root
// [claude-code 2026-03-24] Add backend settings sync for per-user theme persistence
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  type ThemeConfig,
  THEME_PRESETS,
  DEFAULT_THEME,
  loadStoredTheme,
  saveTheme,
} from '../lib/theme';
import {
  type FontTheme,
  type FontThemeId,
  FONT_THEMES,
  DEFAULT_FONT_THEME,
  loadStoredFontTheme,
  saveFontTheme,
} from '../lib/font-theme';

const BACKEND_SETTINGS_URL = '/api/settings';

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  presets: Record<string, ThemeConfig>;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
  fontThemes: Record<string, FontTheme>;
  pompaEnabled: boolean;
  setPompaEnabled: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDOM(theme: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty('--fintheon-accent', theme.accent);
  root.style.setProperty('--fintheon-bg', theme.bg);
  root.style.setProperty('--fintheon-text', theme.text);
  root.style.setProperty('--fintheon-bullish', theme.bullish);
  root.style.setProperty('--fintheon-bearish', theme.bearish);
  root.style.setProperty('--fintheon-surface', theme.surface);
  root.style.setProperty('--fintheon-border', theme.border);
  root.style.setProperty('--fintheon-muted', theme.muted);
}

function applyFontThemeToDOM(fontTheme: FontTheme) {
  const root = document.documentElement;
  // Prepend 'Readable Digits' so digits/numbers always render in Inter
  const bodyStack = `'Readable Digits', ${fontTheme.fontBody}`;
  const headingStack = `'Readable Digits', ${fontTheme.fontHeading}`;
  root.style.setProperty('--font-body', bodyStack);
  root.style.setProperty('--font-heading', headingStack);
  // Apply directly to body to bypass Tailwind v4 preflight specificity
  document.body.style.fontFamily = bodyStack;
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
    const stored = localStorage.getItem('fintheon:pompa-mode');
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('fintheon:pompa-mode', String(pompaEnabled));
  }, [pompaEnabled]);

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

  // Apply on mount (SSR safety) + fetch backend theme if available
  useEffect(() => {
    applyThemeToDOM(theme);
    applyFontThemeToDOM(fontTheme);

    // Fetch backend settings and apply stored theme (backend is source of truth)
    fetch(BACKEND_SETTINGS_URL, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const remote = data?.settings;
        if (remote?.appearance) {
          const { colorTheme, fontThemeId, pompaMode } = remote.appearance;
          if (colorTheme && typeof colorTheme === 'object' && colorTheme.accent) {
            const restored = colorTheme as ThemeConfig;
            setThemeState(restored);
            applyThemeToDOM(restored);
            saveTheme(restored);
          }
          if (fontThemeId && FONT_THEMES[fontThemeId as FontThemeId]) {
            const ft = FONT_THEMES[fontThemeId as FontThemeId];
            setFontThemeState(ft);
            applyFontThemeToDOM(ft);
            saveFontTheme(ft);
          }
          if (pompaMode !== undefined) {
            setPompaEnabled(pompaMode as boolean);
          }
        }
        backendSynced.current = true;
      })
      .catch(() => {
        backendSynced.current = true;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync appearance settings to backend when they change
  useEffect(() => {
    if (!backendSynced.current) return;
    const appearance = {
      colorTheme: theme,
      fontThemeId: fontTheme.id,
      pompaMode: pompaEnabled,
    };
    fetch(BACKEND_SETTINGS_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { appearance } }),
    }).catch(() => {});
  }, [theme, fontTheme, pompaEnabled]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, presets: THEME_PRESETS, fontTheme, setFontTheme, fontThemes: FONT_THEMES, pompaEnabled, setPompaEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
