// [claude-code 2026-04-23] S32-T4 — Consul Control pixelation corners.
// Animated gold pixel flicker at the four corners while Harper is holding the
// wheel. Replaces the flat solid-color overlay. Decorative only.
import { useMemo } from "react";

const GRID = 8;
const CELL_PX = 6;
const GAP_PX = 2;
const ACCENT = "#c79f4a";
const CORNERS = ["tl", "tr", "bl", "br"] as const;
type Corner = (typeof CORNERS)[number];

interface Cell {
  row: number;
  col: number;
  delayMs: number;
  durationMs: number;
}

function buildCells(seed: number): Cell[] {
  // Stable PRNG — mulberry32. Session-stable: seed is captured on mount.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cells: Cell[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      // L-shape density mask: denser at origin (0,0), trailing off
      // diagonally. Keep probability drops with the larger axis distance.
      const axis = Math.max(row, col);
      const keepProb = Math.max(0, 1 - axis / (GRID - 1));
      if (rand() > keepProb * 0.92) continue;
      cells.push({
        row,
        col,
        delayMs: Math.floor(rand() * 1200),
        durationMs: 400 + Math.floor(rand() * 200),
      });
    }
  }
  return cells;
}

function cornerAnchor(corner: Corner): React.CSSProperties {
  switch (corner) {
    case "tl":
      return { top: 12, left: 12 };
    case "tr":
      return { top: 12, right: 12, transform: "scaleX(-1)" };
    case "bl":
      return { bottom: 12, left: 12, transform: "scaleY(-1)" };
    case "br":
      return { bottom: 12, right: 12, transform: "scale(-1, -1)" };
  }
}

function CornerGrid({ corner, seed }: { corner: Corner; seed: number }) {
  const cells = useMemo(() => buildCells(seed), [seed]);
  const size = GRID * CELL_PX + (GRID - 1) * GAP_PX;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: size,
        height: size,
        ...cornerAnchor(corner),
      }}
    >
      {cells.map((cell) => (
        <span
          key={`${cell.row}-${cell.col}`}
          style={{
            position: "absolute",
            top: cell.row * (CELL_PX + GAP_PX),
            left: cell.col * (CELL_PX + GAP_PX),
            width: CELL_PX,
            height: CELL_PX,
            backgroundColor: ACCENT,
            willChange: "opacity",
            animation: `consul-pixel-flicker ${cell.durationMs}ms ease-in-out ${cell.delayMs}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function ConsulControlCorners({ active }: { active: boolean }) {
  const seeds = useMemo(
    () => CORNERS.map((_, i) => (Math.random() * 0xffffffff) >>> 0 || i + 1),
    [],
  );

  return (
    <>
      <style>{`
        @keyframes consul-pixel-flicker {
          0%   { opacity: 0.08; }
          50%  { opacity: 0.40; }
          100% { opacity: 0.08; }
        }
        .consul-corners-root {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 40;
          opacity: 0;
          transition: opacity 600ms ease-out;
        }
        .consul-corners-root.is-active {
          opacity: 1;
          transition: opacity 400ms ease-in;
        }
        .consul-corners-root:not(.is-active) * {
          animation-play-state: paused !important;
        }
      `}</style>
      <div className={`consul-corners-root${active ? " is-active" : ""}`}>
        {CORNERS.map((corner, i) => (
          <CornerGrid key={corner} corner={corner} seed={seeds[i]} />
        ))}
      </div>
    </>
  );
}

export default ConsulControlCorners;
