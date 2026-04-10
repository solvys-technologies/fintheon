// [claude-code 2026-03-16] Stone theme + narrative theme integration
import { useCallback } from "react";
import type { NarrativeLane } from "../../lib/narrative-types";

const DIRECTION_ICONS: Record<string, { symbol: string; color: string }> = {
  long: { symbol: "\u2191", color: "var(--fintheon-bullish)" },
  short: { symbol: "\u2193", color: "var(--fintheon-bearish)" },
  neutral: { symbol: "\u2014", color: "var(--fintheon-muted)" },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  active: { dot: "var(--fintheon-bullish)", label: "Active" },
  watching: { dot: "var(--fintheon-accent)", label: "Watching" },
  archived: { dot: "var(--fintheon-muted)", label: "Archived" },
  decayed: { dot: "var(--fintheon-border)", label: "Decayed" },
};

interface NarrativeLaneHeaderProps {
  lane: NarrativeLane;
  selected?: boolean;
  onSelect: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

export default function NarrativeLaneHeader({
  lane,
  selected = false,
  onSelect,
  onContextMenu,
}: NarrativeLaneHeaderProps) {
  const dir = DIRECTION_ICONS[lane.directionBias] || DIRECTION_ICONS.neutral;
  const status = STATUS_CONFIG[lane.status] || STATUS_CONFIG.active;

  const handleClick = useCallback(() => onSelect(lane.id), [onSelect, lane.id]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(e, lane.id);
    },
    [onContextMenu, lane.id],
  );

  return (
    <div
      className="flex-shrink-0 flex flex-col justify-center gap-1.5 px-3 py-2 cursor-pointer transition-colors duration-150"
      style={{
        width: "180px",
        borderRight: `1px solid color-mix(in srgb, var(--fintheon-border) 20%, transparent)`,
        backgroundColor: selected
          ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
          : "transparent",
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Title + direction arrow */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: dir.color, fontSize: "14px", fontWeight: 700 }}>
          {dir.symbol}
        </span>
        <span
          className="font-semibold truncate flex-1"
          style={{ fontSize: "12px", color: "var(--fintheon-text)" }}
        >
          {lane.title}
        </span>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-full"
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: status.dot,
            flexShrink: 0,
          }}
        />
        <span
          className="uppercase"
          style={{
            fontSize: "10px",
            color: "var(--fintheon-muted)",
            letterSpacing: "0.12em",
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Instruments chips */}
      {lane.instruments.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {lane.instruments.map((inst) => (
            <span
              key={inst}
              className="rounded px-1 py-0.5 font-mono"
              style={{
                fontSize: "8px",
                color: "var(--fintheon-accent)",
                backgroundColor:
                  "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
              }}
            >
              {inst}
            </span>
          ))}
        </div>
      )}

      {/* Health gauge placeholder for Track 4 */}
      <div data-health-gauge />
    </div>
  );
}
