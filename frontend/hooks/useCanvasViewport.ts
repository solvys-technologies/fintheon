// [claude-code 2026-03-28] S5-T1: CSS transform zoom/pan hook for NarrativeFlow canvas
// Google Maps-style: mouse wheel zooms, click-drag pans, semantic zoom at thresholds

import { useCallback, useRef, useState } from 'react';
import type { CanvasViewport, ZoomLevel } from '../lib/narrative-types';
import { DEFAULT_VIEWPORT, ZOOM_THRESHOLDS } from '../lib/narrative-types';

const MIN_SCALE = 0.1;
const MAX_SCALE = 3.0;
const ZOOM_SENSITIVITY = 0.002;
const SEMANTIC_DEBOUNCE_MS = 200;

function scaleToZoomLevel(scale: number): ZoomLevel {
  for (const [level, [lo, hi]] of Object.entries(ZOOM_THRESHOLDS) as [ZoomLevel, [number, number]][]) {
    if (scale >= lo && scale < hi) return level;
  }
  if (scale >= ZOOM_THRESHOLDS.week[0]) return 'week';
  return 'year';
}

export interface UseCanvasViewportOptions {
  onZoomLevelChange?: (level: ZoomLevel) => void;
  initialViewport?: Partial<CanvasViewport>;
}

export function useCanvasViewport(opts?: UseCanvasViewportOptions) {
  const [viewport, setViewport] = useState<CanvasViewport>({
    ...DEFAULT_VIEWPORT,
    ...opts?.initialViewport,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZoomLevelRef = useRef(viewport.zoomLevel);

  // Dispatch semantic zoom change (debounced)
  const notifyZoomLevel = useCallback((newLevel: ZoomLevel) => {
    if (newLevel === lastZoomLevelRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastZoomLevelRef.current = newLevel;
      opts?.onZoomLevelChange?.(newLevel);
    }, SEMANTIC_DEBOUNCE_MS);
  }, [opts]);

  // ── Wheel zoom (centered on cursor) ──────────────────────────

  const onWheel = useCallback((e: React.WheelEvent | WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorX = ('clientX' in e ? e.clientX : 0) - rect.left;
    const cursorY = ('clientY' in e ? e.clientY : 0) - rect.top;

    setViewport(prev => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * (1 + delta)));
      const ratio = newScale / prev.scale;

      // Zoom toward cursor position
      const newX = cursorX - ratio * (cursorX - prev.x);
      const newY = cursorY - ratio * (cursorY - prev.y);
      const zoomLevel = scaleToZoomLevel(newScale);

      notifyZoomLevel(zoomLevel);

      return { x: newX, y: newY, scale: newScale, zoomLevel };
    });
  }, [notifyZoomLevel]);

  // ── Pointer pan ───────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (e.button !== 0) return; // left button only
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
    // Capture vx/vy from current viewport in the next move
    setViewport(prev => {
      panStartRef.current.vx = prev.x;
      panStartRef.current.vy = prev.y;
      return prev;
    });
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setViewport(prev => ({
      ...prev,
      x: panStartRef.current.vx + dx,
      y: panStartRef.current.vy + dy,
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent | PointerEvent) => {
    isPanningRef.current = false;
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
  }, []);

  // ── Programmatic controls ─────────────────────────────────────

  const zoomTo = useCallback((scale: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const zoomLevel = scaleToZoomLevel(clamped);
    setViewport(prev => ({ ...prev, scale: clamped, zoomLevel }));
    notifyZoomLevel(zoomLevel);
  }, [notifyZoomLevel]);

  const panTo = useCallback((x: number, y: number) => {
    setViewport(prev => ({ ...prev, x, y }));
  }, []);

  const fitToView = useCallback((bounds: { width: number; height: number }) => {
    const container = containerRef.current;
    if (!container || bounds.width === 0 || bounds.height === 0) return;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / bounds.width;
    const scaleY = rect.height / bounds.height;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY) * 0.9));
    const zoomLevel = scaleToZoomLevel(scale);
    const x = (rect.width - bounds.width * scale) / 2;
    const y = (rect.height - bounds.height * scale) / 2;
    setViewport({ x, y, scale, zoomLevel });
    notifyZoomLevel(zoomLevel);
  }, [notifyZoomLevel]);

  // ── Derived style ─────────────────────────────────────────────

  const canvasStyle: React.CSSProperties = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
    transformOrigin: '0 0',
    willChange: 'transform',
  };

  return {
    viewport,
    containerRef,
    canvasStyle,
    isPanning: isPanningRef.current,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
    zoomTo,
    panTo,
    fitToView,
  };
}
