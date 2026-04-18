// [claude-code 2026-04-16] Circular radar sweep spinner — 8 pixelated segments, Nothing Design
import { motion } from "framer-motion";

interface RadarSpinnerProps {
  size?: number;
  color?: string;
}

const SEGMENT_COUNT = 8;
const ANGLE_STEP = 360 / SEGMENT_COUNT;

export function RadarSpinner({
  size = 22,
  color = "var(--black, #000)",
}: RadarSpinnerProps) {
  const r = size / 2;
  const segW = 3;
  const segH = r * 0.42;

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const angle = i * ANGLE_STEP;
        // Sweep effect: stagger opacity so leading segment is bright
        const opacity = 0.2 + (i / SEGMENT_COUNT) * 0.8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: r - segH,
              left: r - segW / 2,
              width: segW,
              height: segH,
              borderRadius: 1,
              background: color,
              opacity,
              transformOrigin: `${segW / 2}px ${segH}px`,
              transform: `rotate(${angle}deg) translateY(-${r * 0.15}px)`,
            }}
          />
        );
      })}
    </motion.div>
  );
}
