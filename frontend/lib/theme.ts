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
  // Severity colors — used by RiskFlow badges, alerts, status indicators
  severe?: string;
  neutralSevere?: string;
  neutral?: string;
  lowNeutral?: string;
  low?: string;
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
    accent: '#F4005F',
    bg: '#0A0A0A',
    text: '#FFFFFF',
    bullish: '#00BCD4',
    bearish: '#F4005F',
    surface: '#141014',
    border: '#F4005F',
    muted: '#888888',
  },
  'miami-dolphins': {
    name: 'miami-dolphins',
    label: 'Miami Dolphins',
    accent: '#008E97',
    bg: '#0A1628',
    text: '#FFFFFF',
    bullish: '#008E97',
    bearish: '#F26522',
    surface: '#0F1F35',
    border: '#008E97',
    muted: '#FC4C02',
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
  'solvys-stone': {
    name: 'solvys-stone',
    label: 'Solvys Stone',
    accent: '#c79f4a',
    bg: '#0d0c09',
    text: '#c38f25',
    bullish: '#d49616',
    bearish: '#824d4d',
    surface: '#151310',
    border: '#c79f4a',
    muted: '#6b6455',
    severe: '#da0000',
    neutralSevere: '#ac5318',
    neutral: '#c79f4a',
    lowNeutral: '#526089',
    low: '#073c00',
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
