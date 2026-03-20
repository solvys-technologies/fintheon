import { useState, useEffect, useRef } from 'react';
import { IVScoreCard } from '../IVScoreCard';
import { EmotionalResonanceMonitor } from '../mission-control/EmotionalResonanceMonitor';
import { CompactERMonitor } from '../mission-control/CompactERMonitor';
import { useBackend } from '../../lib/backend';
import type { NewsItem } from '~backend/news/list';
import { X, Trash2 } from 'lucide-react';

type LayoutOption = 'movable' | 'tickers-only' | 'combined';

interface FloatingWidgetProps {
  vix: number;
  ivScore: number;
  layoutOption?: LayoutOption;
  onClose?: () => void;
}

// Track seen news IDs to avoid duplicates
interface NewsNotification extends NewsItem {
  notificationId: string;
}

export function FloatingWidget({ vix, ivScore, layoutOption = 'movable', onClose }: FloatingWidgetProps) {
  const backend = useBackend();
  const [erScore, setErScore] = useState<number>(0);
  const [showERCard, setShowERCard] = useState(false);
  const [notifications, setNotifications] = useState<NewsNotification[]>([]);
  const [isHoveringNotifications, setIsHoveringNotifications] = useState(false);
  const seenNewsIds = useRef<Set<string>>(new Set());
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Listen for ER score updates
  useEffect(() => {
    const handleERUpdate = (event: CustomEvent<number>) => {
      setErScore(event.detail);
      setShowERCard(true);
    };
    window.addEventListener('erScoreUpdate', handleERUpdate as EventListener);
    return () => {
      window.removeEventListener('erScoreUpdate', handleERUpdate as EventListener);
    };
  }, []);

  // Fetch latest news and add to notifications
  useEffect(() => {
    const fetchLatestNews = async () => {
      try {
        const response = await backend.news.list({ limit: 5 });
        if (response.items.length > 0) {
          const newItems: NewsNotification[] = [];
          
          for (const item of response.items) {
            const newsId = item.id?.toString() || `${item.title}-${item.publishedAt}`;
            if (!seenNewsIds.current.has(newsId)) {
              seenNewsIds.current.add(newsId);
              const notification: NewsNotification = {
                ...item,
                notificationId: `${newsId}-${Date.now()}`,
              };
              newItems.push(notification);
            }
          }
          
          if (newItems.length > 0) {
            setNotifications(prev => {
              const updated = [...newItems, ...prev].slice(0, 10); // Keep max 10 notifications
              
              // Set auto-dismiss timeout for new notifications (unless hovering)
              newItems.forEach(item => {
                if (!isHoveringNotifications) {
                  const timeout = setTimeout(() => {
                    dismissNotification(item.notificationId);
                  }, 8000);
                  notificationTimeouts.current.set(item.notificationId, timeout);
                }
              });
              
              return updated;
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      }
    };

    fetchLatestNews();
    const interval = setInterval(fetchLatestNews, 30000); // Check every 30 seconds
    return () => {
      clearInterval(interval);
      // Clear all timeouts
      notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      notificationTimeouts.current.clear();
    };
  }, [backend, isHoveringNotifications]);

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    const timeout = notificationTimeouts.current.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeouts.current.delete(notificationId);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    notificationTimeouts.current.clear();
  };

  const handleNotificationsMouseEnter = () => {
    setIsHoveringNotifications(true);
    // Pause all auto-dismiss timeouts
    notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    notificationTimeouts.current.clear();
  };

  const handleNotificationsMouseLeave = () => {
    setIsHoveringNotifications(false);
    // Restart auto-dismiss timeouts for remaining notifications
    notifications.forEach(item => {
      const timeout = setTimeout(() => {
        dismissNotification(item.notificationId);
      }, 5000);
      notificationTimeouts.current.set(item.notificationId, timeout);
    });
  };

  return (
    <div className="fixed top-[70px] right-4 z-50 flex flex-col items-end gap-2">
      {/* IV Score Tickers - Frosted Glass Effect (iOS 26 style) */}
      {/* Only show VIX ticker when NOT in tickers-only layout */}
      {layoutOption !== 'tickers-only' && (
        <div 
          className="flex items-center gap-2 backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/50 via-[#0a0a00]/40 to-[#0a0a00]/30 border border-[#D4AF37]/30 rounded-2xl p-2.5 shadow-2xl shadow-black/50"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          <div 
            className="backdrop-blur-2xl bg-gradient-to-br from-[#050500]/60 to-[#050500]/40 border border-zinc-800/60 rounded-xl px-2.5 py-1"
            style={{
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-300 drop-shadow-sm">VIX</span>
              <span className="text-xs font-mono text-gray-100 drop-shadow-sm">
                {vix.toFixed(2)}
              </span>
            </div>
          </div>
          <IVScoreCard score={ivScore} variant="frosted" layoutOption={layoutOption} />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#D4AF37]/20 rounded-xl text-[#D4AF37]/80 hover:text-[#D4AF37] backdrop-blur-sm transition-all"
              title="Close Widget"
              style={{
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Tickers-Only Expanded Panel - Shows ER Monitor */}
      {layoutOption === 'tickers-only' && (
        <div
          className="backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/50 via-[#0a0a00]/40 to-[#0a0a00]/30 border border-[#D4AF37]/30 rounded-2xl p-3 w-80 shadow-2xl"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Compact ER Monitor - Landscape */}
          <div className="mb-3 pb-3 border-b border-[#D4AF37]/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-[#D4AF37] font-semibold">PsychAssist</span>
            </div>
            <CompactERMonitor onERScoreChange={setErScore} />
          </div>

          <div>
          </div>
        </div>
      )}

      {/* ER Monitor Card - Landscape oriented, drops down with frosted glass */}
      {layoutOption !== 'tickers-only' && showERCard && (
        <div
          className="backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/50 via-[#0a0a00]/40 to-[#0a0a00]/30 border border-[#D4AF37]/30 rounded-2xl p-4 w-96 transition-all duration-300 opacity-100 translate-y-0 animate-slide-down shadow-2xl"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#D4AF37] drop-shadow-sm">Emotional Resonance</h3>
            <button
              onClick={() => setShowERCard(false)}
              className="p-1.5 hover:bg-[#D4AF37]/20 rounded-xl text-[#D4AF37]/70 hover:text-[#D4AF37] backdrop-blur-sm transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <EmotionalResonanceMonitor onERScoreChange={setErScore} />
          </div>
        </div>
      )}

      {/* News Notifications - Shows for all layouts including tickers-only */}
      {notifications.length > 0 && (
        <div
          className="flex flex-col gap-2"
          onMouseEnter={handleNotificationsMouseEnter}
          onMouseLeave={handleNotificationsMouseLeave}
        >
          {/* Clear All Header */}
          {notifications.length > 1 && (
            <div
              className="backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/60 via-[#0a0a00]/50 to-[#0a0a00]/40 border border-[#D4AF37]/30 rounded-xl px-3 py-1 flex items-center justify-between shadow-lg"
              style={{
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              }}
            >
              <span className="text-[10px] text-gray-400">{notifications.length} notifications</span>
              <button
                onClick={clearAllNotifications}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            </div>
          )}
          
          {/* Individual Notifications - Limit to 2 max */}
          {notifications.slice(0, 2).map((newsItem) => (
            <div
              key={newsItem.notificationId}
              className="backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/50 via-[#0a0a00]/40 to-[#0a0a00]/30 border border-[#D4AF37]/30 rounded-2xl p-3 w-80 transition-all duration-500 opacity-100 animate-slide-up shadow-2xl"
              style={{
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#D4AF37]/70 mb-0.5 drop-shadow-sm">{newsItem.source}</div>
                  <h4 className="text-xs font-semibold text-gray-100 mb-1 drop-shadow-sm line-clamp-2">{newsItem.title}</h4>
                  {newsItem.content && (
                    <p className="text-[10px] text-gray-300/80 line-clamp-1 drop-shadow-sm">{newsItem.content}</p>
                  )}
                  {newsItem.ivScore != null && typeof newsItem.ivScore === 'number' && (
                    <div className="mt-1 text-[10px]">
                      <span className="text-[#D4AF37] drop-shadow-sm">IV: </span>
                      <span className="text-gray-200 drop-shadow-sm">{newsItem.ivScore.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismissNotification(newsItem.notificationId)}
                  className="p-1 hover:bg-[#D4AF37]/20 rounded-lg text-[#D4AF37]/70 hover:text-[#D4AF37] flex-shrink-0 backdrop-blur-sm transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
