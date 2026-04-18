// [claude-code 2026-04-19] S25: SW `notification-tap` message → tab focus + DetailSheet open.
//   Parses the URL shape sent by backend push payload builders:
//     /apparatus/approvals/{id}        → toolApproval
//     /riskflow?item={id}              → riskflowItem
//     /narrative/catalyst/{id}         → catalyst
//     /briefing                        → dailyBrief
//     /chat?conversationId=…           → keep existing chat-relay behavior (no modal)
import { useEffect } from "react";
import { useNotificationModal } from "../contexts/NotificationModalContext";

type TabIndex = 0 | 1 | 2 | 3 | 4;

interface Options {
  onTabChange: (index: TabIndex) => void;
}

export function useNotificationTapRouter({ onTabChange }: Options) {
  const { open } = useNotificationModal();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "notification-tap") return;
      const { category, url, conversationId } = event.data as {
        category?: string;
        url?: string;
        conversationId?: string | null;
      };

      // 1. Route tab focus (same as before — preserves prior UX)
      if (category === "riskflow") {
        onTabChange(1);
      } else if (
        category === "chat" ||
        category === "toolApprovals" ||
        category === "chat_relay"
      ) {
        onTabChange(2);
        if (category === "chat_relay" && conversationId) {
          try {
            sessionStorage.setItem(
              "fintheon:pending-relay-conv",
              conversationId,
            );
            window.dispatchEvent(
              new CustomEvent("fintheon:relay-dispatch", {
                detail: { conversationId },
              }),
            );
          } catch {
            /* ignore */
          }
        }
      } else if (category === "dailyBrief") {
        onTabChange(0);
      }

      // 2. Detail modal open if URL matches a known shape
      if (!url) return;

      try {
        // URLs are path+query only (no host) per our SW payload — synth a base.
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname;

        // /apparatus/approvals/{id}
        const approvalMatch = path.match(/^\/apparatus\/approvals\/([^/]+)/);
        if (approvalMatch) {
          open({ kind: "toolApproval", approvalId: approvalMatch[1] });
          return;
        }

        // /riskflow?item={id}
        if (path === "/riskflow") {
          const itemId = parsed.searchParams.get("item");
          if (itemId) open({ kind: "riskflowItem", itemId });
          return;
        }

        // /narrative/catalyst/{id}
        const catalystMatch = path.match(/^\/narrative\/catalyst\/([^/]+)/);
        if (catalystMatch) {
          open({ kind: "catalyst", catalystId: catalystMatch[1] });
          return;
        }

        // /briefing
        if (path === "/briefing" || path === "/briefing/") {
          open({ kind: "dailyBrief" });
          return;
        }
      } catch {
        /* malformed url — fall through, tab change already happened */
      }
    };

    // Also listen for in-app card taps that want to open the modal without going through SW
    const openDetailHandler = (e: Event) => {
      const custom = e as CustomEvent<{
        kind: "toolApproval" | "riskflowItem" | "catalyst" | "dailyBrief";
        id?: string;
      }>;
      if (!custom.detail) return;
      const { kind, id } = custom.detail;
      if (kind === "toolApproval" && id)
        open({ kind: "toolApproval", approvalId: id });
      else if (kind === "riskflowItem" && id)
        open({ kind: "riskflowItem", itemId: id });
      else if (kind === "catalyst" && id)
        open({ kind: "catalyst", catalystId: id });
      else if (kind === "dailyBrief") open({ kind: "dailyBrief", briefId: id });
    };

    navigator.serviceWorker.addEventListener("message", handler);
    window.addEventListener("fintheon:open-detail", openDetailHandler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
      window.removeEventListener("fintheon:open-detail", openDetailHandler);
    };
  }, [onTabChange, open]);
}
