// [claude-code 2026-04-18] A4: bottom-sheet notification history, grouped by day
import { useMemo } from "react";
import { BottomSheet } from "../shared/BottomSheet";
import type { NotificationItem } from "../../hooks/useNotificationHistory";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function severityColor(sev: NotificationItem["severity"]): string {
  switch (sev) {
    case "critical":
      return "var(--error, #d84f4f)";
    case "high":
      return "var(--accent)";
    case "medium":
      return "var(--text-secondary)";
    default:
      return "var(--text-secondary)";
  }
}

export function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  markRead,
  markAllRead,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of notifications) {
      const key = dayLabel(n.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [notifications]);

  const hasUnread = notifications.some((n) => !n.read);

  const onItemTap = async (n: NotificationItem) => {
    if (!n.read) await markRead([n.id]);
    if (n.url) {
      window.location.href = n.url;
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Notifications">
      <div style={{ padding: "0 16px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
          >
            {notifications.length}{" "}
            {notifications.length === 1 ? "alert" : "alerts"}
          </span>
          {hasUnread && (
            <button
              onClick={markAllRead}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.04em",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            No notifications yet
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <div key={day} style={{ marginTop: 20 }}>
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                {day}
              </div>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemTap(n)}
                  style={{
                    width: "100%",
                    background: n.read
                      ? "transparent"
                      : "rgba(199, 159, 74, 0.06)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${severityColor(n.severity)}`,
                    padding: "12px 14px",
                    marginBottom: 8,
                    textAlign: "left",
                    cursor: n.url ? "pointer" : "default",
                    WebkitTapHighlightColor: "transparent",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        fontWeight: n.read ? 400 : 600,
                        color: n.read ? "var(--text)" : "var(--accent)",
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      {timeLabel(n.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {n.body}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
