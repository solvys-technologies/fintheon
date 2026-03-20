// [claude-code 2026-03-20] S3:T5 — NotificationToast: bottom-left, theme colors, Don't Show Again
import { X, TrendingUp, Newspaper, AlertTriangle, BellOff } from 'lucide-react';
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

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateX(0)' : 'translateX(-16px)',
        backgroundColor: 'var(--fintheon-surface)',
        border: '1px solid var(--fintheon-accent)',
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        minWidth: '300px',
        maxWidth: '400px',
      }}
    >
      <div className="flex items-start gap-3">
        {notification.type === 'iv' ? (
          <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--fintheon-accent)' }} />
        ) : notification.type === 'tilt' || notification.severity === 'warning' ? (
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f97316' }} />
        ) : (
          <Newspaper className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--fintheon-accent)' }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--fintheon-text)' }}>
              {notification.title}
            </h4>
            <div className="flex items-center flex-shrink-0" style={{ gap: '2px' }}>
              <button
                onClick={() => onBlock(dndType)}
                title="Don't show again"
                className="flex items-center justify-center rounded transition-colors"
                style={{ width: '20px', height: '20px', color: 'var(--fintheon-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fintheon-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fintheon-muted)'; }}
              >
                <BellOff size={11} />
              </button>
              <button
                onClick={() => onDismiss(notification.id)}
                className="flex items-center justify-center rounded transition-colors"
                style={{ width: '20px', height: '20px', color: 'var(--fintheon-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fintheon-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fintheon-muted)'; }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--fintheon-muted)' }}>
            {notification.message}
          </p>
          <span className="text-[9px] mt-1.5 block" style={{ color: 'rgba(107,114,128,0.5)' }}>
            {notification.timestamp.toLocaleTimeString()}
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
