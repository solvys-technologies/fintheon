// [claude-code 2026-04-15] S19: Dash page — VIX hero → KPIs → Brief → Regime → Calendar
import { motion, type Variants } from "framer-motion";
import { VixBadge } from "../shared/VixBadge";
import { KPICard, KPIRow } from "../shared/KPICard";
import { BriefingCard } from "./BriefingCard";
import { MiniRegimeTracker } from "./MiniRegimeTracker";
import { MiniSessionCalendar } from "./MiniSessionCalendar";
import { useVixStore } from "../../hooks/useVixTicker";
import { useRegimeTracker } from "../../hooks/useRegimeTracker";
import { useBriefing } from "../../hooks/useBriefing";

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

function getRegimeLabel(activeRegimes: { id: string }[]): string {
  if (activeRegimes.length === 0) return "IDLE";
  const first = activeRegimes[0].id;
  if (first.includes("premarket")) return "PRE";
  if (first.includes("open") || first.includes("morning")) return "OPEN";
  if (first.includes("lunch")) return "LUNCH";
  if (first.includes("power")) return "POWER";
  if (first.includes("close") || first.includes("settle")) return "CLOSE";
  if (first.includes("after")) return "AH";
  return first.slice(0, 6).toUpperCase();
}

function getRegimeConfidence(activeRegimes: { id: string }[]): number {
  if (activeRegimes.length === 0) return 0;
  // Active regime = high confidence in current market phase
  return Math.min(100, activeRegimes.length * 60 + 40);
}

function getBriefLabel(briefType?: string): string {
  if (!briefType) return "NONE";
  const map: Record<string, string> = {
    MDB: "MDB",
    ADB: "ADB",
    PMDB: "PMDB",
    WT: "WT",
  };
  return map[briefType] ?? briefType.slice(0, 4).toUpperCase();
}

export function HomePage() {
  const { value: vixValue, isStale: vixStale } = useVixStore();
  const { activeRegimes } = useRegimeTracker();
  const { briefType, isLoading: briefLoading } = useBriefing();

  const vixBarValue = vixStale ? 0 : Math.min(100, (vixValue / 40) * 100);
  const vixBarColor =
    vixValue > 30
      ? "var(--error)"
      : vixValue > 20
        ? "var(--warning)"
        : "var(--accent)";

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

        {/* KPI Row */}
        <motion.div variants={item}>
          <KPIRow>
            <KPICard
              label="VIX"
              value={vixValue.toFixed(1)}
              barValue={vixBarValue}
              barColor={vixBarColor}
              stale={vixStale}
            />
            <KPICard
              label="REGIME"
              value={getRegimeLabel(activeRegimes)}
              barValue={getRegimeConfidence(activeRegimes)}
              barColor="var(--accent)"
              stale={activeRegimes.length === 0}
            />
            <KPICard
              label="BRIEF"
              value={briefLoading ? "..." : getBriefLabel(briefType)}
              stale={!briefType && !briefLoading}
            />
          </KPIRow>
          <div className="fade-divider" style={{ marginTop: 16 }} />
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
