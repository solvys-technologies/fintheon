// [claude-code 2026-04-16] T7: Dash — snap pages, Risk Signals replaces Proposals, NarrativeFlow catalysts + timeline
// [claude-code 2026-04-17] Observe hero VIX visibility so toolbar VIX can fade in/out
import { lazy, Suspense, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { VixBadge } from "../shared/VixBadge";
import { BriefingCard } from "./BriefingCard";
import { AquariumSummary } from "./AquariumSummary";
import { InstrumentOutlookCards } from "./InstrumentOutlookCards";
import { MobileRiskSignalCards } from "./RiskSignalCards";
import { CatalystCards } from "./CatalystCards";
import { TimelineView } from "./TimelineView";
import { useIVScore } from "../../hooks/useIVScore";
import { useObserveHeroVixVisibility } from "../../hooks/useHeroVixVisible";

const EconCalendarEmbed = lazy(() =>
  import("../econ/EconCalendarEmbed").then((m) => ({
    default: m.EconCalendarEmbed,
  })),
);

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

/** IV sub-score horizontal fuse bars */
function IVSubScores({
  vix,
  headlines,
  miroshark,
}: {
  vix: number;
  headlines: number;
  miroshark: number;
}) {
  const bars = [
    { label: "VIX", value: vix },
    { label: "HEADLINE", value: headlines },
    { label: "AGENTIC DESK", value: miroshark },
  ];

  return (
    <div
      // [claude-code 2026-04-19] snap-anchor for SnapSheet: notifications + bulletin + brief
      // open up to the bottom of this fuse row, leaving tickers + fuses visible above.
      data-snap-anchor="fuses"
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 0 4px",
      }}
    >
      {bars.map(({ label, value }) => (
        <div key={label} style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 8,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 8,
                color: getScoreColor(value),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value.toFixed(1)}
            </span>
          </div>
          <div
            style={{
              height: 3,
              borderRadius: 1,
              background: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (value / 10) * 100)}%`,
                background: getScoreColor(value),
                borderRadius: 1,
                transition: "width 0.4s ease-out",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shared page wrapper — enforces scroll-snap alignment */
function SnapPage({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        minHeight: "100%",
        scrollSnapAlign: "start",
        padding: "0 16px",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function HomePage() {
  const {
    data: ivData,
    score,
    scaledPoints,
    isLoading: ivLoading,
  } = useIVScore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const heroVixRef = useRef<HTMLDivElement>(null);
  useObserveHeroVixVisibility(heroVixRef, scrollRef);

  return (
    <div
      ref={scrollRef}
      style={{
        position: "relative",
        height: "100%",
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Dot-matrix background layer */}
      <div
        className="dot-grid"
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.3,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Page 1: Hero Ticker + Briefing */}
      <SnapPage>
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
            position: "relative",
            zIndex: 1,
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
                ref={heroVixRef}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <VixBadge variant="hero" />
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
                  IMPLIED{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {ivData?.instrument?.replace("/", "") || ""}
                  </span>
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

            {/* IV Sub-Score Fuses */}
            {ivData && !ivLoading && (
              <IVSubScores
                vix={ivData.vixComponent ?? 0}
                headlines={ivData.headlineComponent ?? 0}
                miroshark={ivData.mirosharkComponent ?? 0}
              />
            )}
          </motion.div>

          {/* Briefing */}
          <motion.div variants={item} style={{ flex: 1 }}>
            <BriefingCard />
          </motion.div>
        </motion.div>
      </SnapPage>

      {/* Page 2: Econ Calendar + Aquarium Analysis
          [claude-code 2026-04-19] Calendar flex-grows to push Aquarium down to just-above-bottom
          per TP — no dead space between them, calendar ends exactly where Aquarium begins. */}
      <SnapPage style={{ padding: 0, gap: 0 }}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* TradingView Economic Calendar — takes every px the Aquarium doesn't */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <Suspense fallback={null}>
              <EconCalendarEmbed />
            </Suspense>
          </div>
          <div className="fade-divider" style={{ margin: "0 16px" }} />
          {/* Aquarium Analysis — sits flush at the bottom of the page */}
          <div style={{ padding: "16px 16px 24px", flexShrink: 0 }}>
            <AquariumSummary />
          </div>
        </div>
      </SnapPage>

      {/* Page 3: Instrument Outlook Cards */}
      <SnapPage>
        <div
          style={{
            flex: 1,
            paddingTop: 24,
            paddingBottom: 24,
            position: "relative",
            zIndex: 1,
          }}
        >
          <InstrumentOutlookCards />
        </div>
      </SnapPage>

      {/* Page 4: Risk Signals */}
      <SnapPage>
        <div
          style={{
            flex: 1,
            paddingTop: 24,
            paddingBottom: 24,
            overflowY: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <MobileRiskSignalCards />
        </div>
      </SnapPage>

      {/* Page 5: NarrativeFlow Catalysts */}
      <SnapPage>
        <div
          style={{
            flex: 1,
            paddingTop: 24,
            paddingBottom: 24,
            overflowY: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <CatalystCards />
        </div>
      </SnapPage>

      {/* Page 6: Timeline */}
      <SnapPage>
        <div
          style={{
            flex: 1,
            paddingTop: 24,
            paddingBottom: 64,
            overflowY: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <TimelineView />
        </div>
      </SnapPage>
    </div>
  );
}
