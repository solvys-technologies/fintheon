// [claude-code 2026-04-24] S37: password popup that unlocks the Refinement Engine Advanced pane. Reuses the developer-settings SHA-256 gate so users only remember one password; success persists to localStorage+sessionStorage so the pane stays editable for the session.
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { unlockRefinementEdit } from "../../lib/dev-settings-auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export function RefinementEditLockModal({ open, onClose, onUnlocked }: Props) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
      setChecking(false);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = useCallback(async () => {
    if (!password) return;
    setChecking(true);
    setError(null);
    try {
      const ok = await unlockRefinementEdit(password);
      if (ok) {
        onUnlocked();
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Unlock failed.");
    } finally {
      setChecking(false);
    }
  }, [password, onUnlocked]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock editing"
      onClick={onClose}
      className="fintheon-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fintheon-modal-surface"
        style={{
          width: 380,
          maxWidth: "calc(100vw - 40px)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Lock size={14} strokeWidth={2.2} color="var(--fintheon-accent)" />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fintheon-accent)",
            }}
          >
            Unlock editing
          </div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--fintheon-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          Enter the developer-settings password to edit the Refinement Engine.
          Read-only by default; unlocking lets you mutate matrices, lexicons,
          weights, and source-account lists for this browser session.
        </p>
        <input
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Password"
          disabled={checking}
          style={{
            padding: "10px 12px",
            background: "var(--fintheon-surface)",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
            color: "var(--fintheon-text)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: "0.04em",
            outline: "none",
          }}
        />
        {error && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fintheon-bearish)",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={checking}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border:
                "1px solid color-mix(in srgb, var(--fintheon-muted) 30%, transparent)",
              color: "var(--fintheon-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.08em",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={checking || !password}
            style={{
              padding: "8px 14px",
              background: "var(--fintheon-accent)",
              border: "1px solid var(--fintheon-accent)",
              color: "var(--fintheon-bg)",
              fontFamily: "var(--font-heading)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              cursor: checking ? "wait" : "pointer",
              opacity: checking || !password ? 0.6 : 1,
              textTransform: "uppercase",
            }}
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
