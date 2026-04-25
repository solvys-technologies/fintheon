// [claude-code 2026-04-24] S36 ClusterBeam — horizontal dot-strip timeline with drag-to-scrub.
// Each dot = one headline in the cluster, colored by sentiment. Drag playhead → scroll the
// card list on the right to that moment. Release → playhead returns to the first card.
// No box-shadow, no gradient — flat surfaces per feedback_no_glass_effects.
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { CatalystCard } from "../../lib/narrative-types";

interface ClusterScrubberProps {
  cards: CatalystCard[];
  onScrub: (cardId: string) => void;
  onHover?: (cardId: string | null) => void;
  accentColor: string;
}

const BULLISH = "#34D399";
const BEARISH = "#EF4444";
const NEUTRAL = "#6B7280";

function sentimentColor(card: CatalystCard): string {
  const s = (card as { sentiment?: string }).sentiment;
  if (s === "bullish") return BULLISH;
  if (s === "bearish") return BEARISH;
  return NEUTRAL;
}

function formatTooltip(card: CatalystCard): string {
  const date = card.date ? card.date.slice(0, 10) : "";
  return date ? `${date} — ${card.title}` : card.title;
}

export const ClusterScrubber = memo(function ClusterScrubber({
  cards,
  onScrub,
  onHover,
  accentColor,
}: ClusterScrubberProps) {
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [cards],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const [playheadIndex, setPlayheadIndex] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const resolveIndex = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      return Math.min(
        sortedCards.length - 1,
        Math.floor(ratio * sortedCards.length),
      );
    },
    [sortedCards.length],
  );

  const applyIndex = useCallback(
    (index: number) => {
      const bounded = Math.min(sortedCards.length - 1, Math.max(0, index));
      setPlayheadIndex(bounded);
      const card = sortedCards[bounded];
      if (card) onScrub(card.id);
    },
    [sortedCards, onScrub],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setDragging(true);
      applyIndex(resolveIndex(e.clientX));
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [applyIndex, resolveIndex],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging) {
        applyIndex(resolveIndex(e.clientX));
      } else {
        const idx = resolveIndex(e.clientX);
        setHoveredIndex(idx);
        if (onHover) onHover(sortedCards[idx]?.id ?? null);
      }
    },
    [dragging, applyIndex, resolveIndex, onHover, sortedCards],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    setPlayheadIndex(0);
  }, [dragging]);

  const handlePointerLeave = useCallback(() => {
    setHoveredIndex(null);
    if (onHover) onHover(null);
  }, [onHover]);

  if (sortedCards.length === 0) return null;

  const dotWidth = 100 / sortedCards.length;

  return (
    <div style={{ padding: "8px 14px 4px" }}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{
          position: "relative",
          width: "100%",
          height: 28,
          cursor: dragging ? "grabbing" : "pointer",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 13,
            left: 0,
            right: 0,
            height: 1,
            background: `${accentColor}20`,
          }}
        />
        {sortedCards.map((card, i) => {
          const color = sentimentColor(card);
          const isActive = i === playheadIndex && dragging;
          const isHovered = i === hoveredIndex;
          return (
            <div
              key={card.id}
              style={{
                position: "absolute",
                top: 10,
                left: `${i * dotWidth}%`,
                width: `${dotWidth}%`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  width: isActive || isHovered ? 7 : 5,
                  height: isActive || isHovered ? 7 : 5,
                  borderRadius: "50%",
                  background: color,
                  opacity: isActive ? 1 : isHovered ? 0.9 : 0.7,
                  transition:
                    "width 120ms ease, height 120ms ease, opacity 120ms ease",
                }}
              />
            </div>
          );
        })}
        {dragging && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 2,
              left: `calc(${playheadIndex * dotWidth}% + ${dotWidth / 2}%)`,
              width: 2,
              height: 24,
              marginLeft: -1,
              background: accentColor,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 9,
          color: "var(--fintheon-muted)",
          fontFamily: "var(--font-mono)",
          opacity: 0.5,
          minHeight: 12,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {hoveredIndex != null
          ? formatTooltip(sortedCards[hoveredIndex])
          : dragging
            ? formatTooltip(sortedCards[playheadIndex])
            : `${sortedCards.length} headlines · drag to scrub`}
      </div>
    </div>
  );
});
