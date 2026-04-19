// [claude-code 2026-04-18] v5.22 polish per TP — overhauled drawer.
//   • Cards extracted into NotificationCard with bidirectional swipe (left = dismiss,
//     right = ASK HARPER for scored alerts / REVEAL ACTIONS for proposals).
//   • "Clear" button at top-right runs a fast staggered exit (40ms between cards) and
//     marks-all-read on the backend.
//   • Local dismissedIds Set persisted to localStorage so dismissed cards stay gone
//     across drawer opens and across reloads.
//   • System categories (regimeActivations / dailyBrief / maintenanceRequest /
//     proposals) skip the severity fuse — they're system pings, not scored signals.
// [claude-code 2026-04-19] S26-P1 T7: haptic feedback on approve / deny.
// [claude-code 2026-04-18] A4: bottom-sheet notification history, grouped by day.
import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { SnapSheet } from "../shared/SnapSheet";
import type { NotificationItem } from "../../hooks/useNotificationHistory";
import { useAuth } from "../../contexts/AuthContext";
import { haptic } from "../../lib/haptics";
import { useNotificationModal } from "../../contexts/NotificationModalContext";
import { NotificationCard } from "./NotificationCard";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DISMISSED_STORAGE_KEY = "fintheon-mobile:dismissed-notifications";
const CLEAR_STAGGER_MS = 40;

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

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* storage full — ignore */
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
  const { open: openDetail } = useNotificationModal();
  const [decided, setDecided] = useState<Record<string, "approved" | "denied">>(
    {},
  );
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  // Persist whenever dismissed changes
  useEffect(() => {
    saveDismissed(dismissed);
  }, [dismissed]);

  const dismissOne = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Visible list = notifications minus locally-dismissed.
  const visible = useMemo(
    () => notifications.filter((n) => !dismissed.has(n.id)),
    [notifications, dismissed],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of visible) {
      const key = dayLabel(n.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  const hasAny = visible.length > 0;

  // [v5.22 polish] "Clear" runs a fast staggered exit so the drawer empties
  // visibly card-by-card instead of all-at-once. ~40ms per card → ~13 cards
  // takes ~520ms total, fast enough to feel snappy.
  const clearAll = useCallback(async () => {
    haptic.tap();
    const ids = visible.map((n) => n.id);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // small delay between dismissals — feels like cards flicking off the stack
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, CLEAR_STAGGER_MS));
    }
    void markAllRead();
  }, [visible, markAllRead]);

  // Card tap → mark-read + open detail or navigate.
  const onItemTap = useCallback(
    async (n: NotificationItem) => {
      if (!n.read) await markRead([n.id]);
      if (!n.url) return;

      let routed = false;
      try {
        const parsed = new URL(n.url, window.location.origin);
        const path = parsed.pathname;

        const approvalMatch = path.match(/^\/apparatus\/approvals\/([^/]+)/);
        if (approvalMatch) {
          openDetail({ kind: "toolApproval", approvalId: approvalMatch[1] });
          routed = true;
        } else if (path.startsWith("/maintenance/")) {
          const id = path.split("/")[2];
          if (id) {
            openDetail({ kind: "maintenanceRequest", requestId: id });
            routed = true;
          }
        } else if (path === "/riskflow") {
          const itemId = parsed.searchParams.get("item");
          if (itemId) {
            openDetail({ kind: "riskflowItem", itemId });
            routed = true;
          }
        } else {
          const catalystMatch = path.match(/^\/narrative\/catalyst\/([^/]+)/);
          if (catalystMatch) {
            openDetail({ kind: "catalyst", catalystId: catalystMatch[1] });
            routed = true;
          } else if (path === "/briefing" || path === "/briefing/") {
            openDetail({ kind: "dailyBrief" });
            routed = true;
          }
        }
      } catch {
        /* malformed URL — fall through */
      }

      if (routed) {
        onClose();
      } else {
        window.location.href = n.url;
        onClose();
      }
    },
    [markRead, openDetail, onClose],
  );

  // Approve / deny for proposal cards (revealed via swipe-right inside the card).
  const decide = useCallback(
    async (n: NotificationItem, action: "approve" | "deny") => {
      if (!n.eventId) return;
      const endpoint = APPROVAL_ENDPOINT_MAP[n.category];
      if (!endpoint) return;
      setPending((prev) => new Set(prev).add(n.id));
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}${endpoint}/${n.eventId}/${action}`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDecided((prev) => ({
          ...prev,
          [n.id]: action === "approve" ? "approved" : "denied",
        }));
        if (action === "approve") haptic.success();
        else haptic.deny();
        if (!n.read) void markRead([n.id]);
      } catch {
        haptic.deny();
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(n.id);
          return next;
        });
      }
    },
    [getAccessToken, markRead],
  );

  // Send-to-Harper: dispatches a window event the chat surface listens for. App.tsx
  // catches the tab-change side, ChatInput catches the prefill side. The card itself
  // animates the throw-rightward gesture so the user sees feedback even if chat isn't
  // mounted yet (event is fire-and-forget).
  const sendToHarper = useCallback(
    (n: NotificationItem) => {
      const text = `${n.title}${n.body ? `\n\n${n.body}` : ""}`;
      try {
        window.dispatchEvent(
          new CustomEvent("fintheon:harper-prefill", {
            detail: { text, source: "notification", id: n.id },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("fintheon:tab-change", { detail: { index: 2 } }),
        );
      } catch {
        /* ignore */
      }
      if (!n.read) void markRead([n.id]);
      onClose();
    },
    [markRead, onClose],
  );

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
            {visible.length} {visible.length === 1 ? "alert" : "alerts"}
          </span>
          {hasAny && (
            <button
              onClick={clearAll}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "6px 10px",
                minHeight: 36,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {!hasAny ? (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            No notifications
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
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    decided={decided[n.id]}
                    pendingDecision={pending.has(n.id)}
                    onDismiss={dismissOne}
                    onTap={(item) => void onItemTap(item)}
                    onApprove={(item) => void decide(item, "approve")}
                    onDeny={(item) => void decide(item, "deny")}
                    onSendToHarper={sendToHarper}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </SnapSheet>
  );
}
