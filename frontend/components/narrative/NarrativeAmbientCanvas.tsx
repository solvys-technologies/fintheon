import { useCallback, useEffect, useRef, useState } from "react";
import { useNarrative } from "../../contexts/NarrativeContext";
import type { BubbleState } from "../../lib/narrative-physics";
import {
  initBubble,
  stepPhysics,
  triggerRopeSwing,
} from "../../lib/narrative-physics";
import {
  clearCanvas,
  drawNarrativeCard,
  drawRope,
  drawTimeDividers,
  drawZoneBackgrounds,
  drawZoneLabels,
} from "../../lib/narrative-canvas-renderer";
import {
  clampScale,
  fitToView,
  getZoomConfig,
  screenToWorld,
  type CameraState,
} from "../../lib/narrative-zoom";
import type { ZoomLevel } from "../../lib/narrative-types";

const CAMERA_KEY = "narrativeflow:bubble-camera";

interface NarrativeAmbientCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  onLaneSelect?: (laneId: string) => void;
}

export function NarrativeAmbientCanvas({
  zoomLevel,
  visibleLaneIds,
  onLaneSelect,
}: NarrativeAmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 });
  const bubblesRef = useRef<BubbleState[]>([]);
  const frameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null);
  const { state, dispatch } = useNarrative();

  const effectiveZoom = zoomLevel ?? state.zoomLevel;
  const zoomConfig = getZoomConfig(effectiveZoom);
  const activeLanes = state.lanes.filter(
    (lane) =>
      lane.status !== "archived" &&
      (!visibleLaneIds || visibleLaneIds.has(lane.id)),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const existing = new Map(
      bubblesRef.current.map((bubble) => [bubble.id, bubble]),
    );
    bubblesRef.current = activeLanes.map((lane, index) => {
      const previous = existing.get(lane.id);
      if (previous) {
        previous.category = lane.category;
        return previous;
      }
      return initBubble(lane.id, lane.category, w, h, index);
    });

    const savedCamera = loadCamera();
    if (savedCamera) cameraRef.current = savedCamera;
    if (!savedCamera && bubblesRef.current.length > 0) {
      cameraRef.current = fitToView(getBubbleBounds(bubblesRef.current), w, h);
    }
  }, [activeLanes.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let lastTime = performance.now();

    function render(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      const time = now / 1000;
      lastTime = now;

      stepPhysics(bubblesRef.current, time, dt, w, h);
      ctx!.save();
      ctx!.scale(dpr, dpr);
      clearCanvas(ctx!, w, h);
      const cam = cameraRef.current;
      ctx!.translate(cam.x, cam.y);
      ctx!.scale(cam.scale, cam.scale);
      drawZoneBackgrounds(ctx!, w / cam.scale, h / cam.scale);
      drawZoneLabels(ctx!, w / cam.scale, h / cam.scale);
      drawTimeDividers(ctx!, w / cam.scale, h / cam.scale, zoomConfig);
      drawRopes(
        ctx!,
        bubblesRef.current,
        state.ropes,
        time,
        zoomConfig.showRopes,
      );
      const laneMap = new Map(state.lanes.map((lane) => [lane.id, lane]));
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
  }, [
    hoveredLaneId,
    state.lanes,
    state.ropes,
    state.selectedLaneId,
    zoomConfig,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const persist = () => saveCamera(cameraRef.current);
    document.addEventListener("visibilitychange", persist);
    return () => {
      persist();
      document.removeEventListener("visibilitychange", persist);
    };
  }, []);

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cam = cameraRef.current;
    const world = screenToWorld(
      clientX - rect.left - cam.x,
      clientY - rect.top - cam.y,
      { ...cam, x: 0, y: 0 },
    );
    return (
      bubblesRef.current.find(
        (bubble) =>
          world.x >= bubble.x &&
          world.x <= bubble.x + bubble.width &&
          world.y >= bubble.y &&
          world.y <= bubble.y + bubble.height,
      ) ?? null
    );
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (isDragging.current) {
        const cam = cameraRef.current;
        cameraRef.current = {
          ...cam,
          x: cam.x + event.clientX - lastMouse.current.x,
          y: cam.y + event.clientY - lastMouse.current.y,
        };
        lastMouse.current = { x: event.clientX, y: event.clientY };
        return;
      }
      setHoveredLaneId(hitTest(event.clientX, event.clientY)?.id ?? null);
    },
    [hitTest],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const hit = hitTest(event.clientX, event.clientY);
      if (!hit) return;
      onLaneSelect?.(hit.id);
      dispatch({ type: "UPDATE_LANE", id: hit.id, updates: {} });
      for (const rope of state.ropes) {
        if (rope.fromId === hit.id || rope.toId === hit.id) {
          triggerRopeSwing(rope.id, performance.now() / 1000);
        }
      }
    },
    [dispatch, hitTest, onLaneSelect, state.ropes],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cam = cameraRef.current;
      const scale = clampScale(
        cam.scale * (event.deltaY > 0 ? 0.9 : 1.1),
        zoomConfig,
      );
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      animateCamera(cameraRef, {
        x: mx - (mx - cam.x) * (scale / cam.scale),
        y: my - (my - cam.y) * (scale / cam.scale),
        scale,
      });
    },
    [zoomConfig],
  );

  const handleDoubleClick = useCallback(() => {
    const next =
      effectiveZoom === "year"
        ? "quarter"
        : effectiveZoom === "quarter"
          ? "month"
          : "week";
    dispatch({ type: "SET_ZOOM", level: next });
  }, [dispatch, effectiveZoom]);

  const stopDragging = () => {
    isDragging.current = false;
  };

  return (
    <div ref={containerRef} className="absolute inset-0 opacity-45">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={(event) => {
          isDragging.current = true;
          lastMouse.current = { x: event.clientX, y: event.clientY };
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  );
}

function drawRopes(
  ctx: CanvasRenderingContext2D,
  bubbles: BubbleState[],
  ropes: {
    id: string;
    fromId: string;
    toId: string;
    polarity: "reinforcing" | "contradicting";
  }[],
  time: number,
  shouldShow: boolean,
) {
  if (!shouldShow) return;
  for (const rope of ropes) {
    const from = bubbles.find((bubble) => bubble.id === rope.fromId);
    const to = bubbles.find((bubble) => bubble.id === rope.toId);
    if (!from || !to) continue;
    drawRope(
      ctx,
      from.x + from.width / 2,
      from.y + from.height / 2,
      to.x + to.width / 2,
      to.y + to.height / 2,
      rope.polarity,
      rope.id,
      time,
    );
  }
}

function animateCamera(
  cameraRef: React.MutableRefObject<CameraState>,
  target: CameraState,
) {
  const start = { ...cameraRef.current };
  const startTime = performance.now();
  function tick(now: number) {
    const t = Math.min((now - startTime) / 200, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    cameraRef.current = {
      x: start.x + (target.x - start.x) * ease,
      y: start.y + (target.y - start.y) * ease,
      scale: start.scale + (target.scale - start.scale) * ease,
    };
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getBubbleBounds(bubbles: BubbleState[]) {
  return bubbles.reduce(
    (bounds, bubble) => ({
      minX: Math.min(bounds.minX, bubble.x),
      minY: Math.min(bounds.minY, bubble.y),
      maxX: Math.max(bounds.maxX, bubble.x + bubble.width),
      maxY: Math.max(bounds.maxY, bubble.y + bubble.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function loadCamera(): CameraState | null {
  try {
    const raw = localStorage.getItem(CAMERA_KEY);
    return raw ? (JSON.parse(raw) as CameraState) : null;
  } catch {
    return null;
  }
}

function saveCamera(camera: CameraState) {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify(camera));
  } catch {}
}
