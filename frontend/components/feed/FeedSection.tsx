import { useState, useEffect, useCallback } from "react";
import { FileText, Trash2 } from "@/components/shared/iso-icons";
import { FeedItem as FeedItemType, IVIndicator } from "../../types/feed";
import { useBackend } from "../../lib/backend";
import type { RiskFlowItem } from "../../types/api";
import { FeedItem } from "./FeedItem";
import { MDBReportModal } from "../MDBReportModal";
import { useSettings } from "../../contexts/SettingsContext";
import {
  generateInitialFeed,
  generateMockFeedItem,
} from "../../utils/mockDataGenerator";
import { useRiskFlowSSE } from "../../hooks/useRiskFlow";

// Convert RiskFlowItem to FeedItem format
// Filters out raw/unprocessed data and ensures only interpreted messages are shown
function convertRiskFlowToFeedItem(
  riskflowItem: RiskFlowItem,
): FeedItemType | null {
  const title = riskflowItem.title || "";
  const content = riskflowItem.content || "";

  // [claude-code 2026-03-23] Browser Use Phase 2 — proposal items from Hermes
  if (riskflowItem.source === "Hermes" && riskflowItem.proposal) {
    return {
      id: riskflowItem.id.toString(),
      time:
        typeof riskflowItem.publishedAt === "string"
          ? new Date(riskflowItem.publishedAt)
          : riskflowItem.publishedAt,
      text:
        title ||
        `${riskflowItem.proposal.direction.toUpperCase()} ${riskflowItem.proposal.ticker}`,
      source: "Hermes",
      type: "proposal" as const,
      iv: {
        value: 8,
        type: "Neutral" as const,
        classification: "Neutral" as const,
      },
      proposal: {
        ...riskflowItem.proposal,
        takeProfit: Array.isArray(riskflowItem.proposal.takeProfit)
          ? riskflowItem.proposal.takeProfit
          : [riskflowItem.proposal.takeProfit],
      },
    };
  }

  // Filter out items that look like raw system logs or unprocessed data
  // Skip items that look like raw API responses or system logs
  const rawDataPatterns = [
    /^\[.*\]/, // Items starting with brackets like [Error], [API], etc.
    /API.*error/i,
    /Failed to fetch/i,
    /Error fetching/i,
    /undefined|null/i,
    /^[A-Z_]+$/, // All caps with underscores (like ERROR_CODE)
  ];

  const isRawData = rawDataPatterns.some(
    (pattern) => pattern.test(title) || pattern.test(content),
  );

  // Skip items that are too short or look like technical logs
  if (
    isRawData ||
    title.length < 10 ||
    title.includes("undefined") ||
    title.includes("null")
  ) {
    return null; // Filter out this item
  }

  // Ensure ivScore is always a valid number first
  const ivScoreValue =
    typeof riskflowItem.ivScore === "number"
      ? riskflowItem.ivScore
      : riskflowItem.ivScore != null
        ? Number(riskflowItem.ivScore)
        : 0;
  const safeIvScore = isNaN(ivScoreValue) ? 0 : ivScoreValue;

  // Determine IV type based on sentiment from Logic Matrix (database)
  // Use sentiment from database if available, otherwise fall back to keyword analysis
  let ivType: "Bullish" | "Bearish" | "Neutral" = "Neutral";

  if (riskflowItem.sentiment) {
    // Use sentiment from Logic Matrix interpretation
    if (riskflowItem.sentiment === "bullish") ivType = "Bullish";
    else if (riskflowItem.sentiment === "bearish") ivType = "Bearish";
  } else if (safeIvScore >= 6) {
    // Fallback: High volatility - check title for sentiment keywords
    const titleLower = title.toLowerCase();
    const bullishKeywords = [
      "surge",
      "rally",
      "soar",
      "jump",
      "gain",
      "rise",
      "upgrade",
      "beats",
      "record high",
      "increase",
      "beat",
    ];
    const bearishKeywords = [
      "crash",
      "plunge",
      "fall",
      "drop",
      "tumble",
      "decline",
      "downgrade",
      "miss",
      "record low",
      "decrease",
      "missed",
    ];

    const isBullish = bullishKeywords.some((kw) => titleLower.includes(kw));
    const isBearish = bearishKeywords.some((kw) => titleLower.includes(kw));

    if (isBullish && !isBearish) ivType = "Bullish";
    else if (isBearish && !isBullish) ivType = "Bearish";
  }

  // Determine classification based on category
  let classification: "Cyclical" | "Countercyclical" | "Neutral" = "Neutral";
  const category = riskflowItem.category || "".toLowerCase();
  if (
    category.includes("fed") ||
    category.includes("economic") ||
    category.includes("political") ||
    category.includes("geopolitical")
  ) {
    classification = "Countercyclical";
  } else if (
    category.includes("earning") ||
    category.includes("corporate") ||
    category.includes("technical")
  ) {
    classification = "Cyclical";
  }

  const iv: IVIndicator = {
    value: safeIvScore,
    type: ivType,
    classification: classification,
  };

  return {
    id: riskflowItem.id.toString(),
    time:
      typeof riskflowItem.publishedAt === "string"
        ? new Date(riskflowItem.publishedAt)
        : riskflowItem.publishedAt,
    text: title, // Use interpreted title (already processed by Logic Matrix)
    source: riskflowItem.source,
    type: "news",
    iv: iv,
  };
}

