// [claude-code 2026-05-16] Stripped to Something Solvys + Something Monochrome only

export interface ThemeConfig {
  name: string;
  label: string;
  primary?: string;
  secondary?: string;
  accent: string;
  bg: string;
  text: string;
  bullish: string;
  bearish: string;
  surface: string;
  border: string;
  muted: string;
  severe?: string;
  neutralSevere?: string;
  neutral?: string;
  lowNeutral?: string;
  low?: string;
  special?: boolean;
  fontBody?: string;
  fontHeading?: string;
  fontMono?: string;
  glassEnabled?: boolean;
  glassVariant?: "solid" | "frosted" | "liquid";
  borderRadius?: string;
  easeDefault?: string;
}

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  "something-solvys": {
    name: "something-solvys",
    label: "Something Solvys",
    accent: "#c79f4a",
    primary: "#c79f4a",
    secondary: "#5a4630",
    bg: "#0d0c09",
    text: "#c38f25",
    bullish: "#d49616",
    bearish: "#824d4d",
    surface: "#151310",
    border: "#c79f4a",
    muted: "#6b6455",
    severe: "#da0000",
    neutralSevere: "#ac5318",
    neutral: "#c79f4a",
    lowNeutral: "#526089",
    low: "#073c00",
    special: true,
    fontBody: "'Space Grotesk', sans-serif",
    fontHeading: "'Doto', monospace",
    fontMono: "'Space Mono', monospace",
    glassEnabled: false,
    glassVariant: "solid",
    borderRadius: "0.5rem",
    easeDefault: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
  "something-monochrome": {
    name: "something-monochrome",
    label: "Something Monochrome",
    accent: "#e0e0e0",
    primary: "#e0e0e0",
    secondary: "#737373",
    bg: "#000000",
    text: "#e0e0e0",
    bullish: "#e0e0e0",
    bearish: "#e0e0e0",
    surface: "#0a0a0a",
    border: "#1a1a1a",
    muted: "#4a4a4a",
    special: true,
    fontBody: "'Space Grotesk', sans-serif",
    fontHeading: "'Doto', monospace",
    fontMono: "'Space Mono', monospace",
    glassEnabled: false,
    glassVariant: "solid",
    borderRadius: "0.5rem",
    easeDefault: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
  "frosted-glass": {
    name: "frosted-glass",
    label: "Frosted Glass",
    accent: "#d7b967",
    primary: "#d7b967",
    secondary: "#9aa4b2",
    bg: "#070705",
    text: "#f3ead4",
    bullish: "#4ade80",
    bearish: "#fb7185",
    surface: "rgba(18, 17, 14, 0.58)",
    border: "#d7b967",
    muted: "#8a8170",
    severe: "#ef4444",
    neutralSevere: "#f59e0b",
    neutral: "#8a8170",
    lowNeutral: "#60a5fa",
    low: "#34d399",
    special: true,
    fontBody: "'Space Grotesk', sans-serif",
    fontHeading: "'Doto', monospace",
    fontMono: "'Space Mono', monospace",
    glassEnabled: true,
    glassVariant: "frosted",
    borderRadius: "0.625rem",
    easeDefault: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  "liquid-glass": {
    name: "liquid-glass",
    label: "iOS Liquid Glass",
    accent: "#f2c94c",
    primary: "#f2c94c",
    secondary: "#78dce8",
    bg: "#050608",
    text: "#f7f2df",
    bullish: "#52ffa8",
    bearish: "#ff6b86",
    surface: "rgba(13, 15, 18, 0.48)",
    border: "#f2c94c",
    muted: "#8f938f",
    severe: "#ff4d5e",
    neutralSevere: "#ffb84d",
    neutral: "#8f938f",
    lowNeutral: "#78dce8",
    low: "#52ffa8",
    special: true,
    fontBody: "'Space Grotesk', sans-serif",
    fontHeading: "'Doto', monospace",
    fontMono: "'Space Mono', monospace",
    glassEnabled: true,
    glassVariant: "liquid",
    borderRadius: "0.75rem",
    easeDefault: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
};

export const ALL_PRESETS: Record<string, ThemeConfig> = THEME_PRESETS;

const STORAGE_KEY = "fintheon:theme";
const CUSTOM_STORAGE_KEY = "fintheon:theme-custom";

export const DEFAULT_THEME = THEME_PRESETS["something-solvys"];

export function loadStoredTheme(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_THEME;

    if (stored === "custom") {
      const custom = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (custom) return JSON.parse(custom) as ThemeConfig;
      return DEFAULT_THEME;
    }

    if (ALL_PRESETS[stored]) return ALL_PRESETS[stored];
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: ThemeConfig): void {
  try {
    const presetKey = Object.keys(ALL_PRESETS).find(
      (k) =>
        ALL_PRESETS[k].accent === theme.accent &&
        ALL_PRESETS[k].bg === theme.bg &&
        ALL_PRESETS[k].text === theme.text &&
        ALL_PRESETS[k].special === theme.special,
    );

    if (presetKey) {
      localStorage.setItem(STORAGE_KEY, presetKey);
      localStorage.removeItem(CUSTOM_STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, "custom");
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(theme));
    }
  } catch {
    // localStorage unavailable
  }
}
