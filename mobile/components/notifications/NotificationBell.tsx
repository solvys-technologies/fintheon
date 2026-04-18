// [claude-code 2026-04-18] A4: bell glyph + unread badge, opens NotificationDrawer
import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationHistory } from "../../hooks/useNotificationHistory";
import { NotificationDrawer } from "./NotificationDrawer";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationHistory();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        style={{
          background: "transparent",
          border: "none",
          padding: 8,
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          position: "relative",
        }}
      >
        <Bell
          size={20}
          strokeWidth={1.5}
          color={unreadCount > 0 ? "var(--accent)" : "var(--text-secondary)"}
        />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "var(--accent)",
              color: "var(--black)",
              fontFamily: "var(--font-data)",
              fontSize: 9,
              fontWeight: 600,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              padding: "0 3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        markRead={markRead}
        markAllRead={markAllRead}
      />
    </>
  );
}
