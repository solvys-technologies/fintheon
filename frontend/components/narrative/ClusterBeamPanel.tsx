// [claude-code 2026-04-24] S36 ClusterBeam — right-docked panel that replaces inline cluster
// expansion. Borrows TimelineOverlay's translate-x init transition (300ms), leads with an AI
// summary, offers a drag-to-scrub timeline, and lists every headline in the cluster at full
// readable width. Flat surfaces per feedback_no_glass_effects.md — no backdrop-blur, no
// box-shadow, no gradient. Hover a card row → dispatches narrative:echo for canvas feedback.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { ivHeatColor } from "../../types/agent-desk";
import {
  SEVERITY_COLORS,
  deriveCyclicality,
  deriveIvScore,
  formatDateShort,
} from "../../lib/narrative-territory-layout";
import { useClusterBeam } from "../../contexts/ClusterBeamContext";
import { useClusterSummary } from "../../hooks/useClusterSummary";
import { ClusterScrubber } from "./ClusterScrubber";
import type { CatalystCard } from "../../lib/narrative-types";

function sentimentKey(
  card: CatalystCard,
): "bullish" | "bearish" | "neutral" {
  const raw = ((card as { sentiment?: string }).sentiment ?? "").toLowerCase();
  if (raw === "bullish") return "bullish";
  if (raw === "bearish") return "bearish";
  return "neutral";
}

function dispatchShock(detail: {
  fromNodeId: string;
  toSlug?: string;
  reverse?: boolean;
}) {
  window.dispatchEvent(new CustomEvent("narrative:shock", { detail }));
}

function dispatchEcho(cardId: string | null) {
  window.dispatchEvent(new CustomEvent("narrative:echo", { detail: { cardId } }));
}

