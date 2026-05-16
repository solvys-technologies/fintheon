// [claude-code 2026-05-16] S68-T5: Smooth camera transitions, loading/empty states
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useNarrative } from "../../contexts/NarrativeContext";
import type { NarrativeLane, Rope } from "../../lib/narrative-types";
import type { BubbleState } from "../../lib/narrative-physics";
import {
  initBubble,
  stepPhysics,
  triggerRopeSwing,
} from "../../lib/narrative-physics";
import {
  clearCanvas,
  drawZoneBackgrounds,
  drawZoneLabels,
  drawNarrativeCard,
  drawRope,
  drawTimeDividers,
} from "../../lib/narrative-canvas-renderer";
import {
  getZoomConfig,
  screenToWorld,
  clampScale,
  fitToView,
  type CameraState,
} from "../../lib/narrative-zoom";
import type { ZoomLevel } from "../../lib/narrative-types";
import type { Theme } from "../../hooks/useThemes";
import { ThemeCatalystGroup } from "./ThemeCatalystGroup";
import {
  NarrativeFlowFilterBar,
  type FilterMode,
} from "./NarrativeFlowFilterBar";
import { SolvysLoaderCentered } from "../shared/SolvysLoader";

const CAMERA_KEY = "narrativeflow:bubble-camera";

interface NarrativeCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  themes: Theme[];
  isLoading?: boolean;
}

