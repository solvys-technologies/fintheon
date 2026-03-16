// [claude-code 2026-03-16] Canvas 2D rendering engine for NarrativeFlow — bubbles, ropes, zones
import { useRef, useEffect, useCallback, useState } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { NarrativeLane, Rope } from '../../lib/narrative-types';
import type { BubbleState } from '../../lib/narrative-physics';
import {
  initBubble,
  stepPhysics,
  triggerRopeSwing,
  getZoneBounds,
} from '../../lib/narrative-physics';
import {
  clearCanvas,
  drawZoneBackgrounds,
  drawZoneLabels,
  drawNarrativeCard,
  drawRope,
  drawTimeDividers,
} from '../../lib/narrative-canvas-renderer';
import {
  getZoomConfig,
  screenToWorld,
  clampScale,
  fitToView,
  type CameraState,
} from '../../lib/narrative-zoom';
import type { ZoomLevel } from '../../lib/narrative-types';

interface NarrativeCanvasProps {
  zoomLevel: ZoomLevel;
}

export function NarrativeCanvas({ zoomLevel }: NarrativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useNarrative();
  const bubblesRef = useRef<BubbleState[]>([]);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 });
  const frameRef = useRef<number>(0);
  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const activeLanes = state.lanes.filter(l => l.status !== 'archived');
  const zoomConfig = getZoomConfig(zoomLevel);

  // Initialize bubbles when lanes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const existing = new Map(bubblesRef.current.map(b => [b.id, b]));
    bubblesRef.current = activeLanes.map((lane, i) => {
      const prev = existing.get(lane.id);
      if (prev) {
        prev.category = lane.category;
        return prev;
      }
      return initBubble(lane.id, lane.category, w, h, i);
    });

    // Fit camera to initial layout
    if (bubblesRef.current.length > 0) {
      const bounds = getBubbleBounds(bubblesRef.current);
      cameraRef.current = fitToView(bounds, w, h);
    }
  }, [activeLanes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    function render(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt
      lastTime = now;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      const time = now / 1000;

      // Physics step
      stepPhysics(bubblesRef.current, time, dt, w, h);

      // Render
      ctx!.save();
      ctx!.scale(dpr, dpr);
      clearCanvas(ctx!, w, h);

      // Apply camera transform
      const cam = cameraRef.current;
      ctx!.translate(cam.x, cam.y);
      ctx!.scale(cam.scale, cam.scale);

      // Draw zones
      drawZoneBackgrounds(ctx!, w / cam.scale, h / cam.scale);
      drawZoneLabels(ctx!, w / cam.scale, h / cam.scale);
      drawTimeDividers(ctx!, w / cam.scale, h / cam.scale, zoomConfig);

      // Draw ropes
      if (zoomConfig.showRopes) {
        for (const rope of state.ropes) {
          const fromBubble = bubblesRef.current.find(b => b.id === rope.fromId);
          const toBubble = bubblesRef.current.find(b => b.id === rope.toId);
          if (fromBubble && toBubble) {
            drawRope(
              ctx!,
              fromBubble.x + fromBubble.width / 2,
              fromBubble.y + fromBubble.height / 2,
              toBubble.x + toBubble.width / 2,
              toBubble.y + toBubble.height / 2,
              rope.polarity,
              rope.id,
              time,
            );
          }
        }
      }

      // Draw narrative cards
      const laneMap = new Map(state.lanes.map(l => [l.id, l]));
      for (const bubble of bubblesRef.current) {
        const lane = laneMap.get(bubble.id);
        if (!lane) continue;
        drawNarrativeCard(
          ctx!,
          bubble,
          lane,
          hoveredLaneId === bubble.id,
          state.selectedLaneId === bubble.id,
          zoomConfig,
        );
      }

      ctx!.restore();
      frameRef.current = requestAnimationFrame(render);
    }

    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [state.ropes, state.lanes, hoveredLaneId, state.selectedLaneId, zoomConfig]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const world = screenToWorld(e.clientX - rect.left - cam.x, e.clientY - rect.top - cam.y, { ...cam, x: 0, y: 0 });

    // Pan
    if (isDragging.current) {
      cameraRef.current = {
        ...cam,
        x: cam.x + (e.clientX - lastMouse.current.x),
        y: cam.y + (e.clientY - lastMouse.current.y),
      };
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover detection
    const hit = bubblesRef.current.find(b =>
      world.x >= b.x && world.x <= b.x + b.width &&
      world.y >= b.y && world.y <= b.y + b.height
    );
    setHoveredLaneId(hit?.id ?? null);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx - cam.x, sy - cam.y, { ...cam, x: 0, y: 0 });

    const hit = bubblesRef.current.find(b =>
      world.x >= b.x && world.x <= b.x + b.width &&
      world.y >= b.y && world.y <= b.y + b.height
    );

    if (hit) {
      dispatch({ type: 'UPDATE_LANE', id: hit.id, updates: {} }); // select
      // Trigger rope swings for connected ropes
      for (const rope of state.ropes) {
        if (rope.fromId === hit.id || rope.toId === hit.id) {
          triggerRopeSwing(rope.id, performance.now() / 1000);
        }
      }
    }
  }, [dispatch, state.ropes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = clampScale(cam.scale * zoomFactor, zoomConfig);

    // Zoom toward mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    cameraRef.current = {
      x: mx - (mx - cam.x) * (newScale / cam.scale),
      y: my - (my - cam.y) * (newScale / cam.scale),
      scale: newScale,
    };
  }, [zoomConfig]);

  const handleDoubleClick = useCallback(() => {
    // Double-click zooms in one level
    const nextLevel = zoomLevel === 'year' ? 'quarter' : zoomLevel === 'quarter' ? 'month' : 'week';
    dispatch({ type: 'SET_ZOOM', level: nextLevel });
  }, [dispatch, zoomLevel]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  );
}

function getBubbleBounds(bubbles: BubbleState[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of bubbles) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { minX, minY, maxX, maxY };
}
