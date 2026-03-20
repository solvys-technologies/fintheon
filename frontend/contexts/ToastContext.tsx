// [claude-code 2026-03-20] S3:T5 — notification system: DND blocklist, notificationType for Don't Show Again
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ToastVariant = 'success' | 'error' | 'updating' | 'info' | 'reminder' | 'vix';

/** Unique notification type ID used for "Don't Show Again" blocklist */
export type NotificationType =
  | 'vix-spike'
  | 'system-update'
  | 'connection-status'
  | 'api-error'
  | 'pre-market-reminder'
  | 'news-alert'
  | 'tilt-alert'
  | 'trade-alert'
  | 'iv-alert'
  | 'general';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  description?: string;
  exiting?: boolean;
  /** If set, enables "Don't Show Again" button for this notification type */
  notificationType?: NotificationType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, description?: string, notificationType?: NotificationType) => string;
  dismissToast: (id: string) => void;
  /** Permanently block a notification type (Don't Show Again) */
  blockNotificationType: (type: NotificationType) => void;
  /** Check if a notification type is blocked */
  isNotificationBlocked: (type: NotificationType) => boolean;
  /** Reset all blocked notification types */
  resetBlockedNotifications: () => void;
  /** Get list of all blocked notification types */
  blockedTypes: NotificationType[];
}

const DND_STORAGE_KEY = 'fintheon:notification-blocklist';

function loadBlocklist(): NotificationType[] {
  try {
    const raw = localStorage.getItem(DND_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBlocklist(list: NotificationType[]) {
  localStorage.setItem(DND_STORAGE_KEY, JSON.stringify(list));
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => '',
  dismissToast: () => {},
  blockNotificationType: () => {},
  isNotificationBlocked: () => false,
  resetBlockedNotifications: () => {},
  blockedTypes: [],
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [blockedTypes, setBlockedTypes] = useState<NotificationType[]>(loadBlocklist);

  const isNotificationBlocked = useCallback(
    (type: NotificationType) => blockedTypes.includes(type),
    [blockedTypes],
  );

  const blockNotificationType = useCallback((type: NotificationType) => {
    setBlockedTypes((prev) => {
      if (prev.includes(type)) return prev;
      const next = [...prev, type];
      saveBlocklist(next);
      return next;
    });
  }, []);

  const resetBlockedNotifications = useCallback(() => {
    setBlockedTypes([]);
    saveBlocklist([]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', description?: string, notificationType?: NotificationType): string => {
      // Skip if this notification type is blocked
      if (notificationType && blockedTypes.includes(notificationType)) {
        return '';
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: Toast = { id, message, variant, description, notificationType };
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss (except 'updating' which stays until manually dismissed)
      if (variant !== 'updating') {
        const delay = variant === 'error' ? 2500 : variant === 'reminder' ? 8000 : variant === 'vix' ? 10000 : 4000;
        setTimeout(() => dismissToast(id), delay);
      }

      return id;
    },
    [dismissToast, blockedTypes],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast, blockNotificationType, isNotificationBlocked, resetBlockedNotifications, blockedTypes }}>
      {children}
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useToast = () => useContext(ToastContext);