const SEVERITY_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Animate camera from current to target using requestAnimationFrame interpolation */
function animateCamera(
  cameraRef: React.MutableRefObject<CameraState>,
  target: CameraState,
  duration = 200,
) {
  const start = { ...cameraRef.current };
  const startTime = performance.now();

  function tick(now: number) {
    const t = Math.min((now - startTime) / duration, 1);
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

export function NarrativeCanvas({
  zoomLevel,
  visibleLaneIds,
  themes,
  isLoading = false,
}: NarrativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useNarrative();
  const bubblesRef = useRef<BubbleState[]>([]);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 });
  const frameRef = useRef<number>(0);
  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const handleFilterChange = useCallback(
    (mode: FilterMode, themeId?: string) => {
      setActiveFilter(mode);
      setSelectedThemeId(themeId ?? null);
    },
    [],
  );

  const filteredThemes = useMemo(() => {
    if (activeFilter === "all") return themes;
    if (activeFilter === "active")
      return themes.filter((t) => t.status === "Active");
    if (activeFilter === "theme" && selectedThemeId)
      return themes.filter((t) => t.id === selectedThemeId);
    return [];
  }, [themes, activeFilter, selectedThemeId]);

  const catalystMap = useMemo(() => {
    const map = new Map<string, typeof state.catalysts>();
    for (const theme of filteredThemes) {
      const matched = state.catalysts.filter((c) =>
        theme.catalystIds.includes(c.id),
      );
      map.set(theme.id, matched);
    }
    return map;
  }, [filteredThemes, state.catalysts]);

  const sortedThemes = useMemo(
    () => [...filteredThemes].sort((a, b) => b.ipv - a.ipv),
    [filteredThemes],
  );

  const effectiveZoom = zoomLevel ?? state.zoomLevel;
  const activeLanes = state.lanes.filter(
    (l) =>
      l.status !== "archived" && (!visibleLaneIds || visibleLaneIds.has(l.id)),
  );
  const zoomConfig = getZoomConfig(effectiveZoom);

  // Initialize bubbles when lanes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const existing = new Map(bubblesRef.current.map((b) => [b.id, b]));
    bubblesRef.current = activeLanes.map((lane, i) => {
      const prev = existing.get(lane.id);
      if (prev) {
        prev.category = lane.category;
        return prev;
      }
      return initBubble(lane.id, lane.category, w, h, i);
    });

    // Restore saved camera or fit to initial layout
    if (bubblesRef.current.length > 0) {
      let savedCam: CameraState | null = null;
      try {
        const raw = localStorage.getItem(CAMERA_KEY);
        if (raw) savedCam = JSON.parse(raw) as CameraState;
      } catch {
        // silent
      }
      if (savedCam) {
        cameraRef.current = savedCam;
      } else {
        const bounds = getBubbleBounds(bubblesRef.current);
        cameraRef.current = fitToView(bounds, w, h);
      }
    }
  }, [activeLanes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    function render(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      const time = now / 1000;

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

      if (zoomConfig.showRopes) {
        for (const rope of state.ropes) {
          const fromBubble = bubblesRef.current.find(
            (b) => b.id === rope.fromId,
          );
          const toBubble = bubblesRef.current.find((b) => b.id === rope.toId);
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

      const laneMap = new Map(state.lanes.map((l) => [l.id, l]));
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
    state.ropes,
    state.lanes,
    hoveredLaneId,
    state.selectedLaneId,
    zoomConfig,
  ]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
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

  // Save camera on unmount
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(CAMERA_KEY, JSON.stringify(cameraRef.current));
      } catch {
        // silent
      }
    };
  }, []);

  // Save camera on page hide
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        try {
          localStorage.setItem(CAMERA_KEY, JSON.stringify(cameraRef.current));
        } catch {
          // silent
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Mouse handlers for canvas background
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const world = screenToWorld(
      e.clientX - rect.left - cam.x,
      e.clientY - rect.top - cam.y,
      { ...cam, x: 0, y: 0 },
    );

    if (isDragging.current) {
      cameraRef.current = {
        ...cam,
        x: cam.x + (e.clientX - lastMouse.current.x),
        y: cam.y + (e.clientY - lastMouse.current.y),
      };
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const hit = bubblesRef.current.find(
      (b) =>
        world.x >= b.x &&
        world.x <= b.x + b.width &&
        world.y >= b.y &&
        world.y <= b.y + b.height,
    );
    setHoveredLaneId(hit?.id ?? null);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx - cam.x, sy - cam.y, {
        ...cam,
        x: 0,
        y: 0,
      });

      const hit = bubblesRef.current.find(
        (b) =>
          world.x >= b.x &&
          world.x <= b.x + b.width &&
          world.y >= b.y &&
          world.y <= b.y + b.height,
      );

      if (hit) {
        dispatch({ type: "UPDATE_LANE", id: hit.id, updates: {} });
        for (const rope of state.ropes) {
          if (rope.fromId === hit.id || rope.toId === hit.id) {
            triggerRopeSwing(rope.id, performance.now() / 1000);
          }
        }
      }
    },
    [dispatch, state.ropes],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clampScale(cam.scale * zoomFactor, zoomConfig);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      animateCamera(
        cameraRef,
        {
          x: mx - (mx - cam.x) * (newScale / cam.scale),
          y: my - (my - cam.y) * (newScale / cam.scale),
          scale: newScale,
        },
        200,
      );
    },
    [zoomConfig],
  );

  const handleDoubleClick = useCallback(() => {
    const nextLevel =
      zoomLevel === "year"
        ? "quarter"
        : zoomLevel === "quarter"
          ? "month"
          : "week";
    dispatch({ type: "SET_ZOOM", level: nextLevel });
  }, [dispatch, zoomLevel]);

  const handleCatalystSelect = useCallback(
    (id: string) => {
      dispatch({ type: "UPDATE_LANE", id, updates: {} });
    },
    [dispatch],
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {/* Background canvas */}
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

      {/* Overlay — impact-intelligence structured list */}
      <div
        className="absolute inset-0 flex flex-col overflow-y-auto"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,4,2,0.55) 0%, rgba(5,4,2,0.75) 100%)",
        }}
      >
        <NarrativeFlowFilterBar
          themes={themes}
          activeFilter={activeFilter}
          selectedThemeId={selectedThemeId}
          onFilterChange={handleFilterChange}
        />

        <div className="flex-1 px-4 pb-4 flex flex-col gap-4">
          {isLoading ? (
            <SolvysLoaderCentered text="Loading themes..." />
          ) : sortedThemes.length > 0 ? (
            sortedThemes.map((theme) => {
              const themeCatalysts = catalystMap.get(theme.id) ?? [];
              return (
                <ThemeCatalystGroup
                  key={theme.id}
                  theme={theme}
                  catalysts={themeCatalysts}
                  selectedId={state.selectedCatalystId}
                  onSelect={handleCatalystSelect}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--fintheon-accent)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3 }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p className="text-sm text-[var(--fintheon-muted)]/30 text-center">
                {themes.length === 0
                  ? "No active themes. Connect Narrative Flow to start tracking."
                  : "No themes match the current filter."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getBubbleBounds(bubbles: BubbleState[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of bubbles) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { minX, minY, maxX, maxY };
}
