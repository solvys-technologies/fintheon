// [claude-code 2026-03-20] S3:T5 — NotificationToast: bottom-left, theme colors, Don't Show Again
// [claude-code 2026-03-28] S8-T6: Refactored to RiskFlow card style — frosted glass, severity badges, bullish/bearish footer
import { X, TrendingUp, TrendingDown, Newspaper, AlertTriangle, BellOff, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playAlertSound, playIOSPing, AlertType } from '../utils/soundAlerts';
import { useSettings } from '../contexts/SettingsContext';
import { useBackend } from '../lib/backend';
import { useToast, type NotificationType } from '../contexts/ToastContext';
import { useDND } from '../contexts/DNDContext';
import { healingBowlPlayer } from '../utils/healingBowlSounds';

interface Notification {
  id: string;
  type: 'iv' | 'news' | 'tilt' | 'trade' | 'warning';
  severity?: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

/** Map backend notification type to DND notification type */
function toDndType(type: Notification['type']): NotificationType {
  switch (type) {
    case 'iv': return 'iv-alert';
    case 'news': return 'news-alert';
    case 'tilt': return 'tilt-alert';
    case 'trade': return 'trade-alert';
    case 'warning': return 'general';
  }
}

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onBlock: (type: NotificationType) => void;
}

export function NotificationToast({ notification, onDismiss, onBlock }: NotificationToastProps) {
  const { alertConfig } = useSettings();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!alertConfig.soundEnabled) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, 5000);
      return () => clearTimeout(timer);
    }

    if (notification.type === 'tilt' || notification.title.toLowerCase().includes('tilt') || notification.title.toLowerCase().includes('fraction')) {
      healingBowlPlayer.play(alertConfig.healingBowlSound);
    } else if (notification.type === 'news' || notification.type === 'iv') {
      playIOSPing(alertConfig.soundEnabled);
    } else {
      let soundType: AlertType = 'info';
      if (notification.severity === 'warning') soundType = 'warning';
      else if (notification.severity === 'error') soundType = 'error';
      else if (notification.severity === 'success') soundType = 'success';
      playAlertSound(soundType, alertConfig.soundEnabled);
    }

    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, notification.type, notification.severity, notification.title, onDismiss, alertConfig.soundEnabled, alertConfig.healingBowlSound]);

  const dndType = toDndType(notification.type);

  // Severity badge styling — matches RiskFlowPanel SEVERITY_CONFIG pattern
  const severityConfig = (() => {
    if (notification.severity === 'error' || notification.type === 'tilt')
      return { label: 'HIGH', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' };
    if (notification.severity === 'warning')
      return { label: 'MED', bg: 'bg-[var(--fintheon-accent)]/10', text: 'text-[var(--fintheon-accent)]', border: 'border-[var(--fintheon-accent)]/30' };
    if (notification.type === 'trade')
      return { label: 'TRADE', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    return { label: 'INFO', bg: 'bg-zinc-700/30', text: 'text-zinc-400', border: 'border-zinc-600/30' };
  })();

  // Determine bullish/bearish from content heuristics
  const isBullish = /bull|long|buy|up|rally|bid/i.test(notification.title + notification.message);
  const isBearish = /bear|short|sell|down|drop|crash|risk|tilt/i.test(notification.title + notification.message);
  const dirColor = isBullish ? 'var(--fintheon-bullish)' : isBearish ? 'var(--fintheon-bearish)' : 'var(--fintheon-muted)';

  return (
    <div
      className="transition-all duration-300 ease-out overflow-hidden group"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateX(0)' : 'translateX(-16px)',
        minWidth: '320px',
        maxWidth: '420px',
      }}
    >
      {/* Frosted glass card body */}
      <div
        className="backdrop-blur-xl border border-[var(--fintheon-accent)]/20"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 80%, transparent)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Main content */}
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-start gap-2">
            {/* Severity badge */}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${severityConfig.bg} ${severityConfig.text} ${severityConfig.border} border flex-shrink-0 mt-0.5`}>
              {severityConfig.label}
            </span>
            <div className="flex-1 min-w-0">
              {/* Headline */}
              <p className="text-xs leading-snug font-medium text-[var(--fintheon-text)] line-clamp-2">
                {notification.title}
              </p>
              {/* Summary */}
              {notification.message && notification.message !== notification.title && (
                <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">{notification.message}</p>
              )}
              {/* Source badge + timestamp row */}
              <div className="flex items-center gap-2 mt-1">
                {notification.type === 'iv' ? (
                  <TrendingUp className="w-2.5 h-2.5 text-zinc-500" />
                ) : notification.type === 'tilt' ? (
                  <AlertTriangle className="w-2.5 h-2.5 text-zinc-500" />
                ) : notification.type === 'trade' ? (
                  <Zap className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                ) : (
                  <Newspaper className="w-2.5 h-2.5 text-zinc-500" />
                )}
                <span className="text-[10px] text-zinc-600">{notification.timestamp.toLocaleTimeString()}</span>
                <span className="text-[10px] text-zinc-700">&middot;</span>
                <span className="text-[10px] text-[var(--fintheon-accent)]/60 uppercase tracking-wider">
                  {notification.type === 'iv' ? 'IV Alert' : notification.type === 'tilt' ? 'PsychAssist' : notification.type === 'trade' ? 'Trade' : 'RiskFlow'}
                </span>
              </div>
            </div>
            {/* Dismiss + block CTAs */}
            <div className="flex-shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => onBlock(dndType)}
                title="Don't show again"
                className="p-1 rounded text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <BellOff size={12} />
              </button>
              <button
                onClick={() => onDismiss(notification.id)}
                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom hero footer — matches AlertRow in RiskFlowPanel */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t" style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)', backgroundColor: 'color-mix(in srgb, var(--fintheon-bg) 80%, transparent)' }}>
          <span className="text-[10px] text-zinc-600">{notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {(isBullish || isBearish) && (
            <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-1" style={{ color: dirColor }}>
              {isBullish ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isBullish ? 'BULLISH' : 'BEARISH'}
            </span>
          )}
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono">
            {notification.type}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Critical notification types that break through DND */
const CRITICAL_TAGS = new Set(['margin-call', 'system-error', 'backend-down']);

function isCriticalNotification(n: Notification): boolean {
  // Margin call, system errors, and backend-down always break through
  if (n.severity === 'error' && (n.title.toLowerCase().includes('margin') || n.title.toLowerCase().includes('system'))) return true;
  if (n.type === 'warning' && n.severity === 'error') return true;
  return false;
}

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const backend = useBackend();
  const { isNotificationBlocked, blockNotificationType } = useToast();
  const { dndActive, tryQueue } = useDND();

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleBlock = (type: NotificationType) => {
    blockNotificationType(type);
    // Dismiss all notifications of that type
    setNotifications(prev => prev.filter(n => toDndType(n.type) !== type));
  };

  useEffect(() => {
    let isMounted = true;

    const checkNotifications = async () => {
      try {
        const result = await backend.notifications.list();

        if (!isMounted) return;

        const notifications = Array.isArray(result) ? result : [];
        const newNotifications = notifications
          .filter((item: any) => new Date(item.createdAt) > lastChecked && !item.read)
          .map((item: any) => ({
            id: item.id.toString(),
            type: item.type as any,
            severity: item.severity as any,
            title: item.title,
            message: item.message,
            timestamp: new Date(item.createdAt),
          }))
          // Filter out blocked notification types
          .filter((n: Notification) => !isNotificationBlocked(toDndType(n.type)));

        if (newNotifications.length > 0) {
          // When DND is active, queue non-critical notifications
          const toShow: Notification[] = [];
          for (const n of newNotifications) {
            const critical = isCriticalNotification(n);
            const queued = tryQueue(
              {
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                timestamp: n.timestamp,
                severity: n.severity,
              },
              critical ? undefined : 'non-critical',
            );
            if (!queued) {
              // Not queued — show immediately (DND off, or critical alert)
              toShow.push(n);
            }
          }
          if (toShow.length > 0) {
            setNotifications(prev => [...prev, ...toShow]);
          }
          setLastChecked(new Date());
        }
      } catch (error) {
        console.warn('Failed to fetch notifications:', error);
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [lastChecked, backend, isNotificationBlocked, dndActive, tryQueue]);

  return (
    <div
      className="fixed z-50 flex flex-col gap-2"
      style={{ bottom: '24px', left: '24px' }}
    >
      {notifications.slice(0, 5).map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
          onBlock={handleBlock}
        />
      ))}
    </div>
  );
}
