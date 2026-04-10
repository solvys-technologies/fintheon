// [claude-code 2026-03-16] Stone theme + narrative theme integration — canvas reads CSS vars

import type {
  NarrativeLane,
  NarrativeCategory,
  NarrativeStatus,
} from "./narrative-types";
import type { BubbleState } from "./narrative-physics";
import {
  getAllZoneBounds,
  getRopeSwingOffset,
  ZONE_COLUMNS,
} from "./narrative-physics";
import { computeCatenary } from "./narrative-catenary";
import type { ZoomConfig } from "./narrative-zoom";

// --- Theme color helpers ---

interface CanvasThemeColors {
  accent: string;
  bg: string;
  text: string;
  surface: string;
  border: string;
  muted: string;
  bullish: string;
  bearish: string;
}

/** Read current theme colors from CSS custom properties on :root */
export function getThemeColors(): CanvasThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    accent: get("--fintheon-accent") || "#D4AF37",
    bg: get("--fintheon-bg") || "#050402",
    text: get("--fintheon-text") || "#f0ead6",
    surface: get("--fintheon-surface") || "#0a0a00",
    border: get("--fintheon-border") || "#D4AF37",
    muted: get("--fintheon-muted") || "#6B7280",
    bullish: get("--fintheon-bullish") || "#34D399",
    bearish: get("--fintheon-bearish") || "#EF4444",
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve a value that may be a CSS var reference (e.g. 'var(--fintheon-accent)') */
function resolveColor(color: string, colors: CanvasThemeColors): string {
  if (color.startsWith("var(--fintheon-")) {
    const key = color.slice(15, -1) as keyof CanvasThemeColors;
    return colors[key] || color;
  }
  return color;
}

function getStatusColor(
  status: NarrativeStatus,
  colors: CanvasThemeColors,
): string {
  switch (status) {
    case "active":
      return colors.bullish;
    case "watching":
      return colors.accent;
    case "decayed":
      return colors.bearish;
    case "archived":
      return colors.muted;
  }
}

// --- Color mapping ---

const CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  geopolitical: "Geopolitical",
  macroeconomic: "Macroeconomic",
  monetary: "Monetary Policy",
  "market-structure": "Market Structure",
  "supply-chain": "Supply Chain",
  "black-swan": "Black Swan",
  earnings: "Earnings",
};

// --- Zone rendering ---