export function FeedSection() {
  const backend = useBackend();
  const { mockDataEnabled } = useSettings();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([]);
  const [showMDBModal, setShowMDBModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeNews = async () => {
      try {
        if (mockDataEnabled) {
          // Use mock data when enabled
          const mockItems = generateInitialFeed(20);
          setFeedItems(mockItems);
        } else {
          // Fetch RiskFlow items from the database (pre-fetched by cron job)
          // The cron job runs every 5 minutes to fetch and classify events,
          // so we don't need to trigger API calls here - just load from DB
          // Try with minMacroLevel 1 first to see all items, then fall back to default (3+)
          let response = await backend.riskflow.list({
            limit: 50,
            minMacroLevel: 1,
          });
          if (response.items.length === 0) {
            // If still empty, try default (level 3+)
            response = await backend.riskflow.list({ limit: 50 });
          }
          // Filter out null items (raw/unprocessed data)
          const convertedItems = response.items
            .map((item: RiskFlowItem) => convertRiskFlowToFeedItem(item))
            .filter((item): item is FeedItemType => item !== null);
          setFeedItems(convertedItems);
        }
      } catch (err) {
        console.warn("Failed to fetch RiskFlow:", err);
        // Fallback to mock data on error if enabled
        if (mockDataEnabled) {
          setFeedItems(generateInitialFeed(20));
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchNews = async () => {
      try {
        if (mockDataEnabled) {
          // Add new mock item periodically
          const newItem = generateMockFeedItem();
          setFeedItems((prev) => [newItem, ...prev].slice(0, 50));
        } else {
          // Try with minMacroLevel 1 first to see all items, then fall back to default (3+)
          let response = await backend.riskflow.list({
            limit: 50,
            minMacroLevel: 1,
          });
          if (response.items.length === 0) {
            // If still empty, try default (level 3+)
            response = await backend.riskflow.list({ limit: 50 });
          }
          // Filter out null items (raw/unprocessed data)
          const convertedItems = response.items
            .map((item: RiskFlowItem) => convertRiskFlowToFeedItem(item))
            .filter((item): item is FeedItemType => item !== null);
          setFeedItems(convertedItems);
        }
      } catch (err) {
        console.warn("Failed to fetch RiskFlow:", err);
      }
    };

    // Initialize on mount (load from database or mock data)
    initializeNews();

    // Then fetch every 15 seconds (just refresh the list, don't sync every time)
    const interval = setInterval(() => {
      fetchNews();
    }, 15000);

    return () => clearInterval(interval);
  }, [backend, mockDataEnabled]);

  const handleBreakingNews = useCallback((item: RiskFlowItem) => {
    const converted = convertRiskFlowToFeedItem(item);
    if (!converted) return;
    setFeedItems((prev) => [converted, ...prev].slice(0, 50));
  }, []);

  useRiskFlowSSE(handleBreakingNews);

  const handleClear = () => {
    if (confirm("Clear all tape items?")) {
      setFeedItems([]);
    }
  };

  return (
    <>
      {showMDBModal && (
        <MDBReportModal onClose={() => setShowMDBModal(false)} />
      )}

      <div className="h-full flex flex-col">
        {/* Inline CTAs */}
        <div className="flex items-center justify-end gap-2 px-5 pt-4 pb-2">
          <button
            onClick={() => setShowMDBModal(true)}
            className="px-3 py-1 hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] rounded text-[10px] font-medium tracking-[0.18em] uppercase transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3 h-3" />
            MDB Report
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 hover:bg-white/5 text-zinc-400 rounded text-[10px] font-medium tracking-[0.18em] uppercase transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>

        {/* Feed Items */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="space-y-2">
            {loading ? (
              <div className="text-center text-gray-500 py-12">
                <p>Loading RiskFlow...</p>
                <p className="text-xs mt-2">
                  Fetching real-time market intelligence
                </p>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>No RiskFlow items available</p>
                <p className="text-xs mt-2">Waiting for RiskFlow updates...</p>
              </div>
            ) : (
              feedItems.map((item) => <FeedItem key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