export function ClusterBeamPanel() {
  const { active, close } = useClusterBeam();
  const open = active != null;
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const shockFiredForRef = useRef<string | null>(null);

  const sortedCards = useMemo(() => {
    if (!active) return [];
    return [...active.cards].sort((a, b) =>
      (a.date ?? "").localeCompare(b.date ?? ""),
    );
  }, [active]);

  const summaryCardsPayload = useMemo(
    () =>
      sortedCards.map((c) => ({
        id: c.id,
        title: c.title,
        sentiment: sentimentKey(c),
        severity: (c.severity ?? "low") as "low" | "medium" | "high",
        date: c.date,
        ivScore: deriveIvScore(c),
      })),
    [sortedCards],
  );

  const { summary, loading, error } = useClusterSummary({
    groupId: active?.groupId ?? null,
    cards: summaryCardsPayload,
    narrativeSlug: active?.narrativeSlug,
    narrativeTitle: active?.narrativeTitle ?? active?.label,
  });

  // Fire shock pulse once per open session when the panel becomes visible.
  useEffect(() => {
    if (!active) {
      shockFiredForRef.current = null;
      return;
    }
    if (shockFiredForRef.current === active.groupId) return;
    shockFiredForRef.current = active.groupId;
    // Defer one frame so React Flow has the edge node in the DOM.
    requestAnimationFrame(() => {
      dispatchShock({
        fromNodeId: active.clusterNodeId,
        toSlug: active.narrativeSlug,
      });
    });
  }, [active]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Scroll a specific card into view when the scrubber requests it.
  const scrollToCard = useCallback((cardId: string) => {
    const el = cardRefs.current.get(cardId);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const dateRange = useMemo(() => {
    if (sortedCards.length === 0) return "";
    const first = sortedCards[0].date;
    const last = sortedCards[sortedCards.length - 1].date;
    return `${formatDateShort(first)} → ${formatDateShort(last)}`;
  }, [sortedCards]);

  const avgIv = useMemo(() => {
    if (sortedCards.length === 0) return 0;
    const total = sortedCards.reduce((sum, c) => sum + deriveIvScore(c), 0);
    return total / sortedCards.length;
  }, [sortedCards]);

  const sentimentChip = useMemo(() => {
    if (!summary) return null;
    const color =
      summary.dominant_sentiment === "bullish"
        ? "#34D399"
        : summary.dominant_sentiment === "bearish"
          ? "#EF4444"
          : "#F59E0B";
    const pct = Math.round(summary.dominant_sentiment_confidence * 100);
    return { color, pct };
  }, [summary]);

  const accent = active?.narrativeColor ?? "#c79f4a";

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={close}
          className="fixed inset-0 z-40"
          style={{ background: "transparent" }}
        />
      )}
      <div
        role="dialog"
        aria-label="Cluster beam"
        className={`fixed top-0 right-0 z-50 h-full w-[420px] flex flex-col bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-accent)]/15 transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {active && (
          <>
            <div
              className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/10"
              style={{ gap: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: accent,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h2
                    className="text-sm font-bold uppercase tracking-widest text-[var(--fintheon-accent)]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {active.label}
                  </h2>
                  <span
                    className="text-[10px]"
                    style={{
                      color: "var(--fintheon-muted)",
                      fontFamily: "var(--font-mono)",
                      opacity: 0.5,
                    }}
                  >
                    {sortedCards.length} items · {dateRange} · avg IV{" "}
                    {avgIv.toFixed(1)}
                  </span>
                </div>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
                title="Close (Esc)"
                aria-label="Close cluster panel"
              >
                <ChevronRight className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
              </button>
            </div>

            <div className="shrink-0 px-4 py-3 border-b border-[var(--fintheon-accent)]/5">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{
                  color: "var(--fintheon-accent)",
                  opacity: 0.7,
                  fontFamily: "var(--font-heading)",
                }}
              >
                AI Summary
              </div>
              {loading && !summary && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      height: 14,
                      width: "90%",
                      background: "var(--fintheon-surface)",
                      borderRadius: 3,
                      opacity: 0.4,
                    }}
                  />
                  <div
                    style={{
                      height: 10,
                      width: "80%",
                      background: "var(--fintheon-surface)",
                      borderRadius: 3,
                      opacity: 0.3,
                    }}
                  />
                  <div
                    style={{
                      height: 10,
                      width: "70%",
                      background: "var(--fintheon-surface)",
                      borderRadius: 3,
                      opacity: 0.3,
                    }}
                  />
                </div>
              )}
              {error && !summary && (
                <p
                  className="text-[12px]"
                  style={{
                    color: "var(--fintheon-muted)",
                    fontFamily: "var(--font-body)",
                    opacity: 0.6,
                  }}
                >
                  Summary unavailable — {error}
                </p>
              )}
              {summary && (
                <>
                  <p
                    className="text-[13px] leading-snug"
                    style={{
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {summary.one_liner}
                  </p>
                  {summary.bullets.length > 0 && (
                    <ul
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        paddingLeft: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {summary.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="text-[12px] leading-snug"
                          style={{
                            color: "var(--fintheon-text)",
                            fontFamily: "var(--font-body)",
                            opacity: 0.85,
                          }}
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {sentimentChip && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: sentimentChip.color,
                          background: `${sentimentChip.color}15`,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {summary.dominant_sentiment} {sentimentChip.pct}%
                      </span>
                    )}
                    {summary.notable_tickers.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: accent,
                          background: `${accent}10`,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    {summary.cached && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--fintheon-muted)",
                          fontFamily: "var(--font-mono)",
                          opacity: 0.4,
                          marginLeft: "auto",
                        }}
                      >
                        CACHED
                      </span>
                    )}
                    {loading && summary && (
                      <Loader2
                        className="w-3 h-3 animate-spin text-[var(--fintheon-accent)]/40"
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 border-b border-[var(--fintheon-accent)]/5">
              <ClusterScrubber
                cards={sortedCards}
                onScrub={scrollToCard}
                accentColor={accent}
              />
            </div>

            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              {sortedCards.map((card) => {
                const sentiment = sentimentKey(card);
                const sevColor = SEVERITY_COLORS[card.severity ?? "low"];
                const sentColor =
                  sentiment === "bullish"
                    ? "var(--fintheon-bullish)"
                    : sentiment === "bearish"
                      ? "var(--fintheon-bearish)"
                      : "var(--fintheon-muted)";
                const iv = deriveIvScore(card);
                const cyclicality = deriveCyclicality(card);
                const cyclical = cyclicality === "cyclical";
                return (
                  <div
                    key={card.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(card.id, el);
                      else cardRefs.current.delete(card.id);
                    }}
                    onMouseEnter={() => dispatchEcho(card.id)}
                    onMouseLeave={() => dispatchEcho(null)}
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${sevColor}40`,
                      background: `${sevColor}08`,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.35,
                          color: "var(--fintheon-text)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {card.title}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 12,
                          fontWeight: 800,
                          color: sentColor,
                        }}
                      >
                        {sentiment === "bullish"
                          ? "▲"
                          : sentiment === "bearish"
                            ? "▼"
                            : "—"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: ivHeatColor(iv),
                          background: `${ivHeatColor(iv)}14`,
                          padding: "2px 6px",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        IV {iv.toFixed(1)}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: sentColor,
                          background:
                            sentiment === "bullish"
                              ? "#34D39912"
                              : sentiment === "bearish"
                                ? "#EF444412"
                                : "#6B728012",
                          padding: "2px 6px",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {sentiment}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          color: cyclical ? "#3B82F6" : "#EC4899",
                          background: cyclical ? "#3B82F612" : "#EC489912",
                          padding: "2px 6px",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {cyclicality}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 9,
                          color: "var(--fintheon-muted)",
                          fontFamily: "var(--font-mono)",
                          opacity: 0.55,
                        }}
                      >
                        {formatDateShort(card.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {sortedCards.length === 0 && (
                <p
                  className="text-[12px] text-center py-8"
                  style={{
                    color: "var(--fintheon-muted)",
                    fontFamily: "var(--font-body)",
                    opacity: 0.4,
                  }}
                >
                  No cards in this cluster.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
