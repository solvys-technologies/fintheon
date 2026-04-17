// [claude-code 2026-04-18] Nothing Font Kit + digit-scale control (Readable Digits via FontFace API)
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
  DIGIT_SCALE_DEFAULT,
  DIGIT_SCALE_MIN,
  DIGIT_SCALE_MAX,
  clampDigitScale,
  loadStoredFontTheme,
  loadStoredDigitScale,
  saveFontTheme,
  saveDigitScale,
} from "../lib/font-theme";

const BACKEND_SETTINGS_URL = "/api/settings";

// Unicode ranges mirrored from frontend/fonts.css — digits, currency, percent, sign, degrees
const READABLE_DIGIT_UNICODE_RANGE =
  "U+0024-0025, U+002B, U+002C-002E, U+0030-0039, U+00B0, U+2012-2014, U+2030, U+20AC";

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
  digitScale: number;
  setDigitScale: (scale: number) => void;
  digitScaleMin: number;
  digitScaleMax: number;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---- Readable Digits FontFace runtime ------------------------------------
// Replace the static @font-face (declared with size-adjust: 150%) when the
// user adjusts digit scale. FontFace properties are immutable post-construct,
// so we delete+re-add. Keep a ref to the current face for clean removal.
let activeReadableDigitsFace: FontFace | null = null;

function applyReadableDigitsScale(scale: number): void {
  if (typeof document === "undefined") return;
  const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fontSet || typeof FontFace === "undefined") return;
  const pct = `${Math.round(clampDigitScale(scale) * 100)}%`;
  const face = new FontFace("Readable Digits", "url(/fonts/doto.woff2)", {
    unicodeRange: READABLE_DIGIT_UNICODE_RANGE,
    weight: "100 900",
    style: "normal",
    display: "swap",
    sizeAdjust: pct,
  } as FontFaceDescriptors);
  face
    .load()
    .then(() => {
      if (activeReadableDigitsFace) {
        try {
          fontSet.delete(activeReadableDigitsFace);
        } catch {
          // ignore — face may already be removed
        }
      }
      fontSet.add(face);
      activeReadableDigitsFace = face;
    })
    .catch(() => {
      // Font failed to load — leave the static @font-face in place
    });
}

// ---- DOM application -----------------------------------------------------

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
  // This class gates flat surfaces, sharp geometry, and the mono override in index.css.
  const nothingActive = fontTheme.nothingKit || !!specialOwnsFont;
  if (nothingActive) {
    root.classList.add("nothing-active");
  } else {
    root.classList.remove("nothing-active");
  }

  // Legacy Special theme's font stack takes precedence.
  if (specialOwnsFont) return;

  // Apply font kit overrides — Readable Digits always leads so Doto digits
  // win for both body and heading contexts.
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
    // Restore defaults when exiting Nothing Kit
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

  const [digitScale, setDigitScaleState] = useState<number>(() => {
    const stored = loadStoredDigitScale();
    applyReadableDigitsScale(stored);
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
      // Reapply font kit so nothing-active + overrides reconcile with new theme
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

  const setDigitScale = useCallback((next: number) => {
    const clamped = clampDigitScale(next);
    setDigitScaleState(clamped);
    applyReadableDigitsScale(clamped);
    saveDigitScale(clamped);
  }, []);

  // Apply on mount (SSR safety) + fetch backend theme if available
  useEffect(() => {
    applyThemeToDOM(theme);
    applyFontThemeToDOM(fontTheme, theme);
    applyReadableDigitsScale(digitScale);

    fetch(BACKEND_SETTINGS_URL, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const remote = data?.settings;
        if (remote?.appearance) {
          const {
            colorTheme,
            fontThemeId,
            pompaMode,
            digitScale: ds,
          } = remote.appearance;
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
          if (typeof ds === "number") {
            const clamped = clampDigitScale(ds);
            setDigitScaleState(clamped);
            applyReadableDigitsScale(clamped);
            saveDigitScale(clamped);
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
      digitScale,
    };
    fetch(BACKEND_SETTINGS_URL, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { appearance } }),
    }).catch(() => {});
  }, [theme, fontTheme, pompaEnabled, digitScale]);

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
        digitScale,
        setDigitScale,
        digitScaleMin: DIGIT_SCALE_MIN,
        digitScaleMax: DIGIT_SCALE_MAX,
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

// Re-exported for settings UI convenience
export { DIGIT_SCALE_DEFAULT, ALL_PRESETS };
