import { X, TrendingUp, Newspaper, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playAlertSound, playIOSPing, AlertType } from '../utils/soundAlerts';
import { useSettings } from '../contexts/SettingsContext';
import { useBackend } from '../lib/backend';
import { healingBowlPlayer } from '../utils/healingBowlSounds';

interface Notification {
  id: string;
  type: 'iv' | 'news' | 'tilt' | 'trade' | 'warning';
  severity?: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const { alertConfig } = useSettings();

  useEffect(() => {
    if (!alertConfig.soundEnabled) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Play healing bowl sound for tilt/fraction notifications
    if (notification.type === 'tilt' || notification.title.toLowerCase().includes('tilt') || notification.title.toLowerCase().includes('fraction')) {
      healingBowlPlayer.play(alertConfig.healingBowlSound);
    }
    // Play iOS ping for news alerts
    else if (notification.type === 'news' || notification.type === 'iv') {
      playIOSPing(alertConfig.soundEnabled);
    }
    // Play regular alert sounds for other types
    else {
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

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg p-4 shadow-lg backdrop-blur-md min-w-[300px] max-w-[400px] animate-slide-in">
      <div className="flex items-start gap-3">
        {notification.type === 'iv' ? (
          <TrendingUp className="w-5 h-5 text-[var(--fintheon-accent)] flex-shrink-0" />
        ) : notification.type === 'tilt' || notification.severity === 'warning' ? (
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
        ) : (
          <Newspaper className="w-5 h-5 text-[var(--fintheon-accent)] flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">{notification.title}</h4>
            <button
              onClick={() => onDismiss(notification.id)}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{notification.message}</p>
          <span className="text-[9px] text-gray-600 mt-2 block">
            {notification.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const backend = useBackend();

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
          }));

        if (newNotifications.length > 0) {
          setNotifications(prev => [...prev, ...newNotifications]);
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
  }, [lastChecked, backend]);

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col-reverse gap-2">
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
}
