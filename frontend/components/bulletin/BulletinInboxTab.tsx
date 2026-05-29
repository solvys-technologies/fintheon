import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Diff,
  Newspaper,
  Server,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useDND, type QueuedNotification } from "../../contexts/DNDContext";
import {
  useServerNotifications,
  type ServerNotification,
} from "../../contexts/NotificationsContext";
import {
  categoryToQueuedType,
  isErrorQueuedNotification,
  isErrorServerNotification,
} from "../../lib/notification-presentation";
import { timeAgo } from "../../lib/time-utils";

function notificationIcon(type: QueuedNotification["type"], error = false) {
  if (error) {
    return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  }
  switch (type) {
    case "iv":
      return <Diff className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />;
    case "news":
      return (
        <Newspaper className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
      );
    case "tilt":
      return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
    case "trade":
      return <ShieldAlert className="h-3.5 w-3.5 text-blue-400" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
    case "system":
      return <Server className="h-3.5 w-3.5 text-[var(--fintheon-muted)]" />;
  }
}

export function BulletinInboxTab() {
  const { queue, dismissQueued, clearQueue, dndActive, toggleManualDnd } =
    useDND();
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    clearOne,
    clearAll,
  } = useServerNotifications();

  const totalCount = notifications.length + queue.length;
  const canClear = totalCount > 0;
  const canMarkRead = unreadCount > 0;

  const handleClearAll = async () => {
    clearQueue();
    if (notifications.length > 0) await clearAll();
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
              Inbox
            </span>
            {unreadCount > 0 ? (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--fintheon-accent)]/18 px-1 text-[8px] font-bold text-[var(--fintheon-accent)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--fintheon-muted)]">
            Server notifications stay tied to your Fintheon user ID.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleManualDnd}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
            dndActive
              ? "border-[var(--fintheon-accent)]/28 bg-[var(--fintheon-accent)]/12 text-[var(--fintheon-accent)]"
              : "border-[var(--fintheon-accent)]/10 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)]"
          }`}
          title={dndActive ? "Disable DND" : "Enable DND"}
        >
          {dndActive ? (
            <BellOff className="h-3.5 w-3.5" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          className="h-7 rounded-md border border-[var(--fintheon-accent)]/10 px-2 text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition-colors hover:text-[var(--fintheon-accent)]"
        >
          {loading ? "Syncing" : "Sync"}
        </button>
        <button
          type="button"
          disabled={!canMarkRead}
          onClick={() => void markAllRead()}
          className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--fintheon-accent)]/10 px-2 text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition-colors enabled:hover:text-[var(--fintheon-accent)] disabled:opacity-35"
        >
          <CheckCircle2 className="h-3 w-3" />
          Read
        </button>
        <button
          type="button"
          disabled={!canClear}
          onClick={() => void handleClearAll()}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-red-400/10 px-2 text-[9px] uppercase tracking-[0.12em] text-red-300/70 transition-colors enabled:hover:text-red-300 disabled:opacity-35"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="grid min-h-[136px] place-items-center rounded-lg border border-[var(--fintheon-accent)]/8 bg-black/10 px-4 py-8 text-center">
          <div>
            <Bell className="mx-auto mb-2 h-6 w-6 text-[var(--fintheon-muted)]/40" />
            <p className="text-[11px] text-[var(--fintheon-muted)]">
              No notifications
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notification) => (
            <ServerNotificationRow
              key={notification.id}
              notification={notification}
              onRead={markRead}
              onClear={clearOne}
            />
          ))}
          {queue.map((notification) => (
            <QueuedNotificationRow
              key={notification.id}
              notification={notification}
              onDismiss={dismissQueued}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerNotificationRow({
  notification,
  onRead,
  onClear,
}: {
  notification: ServerNotification;
  onRead: (id: string) => Promise<void>;
  onClear: (id: string) => Promise<void>;
}) {
  const isError = isErrorServerNotification(notification);
  const type = categoryToQueuedType(notification.category);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!notification.read) void onRead(notification.id);
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !notification.read)
          void onRead(notification.id);
      }}
      className={`group flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
        notification.read
          ? "border-[var(--fintheon-accent)]/6 bg-black/8"
          : "border-[var(--fintheon-accent)]/14 bg-[var(--fintheon-accent)]/5"
      }`}
    >
      <div className="mt-0.5 shrink-0">{notificationIcon(type, isError)}</div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[11px] font-semibold ${
            notification.read
              ? "text-[var(--fintheon-muted)]"
              : "text-[var(--fintheon-text)]"
          }`}
        >
          {notification.title}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--fintheon-muted)]">
          {notification.body}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[8px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/55">
          <span>{formatCategory(notification.category)}</span>
          <span>{timeAgo(notification.createdAt)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void onClear(notification.id);
        }}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--fintheon-muted)] opacity-70 transition-opacity hover:bg-white/5 hover:opacity-100"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function QueuedNotificationRow({
  notification,
  onDismiss,
}: {
  notification: QueuedNotification;
  onDismiss: (id: string) => void;
}) {
  const isError = isErrorQueuedNotification(notification);

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-[var(--fintheon-accent)]/8 bg-black/8 px-2.5 py-2">
      <div className="mt-0.5 shrink-0">
        {notificationIcon(notification.type, isError)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-[var(--fintheon-text)]">
          {notification.title}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--fintheon-muted)]">
          {notification.message}
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/55">
          Queued · {timeAgo(notification.timestamp.toISOString())}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--fintheon-muted)] opacity-70 transition-opacity hover:bg-white/5 hover:opacity-100"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}
