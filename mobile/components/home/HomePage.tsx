// [claude-code 2026-04-15] Dash page — scroll-lock pages: Hero+Brief+Calendar | Aquarium+Instruments | Agent Trades
import { motion, type Variants } from "framer-motion";
import { VixBadge } from "../shared/VixBadge";
import { BriefingCard } from "./BriefingCard";
import { MiniSessionCalendar } from "./MiniSessionCalendar";
import { AquariumSummary } from "./AquariumSummary";
import { InstrumentOutlookCards } from "./InstrumentOutlookCards";
import { AgentTradeCards } from "./AgentTradeCards";
import { useIVScore } from "../../hooks/useIVScore";

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

function getScoreColor(score: number): string {
  if (score >= 8) return "var(--error)";
  if (score >= 6) return "var(--warning)";
  if (score >= 4) return "var(--accent)";
  return "var(--success)";
}

export function HomePage() {
  const { score, scaledPoints, isLoading: ivLoading } = useIVScore();

  return (
    <div style={{ position: "relative", height: "100%" }}>
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

      {/* Scroll-lock container — snaps to each page */}
      <div
        style={{
          position: "relative",
          height: "100%",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
        }}
      >
        {/* Page 1: Hero Row + Briefing + Mini Calendar */}
        <div
          style={{
            minHeight: "100%",
            scrollSnapAlign: "start",
            padding: "0 16px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <motion.div
            variants={container}
            initial="initial"
            animate="animate"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              flex: 1,
              paddingBottom: 24,
            }}
          >
            {/* Hero Row: IV | VIX | Implied Points */}
            <motion.div variants={item}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 0 8px",
                  gap: 8,
                }}
              >
                {/* Left: IV Score */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                    }}
                  >
                    IV
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                      color: ivLoading
                        ? "var(--text-disabled)"
                        : getScoreColor(score),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {ivLoading ? "--" : score.toFixed(1)}
                  </span>
                </div>

                {/* Center: VIX */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <VixBadge />
                </div>

                {/* Right: Implied Points */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                    }}
                  >
                    IMPLIED
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                      color: ivLoading
                        ? "var(--text-disabled)"
                        : "var(--text-display)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {ivLoading
                      ? "--"
                      : `\u00B1${Math.abs(scaledPoints).toFixed(0)}`}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      color: "var(--text-disabled)",
                    }}
                  >
                    pts
                  </span>
                </div>
              </div>
              <div className="fade-divider" />
            </motion.div>

            {/* Briefing */}
            <motion.div variants={item}>
              <BriefingCard />
            </motion.div>

            {/* Mini Calendar — 3-row locked */}
            <motion.div variants={item}>
              <MiniSessionCalendar maxEvents={3} />
            </motion.div>
          </motion.div>
        </div>

        {/* Page 2: Aquarium Summary + Instrument Outlook */}
        <div
          style={{
            minHeight: "100%",
            scrollSnapAlign: "start",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <AquariumSummary />
          <div className="fade-divider" />
          <InstrumentOutlookCards />
        </div>

        {/* Page 3: Agent Trades / Predictions */}
        <div
          style={{
            minHeight: "100%",
            scrollSnapAlign: "start",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            paddingBottom: 64,
          }}
        >
          <AgentTradeCards />
        </div>
      </div>
    </div>
  );
}
