// [claude-code 2026-04-15] T8: Home page — dot-matrix bg, framer-motion variants stagger
import { motion, type Variants } from "framer-motion";
import { BriefingCard } from "./BriefingCard";
import { QuickStatsRow } from "./QuickStatsRow";
import { MiniRegimeTracker } from "./MiniRegimeTracker";
import { MiniSessionCalendar } from "./MiniSessionCalendar";

const sections = [
  BriefingCard,
  QuickStatsRow,
  MiniRegimeTracker,
  MiniSessionCalendar,
];

const container: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
};

export function HomePage() {
  return (
    <div style={{ position: "relative" }}>
      {/* Dot-matrix background layer */}
      <div
        className="dot-grid"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.3,
          pointerEvents: "none",
        }}
      />
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        style={{
          position: "relative",
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
          paddingBottom: 32,
        }}
      >
        {sections.map((Section, i) => (
          <motion.div key={i} variants={item}>
            <Section />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
