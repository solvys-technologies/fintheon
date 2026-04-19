// [claude-code 2026-04-19] S26-P1 T7: haptic feedback on approve (success buzz) /
//   deny (deny buzz). Respects the global hapticEnabled setting via the module gate.
// [claude-code 2026-04-19] Notification cards redesigned in RiskFlow's mobile shape —
//   vertical fuse bar on the left, headline + body center, approve/deny stacked right.
//   Keeps glassmorphic surface (TP: glass before kanban). Severity still drives the
//   fuse color; severity dot removed (now lives in the fuse color/fill).
// [claude-code 2026-04-18] S24-T4: approval-card rendering for regimeProposals / lexiconProposals / walkBackReverts / toolApprovals
// [claude-code 2026-04-18] A4: bottom-sheet notification history, grouped by day
import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { SnapSheet } from "../shared/SnapSheet";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import type { NotificationItem } from "../../hooks/useNotificationHistory";
import { useAuth } from "../../contexts/AuthContext";
import { haptic } from "../../lib/haptics";

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

function severityScore(sev: NotificationItem["severity"]): number {
  switch (sev) {
    case "critical":
      return 10;
    case "high":
      return 7.5;
    case "medium":
      return 5;
    default:
      return 2.5;
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
      if (action === "approve") haptic.success();
      else haptic.deny();
      if (!n.read) void markRead([n.id]);
    } catch {
      // best effort — card stays actionable
      haptic.deny();
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
                const sevColor = severityColor(n.severity);
                const fuseValue = severityScore(n.severity);
                return (
                  <div
                    key={n.id}
                    onClick={isApproval ? undefined : () => void onItemTap(n)}
                    role={isApproval ? undefined : "button"}
                    style={{
                      // Glassmorphic, RiskFlow-shaped card: fuse | body | actions
                      width: "100%",
                      display: "flex",
                      alignItems: "stretch",
                      gap: 12,
                      background: n.read
                        ? "rgba(255,255,255,0.015)"
                        : "color-mix(in srgb, var(--accent) 5%, transparent)",
                      backdropFilter: "blur(18px) saturate(1.3)",
                      WebkitBackdropFilter: "blur(18px) saturate(1.3)",
                      border:
                        "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      marginBottom: 10,
                      textAlign: "left",
                      cursor: !isApproval && n.url ? "pointer" : "default",
                      WebkitTapHighlightColor: "transparent",
                      opacity: status ? 0.55 : 1,
                      boxShadow: n.read
                        ? "none"
                        : "0 1px 20px color-mix(in srgb, var(--accent) 6%, transparent)",
                      transition:
                        "opacity 220ms ease, background 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
                    }}
                  >
                    {/* Left: vertical fuse bar — severity-driven, matches RiskFlow */}
                    <VerticalFuseBar value={fuseValue} color={sevColor} />

                    {/* Center: source/time + title + body */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 3,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: "var(--font-data)",
                          fontSize: 9,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span>{n.severity}</span>
                        <span style={{ color: "var(--text-disabled)" }}>
                          &middot;
                        </span>
                        <span>{timeLabel(n.createdAt)}</span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 14,
                          lineHeight: 1.4,
                          fontWeight: n.read ? 400 : 600,
                          color: n.read
                            ? "var(--text-primary)"
                            : "var(--accent)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as const,
                          overflow: "hidden",
                        }}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as const,
                            overflow: "hidden",
                          }}
                        >
                          {n.body}
                        </span>
                      )}
                      {status && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-data)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          [{status}]
                        </span>
                      )}
                    </div>

                    {/* Right: approve/deny icon-only stack (TP: Check over X,
                        Approve = accent, Deny = muted secondary) */}
                    {isApproval && !status && n.eventId ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignSelf: "center",
                          flexShrink: 0,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void decide(n, "approve");
                          }}
                          disabled={pending.has(n.id)}
                          aria-label="Approve"
                          style={iconBtnStyle("approve", pending.has(n.id))}
                        >
                          <CheckCircle2 size={20} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void decide(n, "deny");
                          }}
                          disabled={pending.has(n.id)}
                          aria-label="Deny"
                          style={iconBtnStyle("deny", pending.has(n.id))}
                        >
                          <XCircle size={20} strokeWidth={1.8} />
                        </button>
                      </div>
                    ) : null}
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

/** Icon-only 36×36 tap target. Approve = accent, Deny = muted secondary. */
function iconBtnStyle(
  kind: "approve" | "deny",
  isPending: boolean,
): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: kind === "approve" ? "var(--accent)" : "var(--text-secondary)",
    cursor: isPending ? "not-allowed" : "pointer",
    opacity: isPending ? 0.4 : 1,
    WebkitTapHighlightColor: "transparent",
    transition:
      "opacity 150ms ease, background 150ms ease, transform 150ms ease",
  };
}
