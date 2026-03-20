// [claude-code 2026-03-16] Zoom level management and semantic zoom transitions for NarrativeCanvas

import type { ZoomLevel } from './narrative-types';

export interface ZoomConfig {
  level: ZoomLevel;
  /** Pixels per logical day on the time axis */
  dayWidth: number;
  /** Minimum scale factor for canvas transform */
  minScale: number;
  /** Maximum scale factor */
  maxScale: number;
  /** Whether to show individual catalyst dots inside bubbles */
  showCatalystDots: boolean;
  /** Whether to show time divider lines */
  showTimeDividers: boolean;
  /** Whether to show cross-narrative ropes */
  showRopes: boolean;
  /** Label granularity for time axis */
  timeLabelGranularity: 'year' | 'quarter' | 'month' | 'week';
}

const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  year: {
    level: 'year',
    dayWidth: 2,
    minScale: 0.3,
    maxScale: 1.5,
    showCatalystDots: false,
    showTimeDividers: false,
    showRopes: true,
    timeLabelGranularity: 'year',
  },
  quarter: {
    level: 'quarter',
    dayWidth: 5,
    minScale: 0.5,
    maxScale: 2,
    showCatalystDots: false,
    showTimeDividers: true,
    timeLabelGranularity: 'quarter',
    showRopes: true,
  },
  month: {
    level: 'month',
    dayWidth: 12,
    minScale: 0.6,
    maxScale: 3,
    showCatalystDots: true,
    showTimeDividers: true,
    showRopes: true,
    timeLabelGranularity: 'month',
  },
  week: {
    level: 'week',
    dayWidth: 120,
    minScale: 1,
    maxScale: 4,
    showCatalystDots: true,
    showTimeDividers: true,
    showRopes: true,
    timeLabelGranularity: 'week',
  },
};

export function getZoomConfig(level: ZoomLevel): ZoomConfig {
  return ZOOM_CONFIGS[level];
}

/** Ordered zoom levels from most zoomed-out to most zoomed-in */
const ZOOM_ORDER: ZoomLevel[] = ['year', 'quarter', 'month', 'week'];

export function canZoomIn(level: ZoomLevel): boolean {
  return ZOOM_ORDER.indexOf(level) < ZOOM_ORDER.length - 1;
}

export function canZoomOut(level: ZoomLevel): boolean {
  return ZOOM_ORDER.indexOf(level) > 0;
}

export function zoomIn(level: ZoomLevel): ZoomLevel {
  const idx = ZOOM_ORDER.indexOf(level);
  return idx < ZOOM_ORDER.length - 1 ? ZOOM_ORDER[idx + 1] : level;
}

export function zoomOut(level: ZoomLevel): ZoomLevel {
  const idx = ZOOM_ORDER.indexOf(level);
  return idx > 0 ? ZOOM_ORDER[idx - 1] : level;
}

/** Easing function for zoom transitions */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

/** Interpolate between two camera states with easeInOutCubic */
export function interpolateCamera(from: CameraState, to: CameraState, t: number): CameraState {
  const e = easeInOutCubic(Math.max(0, Math.min(1, t)));
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    scale: from.scale + (to.scale - from.scale) * e,
  };
}

/** Convert screen coordinates to canvas world coordinates */
export function screenToWorld(screenX: number, screenY: number, camera: CameraState): { x: number; y: number } {
  return {
    x: (screenX - camera.x) / camera.scale,
    y: (screenY - camera.y) / camera.scale,
  };
}

/** Convert world coordinates to screen coordinates */
export function worldToScreen(worldX: number, worldY: number, camera: CameraState): { x: number; y: number } {
  return {
    x: worldX * camera.scale + camera.x,
    y: worldY * camera.scale + camera.y,
  };
}

/** Clamp camera scale to zoom config bounds */
export function clampScale(scale: number, config: ZoomConfig): number {
  return Math.max(config.minScale, Math.min(config.maxScale, scale));
}

/** Calculate camera state to fit a bounding box in the viewport */
export function fitToView(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewportWidth: number,
  viewportHeight: number,
  padding = 60,
): CameraState {
  const w = bounds.maxX - bounds.minX + padding * 2;
  const h = bounds.maxY - bounds.minY + padding * 2;
  const scale = Math.min(viewportWidth / w, viewportHeight / h, 1.5);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    x: viewportWidth / 2 - cx * scale,
    y: viewportHeight / 2 - cy * scale,
    scale,
  };
}
