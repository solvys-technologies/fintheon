// [claude-code 2026-04-28] S47-T4: Shared approval modal for tools/Narratives/Catalyst Watch/Refinement edits.
// Reuses the developer-settings SHA-256 gate for admin password verification.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { authenticateDev } from "../../lib/dev-settings-auth";
import { ChatCitationIcon } from "../icon-bank/ChatCitationIcon";

export interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onDeny?: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  requirePassword?: boolean;
}

export function ApprovalModal({
  open,
  onClose,
  onApprove,
  onDeny,
  title = "Approve Action",
  description = "This action requires approval before proceeding.",
  actionLabel = "Approve",
  requirePassword = false,
}: ApprovalModalProps) {
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
    if (requirePassword && !password) return;
    setChecking(true);
    setError(null);
    try {
      if (requirePassword) {
        const ok = await authenticateDev(password);
        if (!ok) {
          setError("Incorrect password.");
          setChecking(false);
          return;
        }
      }
      onApprove();
    } catch {
      setError("Approval failed.");
    } finally {
      setChecking(false);
    }
  }, [password, requirePassword, onApprove]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
          width: 400,
          maxWidth: "calc(100vw - 40px)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChatCitationIcon kind="approval" size={30} title="Approval" />
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
            {title}
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
          {description}
        </p>
        {requirePassword && (
          <input
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Admin password"
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
        )}
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
          {onDeny && (
            <button
              type="button"
              onClick={() => {
                onDeny();
                onClose();
              }}
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
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <X size={12} />
              Deny
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={checking || (requirePassword && !password)}
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
              opacity: checking || (requirePassword && !password) ? 0.6 : 1,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={12} />
            {checking ? "Checking…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
