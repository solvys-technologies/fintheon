import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Lock, LockOpen, Moon, Sun, Sunset } from "lucide-react";
import { useLockout, type BriefingAnchor } from "../../hooks/useLockout";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";

const BRIEF_OPTIONS: Array<{
  id: BriefingAnchor;
  label: string;
  detail: string;
  icon: typeof Sun;
}> = [
  { id: "mdb", label: "Morning Brief", detail: "6:30 AM ET", icon: Sun },
  { id: "adb", label: "Afternoon Brief", detail: "10:45 AM ET", icon: Sunset },
  { id: "pmdb", label: "PM Brief", detail: "5:15 PM ET", icon: Moon },
];

export function HeaderLockButton() {
  const {
    state,
    unlock,
    lockUntilBriefing,
    lockUntilDeskSession,
    requestPermission,
  } = useLockout();
  const { lockoutPermission } = useSettings();
  const { addToast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const refreshPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 248;
    const left = Math.max(
      12,
      Math.min(rect.right - width, window.innerWidth - width - 12),
    );
    setPosition({ top: rect.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshPosition();
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", refreshPosition);
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("resize", refreshPosition);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, refreshPosition]);

  const handlePermission = async () => {
    setBusy("permission");
    try {
      const granted = await requestPermission();
      addToast(
        granted ? "Lock gate approved" : "Lock gate not approved",
        granted ? "success" : "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleBriefLock = async (anchor: BriefingAnchor) => {
    setBusy(anchor);
    try {
      const next = await lockUntilBriefing(anchor);
      addToast(
        next.locked ? "Terminal locked" : "Lock failed",
        next.locked ? "success" : "error",
      );
      if (next.locked) setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const handleDeskPlanLock = async () => {
    setBusy("desk-plan");
    try {
      const next = await lockUntilDeskSession();
      addToast(
        next.locked ? "Locked until Desk Plan" : "Desk Plan lock failed",
        next.locked ? "success" : "error",
      );
      if (next.locked) setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const handleUnlock = async () => {
    setBusy("unlock");
    try {
      const ok = await unlock();
      addToast(
        ok ? "Terminal unlocked" : "Unlock failed",
        ok ? "success" : "error",
      );
      if (ok) setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`toolbar-icon-btn ${state.locked ? "toolbar-active" : ""}`}
        title={state.locked ? "Terminal locked" : "Lock terminal"}
        aria-label={state.locked ? "Terminal locked" : "Lock terminal"}
      >
        {state.locked ? (
          <Lock
            className="h-3 w-3 toolbar-icon-active"
            style={
              {
                "--toolbar-icon-active-color": "#ef4444",
              } as CSSProperties
            }
          />
        ) : (
          <LockOpen className="h-3 w-3" />
        )}
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                zIndex: 9999,
              }}
              className="w-[248px] overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-xl animate-dropdown-enter"
            >
              {state.locked && (
                <MenuButton
                  label="Unlock Terminal"
                  detail="Clear active lock"
                  busy={busy === "unlock"}
                  onClick={handleUnlock}
                  icon={LockOpen}
                />
              )}
              {lockoutPermission !== "granted" && (
                <MenuButton
                  label="Approve Lock Gate"
                  detail="One-time macOS gate"
                  busy={busy === "permission"}
                  onClick={handlePermission}
                  icon={Lock}
                />
              )}
              {BRIEF_OPTIONS.map((option) => (
                <MenuButton
                  key={option.id}
                  label={option.label}
                  detail={option.detail}
                  busy={busy === option.id}
                  onClick={() => handleBriefLock(option.id)}
                  icon={option.icon}
                />
              ))}
              <MenuButton
                label="Next Desk Plan"
                detail="Release before session"
                busy={busy === "desk-plan"}
                onClick={handleDeskPlanLock}
                icon={BookOpen}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuButton({
  label,
  detail,
  busy,
  onClick,
  icon: Icon,
}: {
  label: string;
  detail: string;
  busy: boolean;
  onClick: () => void;
  icon: typeof Sun;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--fintheon-accent)]/75" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-100">
          {busy ? "Working..." : label}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-500">
          {detail}
        </span>
      </span>
    </button>
  );
}
