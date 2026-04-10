// [claude-code 2026-04-01] Timeline split-screen overlay — slides over browser iframe, same width as Strategium
// Fetches from RiskFlow API directly (no NarrativeProvider dependency) — works from any tab
import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronRight, Clock, ChevronDown, Loader2 } from "lucide-react";
import { useBackend } from "../../lib/backend";
import { ivHeatColor } from "../../types/miroshark";

interface FeedItem {
  id: string;
  title: string;
  headline?: string;
  source: string;
  publishedAt: string;
  sentiment?: string;
  macroLevel?: number;
  riskType?: string;
  tags?: string[];
  narrativeThreads?: string[];
  ivScore?: number;
  priceBrainScore?: {
    sentiment?: string;
    impliedPoints?: number;
    instrument?: string;
  };
}

const NARRATIVE_THREADS = [
  { slug: "all", title: "All Headlines", color: "#c79f4a" },
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

// Keyword fallback for items that lack narrativeThreads — match headline/tags/riskType
const THREAD_KEYWORDS: Record<string, string[]> = {
  "middle-east-conflict": [
    "iran",
    "israel",
    "houthi",
    "gaza",
    "beirut",
    "hezbollah",
    "irgc",
    "middle east",
    "middle-east",
    "ceasefire",
    "missile",
    "strike",
  ],
  "liquidity-credit-contraction": [
    "liquidity",
    "credit",
    "spreads",
    "repo",
    "overnight",
    "funding",
    "cdx",
    "cds",
    "tightening",
    "bank stress",
  ],
  "ai-singularity": [
    "nvidia",
    "openai",
    "anthropic",
    "deepseek",
    "gpt",
    "gemini",
    "ai chip",
    "datacenter",
    "stargate",
    "inference",
    "singularity",
    "agi",
  ],
  "usd-jpy-carry-trade": [
    "jpy",
    "yen",
    "usd/jpy",
    "carry trade",
    "boj",
    "bank of japan",
    "ueda",
    "japan rate",
    "yen intervention",
  ],
  "trade-war": [
    "tariff",
    "trade war",
    "duties",
    "export control",
    "wto",
    "section 301",
    "reciprocal tariff",
  ],
  "us-china-relations": [
    "china",
    "beijing",
    "xi jinping",
    "pboc",
    "pla",
    "taiwan",
    "south china sea",
    "us-china",
    "decoupling",
  ],
  "rate-cut-cycle": [
    "fomc",
    "federal reserve",
    "rate cut",
    "rate hike",
    "fed funds",
    "powell",
    "basis points",
    "bps",
    "dovish",
    "hawkish",
    "qe",
    "qt",
  ],
  "trump-presidency": [
    "trump",
    "white house",
    "executive order",
    "doge",
    "musk doge",
    "potus",
    "administration",
    "oval office",
  ],
  "price-stability": [
    "cpi",
    "pce",
    "inflation",
    "deflation",
    "core inflation",
    "ppi",
    "supercore",
    "price index",
  ],
  "maximum-employment": [
    "nfp",
    "payrolls",
    "unemployment",
    "jobless claims",
    "jolts",
    "labor market",
    "jobs report",
    "hiring",
    "layoffs",
  ],
};

function itemMatchesThread(item: FeedItem, slug: string): boolean {
  // Primary: use narrativeThreads field if populated
  const threads = item.narrativeThreads ?? [];
  if (threads.length > 0) return threads.includes(slug);
  // Fallback: keyword match across headline, tags, and riskType
  const keywords = THREAD_KEYWORDS[slug];
  if (!keywords) return false;
  const haystack = [
    item.headline ?? item.title ?? "",
    ...(item.tags ?? []),
    item.riskType ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

const MACRO_COLOR: Record<number, string> = {
  4: "#EF4444",
  3: "#c79f4a",
  2: "#6B7280",
  1: "#4B5563",
};

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDate(items: FeedItem[]): [string, FeedItem[]][] {
  const map = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = (item.publishedAt ?? "").slice(0, 10) || "unknown";
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

interface TimelineOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function TimelineOverlay({ open, onClose }: TimelineOverlayProps) {
  const backend = useBackend();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeThread =
    NARRATIVE_THREADS.find((t) => t.slug === selectedThread) ??
    NARRATIVE_THREADS[0];

  // Fetch from RiskFlow API when overlay opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    backend.riskflow
      .list({ limit: 200, minMacroLevel: 1 })
      .then((res: any) => {
        setItems(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, backend]);

  const filteredItems = useMemo(() => {
    if (selectedThread === "all") return items;
    return items.filter((item) => itemMatchesThread(item, selectedThread));
  }, [items, selectedThread]);

  const dateGroups = useMemo(() => groupByDate(filteredItems), [filteredItems]);

  // Count items per thread — use keyword fallback so counts reflect actual matches
  const threadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const thread of NARRATIVE_THREADS) {
        if (thread.slug === "all") continue;
        if (itemMatchesThread(item, thread.slug)) {
          counts.set(thread.slug, (counts.get(thread.slug) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [items]);

  const handleThreadSelect = useCallback((slug: string) => {
    setSelectedThread(slug);
    setDropdownOpen(false);
  }, []);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}

      <div
        className={`fixed top-0 left-0 z-50 h-full w-[380px] flex flex-col bg-[var(--fintheon-bg)] border-r border-[var(--fintheon-accent)]/15 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2
              className="text-sm font-bold uppercase tracking-widest text-[var(--fintheon-accent)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Timeline
            </h2>
            <span
              className="text-[11px] text-[var(--fintheon-muted)]/40"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {filteredItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title="Close"
          >
            <ChevronRight className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
          </button>
        </div>

        {/* Narrative dropdown — z-10 ensures it stacks above the overflow-y-auto items list below */}
        <div className="shrink-0 px-4 py-2 border-b border-[var(--fintheon-accent)]/5 relative z-10">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] text-left transition-colors hover:border-[var(--fintheon-accent)]/25"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: activeThread.color }}
              />
              <span
                className="text-[12px] font-medium text-[var(--fintheon-text)]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {activeThread.title}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--fintheon-muted)]/40 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-4 right-4 top-full mt-1 z-50 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
              {NARRATIVE_THREADS.map((thread) => (
                <button
                  key={thread.slug}
                  onClick={() => handleThreadSelect(thread.slug)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-[12px] transition-colors ${
                    selectedThread === thread.slug
                      ? "bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-text)]"
                      : "text-[var(--fintheon-muted)]/60 hover:bg-[var(--fintheon-accent)]/3 hover:text-[var(--fintheon-text)]"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: thread.color }}
                  />
                  {thread.title}
                  {thread.slug !== "all" && (
                    <span
                      className="ml-auto text-[10px] text-[var(--fintheon-muted)]/30"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {threadCounts.get(thread.slug) ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--fintheon-accent)]" />
            </div>
          )}

          {!loading && dateGroups.length === 0 && (
            <p
              className="text-[13px] text-[var(--fintheon-muted)]/30 text-center py-12"
              style={{ fontFamily: "var(--font-body)" }}
            >
              No items in this timeline
            </p>
          )}

          {!loading &&
            dateGroups.map(([date, events]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: `${activeThread.color}80`,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {formatDate(date)}
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: `${activeThread.color}12` }}
                  />
                  <span
                    className="text-[9px] text-[var(--fintheon-muted)]/25"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {events.length}
                  </span>
                </div>

                <div className="space-y-1.5 ml-0.5">
                  {events.map((item) => {
                    const sentiment =
                      item.priceBrainScore?.sentiment?.toLowerCase() ??
                      item.sentiment ??
                      "bearish";
                    const isBullish = sentiment === "bullish";
                    const sevColor =
                      MACRO_COLOR[item.macroLevel ?? 2] ?? "#6B7280";
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg px-3 py-2.5 transition-colors hover:brightness-110"
                        style={{
                          border: `1px solid ${sevColor}35`,
                          backgroundColor: `${sevColor}04`,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <p
                            className="flex-1 text-[12px] font-medium leading-snug text-[var(--fintheon-text)]"
                            style={{ fontFamily: "var(--font-body)" }}
                          >
                            {item.title || item.headline}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.ivScore != null && (
                              <span
                                className="text-[9px] font-mono font-bold tabular-nums"
                                style={{
                                  color: ivHeatColor(Number(item.ivScore)),
                                }}
                              >
                                IV {Number(item.ivScore).toFixed(1)}
                              </span>
                            )}
                            <span
                              className="text-[11px] font-bold"
                              style={{
                                color: isBullish
                                  ? "var(--fintheon-bullish)"
                                  : "var(--fintheon-bearish)",
                              }}
                            >
                              {isBullish ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[8px] px-1.5 py-0.5 rounded"
                                style={{
                                  color: `${activeThread.color}80`,
                                  backgroundColor: `${activeThread.color}08`,
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-[9px] text-[var(--fintheon-muted)]/30"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {formatRelative(item.publishedAt)}
                          </span>
                          {item.source && (
                            <span
                              className="text-[8px] text-[var(--fintheon-muted)]/20"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {item.source}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

/** Compact toggle button — sits on the left edge, does not affect iframe sizing */
export function TimelineToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 rounded-r-lg border border-l-0 border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/90 backdrop-blur-sm px-2 py-3 text-[var(--fintheon-accent)]/60 transition-all hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
      title="Open Timeline"
    >
      <Clock className="w-3.5 h-3.5" />
    </button>
  );
}
