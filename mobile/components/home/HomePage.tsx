// [claude-code 2026-04-18] v5.22 S2 (post-S1 reconcile): AGENTIC DESK → AGENT DESK; hero
//   ticker labels aligned on one row (alignItems flex-start + lineHeight 1 on labels);
//   IVSubScores prop renamed miroshark → agentDesk. S1 fully renamed the IVScoreResponse
//   field too (mirosharkComponent → agentDeskComponent), so the call-site reads the new
//   name. Legacy `/api/miroshark/*` URLs still aliased on the backend.
// [claude-code 2026-04-19] Tighten page 1 padding (−25% above brief), give briefing card
//   more vertical room; page 2 calendar now owns real pixel height so no black gap above
//   Aquarium. Aquarium rendered in a compact glass sliver at bottom.
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
import { colorForScore } from "../../lib/fuse-palette";

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

/** [v5.22 S2] Delegates to the shared palette so user-preferences fusePalette overrides
 *  flow through here too once SettingsContext starts merging the remote contract. */
function getScoreColor(score: number): string {
  return colorForScore(score);
}

/** IV sub-score horizontal fuse bars */
function IVSubScores({
  vix,
  headlines,
  agentDesk,
}: {
  vix: number;
  headlines: number;
  agentDesk: number;
}) {
  const bars = [
    { label: "VIX", value: vix },
    { label: "HEADLINE", value: headlines },
    { label: "AGENT DESK", value: agentDesk },
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
              borderRadius: 2,
              background: "var(--fintheon-surface, #0a0a00)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (value / 10) * 100)}%`,
                background: getScoreColor(value),
                borderRadius: 2,
                transition: "width 0.4s ease-out",
              }}
            />
            <span className="nothing-fuse-shimmer" aria-hidden="true" />
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

      {/* Page 1: Hero Ticker + Briefing
          [claude-code 2026-04-19] TP: −25% top padding, briefing gets 25% more
          breathing room. Hero/brief gap halved from 24→18 to amplify brief. */}
      <SnapPage>
        <motion.div
          variants={container}
          initial="initial"
          animate="animate"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
            paddingBottom: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Hero Row: IV | VIX | Implied Points
              [claude-code 2026-04-18] v5.22 S2: anchor columns to top so the three
              labels (IV / VIX / IMPLIED) share one baseline. Center alignment used
              to push the shortest column (IV) off-row. */}
          <motion.div variants={item}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "15px 0 6px",
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
                    lineHeight: 1,
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
                    lineHeight: 1,
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
                agentDesk={ivData.agentDeskComponent ?? 0}
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
          [claude-code 2026-04-19] Calendar now fills remaining viewport minus Aquarium
          footprint via minHeight calc — embed iframe gets honest pixel height via
          ResizeObserver in EconCalendarEmbed, so no black gap. */}
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
          {/* TradingView Economic Calendar — fills every pixel above Aquarium */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <Suspense fallback={null}>
              <EconCalendarEmbed />
            </Suspense>
          </div>
          <div className="fade-divider" style={{ margin: "0 16px" }} />
          {/* Aquarium Analysis — compact sliver at the bottom */}
          <div style={{ padding: "12px 16px 16px", flexShrink: 0 }}>
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
