// [claude-code 2026-04-15] S18: Dash page — VIX ticker → Brief → Regime → Calendar, no Balance/P&L
import { motion, type Variants } from "framer-motion";
import { VixBadge } from "../shared/VixBadge";
import { BriefingCard } from "./BriefingCard";
import { MiniRegimeTracker } from "./MiniRegimeTracker";
import { MiniSessionCalendar } from "./MiniSessionCalendar";

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
          gap: 48,
          paddingBottom: 48,
        }}
      >
        {/* VIX Hero */}
        <motion.div variants={item}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 0 8px",
            }}
          >
            <VixBadge />
          </div>
          <div className="fade-divider" />
        </motion.div>

        {/* IV Scoring placeholder */}
        <motion.div variants={item}>
          <div
            style={{
              padding: 16,
              background: "var(--surface)",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.12em",
                color: "var(--text-disabled)",
              }}
            >
              [IV SCORING COMING SOON]
            </span>
          </div>
        </motion.div>

        {/* Brief */}
        <motion.div variants={item}>
          <BriefingCard />
        </motion.div>

        {/* Regime Tracker */}
        <motion.div variants={item}>
          <MiniRegimeTracker />
        </motion.div>

        {/* Economic Calendar */}
        <motion.div variants={item}>
          <MiniSessionCalendar />
        </motion.div>
      </motion.div>
    </div>
  );
}
