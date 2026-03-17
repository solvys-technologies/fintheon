// [claude-code 2026-02-26] Zen layout uses a separate dockable PsychAssist widget.
// [claude-code 2026-03-11] T2: FloatingWidget now accepts IVScoreResponse from backend
// [claude-code 2026-03-11] Toast notifications with source icons + implied points
import { useState, useEffect, useRef } from 'react';
import { IVScoreCard } from '../IVScoreCard';
import { EmotionalResonanceMonitor } from '../mission-control/EmotionalResonanceMonitor';
import { useBackend } from '../../lib/backend';
import type { RiskFlowItem } from '../../types/api';
import type { IVScoreResponse } from '../../types/market-data';
import { X, Trash2, TrendingUp } from 'lucide-react';

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="X">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NotionLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Notion">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.45 2.29c-.42-.326-.98-.7-2.055-.607L3.62 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.214-.14c-.093-.513.28-.886.747-.933zM2.667 1.21l13.728-1.027c1.68-.14 2.1.093 2.8.606l3.874 2.707c.466.326.606.746.606 1.26v15.7c0 .933-.326 1.493-1.494 1.586l-15.457.933c-.84.047-1.26-.093-1.727-.653L1.88 19.01c-.513-.653-.746-1.166-.746-1.86V2.89c0-.84.373-1.54 1.54-1.68z" />
    </svg>
  );
}

function ToastSourceIcon({ source, className }: { source: string; className?: string }) {
  const s = source.toLowerCase();
  if (s === 'twitter-cli' || s === 'twittercli' || s.includes('twitter') || s === 'financialjuice' || s === 'financial-juice') {
    return <XLogo className={className} />;
  }
  if (s === 'notion-trade-idea' || s.includes('notion')) {
    return <NotionLogo className={className} />;
  }
  return <span className={`font-bold text-[7px] uppercase ${className}`}>{source.charAt(0)}</span>;
}

type LayoutOption = 'tickers-only' | 'combined';

interface FloatingWidgetProps {
  ivData: IVScoreResponse | null;
  ivLoading?: boolean;
  layoutOption?: LayoutOption;
  onClose?: () => void;
}

// Track seen news IDs to avoid duplicates
interface RiskFlowNotification extends RiskFlowItem {
  notificationId: string;
}

export function FloatingWidget({ ivData, ivLoading, layoutOption = 'combined', onClose }: FloatingWidgetProps) {
  const backend = useBackend();
  const [erScore, setErScore] = useState<number>(0);
  const [showERCard, setShowERCard] = useState(false);
  const [notifications, setNotifications] = useState<RiskFlowNotification[]>([]);
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
        const response = await backend.riskflow.list({ limit: 5 });
        if (response.items.length > 0) {
          const newItems: RiskFlowNotification[] = [];
          
          for (const item of response.items) {
            const newsId = item.id?.toString() || `${item.title}-${item.publishedAt}`;
            if (!seenNewsIds.current.has(newsId)) {
              seenNewsIds.current.add(newsId);
              const notification: RiskFlowNotification = {
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
        console.warn('Failed to fetch news:', err);
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
          className="flex items-center gap-2 backdrop-blur-3xl bg-gradient-to-br from-[var(--fintheon-surface)]/50 via-[var(--fintheon-surface)]/40 to-[var(--fintheon-surface)]/30 border border-[var(--fintheon-accent)]/30 rounded-2xl p-2.5 shadow-2xl shadow-black/50"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          <div 
            className="backdrop-blur-2xl bg-gradient-to-br from-[var(--fintheon-bg)]/60 to-[var(--fintheon-bg)]/40 border border-zinc-800/60 rounded-xl px-2.5 py-1"
            style={{
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-300 drop-shadow-sm">VIX</span>
              <span className="text-xs font-mono text-gray-100 drop-shadow-sm">
                {ivData ? ivData.vix.level.toFixed(2) : '--'}
              </span>
            </div>
          </div>
          <IVScoreCard data={ivData} loading={ivLoading} layoutOption={layoutOption} />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--fintheon-accent)]/20 rounded-xl text-[var(--fintheon-accent)]/80 hover:text-[var(--fintheon-accent)] backdrop-blur-sm transition-all"
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

      {/* ER Monitor Card - Landscape oriented, drops down with frosted glass */}
      {layoutOption !== 'tickers-only' && showERCard && (
        <div
          className="backdrop-blur-3xl bg-gradient-to-br from-[var(--fintheon-surface)]/50 via-[var(--fintheon-surface)]/40 to-[var(--fintheon-surface)]/30 border border-[var(--fintheon-accent)]/30 rounded-2xl p-4 w-96 transition-all duration-300 opacity-100 translate-y-0 animate-slide-down shadow-2xl"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] drop-shadow-sm">Emotional Resonance</h3>
            <button
              onClick={() => setShowERCard(false)}
              className="p-1.5 hover:bg-[var(--fintheon-accent)]/20 rounded-xl text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] backdrop-blur-sm transition-all"
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
              className="backdrop-blur-3xl bg-gradient-to-br from-[var(--fintheon-surface)]/60 via-[var(--fintheon-surface)]/50 to-[var(--fintheon-surface)]/40 border border-[var(--fintheon-accent)]/30 rounded-xl px-3 py-1 flex items-center justify-between shadow-lg"
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
              className="backdrop-blur-3xl bg-gradient-to-br from-[var(--fintheon-surface)]/50 via-[var(--fintheon-surface)]/40 to-[var(--fintheon-surface)]/30 border border-[var(--fintheon-accent)]/30 rounded-2xl p-3 w-80 transition-all duration-500 opacity-100 animate-slide-up shadow-2xl"
              style={{
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="flex items-start gap-2">
                <ToastSourceIcon source={newsItem.source} className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-100 drop-shadow-sm line-clamp-2">{newsItem.title}</h4>
                  {newsItem.content && (
                    <p className="text-[10px] text-gray-300/80 line-clamp-1 drop-shadow-sm mt-0.5">{newsItem.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {newsItem.ivScore != null && typeof newsItem.ivScore === 'number' && newsItem.ivScore > 0 && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <TrendingUp className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                        <span className="text-[var(--fintheon-accent)] font-medium drop-shadow-sm">
                          ±{newsItem.ivScore.toFixed(0)} pts
                        </span>
                      </div>
                    )}
                    {newsItem.impact && (
                      <span className={`text-[9px] uppercase tracking-wider font-semibold ${
                        newsItem.impact === 'high' ? 'text-red-400' : newsItem.impact === 'medium' ? 'text-yellow-400' : 'text-zinc-500'
                      }`}>
                        {newsItem.impact}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(newsItem.notificationId)}
                  className="p-1 hover:bg-[var(--fintheon-accent)]/20 rounded-lg text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] flex-shrink-0 backdrop-blur-sm transition-all"
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
