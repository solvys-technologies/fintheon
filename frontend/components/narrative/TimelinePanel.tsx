// [claude-code 2026-03-30] Full-border severity, bigger fonts, smooth transitions, wider tag filter w/ search, auto-purge banned tags
// [claude-code 2026-03-29] Add severity filter (default: Critical & High) + fix empty timeline
// [claude-code 2026-03-28] S7: Paginated 2-column narrative timeline — structured view of NarrativeFlow
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  X,
  Clock,
} from "lucide-react";
import { useNarrative } from "../../contexts/NarrativeContext";
import type {
  CatalystCard,
  NarrativeCategory,
} from "../../lib/narrative-types";

// The 10 real narrative threads (must match migration 027)
const NARRATIVE_THREADS = [
  {
    slug: "middle-east-conflict",
    title: "Middle Eastern Conflict",
    color: "#F59E0B",
  },
  {
    slug: "liquidity-credit-contraction",
    title: "Liquidity & Credit",
    color: "#8B5CF6",
  },
  { slug: "ai-singularity", title: "The Singularity", color: "#3B82F6" },
  {
    slug: "usd-jpy-carry-trade",
    title: "USD-JPY Carry Trade",
    color: "#EC4899",
  },
  { slug: "trade-war", title: "Trade War", color: "#EF4444" },
  { slug: "us-china-relations", title: "US-China Relations", color: "#14B8A6" },
  { slug: "rate-cut-cycle", title: "Rate Cut Cycle", color: "#34D399" },
  { slug: "trump-presidency", title: "Trump Presidency", color: "#F97316" },
  { slug: "price-stability", title: "Price Stability", color: "#FBBF24" },
  { slug: "maximum-employment", title: "Max Employment", color: "#A78BFA" },
] as const;

const COLS_PER_PAGE = 2;
const TOTAL_PAGES = Math.ceil(NARRATIVE_THREADS.length / COLS_PER_PAGE);

const SEVERITY_COLOR: Record<string, string> = {
  high: "#EF4444",
  medium: "#c79f4a",
  low: "#6B7280",
};

// Tags that indicate non-market noise — catalysts with ONLY these tags get auto-purged
const BANNED_TAGS = new Set([
  "social",
  "media",
  "browser",
  "platform",
  "spam",
  "bot",
  "advertisement",
  "ad",
  "promo",
  "clickbait",
]);

const TIME_RANGES = [
  { key: "1h", label: "1H" },
  { key: "4h", label: "4H" },
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "all", label: "ALL" },
] as const;

function getTimeRangeCutoff(range: string): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const ms: Record<string, number> = {
    "1h": 3600000,
    "4h": 14400000,
    "1d": 86400000,
    "1w": 604800000,
  };
  return new Date(now.getTime() - (ms[range] ?? 0));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

