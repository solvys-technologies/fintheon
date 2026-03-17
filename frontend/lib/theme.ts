// [claude-code 2026-03-16] Stone theme + narrative theme integration

export interface ThemeConfig {
  name: string;
  label: string;
  accent: string;
  bg: string;
  text: string;
  bullish: string;
  bearish: string;
  surface: string;
  border: string;
  muted: string;
}

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  'solvys-gold': {
    name: 'solvys-gold',
    label: 'Solvys Gold',
    accent: '#D4AF37',
    bg: '#050402',
    text: '#f0ead6',
    bullish: '#34D399',
    bearish: '#EF4444',
    surface: '#0a0a00',
    border: '#D4AF37',
    muted: '#6B7280',
  },
  ios: {
    name: 'ios',
    label: 'iOS',
    accent: '#007AFF',
    bg: '#000000',
    text: '#FFFFFF',
    bullish: '#30D158',
    bearish: '#FF453A',
    surface: '#1C1C1E',
    border: '#007AFF',
    muted: '#8E8E93',
  },
  'project-x': {
    name: 'project-x',
    label: 'Project X',
    accent: '#6B7280',
    bg: '#111111',
    text: '#E5E7EB',
    bullish: '#4ADE80',
    bearish: '#F87171',
    surface: '#1A1A1A',
    border: '#6B7280',
    muted: '#9CA3AF',
  },
  'dark-trading': {
    name: 'dark-trading',
    label: 'Dark Trading',
    accent: '#3B82F6',
    bg: '#0A0A0F',
    text: '#E2E8F0',
    bullish: '#22C55E',
    bearish: '#EF4444',
    surface: '#12121A',
    border: '#3B82F6',
    muted: '#64748B',
  },
  'miami-heat': {
    name: 'miami-heat',
    label: 'Miami Heat',
    accent: '#F9A825',
    bg: '#1A0A0A',
    text: '#FFF8E1',
    bullish: '#98201C',
    bearish: '#000000',
    surface: '#221010',
    border: '#F9A825',
    muted: '#A1887F',
  },
  monocolor: {
    name: 'monocolor',
    label: 'Monocolor',
    accent: '#FFFFFF',
    bg: '#0A0A0A',
    text: '#E5E5E5',
    bullish: '#FFFFFF',
    bearish: '#FFFFFF',
    surface: '#141414',
    border: '#FFFFFF',
    muted: '#737373',
  },
  stone: {
    name: 'stone',
    label: 'Stone',
    accent: '#c79f4a',
    bg: '#0d0c09',
    text: '#cdc5b4',
    bullish: '#2d5a3d',
    bearish: '#7a3030',
    surface: '#151310',
    border: '#3d3826',
    muted: '#6b6455',
  },
};

const STORAGE_KEY = 'fintheon:theme';
const CUSTOM_STORAGE_KEY = 'fintheon:theme-custom';

export const DEFAULT_THEME = THEME_PRESETS['solvys-gold'];

export function loadStoredTheme(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_THEME;

    if (stored === 'custom') {
      const custom = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (custom) return JSON.parse(custom) as ThemeConfig;
      return DEFAULT_THEME;
    }

    if (THEME_PRESETS[stored]) return THEME_PRESETS[stored];
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: ThemeConfig): void {
  try {
    const presetKey = Object.keys(THEME_PRESETS).find(
      (k) => THEME_PRESETS[k].accent === theme.accent &&
             THEME_PRESETS[k].bg === theme.bg &&
             THEME_PRESETS[k].text === theme.text
    );

    if (presetKey) {
      localStorage.setItem(STORAGE_KEY, presetKey);
      localStorage.removeItem(CUSTOM_STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, 'custom');
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(theme));
    }
  } catch {
    // localStorage unavailable
  }
}
