// [claude-code 2026-03-14] Font theme system — types, presets, and localStorage persistence

export type FontThemeId = 'default' | 'solvys' | 'classic' | 'imperial';

export interface FontTheme {
  id: FontThemeId;
  label: string;
  description: string;
  fontBody: string;
  fontHeading: string;
}

const FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const FONT_THEMES: Record<FontThemeId, FontTheme> = {
  default: {
    id: 'default',
    label: 'Default',
    description: 'Inter — clean geometric sans',
    fontBody: `'Inter', ${FALLBACK}`,
    fontHeading: `'Inter', ${FALLBACK}`,
  },
  solvys: {
    id: 'solvys',
    label: 'Solvys',
    description: 'Playfair Display — elegant serif',
    fontBody: `'Playfair Display', 'Georgia', serif`,
    fontHeading: `'Playfair Display', 'Georgia', serif`,
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Roboto — classic clean sans',
    fontBody: `'Roboto', ${FALLBACK}`,
    fontHeading: `'Roboto', ${FALLBACK}`,
  },
  imperial: {
    id: 'imperial',
    label: 'Imperial',
    description: 'Cinzel + Cormorant Garamond — Roman inscription aesthetic',
    fontBody: `'Cormorant Garamond', 'Georgia', serif`,
    fontHeading: `'Cinzel', 'Georgia', serif`,
  },
};

const STORAGE_KEY = 'fintheon:font-theme';

export const DEFAULT_FONT_THEME = FONT_THEMES.default;

export function loadStoredFontTheme(): FontTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FONT_THEMES[stored as FontThemeId]) {
      return FONT_THEMES[stored as FontThemeId];
    }
  } catch {}
  return DEFAULT_FONT_THEME;
}

export function saveFontTheme(theme: FontTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {}
}
