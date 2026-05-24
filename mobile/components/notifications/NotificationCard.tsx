// [claude-code 2026-04-18] v5.22 polish — bidirectional swipe + glass card refit per TP.
//   Swipe LEFT → dismiss (red bg + DISMISS label, fade out). Swipe RIGHT on approval
//   notifications → snap-reveal the inline approve / deny buttons (TP: "swipe from the
//   left to the right to be able to bring up the approve or deny buttons"). Swipe RIGHT
//   on non-approval cards → send to Harper (fires fintheon:harper-prefill + tab-change
//   events; ChatInput prefills, App switches to the chat tab). System categories
//   (regimeActivations / dailyBrief / maintenanceRequest / etc.) skip the fuse + severity
//   chrome — they're system pings, not scored alerts.
import { useState, useCallback, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  AnimatePresence,
} from "framer-motion";
import { CheckCircle2, XCircle, MessageCircle, Trash2 } from "lucide-react";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import type { NotificationItem } from "../../hooks/useNotificationHistory";
import { colorForSeverity, type FuseSeverity } from "../../lib/fuse-palette";
import { haptic } from "../../lib/haptics";

const APPROVAL_CATEGORIES = new Set([
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
]);

/** Categories that are pure system signals — no severity score, no fuse. */
const SYSTEM_CATEGORIES = new Set([
  "regimeActivations",
  "dailyBrief",
  "maintenanceRequest",
  "maintenance_request",
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
]);

const DISMISS_THRESHOLD = 96;
const REVEAL_SNAP = 120;
const REVEAL_THRESHOLD = 64;

