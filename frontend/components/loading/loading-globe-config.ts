export interface LoadingThemeColors {
  primary: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
}

export interface BeamTarget {
  name: string;
  lon: number;
  lat: number;
  jitter: number;
}

export const LOADING_GREETINGS = [
  "Ave. The markets stir.",
  "The Forum is active.",
  "The day's battles are done.",
] as const;

export const LOADING_PHRASES = [
  "Initializing Strategium",
  "Summoning Consilium",
  "Agents standing by",
  "The tape is unwinding",
] as const;

export const COUNTRY_GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

export const BEAM_TARGETS: BeamTarget[] = [
  { name: "Strait of Hormuz / Iran", lon: 56.3, lat: 26.5, jitter: 2.1 },
  { name: "Israel", lon: 35.2, lat: 31.8, jitter: 0.9 },
  { name: "China", lon: 116.4, lat: 39.9, jitter: 1.7 },
  { name: "Japan", lon: 139.7, lat: 35.7, jitter: 1.5 },
  { name: "Koreas", lon: 127.1, lat: 37.7, jitter: 1.2 },
  { name: "USA", lon: -73.4, lat: 39.1, jitter: 2.4 },
  { name: "Venezuela", lon: -66.9, lat: 10.5, jitter: 1.7 },
  { name: "Mexico", lon: -99.1, lat: 19.4, jitter: 1.8 },
  { name: "Russia", lon: 37.6, lat: 55.8, jitter: 2.4 },
  { name: "EU cluster", lon: 4.4, lat: 50.8, jitter: 2.2 },
  { name: "London", lon: -0.1, lat: 51.5, jitter: 1 },
];

export function readLoadingThemeColors(): LoadingThemeColors {
  if (typeof window === "undefined") return FALLBACK_COLORS;

  const style = window.getComputedStyle(document.documentElement);
  const primary =
    style.getPropertyValue("--fintheon-primary").trim() ||
    style.getPropertyValue("--fintheon-accent").trim() ||
    style.getPropertyValue("--accent").trim() ||
    FALLBACK_COLORS.primary;

  return {
    primary,
    bg: style.getPropertyValue("--fintheon-bg").trim() || FALLBACK_COLORS.bg,
    surface:
      style.getPropertyValue("--fintheon-surface").trim() ||
      FALLBACK_COLORS.surface,
    text:
      style.getPropertyValue("--fintheon-text").trim() || FALLBACK_COLORS.text,
    muted:
      style.getPropertyValue("--fintheon-muted").trim() || FALLBACK_COLORS.muted,
  };
}

const FALLBACK_COLORS: LoadingThemeColors = {
  primary: "#c79f4a",
  bg: "#050402",
  surface: "#0a0905",
  text: "#f0ead6",
  muted: "#6b6455",
};
