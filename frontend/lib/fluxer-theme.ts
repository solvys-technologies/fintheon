// [claude-code 2026-04-12] Solvys Gold theme map for Fluxer.app iframe embed
// Maps Fintheon brand colors to Fluxer CSS variable tokens

export const FLUXER_SOLVYS_THEME: Record<string, string> = {
  // Backgrounds
  "--bg-primary": "#050402",
  "--bg-secondary": "#0a0905",
  "--bg-tertiary": "#110f0a",
  "--bg-header": "#080604",
  "--bg-modifier-hover": "rgba(199, 159, 74, 0.06)",
  "--bg-modifier-active": "rgba(199, 159, 74, 0.10)",
  "--bg-modifier-selected": "rgba(199, 159, 74, 0.12)",

  // Text
  "--text-primary": "#f0ead6",
  "--text-secondary": "rgba(240, 234, 214, 0.72)",
  "--text-muted": "rgba(240, 234, 214, 0.40)",
  "--text-link": "#c79f4a",

  // Brand / accent
  "--brand-primary": "#c79f4a",
  "--brand-primary-light": "#d4af37",
  "--link-color": "#c79f4a",

  // Buttons
  "--button-primary-bg": "#c79f4a",
  "--button-primary-text": "#050402",
  "--button-secondary-bg": "rgba(199, 159, 74, 0.12)",
  "--button-secondary-text": "#f0ead6",
  "--button-danger-bg": "#dc2626",
  "--button-danger-text": "#ffffff",

  // Borders
  "--border-base": "rgba(199, 159, 74, 0.10)",
  "--border-hover": "rgba(199, 159, 74, 0.20)",
  "--border-focus": "rgba(199, 159, 74, 0.40)",

  // Scrollbar
  "--scrollbar-thin-thumb": "rgba(199, 159, 74, 0.20)",
  "--scrollbar-thin-track": "transparent",

  // Code blocks
  "--code-bg": "#0a0905",
};

/** Build a full CSS string that can be injected into a Fluxer iframe or appended as a <style> block. */
export function buildFluxerThemeCSS(): string {
  const vars = Object.entries(FLUXER_SOLVYS_THEME)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${vars}\n}`;
}
