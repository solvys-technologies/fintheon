// [claude-code 2026-04-17] Migrated drag to useDraggable hook; resize migrated to pointer events + rAF; removed glass/shadow effects per Nothing-Design
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Minus,
  Maximize2,
  GripVertical,
  Play,
  Youtube,
} from "lucide-react";
import { isElectron } from "../../lib/platform";
import { useDraggable } from "../../hooks/useDraggable";

interface YouTubeMiniplayerProps {
  onClose: () => void;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 260;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;

const POS_KEY = "fintheon:yt-miniplayer-pos";
const SIZE_KEY = "fintheon:yt-miniplayer-size";

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.searchParams.has("v")) return url.searchParams.get("v");
    if (url.hostname === "youtu.be")
      return url.pathname.slice(1).split("/")[0] || null;
    const embedMatch = url.pathname.match(/\/(embed|live|shorts)\/([\w-]{11})/);
    if (embedMatch) return embedMatch[2];
  } catch {
    // not a URL
  }
  return null;
}

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function readSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
}

function defaultPos(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - DEFAULT_WIDTH - 40,
    y: window.innerHeight - DEFAULT_HEIGHT - 80,
  };
}

export function YouTubeMiniplayer({ onClose }: YouTubeMiniplayerProps) {
  const [videoId, setVideoId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("fintheon:yt-miniplayer-video") || null;
    } catch {
      return null;
    }
  });
  const [urlInput, setUrlInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [size, setSize] = useState(readSize);

  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const minimizedGripRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sizeWriteTimer = useRef<number | null>(null);

  const draggable = useDraggable({
    elementRef: panelRef,
    handleRef: minimized ? minimizedGripRef : gripRef,
    storageKey: POS_KEY,
    initialPosition: defaultPos(),
    bounds: "viewport",
  });

  // Persist video ID
  useEffect(() => {
    try {
      if (videoId)
        localStorage.setItem("fintheon:yt-miniplayer-video", videoId);
      else localStorage.removeItem("fintheon:yt-miniplayer-video");
    } catch {
      /* ignore */
    }
  }, [videoId]);

  // Debounced size persistence
  useEffect(() => {
    if (sizeWriteTimer.current) window.clearTimeout(sizeWriteTimer.current);
    sizeWriteTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify(size));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      if (sizeWriteTimer.current) window.clearTimeout(sizeWriteTimer.current);
    };
  }, [size]);

  // Clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - rect.height);
      const clamped = {
        x: Math.min(draggable.position.x, maxX),
        y: Math.min(draggable.position.y, maxY),
      };
      if (
        clamped.x !== draggable.position.x ||
        clamped.y !== draggable.position.y
      ) {
        draggable.setPosition(clamped);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draggable]);

  // --- Resize (pointer events + rAF) ---
  const resizeStateRef = useRef<{
    edge: ResizeEdge;
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPX: number;
    startPY: number;
    latestW: number;
    latestH: number;
    latestPX: number;
    latestPY: number;
    rafPending: boolean;
    target: HTMLElement;
  } | null>(null);

  const flushResize = useCallback(() => {
    const state = resizeStateRef.current;
    if (!state) return;
    state.rafPending = false;
    const el = panelRef.current;
    if (!el) return;
    el.style.width = `${state.latestW}px`;
    el.style.height = `${state.latestH}px`;
    el.style.transform = `translate3d(${state.latestPX}px, ${state.latestPY}px, 0)`;
  }, []);

  const handleResizePointerMove = useCallback(
    (e: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const { edge, startW, startH, startPX, startPY } = state;

      let newW = startW;
      let newH = startH;
      let newX = startPX;
      let newY = startPY;

      if (edge.includes("e")) newW = Math.max(MIN_WIDTH, startW + dx);
      if (edge.includes("w")) {
        newW = Math.max(MIN_WIDTH, startW - dx);
        newX = startPX + (startW - newW);
      }
      if (edge.includes("s")) newH = Math.max(MIN_HEIGHT, startH + dy);
      if (edge.includes("n")) {
        newH = Math.max(MIN_HEIGHT, startH - dy);
        newY = startPY + (startH - newH);
      }

      state.latestW = newW;
      state.latestH = newH;
      state.latestPX = newX;
      state.latestPY = newY;

      if (!state.rafPending) {
        state.rafPending = true;
        requestAnimationFrame(flushResize);
      }
    },
    [flushResize],
  );

  const endResize = useCallback(
    (e: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      const { target, pointerId } = state;
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      target.removeEventListener("pointermove", handleResizePointerMove);
      target.removeEventListener("pointerup", endResize);
      target.removeEventListener("pointercancel", endResize);

      // Commit to React state
      setSize({ w: state.latestW, h: state.latestH });
      draggable.setPosition({ x: state.latestPX, y: state.latestPY });

      resizeStateRef.current = null;
    },
    [draggable, handleResizePointerMove],
  );

  const handleResizeStart = useCallback(
    (edge: ResizeEdge) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      resizeStateRef.current = {
        edge,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startW: size.w,
        startH: size.h,
        startPX: draggable.position.x,
        startPY: draggable.position.y,
        latestW: size.w,
        latestH: size.h,
        latestPX: draggable.position.x,
        latestPY: draggable.position.y,
        rafPending: false,
        target,
      };

      target.addEventListener("pointermove", handleResizePointerMove);
      target.addEventListener("pointerup", endResize);
      target.addEventListener("pointercancel", endResize);
    },
    [size, draggable, handleResizePointerMove, endResize],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(urlInput);
    if (id) {
      setVideoId(id);
      setUrlInput("");
    }
  };

  const handleClear = () => {
    setVideoId(null);
    setUrlInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const EDGE = 6;

  if (minimized) {
    return (
      <div
        ref={panelRef}
        className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-2xl border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-surface)] select-none"
        style={{ top: 0, left: 0 }}
      >
        <button
          ref={minimizedGripRef}
          className="p-1 rounded cursor-grab active:cursor-grabbing touch-none"
          title="Drag"
          aria-label="Drag miniplayer"
        >
          <GripVertical className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/50" />
        </button>
        <Youtube className="w-4 h-4 text-red-500" />
        <button
          onClick={() => setMinimized(false)}
          className="p-1 hover:bg-[var(--fintheon-accent)]/15 rounded-lg text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Expand"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-red-500/15 rounded-lg text-[var(--fintheon-accent)]/50 hover:text-red-400 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 rounded-2xl border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-surface)] overflow-hidden flex flex-col"
      style={{
        top: 0,
        left: 0,
        width: size.w,
        height: size.h,
      }}
    >
      {/* Resize handles — edges + corners */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          onPointerDown={handleResizeStart("n")}
          className="pointer-events-auto absolute top-0 left-[8px] right-[8px] cursor-n-resize touch-none"
          style={{ height: EDGE }}
        />
        <div
          onPointerDown={handleResizeStart("s")}
          className="pointer-events-auto absolute bottom-0 left-[8px] right-[8px] cursor-s-resize touch-none"
          style={{ height: EDGE }}
        />
        <div
          onPointerDown={handleResizeStart("w")}
          className="pointer-events-auto absolute left-0 top-[8px] bottom-[8px] cursor-w-resize touch-none"
          style={{ width: EDGE }}
        />
        <div
          onPointerDown={handleResizeStart("e")}
          className="pointer-events-auto absolute right-0 top-[8px] bottom-[8px] cursor-e-resize touch-none"
          style={{ width: EDGE }}
        />
        <div
          onPointerDown={handleResizeStart("nw")}
          className="pointer-events-auto absolute top-0 left-0 cursor-nw-resize touch-none"
          style={{ width: EDGE * 2, height: EDGE * 2 }}
        />
        <div
          onPointerDown={handleResizeStart("ne")}
          className="pointer-events-auto absolute top-0 right-0 cursor-ne-resize touch-none"
          style={{ width: EDGE * 2, height: EDGE * 2 }}
        />
        <div
          onPointerDown={handleResizeStart("sw")}
          className="pointer-events-auto absolute bottom-0 left-0 cursor-sw-resize touch-none"
          style={{ width: EDGE * 2, height: EDGE * 2 }}
        />
        <div
          onPointerDown={handleResizeStart("se")}
          className="pointer-events-auto absolute bottom-0 right-0 cursor-se-resize touch-none"
          style={{ width: EDGE * 2, height: EDGE * 2 }}
        />
      </div>

      {/* Title bar — grip-only drag */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/15 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            ref={gripRef}
            className="p-0.5 rounded cursor-grab active:cursor-grabbing text-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)] touch-none"
            title="Drag"
            aria-label="Drag miniplayer"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <Youtube className="w-4 h-4 text-red-500" />
          <span className="text-xs font-medium text-[var(--fintheon-text)]/70">
            Miniplayer
          </span>
        </div>
        <div className="flex items-center gap-1">
          {videoId && (
            <button
              onClick={handleClear}
              className="px-2 py-0.5 text-[10px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
              title="Change video"
            >
              Change
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="p-1 hover:bg-[var(--fintheon-accent)]/15 rounded-lg text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/15 rounded-lg text-[var(--fintheon-accent)]/50 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content — fills remaining space */}
      {videoId ? (
        <div className="flex-1 min-h-0 bg-black">
          {isElectron() ? (
            <webview
              title="YouTube miniplayer"
              src={`https://www.youtube.com/watch?v=${videoId}`}
              className="w-full h-full"
              allowpopups
              partition="persist:fintheon"
              webpreferences="nativeWindowOpen=yes"
            />
          ) : (
            <iframe
              title="YouTube miniplayer"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="no-referrer"
              allowFullScreen
              className="w-full h-full"
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <div className="text-center">
              <Youtube className="w-10 h-10 text-red-500/40 mx-auto mb-2" />
              <p className="text-xs text-[var(--fintheon-text)]/50">
                Paste a YouTube URL or video ID
              </p>
            </div>
            <form onSubmit={handleSubmit} className="w-full flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-[var(--fintheon-bg)]/60 border border-[var(--fintheon-accent)]/20 rounded-xl px-3 py-2 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text)]/30 outline-none focus:border-[var(--fintheon-accent)]/50 transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="p-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-red-400 transition-colors"
                title="Play"
              >
                <Play className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
