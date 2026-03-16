// [claude-code 2026-03-16] Pure Canvas 2D render functions for NarrativeCanvas

import type { NarrativeLane, NarrativeCategory, NarrativeStatus } from './narrative-types';
import type { BubbleState } from './narrative-physics';
import { getAllZoneBounds, getRopeSwingOffset, ZONE_COLUMNS } from './narrative-physics';
import { computeCatenary } from './narrative-catenary';
import type { ZoomConfig } from './narrative-zoom';

// --- Color mapping ---

const STATUS_COLORS: Record<NarrativeStatus, string> = {
  active: '#34D399',
  watching: '#FBBF24',
  decayed: '#EF4444',
  archived: '#6B7280',
};

const CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  geopolitical: 'Geopolitical',
  macroeconomic: 'Macroeconomic',
  monetary: 'Monetary Policy',
  'market-structure': 'Market Structure',
  'supply-chain': 'Supply Chain',
  'black-swan': 'Black Swan',
  earnings: 'Earnings',
};

// --- Zone rendering ---

export function drawZoneBackgrounds(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const zones = getAllZoneBounds(canvasWidth, canvasHeight);

  for (let i = 0; i < zones.length; i++) {
    const { bounds } = zones[i];

    // Alternating subtle background
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    // Dashed boundary line (skip first)
    if (i > 0) {
      ctx.beginPath();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
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

  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';

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
  const { x, y, width, height } = bubble;
  const radius = 16;
  const color = lane.color || '#D4AF37';
  const statusColor = STATUS_COLORS[lane.status];

  ctx.save();

  // Drop shadow
  ctx.shadowColor = isHovered ? color : `${color}4D`; // 30% opacity
  ctx.shadowBlur = isHovered ? 20 : 12;
  ctx.shadowOffsetY = 4;

  // Card background with glassmorphism-like gradient
  const gradient = ctx.createRadialGradient(
    x + width / 2, y + height / 2, 0,
    x + width / 2, y + height / 2, Math.max(width, height),
  );
  gradient.addColorStop(0, 'rgba(20, 20, 16, 0.95)');
  gradient.addColorStop(1, 'rgba(10, 10, 0, 0.85)');

  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Health ring border
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = isSelected ? '#D4AF37' : statusColor;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.stroke();

  // Card contents
  ctx.fillStyle = '#f0ead6';
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const titleText = lane.title.length > 22 ? lane.title.slice(0, 20) + '…' : lane.title;
  ctx.fillText(titleText, x + 12, y + 14);

  // Category tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText(CATEGORY_LABELS[lane.category] ?? '', x + 12, y + 34);

  // Direction bias indicator
  const biasColor = lane.directionBias === 'long' ? '#34D399' : lane.directionBias === 'short' ? '#EF4444' : '#6B7280';
  ctx.fillStyle = biasColor;
  ctx.beginPath();
  ctx.arc(x + width - 20, y + 20, 5, 0, Math.PI * 2);
  ctx.fill();

  // Health score bar at bottom
  const barY = y + height - 16;
  const barWidth = width - 24;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, x + 12, barY, barWidth, 4, 2);
  ctx.fill();
  ctx.fillStyle = statusColor;
  drawRoundedRect(ctx, x + 12, barY, barWidth * Math.max(0, Math.min(1, lane.healthScore / 100)), 4, 2);
  ctx.fill();

  // Catalyst dot count (if zoom shows it)
  if (zoomConfig.showCatalystDots) {
    ctx.fillStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
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
  polarity: 'reinforcing' | 'contradicting',
  ropeId: string,
  now: number,
): void {
  const swingOffset = getRopeSwingOffset(ropeId, now);
  const catenary = computeCatenary(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    0.3,
  );

  // Apply swing offset to control points
  const cp1x = catenary.controlPoints[0].x + swingOffset;
  const cp2x = catenary.controlPoints[1].x + swingOffset;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(
    cp1x, catenary.controlPoints[0].y,
    cp2x, catenary.controlPoints[1].y,
    toX, toY,
  );

  ctx.strokeStyle = polarity === 'reinforcing'
    ? 'rgba(52, 211, 153, 0.4)'
    : 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash(polarity === 'contradicting' ? [6, 4] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  // Midpoint dot
  ctx.beginPath();
  ctx.arc(
    catenary.midpoint.x + swingOffset * 0.5,
    catenary.midpoint.y,
    3,
    0, Math.PI * 2,
  );
  ctx.fillStyle = polarity === 'reinforcing'
    ? 'rgba(52, 211, 153, 0.6)'
    : 'rgba(239, 68, 68, 0.6)';
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
  // In production, iterate over quarter/month boundaries and draw vertical lines
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

/** Clear the canvas and fill with the Fintheon background color */
export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#050402';
  ctx.fillRect(0, 0, w, h);
}

export { CATEGORY_LABELS, STATUS_COLORS };
