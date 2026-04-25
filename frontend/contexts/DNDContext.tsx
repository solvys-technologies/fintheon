// [claude-code 2026-03-20] S3:T10 — Do Not Disturb context: auto-suppress during trading, manual toggle, notification queue
// [claude-code 2026-04-25] S35-Unified: manualDnd is now sourced from SettingsContext.preferences
//   so DND syncs across desktop + mobile via the server, not localStorage. The local in-memory
//   queue stays — it's auxiliary state for UI suppression while DND is active.
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useSettings } from "./SettingsContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QueuedNotification {
  id: string;
  type: "iv" | "news" | "tilt" | "trade" | "warning" | "system";
  title: string;
  message: string;
  timestamp: Date;
  severity?: "info" | "warning" | "success" | "error";
}

/** Critical alert types that break through DND */
const CRITICAL_TYPES = new Set(["margin-call", "system-error", "backend-down"]);

interface DNDContextValue {
  /** Whether DND is currently active (auto or manual) */
  dndActive: boolean;
  /** Manual DND toggle (user-initiated) */
  manualDnd: boolean;
  /** Auto-DND (trading mode active) */
  autoDnd: boolean;
  /** Queued notifications suppressed during DND */
  queue: QueuedNotification[];
  /** Number of queued notifications */
  queueCount: number;
  /** Toggle manual DND on/off */
  toggleManualDnd: () => void;
  /** Set auto-DND (called when trading mode changes) */
  setAutoDnd: (active: boolean) => void;
  /** Try to queue a notification — returns true if queued (DND active), false if it should show normally */
  tryQueue: (notification: QueuedNotification, criticalTag?: string) => boolean;
  /** Flush queue — returns all queued notifications and clears the queue */
  flushQueue: () => QueuedNotification[];
  /** Dismiss a single queued notification */
  dismissQueued: (id: string) => void;
  /** Clear all queued notifications */
  clearQueue: () => void;
  /** Check if a notification tag is critical (breaks through DND) */
  isCritical: (tag: string) => boolean;
}

const DND_QUEUE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const DNDContext = createContext<DNDContextValue>({
  dndActive: false,
  manualDnd: false,
  autoDnd: false,
  queue: [],
  queueCount: 0,
  toggleManualDnd: () => {},
  setAutoDnd: () => {},
  tryQueue: () => false,
  flushQueue: () => [],
  dismissQueued: () => {},
  clearQueue: () => {},
  isCritical: () => false,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function DNDProvider({ children }: { children: ReactNode }) {
  // Server-backed manual DND. Reads/writes via SettingsContext → /api/preferences,
  // which broadcasts a __sync push so other devices flip in real-time.
  const { preferences, updatePreferences } = useSettings();
  const manualDnd = Boolean(preferences.notifications.manualDnd);
  const [autoDnd, setAutoDnd] = useState(false);
  const [queue, setQueue] = useState<QueuedNotification[]>([]);

  const dndActive = manualDnd || autoDnd;

  // Auto-expire queued notifications older than 24h
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - DND_QUEUE_EXPIRY_MS;
      setQueue((prev) => prev.filter((n) => n.timestamp.getTime() > cutoff));
    }, 60_000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const toggleManualDnd = useCallback(() => {
    updatePreferences({
      notifications: { ...preferences.notifications, manualDnd: !manualDnd },
    });
  }, [manualDnd, preferences.notifications, updatePreferences]);

  const isCritical = useCallback((tag: string) => CRITICAL_TYPES.has(tag), []);

  const tryQueue = useCallback(
    (notification: QueuedNotification, criticalTag?: string): boolean => {
      // Critical alerts always break through
      if (criticalTag && CRITICAL_TYPES.has(criticalTag)) {
        return false; // Not queued — show immediately
      }
      // If DND is not active, don't queue
      if (!dndActive) {
        return false;
      }
      // Queue the notification silently
      setQueue((prev) => [...prev, notification]);
      return true; // Queued
    },
    [dndActive],
  );

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const flushQueue = useCallback(() => {
    const flushed = [...queueRef.current];
    setQueue([]);
    return flushed;
  }, []);

  const dismissQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return (
    <DNDContext.Provider
      value={{
        dndActive,
        manualDnd,
        autoDnd,
        queue,
        queueCount: queue.length,
        toggleManualDnd,
        setAutoDnd,
        tryQueue,
        flushQueue,
        dismissQueued,
        clearQueue,
        isCritical,
      }}
    >
      {children}
    </DNDContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useDND = () => useContext(DNDContext);
