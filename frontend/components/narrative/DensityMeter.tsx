// [claude-code 2026-04-24] S36 ClusterBeam — 3-bar cards-per-hour sparkline for cluster headers.
// Splits the cluster's date span into 3 equal buckets and renders a tiny bar graph of how
// many cards landed in each. Tallest bucket anchors at full height; others scale relative.
import { memo, useMemo } from "react";
import type { CatalystCard } from "../../lib/narrative-types";

interface DensityMeterProps {
  cards: CatalystCard[];
  accentColor: string;
}

function bucketCards(cards: CatalystCard[]): [number, number, number] {
  const times = cards
    .map((c) => (c.date ? new Date(c.date).getTime() : NaN))
    .filter((t) => Number.isFinite(t)) as number[];
  if (times.length === 0) return [0, 0, 0];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  const step = span / 3;
  const buckets: [number, number, number] = [0, 0, 0];
  for (const t of times) {
    const idx = Math.min(2, Math.floor((t - min) / step));
    buckets[idx] += 1;
  }
  return buckets;
}

export const DensityMeter = memo(function DensityMeter({
  cards,
  accentColor,
}: DensityMeterProps) {
  const [a, b, c] = useMemo(() => bucketCards(cards), [cards]);
  const peak = Math.max(a, b, c, 1);

  const barStyle = (v: number): React.CSSProperties => ({
    width: 4,
    height: Math.max(2, Math.round((v / peak) * 10)),
    background: accentColor,
    opacity: v === 0 ? 0.15 : 0.75,
    borderRadius: 1,
  });

  return (
    <div
      aria-label={`cluster density ${a}-${b}-${c}`}
      style={{
        display: "flex",
        gap: 2,
        alignItems: "flex-end",
        height: 10,
        marginTop: 2,
      }}
    >
      <span style={barStyle(a)} />
      <span style={barStyle(b)} />
      <span style={barStyle(c)} />
    </div>
  );
});
