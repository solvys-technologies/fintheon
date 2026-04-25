// [claude-code 2026-04-25] Advanced reveal switched to t-panel-slide (solvys-transitions)
//   so the pane tweens in with translate-Y + blur + fade instead of an instant mount.
// [claude-code 2026-04-24] S37: (1) header row is right-justified so the Advanced trigger sits opposite the other section labels, mirroring a "glass of a data center" — always visible, read-only by default. (2) when locked, the pane's mutation surface sits under a click-to-unlock overlay that pops the shared developer-settings password modal. (3) unlocking persists across the session via dev-settings-auth; a lock button in the header locks back on demand.
// [claude-code 2026-04-18] S24-T4: Advanced pane — collapsible wrapper for per-event / commentator / source tweaks
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Lock, LockOpen, SlidersHorizontal } from "lucide-react";
import {
  isRefinementEditUnlocked,
  lockRefinementEdit,
} from "../../lib/dev-settings-auth";
import { RefinementEditLockModal } from "./RefinementEditLockModal";

export function AdvancedPane({
  children,
  defaultOpen = false,
  count,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [unlocked, setUnlocked] = useState(() => isRefinementEditUnlocked());
  const [modalOpen, setModalOpen] = useState(false);

  // Drive the t-panel-slide data-open after first paint when opening so the
  // entry tween renders from the closed (translate-Y + blur + opacity:0) state.
  const [revealed, setRevealed] = useState(defaultOpen);
  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Re-sync unlocked state when the modal closes (it may have mutated localStorage).
  useEffect(() => {
    if (!modalOpen) setUnlocked(isRefinementEditUnlocked());
  }, [modalOpen]);

  const handleLock = () => {
    lockRefinementEdit();
    setUnlocked(false);
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--fintheon-glass-border)",
        marginTop: 8,
      }}
    >
      {/* [S37] Header row is right-justified — label/trigger anchor to the right edge. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          padding: "12px 4px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fintheon-muted)",
          }}
        >
          {unlocked ? "Editing unlocked" : "View only"}
        </span>
        <button
          type="button"
          onClick={() => (unlocked ? handleLock() : setModalOpen(true))}
          title={unlocked ? "Lock editing" : "Unlock editing"}
          aria-label={unlocked ? "Lock editing" : "Unlock editing"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            background: "transparent",
            border: `1px solid ${
              unlocked
                ? "color-mix(in srgb, var(--fintheon-accent) 55%, transparent)"
                : "color-mix(in srgb, var(--fintheon-muted) 35%, transparent)"
            }`,
            color: unlocked
              ? "var(--fintheon-accent)"
              : "var(--fintheon-muted)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          {unlocked ? (
            <LockOpen size={11} strokeWidth={2.2} />
          ) : (
            <Lock size={11} strokeWidth={2.2} />
          )}
          {unlocked ? "Unlocked" : "Locked"}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            cursor: "pointer",
            color: "var(--fintheon-text)",
          }}
        >
          <SlidersHorizontal size={12} color="var(--fintheon-accent)" />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--fintheon-text)",
            }}
          >
            Advanced
          </span>
          {typeof count === "number" && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--fintheon-muted)",
              }}
            >
              {count} knob{count === 1 ? "" : "s"}
            </span>
          )}
          <ChevronDown
            size={12}
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 140ms ease",
              opacity: 0.6,
              marginLeft: 2,
            }}
          />
        </button>
      </div>

      {open && (
        <div
          className="t-panel-slide"
          data-open={revealed ? "true" : "false"}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            paddingTop: 4,
            paddingBottom: 12,
          }}
        >
          {children}
          {/* Glass-of-a-data-center overlay: content is always visible, but all
              mutation clicks land on this transparent surface when locked, which
              pops the password modal instead of the underlying control. */}
          {!unlocked && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              aria-label="Unlock editing to interact with Advanced controls"
              style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                zIndex: 5,
              }}
            />
          )}
        </div>
      )}

      <RefinementEditLockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUnlocked={() => {
          setUnlocked(true);
          setModalOpen(false);
        }}
      />
    </div>
  );
}
