// [claude-code 2026-04-30] Small source popup opener for RiskFlow cards.
// Uses a sized popup instead of navigating the main app or opening a full tab.
export function openSourcePopup(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;

  const width = Math.min(760, Math.max(360, window.innerWidth - 80));
  const height = Math.min(720, Math.max(420, window.innerHeight - 100));
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const features = [
    "popup=yes",
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    "noopener=yes",
    "noreferrer=yes",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const opened = window.open(url, "fintheon-source-popup", features);
  opened?.focus();
}