// Group cards by date for a column
function groupByDate(cards: CatalystCard[]): [string, CatalystCard[]][] {
  const map = new Map<string, CatalystCard[]>();
  for (const c of cards) {
    const key = c.date?.slice(0, 10) ?? "unknown";
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

// Check if a catalyst has ONLY banned tags (no legitimate tags)
function isBannedCatalyst(c: CatalystCard): boolean {
  const tags = c.tags ?? [];
  if (tags.length === 0) return false;
  return tags.every((t) => BANNED_TAGS.has(t.toLowerCase()));
}

export function TimelinePanel() {
  const { state, dispatch } = useNarrative();
  const [pageIndex, setPageIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">(
    "right",
  );
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  // Default to Critical & High only
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(
    new Set(["high"]),
  );
  const [timeRange, setTimeRange] = useState<string>("all");
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const purgedRef = useRef(false);

  // Auto-purge catalysts with banned tags on first load
  useEffect(() => {
    if (purgedRef.current) return;
    purgedRef.current = true;
    const banned = state.catalysts.filter(isBannedCatalyst);
    for (const c of banned) {
      dispatch({ type: "REMOVE_CATALYST", id: c.id });
    }
  }, [state.catalysts, dispatch]);

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setTagFilterOpen(false);
        setTagSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagFilterOpen]);

  // Filter out banned catalysts from display
  const cleanCatalysts = useMemo(
    () => state.catalysts.filter((c) => !isBannedCatalyst(c)),
    [state.catalysts],
  );

  // Current 2 narratives to display
  const visibleThreads = useMemo(() => {
    const start = pageIndex * COLS_PER_PAGE;
    return NARRATIVE_THREADS.slice(start, start + COLS_PER_PAGE);
  }, [pageIndex]);

  // All unique tags from catalysts (excluding banned)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of cleanCatalysts) {
      for (const t of c.tags ?? []) {
        if (!BANNED_TAGS.has(t.toLowerCase())) set.add(t);
      }
    }
    return [...set].sort();
  }, [cleanCatalysts]);

  // Filtered tags for search
  const filteredTags = useMemo(() => {
    if (!tagSearch) return allTags;
    const q = tagSearch.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, tagSearch]);

  // Cards grouped by narrative thread
  const cardsByThread = useMemo(() => {
    const map = new Map<string, CatalystCard[]>();
    const cutoff = getTimeRangeCutoff(timeRange);
    for (const thread of NARRATIVE_THREADS) {
      const cards = cleanCatalysts.filter((c) => {
        const threads =
          c.narrativeThreads ?? (c.narrative ? [c.narrative] : []);
        if (!threads.includes(thread.slug)) return false;
        if (activeTagFilter && !(c.tags ?? []).includes(activeTagFilter))
          return false;
        // Severity filter (empty set = show all)
        if (severityFilter.size > 0 && !severityFilter.has(c.severity))
          return false;
        // Time range filter
        if (cutoff && c.date) {
          const cardDate = new Date(c.date + "T23:59:59");
          if (cardDate < cutoff) return false;
        }
        return true;
      });
      map.set(
        thread.slug,
        cards.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      );
    }
    return map;
  }, [cleanCatalysts, activeTagFilter, severityFilter, timeRange]);

  // Total catalyst count across all threads (live)
  const totalCatalysts = cleanCatalysts.length;

  // Find cross-column connections (cards that appear in both visible threads)
  const crossConnections = useMemo(() => {
    if (visibleThreads.length < 2) return [];
    const leftCards = cardsByThread.get(visibleThreads[0].slug) ?? [];
    const rightIds = new Set(
      (cardsByThread.get(visibleThreads[1].slug) ?? []).map((c) => c.id),
    );
    return leftCards
      .filter((c) => {
        const threads = c.narrativeThreads ?? [];
        return threads.includes(visibleThreads[1].slug);
      })
      .map((c) => ({
        id: c.id,
        title: c.title,
        existsInRight: rightIds.has(c.id),
      }));
  }, [visibleThreads, cardsByThread]);

  const changePage = useCallback(
    (direction: "left" | "right", newIndex: number) => {
      setSlideDirection(direction);
      setTransitioning(true);
      setTimeout(() => {
        setPageIndex(newIndex);
        setTransitioning(false);
      }, 200);
    },
    [],
  );

  const handlePrev = useCallback(() => {
    if (pageIndex > 0) changePage("right", pageIndex - 1);
  }, [pageIndex, changePage]);

  const handleNext = useCallback(() => {
    if (pageIndex < TOTAL_PAGES - 1) changePage("left", pageIndex + 1);
  }, [pageIndex, changePage]);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header with navigation */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/10">
        <div>
          <div className="flex items-baseline gap-3">
            <h2
              className="text-xl font-bold text-[var(--fintheon-accent)] uppercase tracking-widest"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Timeline
            </h2>
            <div
              className="flex items-baseline gap-1.5 text-[15px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="shimmer-number font-bold">{totalCatalysts}</span>
              <span className="text-[var(--fintheon-muted)]/50 text-[13px]">
                catalysts
              </span>
              <span className="text-[var(--fintheon-muted)]/20 mx-0.5">
                &middot;
              </span>
              <span className="shimmer-number font-bold">
                {NARRATIVE_THREADS.length}
              </span>
              <span className="text-[var(--fintheon-muted)]/50 text-[13px]">
                narratives
              </span>
            </div>
          </div>
          <p
            className="text-[13px] text-[var(--fintheon-muted)]/40 mt-0.5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Structured Narrative View
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Severity filter pills — bigger, theme-sensitive */}
          <div className="flex items-center gap-1.5">
            {(["high", "medium", "low"] as const).map((sev) => {
              const active = severityFilter.has(sev);
              const label =
                sev === "high"
                  ? "Critical & High"
                  : sev === "medium"
                    ? "Medium"
                    : "Low";
              const dotColor = SEVERITY_COLOR[sev];
              return (
                <button
                  key={sev}
                  onClick={() =>
                    setSeverityFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(sev)) {
                        next.delete(sev);
                      } else {
                        next.add(sev);
                      }
                      return next;
                    })
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-wider transition-all duration-200 ${
                    active
                      ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-text)]/90 bg-[var(--fintheon-accent)]/5"
                      : "border-[var(--fintheon-accent)]/8 text-[var(--fintheon-muted)]/30 hover:text-[var(--fintheon-muted)]/60"
                  }`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <span
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{
                      backgroundColor: active ? dotColor : `${dotColor}40`,
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Time range pills */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--fintheon-muted)]/30 mr-0.5" />
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => setTimeRange(tr.key)}
                className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-all duration-200 ${
                  timeRange === tr.key
                    ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8 border border-[var(--fintheon-accent)]/20"
                    : "text-[var(--fintheon-muted)]/30 hover:text-[var(--fintheon-muted)]/60 border border-transparent"
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Tag filter — wider dropdown with search */}
          <div className="relative" ref={tagDropdownRef}>
            <button
              onClick={() => {
                setTagFilterOpen((v) => !v);
                setTagSearch("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                activeTagFilter
                  ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20"
                  : "text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]/70 border border-transparent"
              }`}
              style={{ fontFamily: "var(--font-body)" }}
            >
              <Filter className="w-3.5 h-3.5" />
              {activeTagFilter ? `#${activeTagFilter}` : "Filter Tags"}
              {activeTagFilter && (
                <X
                  className="w-3 h-3 ml-1 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTagFilter(null);
                  }}
                />
              )}
            </button>
            {tagFilterOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 z-50 w-72 rounded-xl border bg-[var(--fintheon-bg)] shadow-2xl overflow-hidden"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                }}
              >
                {/* Search bar inside dropdown */}
                <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fintheon-muted)]/40"
                    />
                    <input
                      type="text"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Search tags..."
                      autoFocus
                      className="w-full rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]/40 py-1.5 pl-8 pr-3 text-[12px] text-[var(--fintheon-text)] placeholder-[var(--fintheon-muted)]/30 outline-none focus:border-[var(--fintheon-accent)]/30"
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  <button
                    onClick={() => {
                      setActiveTagFilter(null);
                      setTagFilterOpen(false);
                      setTagSearch("");
                    }}
                    className={`w-full text-left px-4 py-2 text-[12px] transition-colors ${!activeTagFilter ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5" : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/3"}`}
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    All tags
                  </button>
                  {filteredTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setActiveTagFilter(tag);
                        setTagFilterOpen(false);
                        setTagSearch("");
                      }}
                      className={`w-full text-left px-4 py-2 text-[12px] transition-colors ${activeTagFilter === tag ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5" : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/3"}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      #{tag}
                    </button>
                  ))}
                  {filteredTags.length === 0 && (
                    <p className="px-4 py-3 text-[11px] text-[var(--fintheon-muted)]/30 text-center">
                      No matching tags
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className="p-1.5 rounded transition-colors hover:bg-[var(--fintheon-accent)]/5 disabled:opacity-20"
              style={{ color: "var(--fintheon-accent)" }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span
              className="text-[11px] text-[var(--fintheon-muted)]/50 min-w-[44px] text-center"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {pageIndex + 1}/{TOTAL_PAGES}
            </span>
            <button
              onClick={handleNext}
              disabled={pageIndex >= TOTAL_PAGES - 1}
              className="p-1.5 rounded transition-colors hover:bg-[var(--fintheon-accent)]/5 disabled:opacity-20"
              style={{ color: "var(--fintheon-accent)" }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column narrative view with slide transition */}
      <div
        className="flex-1 min-h-0 flex gap-0 overflow-hidden transition-all duration-200 ease-out"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning
            ? `translateX(${slideDirection === "left" ? "-20px" : "20px"})`
            : "translateX(0)",
        }}
      >
        {visibleThreads.map((thread) => {
          const cards = cardsByThread.get(thread.slug) ?? [];
          const dateGroups = groupByDate(cards);
          return (
            <div
              key={thread.slug}
              className="flex-1 min-w-0 flex flex-col border-r last:border-r-0 overflow-hidden"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--fintheon-border) 10%, transparent)",
              }}
            >
              {/* Column header */}
              <div
                className="shrink-0 px-4 py-3 border-b"
                style={{ borderColor: `${thread.color}20` }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: thread.color }}
                  />
                  <h3
                    className="text-[14px] font-bold uppercase tracking-wider"
                    style={{
                      color: thread.color,
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {thread.title}
                  </h3>
                </div>
                <p
                  className="text-[11px] mt-0.5 opacity-50"
                  style={{
                    color: "var(--fintheon-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {cards.length} catalysts
                </p>
              </div>

              {/* Cards chronologically */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                {dateGroups.length === 0 && (
                  <p
                    className="text-[13px] text-[var(--fintheon-muted)]/30 text-center py-8"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    No catalysts in this narrative
                  </p>
                )}

                {dateGroups.map(([date, events]) => (
                  <div key={date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          color: `${thread.color}70`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {formatDate(date)}
                      </span>
                      <div
                        className="flex-1 h-px"
                        style={{ backgroundColor: `${thread.color}15` }}
                      />
                    </div>

                    {/* Event cards — smooth appear/disappear */}
                    <div className="space-y-2 ml-1">
                      {events.map((event, idx) => {
                        const isBullish = event.sentiment === "bullish";
                        const isNeutral =
                          (event.sentiment as string) === "neutral";
                        const isMultiNarrative =
                          (event.narrativeThreads ?? []).length > 1;
                        const sevColor =
                          SEVERITY_COLOR[event.severity] ?? "#6B7280";
                        return (
                          <div
                            key={event.id}
                            className="rounded-lg px-4 py-3 transition-all duration-300 ease-out hover:brightness-110"
                            style={{
                              border: `1.5px solid ${sevColor}50`,
                              backgroundColor: `${sevColor}06`,
                              animation: `card-fade-in 0.3s ease-out ${idx * 40}ms both`,
                            }}
                          >
                            {/* Title + sentiment */}
                            <div className="flex items-start gap-2">
                              <p
                                className="flex-1 text-[14px] font-semibold leading-snug"
                                style={{
                                  color: "var(--fintheon-text)",
                                  fontFamily: "var(--font-body)",
                                }}
                              >
                                {event.title}
                              </p>
                              <span
                                className="text-[13px] font-bold shrink-0"
                                style={{
                                  color: isBullish
                                    ? "var(--fintheon-bullish)"
                                    : isNeutral
                                      ? "var(--fintheon-muted)"
                                      : "var(--fintheon-bearish)",
                                }}
                              >
                                {isBullish ? "▲" : isNeutral ? "—" : "▼"}
                              </span>
                            </div>

                            {/* Description */}
                            {event.description && (
                              <p
                                className="text-[12px] mt-1 line-clamp-2 opacity-55 leading-relaxed"
                                style={{
                                  color: "var(--fintheon-muted)",
                                  fontFamily: "var(--font-body)",
                                }}
                              >
                                {event.description}
                              </p>
                            )}

                            {/* Tags */}
                            {event.tags && event.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {event.tags.slice(0, 4).map((t) => (
                                  <span
                                    key={t}
                                    className="text-[9px] px-1.5 py-0.5 rounded"
                                    style={{
                                      color: `${thread.color}90`,
                                      backgroundColor: `${thread.color}10`,
                                      fontFamily: "var(--font-mono)",
                                    }}
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Multi-narrative indicator (rope connection) */}
                            {isMultiNarrative && (
                              <div
                                className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t"
                                style={{ borderColor: "#c79f4a15" }}
                              >
                                <div
                                  className="w-8 h-px"
                                  style={{ backgroundColor: "#c79f4a40" }}
                                />
                                <span
                                  className="text-[9px] italic"
                                  style={{
                                    color: "#c79f4a60",
                                    fontFamily: "var(--font-body)",
                                  }}
                                >
                                  also in:{" "}
                                  {(event.narrativeThreads ?? [])
                                    .filter((s) => s !== thread.slug)
                                    .map(
                                      (s) =>
                                        NARRATIVE_THREADS.find(
                                          (t) => t.slug === s,
                                        )?.title ?? s,
                                    )
                                    .join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-column connections indicator */}
      {crossConnections.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-[var(--fintheon-border)]/10 flex items-center gap-2">
          <div className="w-6 h-px bg-[var(--fintheon-accent)]/30" />
          <span
            className="text-[9px] text-[var(--fintheon-accent)]/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {crossConnections.length} shared catalysts between these narratives
          </span>
        </div>
      )}

      {/* Card animation keyframes */}
      <style>{`
        @keyframes card-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
