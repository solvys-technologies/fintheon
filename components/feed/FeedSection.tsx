import { useState, useEffect } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { FeedItem as FeedItemType, IVIndicator } from '../../types/feed';
import { useBackend } from '../../lib/backend';
import type { NewsItem } from '../../types/api';
import { FeedItem } from './FeedItem';
import { NTNReportModal } from '../NTNReportModal';

// Convert NewsItem to FeedItem format
// Filters out raw/unprocessed data and ensures only interpreted messages are shown
function convertNewsToFeedItem(newsItem: NewsItem): FeedItemType | null {
  // Filter out items that look like raw system logs or unprocessed data
  const title = newsItem.title || '';
  const content = newsItem.content || '';
  
  // Skip items that look like raw API responses or system logs
  const rawDataPatterns = [
    /^\[.*\]/,  // Items starting with brackets like [Error], [API], etc.
    /API.*error/i,
    /Failed to fetch/i,
    /Error fetching/i,
    /undefined|null/i,
    /^[A-Z_]+$/,  // All caps with underscores (like ERROR_CODE)
  ];
  
  const isRawData = rawDataPatterns.some(pattern => pattern.test(title) || pattern.test(content));
  
  // Skip items that are too short or look like technical logs
  if (isRawData || title.length < 10 || title.includes('undefined') || title.includes('null')) {
    return null; // Filter out this item
  }
  
  // Ensure ivScore is always a valid number first
  const ivScoreValue = typeof newsItem.ivScore === 'number' ? newsItem.ivScore : 
                       newsItem.ivScore != null ? Number(newsItem.ivScore) : 0;
  const safeIvScore = isNaN(ivScoreValue) ? 0 : ivScoreValue;

  // Determine IV type based on sentiment from Logic Matrix (database)
  // Use sentiment from database if available, otherwise fall back to keyword analysis
  let ivType: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  
  if (newsItem.sentiment) {
    // Use sentiment from Logic Matrix interpretation
    if (newsItem.sentiment === 'bullish') ivType = 'Bullish';
    else if (newsItem.sentiment === 'bearish') ivType = 'Bearish';
  } else if (safeIvScore >= 6) {
    // Fallback: High volatility - check title for sentiment keywords
    const titleLower = title.toLowerCase();
    const bullishKeywords = ['surge', 'rally', 'soar', 'jump', 'gain', 'rise', 'upgrade', 'beats', 'record high', 'increase', 'beat'];
    const bearishKeywords = ['crash', 'plunge', 'fall', 'drop', 'tumble', 'decline', 'downgrade', 'miss', 'record low', 'decrease', 'missed'];

    const isBullish = bullishKeywords.some(kw => titleLower.includes(kw));
    const isBearish = bearishKeywords.some(kw => titleLower.includes(kw));

    if (isBullish && !isBearish) ivType = 'Bullish';
    else if (isBearish && !isBullish) ivType = 'Bearish';
  }

  // Determine classification based on category
  let classification: 'Cyclical' | 'Countercyclical' | 'Neutral' = 'Neutral';
  const category = newsItem.category.toLowerCase();
  if (category.includes('fed') || category.includes('economic') || category.includes('political') || category.includes('geopolitical')) {
    classification = 'Countercyclical';
  } else if (category.includes('earning') || category.includes('corporate') || category.includes('technical')) {
    classification = 'Cyclical';
  }

  const iv: IVIndicator = {
    value: safeIvScore,
    type: ivType,
    classification: classification,
  };

  return {
    id: newsItem.id.toString(),
    time: newsItem.publishedAt,
    text: title, // Use interpreted title (already processed by Logic Matrix)
    source: newsItem.source,
    type: 'news',
    iv: iv,
  };
}

export function FeedSection() {
  const backend = useBackend();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([]);
  const [showNTNModal, setShowNTNModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeNews = async () => {
      try {
        // Fetch news items from the database (pre-fetched by cron job)
        // The cron job runs every 5 minutes to fetch and classify events,
        // so we don't need to trigger API calls here - just load from DB
        const response = await backend.news.list({ limit: 50 });
        // Filter out null items (raw/unprocessed data)
        const convertedItems = response.items
          .map(convertNewsToFeedItem)
          .filter((item): item is FeedItemType => item !== null);
        setFeedItems(convertedItems);
      } catch (err) {
        console.error('Failed to fetch news for The Tape:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchNews = async () => {
      try {
        const response = await backend.news.list({ limit: 50 });
        // Filter out null items (raw/unprocessed data)
        const convertedItems = response.items
          .map(convertNewsToFeedItem)
          .filter((item): item is FeedItemType => item !== null);
        setFeedItems(convertedItems);
      } catch (err) {
        console.error('Failed to fetch news for The Tape:', err);
      }
    };

    // Initialize on mount (load from database)
    initializeNews();

    // Then fetch every 30 seconds (just refresh the list, don't sync every time)
    const interval = setInterval(fetchNews, 30000);

    return () => clearInterval(interval);
  }, [backend]);

  const handleClear = () => {
    if (confirm("Clear all tape items?")) {
      setFeedItems([]);
    }
  };

  return (
    <>
      {showNTNModal && <NTNReportModal onClose={() => setShowNTNModal(false)} />}

      <div className="h-full flex flex-col">
        {/* Header with CTAs */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#D4AF37]">The Tape</h2>
            <p className="text-sm text-gray-400 mt-1">RiskFlow and Algorithmic Analytics Feed.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNTNModal(true)}
              className="px-4 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-medium transition-colors flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              Run NTN Report
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-full text-xs font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Feed Items */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-2">
            {loading ? (
              <div className="text-center text-gray-500 py-12">
                <p>Loading The Tape...</p>
                <p className="text-xs mt-2">Fetching real-time market intelligence</p>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>No news items available</p>
                <p className="text-xs mt-2">Waiting for RiskFlow updates...</p>
              </div>
            ) : (
              feedItems.map(item => (
                <FeedItem key={item.id} item={item} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
