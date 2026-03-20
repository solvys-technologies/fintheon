import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import type { NewsItem } from '../../types/api';
import { Button } from '../ui/Button';

export function NewsSection() {
  const backend = useBackend();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        new Notification('PULSE News Alerts', {
          body: 'You will now receive notifications for breaking news',
          icon: '/favicon.ico',
        });
      }
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await backend.news.list({ limit: 50 });
        setNewsItems(response.items);
      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#D4AF37]">RiskFlow</h2>
            <p className="text-sm text-gray-400 mt-1">
              Real-time market intelligence from leading prediction markets and macroeconomic sources.
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Filtered by watchlist • Classified by AI • Scored by IV
            </p>
          </div>

          <Button
            variant={notificationsEnabled ? 'primary' : 'secondary'}
            onClick={requestNotifications}
            className="flex items-center gap-2"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
            {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-12">
            <p>Loading news...</p>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>No news items available</p>
            <p className="text-xs mt-2">Check your API keys in Settings</p>
          </div>
        ) : (
          newsItems.map(item => {
            const priceBrain = item.priceBrainScore;
            const macroLevel = item.macroLevel || 1;
            const showImpliedPoints = (macroLevel === 3 || macroLevel === 4) && priceBrain?.impliedPoints !== null && priceBrain?.impliedPoints !== undefined;

            return (
              <div
                key={item.id}
                className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4 hover:border-[#D4AF37]/40 transition-colors border-b-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[#D4AF37]">{item.source}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                        item.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                        {(item.impact || 'low').toUpperCase()}
                      </span>
                      {item.macroLevel && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          Level {item.macroLevel}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{item.category}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                    {item.content && (
                      <p className="text-xs text-gray-400 line-clamp-2">{item.content}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        {new Date(item.publishedAt).toLocaleString()}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#D4AF37] hover:underline"
                        >
                          Read more →
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Three Mini Cards at Bottom */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-[#D4AF37]/10">
                  {/* Bullish/Bearish Mini Card - Shows on ALL levels */}
                  <div className={`flex-1 px-3 py-2 rounded text-xs font-semibold text-center ${
                    priceBrain?.sentiment === 'Bullish' ? 'bg-green-500/20 text-green-400' :
                    priceBrain?.sentiment === 'Bearish' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {priceBrain?.sentiment || 'Neutral'}
                  </div>

                  {/* Cyclical/Counter-cyclical Mini Card - Shows on ALL levels */}
                  <div className={`flex-1 px-3 py-2 rounded text-xs font-semibold text-center ${
                    priceBrain?.classification === 'Cyclical' ? 'bg-blue-500/20 text-blue-400' :
                    priceBrain?.classification === 'Counter-cyclical' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {priceBrain?.classification || 'Neutral'}
                  </div>

                  {/* Implied Points Mini Card - Shows ONLY on Level 3 and 4 */}
                  {showImpliedPoints ? (
                    <div className={`flex-1 px-3 py-2 rounded text-xs font-semibold text-center ${
                      (priceBrain?.impliedPoints || 0) > 0 ? 'bg-green-500/20 text-green-400' :
                      (priceBrain?.impliedPoints || 0) < 0 ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {(priceBrain?.impliedPoints || 0) > 0 ? '+' : ''}{priceBrain?.impliedPoints?.toFixed(1)} pts
                    </div>
                  ) : (
                    <div className="flex-1 px-3 py-2 rounded text-xs font-semibold text-center bg-gray-500/10 text-gray-500">
                      N/A
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
