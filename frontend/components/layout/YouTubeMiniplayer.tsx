// [claude-code 2026-04-06] YouTube floating miniplayer — persists independent of TradingBrowser
// [claude-code 2026-04-06] Fix Error 153: use <webview> in Electron, embed in browser
// [claude-code 2026-04-06] Resizable + larger default so YouTube UI is readable
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus, Maximize2, GripVertical, Play, Youtube } from 'lucide-react';
import { isElectron } from '../../lib/platform';

interface YouTubeMiniplayerProps {
  onClose: () => void;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 260;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.searchParams.has('v')) return url.searchParams.get('v');
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
    const embedMatch = url.pathname.match(/\/(embed|live|shorts)\/([\w-]{11})/);
    if (embedMatch) return embedMatch[2];
  } catch {
    // not a URL
  }
  return null;
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export function YouTubeMiniplayer({ onClose }: YouTubeMiniplayerProps) {
  const [videoId, setVideoId] = useState<string | null>(() => {
    try { return localStorage.getItem('fintheon:yt-miniplayer-video') || null; } catch { return null; }
  });
  const [urlInput, setUrlInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('fintheon:yt-miniplayer-pos');
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch { /* ignore */ }
    return { x: window.innerWidth - DEFAULT_WIDTH - 40, y: window.innerHeight - DEFAULT_HEIGHT - 80 };
  });
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem('fintheon:yt-miniplayer-size');
      if (saved) return JSON.parse(saved) as { w: number; h: number };
    } catch { /* ignore */ }
    return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
  });
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeEdge = useRef<ResizeEdge>(null);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist video ID
  useEffect(() => {
    try {
      if (videoId) localStorage.setItem('fintheon:yt-miniplayer-video', videoId);
      else localStorage.removeItem('fintheon:yt-miniplayer-video');
    } catch { /* ignore */ }
  }, [videoId]);

  // Persist position + size
  useEffect(() => {
    try { localStorage.setItem('fintheon:yt-miniplayer-pos', JSON.stringify(position)); } catch { /* ignore */ }
  }, [position]);
  useEffect(() => {
    try { localStorage.setItem('fintheon:yt-miniplayer-size', JSON.stringify(size)); } catch { /* ignore */ }
  }, [size]);

  // Clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 120),
        y: Math.min(prev.y, window.innerHeight - 60),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Drag ---
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 120)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // --- Resize ---
  const handleResizeStart = useCallback((edge: ResizeEdge) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeEdge.current = edge;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, px: position.x, py: position.y };
    setIsResizing(true);
  }, [size, position]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const { x: sx, y: sy, w: sw, h: sh, px, py } = resizeStart.current;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const edge = resizeEdge.current;

      let newW = sw, newH = sh, newX = px, newY = py;

      if (edge?.includes('e')) newW = Math.max(MIN_WIDTH, sw + dx);
      if (edge?.includes('w')) { newW = Math.max(MIN_WIDTH, sw - dx); newX = px + (sw - newW); }
      if (edge?.includes('s')) newH = Math.max(MIN_HEIGHT, sh + dy);
      if (edge?.includes('n')) { newH = Math.max(MIN_HEIGHT, sh - dy); newY = py + (sh - newH); }

      setSize({ w: newW, h: newH });
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(urlInput);
    if (id) {
      setVideoId(id);
      setUrlInput('');
    }
  };

  const handleClear = () => {
    setVideoId(null);
    setUrlInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)',
  };

  const EDGE = 6; // resize handle thickness in px

  // Minimized pill
  if (minimized) {
    return (
      <div
        ref={panelRef}
        className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-2xl border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-surface)]/70 cursor-default select-none"
        style={{ left: position.x, top: position.y, ...glassStyle }}
      >
        <div className="cursor-move" onMouseDown={handleDragStart}>
          <GripVertical className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/50" />
        </div>
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
      className="fixed z-50 rounded-2xl border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-surface)]/80 overflow-hidden flex flex-col"
      style={{ left: position.x, top: position.y, width: size.w, height: size.h, ...glassStyle, userSelect: isResizing ? 'none' : undefined }}
    >
      {/* Resize handles — edges + corners */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Edges */}
        <div onMouseDown={handleResizeStart('n')} className="pointer-events-auto absolute top-0 left-[8px] right-[8px] cursor-n-resize" style={{ height: EDGE }} />
        <div onMouseDown={handleResizeStart('s')} className="pointer-events-auto absolute bottom-0 left-[8px] right-[8px] cursor-s-resize" style={{ height: EDGE }} />
        <div onMouseDown={handleResizeStart('w')} className="pointer-events-auto absolute left-0 top-[8px] bottom-[8px] cursor-w-resize" style={{ width: EDGE }} />
        <div onMouseDown={handleResizeStart('e')} className="pointer-events-auto absolute right-0 top-[8px] bottom-[8px] cursor-e-resize" style={{ width: EDGE }} />
        {/* Corners */}
        <div onMouseDown={handleResizeStart('nw')} className="pointer-events-auto absolute top-0 left-0 cursor-nw-resize" style={{ width: EDGE * 2, height: EDGE * 2 }} />
        <div onMouseDown={handleResizeStart('ne')} className="pointer-events-auto absolute top-0 right-0 cursor-ne-resize" style={{ width: EDGE * 2, height: EDGE * 2 }} />
        <div onMouseDown={handleResizeStart('sw')} className="pointer-events-auto absolute bottom-0 left-0 cursor-sw-resize" style={{ width: EDGE * 2, height: EDGE * 2 }} />
        <div onMouseDown={handleResizeStart('se')} className="pointer-events-auto absolute bottom-0 right-0 cursor-se-resize" style={{ width: EDGE * 2, height: EDGE * 2 }} />
      </div>

      {/* Title bar */}
      <div
        className="h-9 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/15 cursor-move flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/40" />
          <Youtube className="w-4 h-4 text-red-500" />
          <span className="text-xs font-medium text-[var(--fintheon-text)]/70">Miniplayer</span>
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
              <p className="text-xs text-[var(--fintheon-text)]/50">Paste a YouTube URL or video ID</p>
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