export function drawZoneBackgrounds(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const zones = getAllZoneBounds(canvasWidth, canvasHeight);
  const colors = getThemeColors();

  for (let i = 0; i < zones.length; i++) {
    const { bounds } = zones[i];

    // Alternating subtle background
    if (i % 2 === 1) {
      ctx.fillStyle = hexToRgba(colors.text, 0.015);
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    // Dashed boundary line (skip first)
    if (i > 0) {
      ctx.beginPath();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = hexToRgba(colors.text, 0.06);
      ctx.lineWidth = 1;
      ctx.moveTo(bounds.x, 0);
      ctx.lineTo(bounds.x, canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawZoneLabels(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const zones = getAllZoneBounds(canvasWidth, canvasHeight);
  const colors = getThemeColors();

  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = hexToRgba(colors.text, 0.25);

  for (const { category, bounds } of zones) {
    const label = CATEGORY_LABELS[category];
    ctx.fillText(label, bounds.x + bounds.width / 2, 12);
  }
}

// --- Narrative card (bubble) rendering ---

export function drawNarrativeCard(
  ctx: CanvasRenderingContext2D,
  bubble: BubbleState,
  lane: NarrativeLane,
  isHovered: boolean,
  isSelected: boolean,
  zoomConfig: ZoomConfig,
): void {
  const colors = getThemeColors();
  const { x, y, width, height } = bubble;
  const radius = 16;
  const color = resolveColor(lane.color || colors.accent, colors);
  const statusColor = getStatusColor(lane.status, colors);

  ctx.save();

  // Frosted glass: flat fill, glow only on hover
  if (isHovered) {
    ctx.shadowColor = hexToRgba(color, 0.25);
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 0;
  }

  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = hexToRgba(colors.surface, 0.75);
  ctx.fill();

  // Reset shadow for border
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = isSelected ? colors.accent : statusColor;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.stroke();

  // Card contents
  ctx.fillStyle = colors.text;
  ctx.font = "bold 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const titleText =
    lane.title.length > 22 ? lane.title.slice(0, 20) + "\u2026" : lane.title;
  ctx.fillText(titleText, x + 12, y + 14);

  // Category tag
  ctx.fillStyle = hexToRgba(colors.text, 0.35);
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillText(CATEGORY_LABELS[lane.category] ?? "", x + 12, y + 34);

  // Direction bias indicator
  const biasColor =
    lane.directionBias === "long"
      ? colors.bullish
      : lane.directionBias === "short"
        ? colors.bearish
        : colors.muted;
  ctx.fillStyle = biasColor;
  ctx.beginPath();
  ctx.arc(x + width - 20, y + 20, 5, 0, Math.PI * 2);
  ctx.fill();

  // Health score bar at bottom
  const barY = y + height - 16;
  const barWidth = width - 24;
  ctx.fillStyle = hexToRgba(colors.text, 0.08);
  drawRoundedRect(ctx, x + 12, barY, barWidth, 4, 2);
  ctx.fill();
  ctx.fillStyle = statusColor;
  drawRoundedRect(
    ctx,
    x + 12,
    barY,
    barWidth * Math.max(0, Math.min(1, lane.healthScore / 100)),
    4,
    2,
  );
  ctx.fill();

  // Catalyst dot count (if zoom shows it)
  if (zoomConfig.showCatalystDots) {
    ctx.fillStyle = hexToRgba(colors.accent, 0.7);
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${lane.instruments.length} inst`, x + width - 12, y + 34);
  }

  ctx.restore();
}

// --- Rope rendering ---

export function drawRope(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  polarity: "reinforcing" | "contradicting",
  ropeId: string,
  now: number,
  weight = 0.5,
  fromColor?: string,
  toColor?: string,
): void {
  const colors = getThemeColors();
  const swingOffset = getRopeSwingOffset(ropeId, now);
  const catenary = computeCatenary(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    0.3,
  );

  const cp1x = catenary.controlPoints[0].x + swingOffset;
  const cp2x = catenary.controlPoints[1].x + swingOffset;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(
    cp1x,
    catenary.controlPoints[0].y,
    cp2x,
    catenary.controlPoints[1].y,
    toX,
    toY,
  );

  // Gradient energy line: source color -> target color
  const srcColor =
    fromColor ?? (polarity === "reinforcing" ? colors.bullish : colors.bearish);
  const dstColor = toColor ?? srcColor;
  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, hexToRgba(srcColor, 0.5));
  gradient.addColorStop(1, hexToRgba(dstColor, 0.5));
  ctx.strokeStyle = gradient;

  // Width varies by weight (1-4px range)
  ctx.lineWidth = 1 + weight * 3;

  // Animated electricity dash
  ctx.setLineDash([8, 16]);
  ctx.lineDashOffset = -(now * 0.024) % 48;
  ctx.stroke();
  ctx.setLineDash([]);

  // Midpoint dot
  ctx.beginPath();
  ctx.arc(
    catenary.midpoint.x + swingOffset * 0.5,
    catenary.midpoint.y,
    2,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = hexToRgba(srcColor, 0.4);
  ctx.fill();
}

// --- Time dividers ---

export function drawTimeDividers(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  zoomConfig: ZoomConfig,
): void {
  if (!zoomConfig.showTimeDividers) return;
  // Placeholder — time dividers depend on actual date range
}

// --- Utility ---

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Clear the canvas and fill with the current theme background */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const colors = getThemeColors();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
}

export { CATEGORY_LABELS };
