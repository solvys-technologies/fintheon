import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';
import type { NewsItem } from '~backend/news/list';

// Track last seen news item ID to count unread items (per session)
let lastSeenNewsId: number | null = null;

export function MinimalTapeWidget() {
  const backend = useBackend();
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await backend.news.list({ limit: 20 });
        setTotalItems(response.items.length);
        
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
        console.error('Failed to fetch news for Minimal Tape Widget:', err);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2 p-2 bg-[#0a0a00] border border-[#D4AF37]/20 rounded w-full">
      <div className="text-center">
        <span className="text-[10px] font-semibold text-[#D4AF37]">Tape</span>
      </div>
      
      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="text-center">
          <div className="text-xs text-gray-400">{totalItems} items</div>
          {unreadCount > 0 && (
            <div className="mt-1 backdrop-blur-sm bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded px-2 py-0.5 inline-block">
              <span className="text-[10px] font-mono text-[#D4AF37]">{unreadCount} new</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
