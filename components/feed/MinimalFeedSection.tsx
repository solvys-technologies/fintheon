import { useState, useEffect } from 'react';
import { FeedItem as FeedItemType, IVIndicator } from '../../types/feed';
import { useBackend } from '../../lib/backend';
import type { NewsItem } from '~backend/news/list';
import { FeedItem } from './FeedItem';
import { MoveLeft, MoveRight, GripVertical, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PanelPosition } from '../layout/DraggablePanel';

// Track last seen news item ID to count unread items (per session)
let lastSeenNewsId: number | null = null;

// Convert NewsItem to FeedItem format
function convertNewsToFeedItem(newsItem: NewsItem): FeedItemType | null {
  const title = newsItem.title || '';
  const content = newsItem.content || '';
  
  const rawDataPatterns = [
    /^\[.*\]/,
    /API.*error/i,
    /Failed to fetch/i,
    /Error fetching/i,
    /undefined|null/i,
    /^[A-Z_]+$/,
  ];
  
  const isRawData = rawDataPatterns.some(pattern => pattern.test(title) || pattern.test(content));
  
  if (isRawData || title.length < 10 || title.includes('undefined') || title.includes('null')) {
    return null;
  }
  
  const ivScoreValue = typeof newsItem.ivScore === 'number' ? newsItem.ivScore : 
                       newsItem.ivScore != null ? Number(newsItem.ivScore) : 0;
  const safeIvScore = isNaN(ivScoreValue) ? 0 : ivScoreValue;

  let ivType: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  
  if (newsItem.sentiment) {
    if (newsItem.sentiment === 'bullish') ivType = 'Bullish';
    else if (newsItem.sentiment === 'bearish') ivType = 'Bearish';
  } else if (safeIvScore >= 6) {
    const titleLower = title.toLowerCase();
    const bullishKeywords = ['surge', 'rally', 'soar', 'jump', 'gain', 'rise', 'upgrade', 'beats', 'record high', 'increase', 'beat'];
    const bearishKeywords = ['crash', 'plunge', 'fall', 'drop', 'tumble', 'decline', 'downgrade', 'miss', 'record low', 'decrease', 'missed'];

    const isBullish = bullishKeywords.some(kw => titleLower.includes(kw));
    const isBearish = bearishKeywords.some(kw => titleLower.includes(kw));

    if (isBullish && !isBearish) ivType = 'Bullish';
    else if (isBearish && !isBullish) ivType = 'Bearish';
  }

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
    text: title,
    source: newsItem.source,
    type: 'news',
    iv: iv,
  };
}

interface MinimalFeedSectionProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  position?: PanelPosition;
  onPositionChange?: (position: PanelPosition) => void;
  onHide?: () => void;
}

export function MinimalFeedSection({ 
  collapsed = false,
  onToggleCollapse,
  position = 'right',
  onPositionChange,
  onHide
}: MinimalFeedSectionProps) {
  const backend = useBackend();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await backend.news.list({ limit: 20 });
        const convertedItems = response.items
          .map(convertNewsToFeedItem)
          .filter((item): item is FeedItemType => item !== null);
        setFeedItems(convertedItems);
        
        // Calculate unread count
        if (response.items.length > 0) {
          const latestId = typeof response.items[0].id === 'number' ? response.items[0].id : parseInt(response.items[0].id.toString());
          if (lastSeenNewsId === null) {
            lastSeenNewsId = latestId;
            setUnreadCount(0);
          } else {
            // Count items newer than last seen
            const unread = response.items.filter(item => {
              const itemId = typeof item.id === 'number' ? item.id : parseInt(item.id.toString());
              return itemId > lastSeenNewsId!;
            }).length;
            setUnreadCount(unread);
          }
        }
      } catch (err) {
        console.error('Failed to fetch news for The Tape:', err);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
  }, [backend]);

  // Mark as read when panel is opened
  useEffect(() => {
    if (!collapsed && feedItems.length > 0) {
      const latestIdRaw = feedItems[0]?.id;
      const latestId = latestIdRaw != null ? Number(latestIdRaw) : null;
      if (latestId !== null && !Number.isNaN(latestId)) {
        lastSeenNewsId = latestId;
        setUnreadCount(0);
      }
    }
  }, [collapsed, feedItems]);

  if (collapsed) {
    return (
      <div className="h-full flex items-center justify-center p-4 relative bg-[#0a0a00]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="text-xs text-[#D4AF37]/60">The Tape</div>
            {unreadCount > 0 && (
              <div className="backdrop-blur-sm bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded px-1.5 py-0.5">
                <span className="text-[10px] font-mono text-[#D4AF37]">{unreadCount}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">{feedItems.length} items</div>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="absolute top-2 right-2 p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-3 border-b border-[#D4AF37]/20">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#D4AF37]">The Tape</h2>
          {unreadCount > 0 && (
            <div className="backdrop-blur-sm bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded px-1.5 py-0.5">
              <span className="text-[10px] font-mono text-[#D4AF37]">{unreadCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onPositionChange && (
            <>
              {position === 'right' && (
                <button
                  onClick={() => onPositionChange('left')}
                  className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                  title="Move Left"
                >
                  <MoveLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {position === 'left' && (
                <button
                  onClick={() => onPositionChange('right')}
                  className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                  title="Move Right"
                >
                  <MoveRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onPositionChange('floating')}
                className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                title="Float"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
              title="Hide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {feedItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-xs">
            <p>No news items available</p>
          </div>
        ) : (
          feedItems.map(item => (
            <FeedItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
