// [claude-code 2026-04-15] T4: Home page — vertical scroll with staggered fade-in sections
import { motion } from "framer-motion";
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

export function HomePage() {
  return (
    <div
      style={{
        padding: "0 16px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        paddingBottom: 32,
      }}
    >
      {sections.map((Section, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.05 }}
        >
          <Section />
        </motion.div>
      ))}
    </div>
  );
}
