// [claude-code 2026-04-18] S24-T4: approval-card rendering for regimeProposals / lexiconProposals / walkBackReverts / toolApprovals
// [claude-code 2026-04-18] A4: bottom-sheet notification history, grouped by day
import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { SnapSheet } from "../shared/SnapSheet";
import type { NotificationItem } from "../../hooks/useNotificationHistory";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

const APPROVAL_CATEGORIES = new Set([
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
]);

const APPROVAL_ENDPOINT_MAP: Record<string, string> = {
  regimeProposals: "/api/regime/proposals",
  lexiconProposals: "/api/lexicon/proposals",
  walkBackReverts: "/api/riskflow/walk-back-proposals",
  toolApprovals: "/api/tool-approvals",
};

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
  const { getAccessToken } = useAuth();
  const [decided, setDecided] = useState<Record<string, "approved" | "denied">>(
    {},
  );
  const [pending, setPending] = useState<Set<string>>(new Set());

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

  const decide = async (n: NotificationItem, action: "approve" | "deny") => {
    if (!n.eventId) return;
    const endpoint = APPROVAL_ENDPOINT_MAP[n.category];
    if (!endpoint) return;
    setPending((prev) => new Set(prev).add(n.id));
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}${endpoint}/${n.eventId}/${action}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDecided((prev) => ({
        ...prev,
        [n.id]: action === "approve" ? "approved" : "denied",
      }));
      if (!n.read) void markRead([n.id]);
    } catch {
      // best effort — card stays actionable
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }
  };

  return (
    <SnapSheet isOpen={isOpen} onClose={onClose} title="Notifications">
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
              {items.map((n) => {
                const isApproval = APPROVAL_CATEGORIES.has(n.category);
                const status = decided[n.id];
                return (
                  <div
                    key={n.id}
                    onClick={isApproval ? undefined : () => void onItemTap(n)}
                    role={isApproval ? undefined : "button"}
                    style={{
                      width: "100%",
                      background:
                        status === "approved"
                          ? "rgba(199, 159, 74, 0.10)"
                          : status === "denied"
                            ? "rgba(120,120,120,0.06)"
                            : n.read
                              ? "transparent"
                              : "rgba(199, 159, 74, 0.06)",
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${severityColor(n.severity)}`,
                      padding: "12px 14px",
                      marginBottom: 8,
                      textAlign: "left",
                      cursor: !isApproval && n.url ? "pointer" : "default",
                      WebkitTapHighlightColor: "transparent",
                      opacity: status ? 0.6 : 1,
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
                        marginBottom: isApproval ? 10 : 0,
                      }}
                    >
                      {n.body}
                    </div>
                    {isApproval && !status && n.eventId && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        {/* [claude-code 2026-04-19] Borderless, transparent, accent-letters per TP */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void decide(n, "deny");
                          }}
                          disabled={pending.has(n.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontFamily: "var(--font-data)",
                            letterSpacing: "0.06em",
                            color: "var(--accent)",
                            background: "transparent",
                            border: "none",
                            cursor: pending.has(n.id)
                              ? "not-allowed"
                              : "pointer",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          <XCircle size={12} />
                          Deny
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void decide(n, "approve");
                          }}
                          disabled={pending.has(n.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontFamily: "var(--font-data)",
                            letterSpacing: "0.06em",
                            fontWeight: 600,
                            color: "var(--accent)",
                            background: "transparent",
                            border: "none",
                            cursor: pending.has(n.id)
                              ? "not-allowed"
                              : "pointer",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Approve
                        </button>
                      </div>
                    )}
                    {status && (
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-data)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--text-secondary)",
                          textAlign: "right",
                        }}
                      >
                        {status}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </SnapSheet>
  );
}