function paletteSeverity(sev: NotificationItem["severity"]): FuseSeverity {
  return sev as FuseSeverity;
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

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Friendly display label for system categories. */
function systemLabel(category: string): string {
  switch (category) {
    case "regimeActivations":
      return "REGIME";
    case "dailyBrief":
      return "BRIEF";
    case "maintenanceRequest":
    case "maintenance_request":
      return "MAINTENANCE";
    case "regimeProposals":
      return "PROPOSAL";
    case "lexiconProposals":
      return "LEXICON";
    case "walkBackReverts":
      return "WALK-BACK";
    case "toolApprovals":
      return "TOOL";
    default:
      return category.toUpperCase();
  }
}

interface NotificationCardProps {
  notification: NotificationItem;
  decided?: "approved" | "denied";
  pendingDecision?: boolean;
  onDismiss: (id: string) => void;
  onTap: (n: NotificationItem) => void;
  onApprove?: (n: NotificationItem) => void;
  onDeny?: (n: NotificationItem) => void;
  onSendToHarper: (n: NotificationItem) => void;
}

export function NotificationCard({
  notification: n,
  decided,
  pendingDecision,
  onDismiss,
  onTap,
  onApprove,
  onDeny,
  onSendToHarper,
}: NotificationCardProps) {
  const isApproval = APPROVAL_CATEGORIES.has(n.category);
  const isSystem = SYSTEM_CATEGORIES.has(n.category);
  const sevColor = colorForSeverity(paletteSeverity(n.severity));
  const fuseValue = severityScore(n.severity);

  const x = useMotionValue(0);
  const controls = useAnimation();
  const [revealed, setRevealed] = useState(false);
  const dismissBg = useTransform(x, [-DISMISS_THRESHOLD, 0], [0.85, 0]);
  const harperBg = useTransform(x, [0, DISMISS_THRESHOLD], [0, 0.85]);

  const handleDragEnd = useCallback(
    async (
      _: unknown,
      info: { offset: { x: number }; velocity: { x: number } },
    ) => {
      const { offset, velocity } = info;

      // Swipe-left → dismiss
      if (offset.x < -DISMISS_THRESHOLD || velocity.x < -600) {
        haptic.tap();
        await controls.start({
          x: -360,
          opacity: 0,
          transition: { duration: 0.18, ease: "easeOut" },
        });
        onDismiss(n.id);
        return;
      }

      // Swipe-right on approvals → snap to reveal mode
      if (isApproval && (offset.x > REVEAL_THRESHOLD || velocity.x > 400)) {
        haptic.tap();
        setRevealed(true);
        await controls.start({
          x: REVEAL_SNAP,
          transition: { type: "spring", stiffness: 360, damping: 28 },
        });
        return;
      }

      // Swipe-right on non-approvals → send to Harper
      if (!isApproval && (offset.x > DISMISS_THRESHOLD || velocity.x > 600)) {
        haptic.tap();
        await controls.start({
          x: 360,
          opacity: 0.4,
          transition: { duration: 0.18, ease: "easeOut" },
        });
        onSendToHarper(n);
        // Snap back so the card stays in place after the dispatch
        controls.start({
          x: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 320, damping: 30 },
        });
        return;
      }

      // Otherwise snap back to rest
      setRevealed(false);
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 320, damping: 30 },
      });
    },
    [controls, isApproval, n, onDismiss, onSendToHarper],
  );

  const closeReveal = useCallback(() => {
    setRevealed(false);
    controls.start({
      x: 0,
      transition: { type: "spring", stiffness: 320, damping: 30 },
    });
  }, [controls]);

  const onCardTap = useCallback(() => {
    if (revealed) {
      closeReveal();
      return;
    }
    onTap(n);
  }, [revealed, closeReveal, onTap, n]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -360, transition: { duration: 0.16 } }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        position: "relative",
        marginBottom: 10,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Swipe-left action: dismiss bg */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--error)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 22,
          opacity: dismissBg,
          borderRadius: 14,
        }}
        aria-hidden="true"
      >
        <Trash2 size={18} color="white" strokeWidth={2} />
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "white",
            marginLeft: 8,
          }}
        >
          DISMISS
        </span>
      </motion.div>

      {/* Swipe-right action: send to Harper bg */}
      {!isApproval && (
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "color-mix(in srgb, var(--accent, #c79f4a) 80%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 22,
            opacity: harperBg,
            borderRadius: 14,
          }}
          aria-hidden="true"
        >
          <MessageCircle size={18} color="var(--black)" strokeWidth={2} />
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--black)",
              marginLeft: 8,
            }}
          >
            ASK CAO
          </span>
        </motion.div>
      )}

      {/* Approval reveal bg */}
      {isApproval && (
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "color-mix(in srgb, var(--accent, #c79f4a) 14%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 22,
            opacity: harperBg,
            borderRadius: 14,
          }}
          aria-hidden="true"
        >
          <CheckCircle2 size={16} color="var(--accent)" strokeWidth={2} />
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--accent)",
              marginLeft: 6,
              textTransform: "uppercase",
            }}
          >
            REVEAL ACTIONS
          </span>
        </motion.div>
      )}

      {/* The actual card — draggable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -180, right: isApproval ? 180 : 180 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
      >
        <button
          type="button"
          onClick={onCardTap}
          className="fintheon-toast-surface"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "stretch",
            gap: 12,
            background: n.read
              ? "var(--fintheon-glass-surface)"
              : "color-mix(in srgb, var(--accent) 5%, var(--fintheon-glass-surface))",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border:
              "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
            borderRadius: 14,
            padding: "14px 16px",
            textAlign: "left",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            opacity: decided ? 0.55 : 1,
            boxShadow: n.read
              ? "0 1px 8px rgba(0,0,0,0.3)"
              : "0 2px 24px color-mix(in srgb, var(--accent) 8%, transparent), 0 1px 8px rgba(0,0,0,0.4)",
            transition:
              "opacity 220ms ease, background 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
          }}
        >
          {/* Left rail — fuse for scored alerts, accent strip for system pings */}
          {isSystem ? (
            <div
              aria-hidden="true"
              style={{
                width: 3,
                alignSelf: "stretch",
                borderRadius: 2,
                background:
                  "color-mix(in srgb, var(--accent) 35%, transparent)",
                flexShrink: 0,
              }}
            />
          ) : (
            <VerticalFuseBar value={fuseValue} color={sevColor} />
          )}

          {/* Center — full-width content */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
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
              {/* System cards: just category + time. Scored cards: severity + time. */}
              <span>{isSystem ? systemLabel(n.category) : n.severity}</span>
              <span style={{ color: "var(--text-disabled)" }}>&middot;</span>
              <span>{timeLabel(n.createdAt)}</span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: n.read ? 400 : 600,
                color: n.read ? "var(--text-primary)" : "var(--accent)",
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
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }}
              >
                {n.body}
              </span>
            )}
            {decided && (
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
                [{decided}]
              </span>
            )}
          </div>
        </button>

        {/* Approval inline buttons — revealed via swipe-right */}
        <AnimatePresence>
          {isApproval && revealed && !decided && n.eventId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 16px 14px",
                background: "color-mix(in srgb, var(--accent) 4%, transparent)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                borderTop:
                  "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
                marginTop: -1,
                borderRadius: "0 0 14px 14px",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(n);
                  closeReveal();
                }}
                disabled={pendingDecision}
                aria-label="Approve"
                style={{
                  flex: 1,
                  minHeight: 40,
                  background: "var(--accent)",
                  color: "var(--black)",
                  border: "none",
                  borderRadius: 8,
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  cursor: pendingDecision ? "not-allowed" : "pointer",
                  opacity: pendingDecision ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <CheckCircle2 size={14} strokeWidth={2.2} />
                Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeny?.(n);
                  closeReveal();
                }}
                disabled={pendingDecision}
                aria-label="Deny"
                style={{
                  flex: 1,
                  minHeight: 40,
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-visible)",
                  borderRadius: 8,
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  cursor: pendingDecision ? "not-allowed" : "pointer",
                  opacity: pendingDecision ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <XCircle size={14} strokeWidth={2.2} />
                Deny
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/** Stub used by some helper consumers — exported so the drawer can pass it through. */
export type NotificationCardCallbacks = Pick<
  NotificationCardProps,
  "onDismiss" | "onTap" | "onApprove" | "onDeny" | "onSendToHarper"
>;
