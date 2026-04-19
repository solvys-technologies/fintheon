// [claude-code 2026-04-19] S26-P2 T9: Maintenance Request detail modal per TP —
//   "the preview of the issue, the description of what the fix was that was applied,
//   permission to go ahead and commit it... a third option for it to be deployed.
//   The approved option should be for it to just commit the changes."
//
//   Three buttons: COMMIT (accent outline), COMMIT + DEPLOY (accent filled),
//   DENY (muted secondary). Only super-admins see the buttons; everyone else gets
//   the issue + fix readout.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DetailHeader } from "./DetailHeader";
import { useMaintenanceById } from "../../hooks/useMaintenanceById";
import { useAuth } from "../../contexts/AuthContext";
import {
  decideMaintenance,
  type MaintenanceAction,
} from "../../lib/services/maintenance";
import { haptic } from "../../lib/haptics";

interface Props {
  requestId: string;
  onClose: () => void;
}

type Status =
  | { kind: "pending" }
  | { kind: "working"; action: MaintenanceAction }
  | { kind: "done"; action: MaintenanceAction; message: string }
  | { kind: "error"; action: MaintenanceAction; error: string };

export function MaintenanceDetail({ requestId, onClose }: Props) {
  const { request, isLoading, error } = useMaintenanceById(requestId);
  const { getAccessToken, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "pending" });

  const severity = request?.severity ?? "medium";

  const headerSev = useMemo(() => {
    if (severity === "low") return "medium" as const;
    if (severity === "high") return "high" as const;
    if (severity === "critical") return "critical" as const;
    return "medium" as const;
  }, [severity]);

  async function act(action: MaintenanceAction) {
    if (!request) return;
    setStatus({ kind: "working", action });
    const token = await getAccessToken();
    const result = await decideMaintenance(
      { requestId: request.id, action },
      token,
    );
    if (result.ok) {
      if (action === "deny") haptic.deny();
      else haptic.success();
      setStatus({
        kind: "done",
        action,
        message: result.message ?? "Decision recorded.",
      });
      // Auto-dismiss on success after a short confirmation pause.
      window.setTimeout(() => onClose(), 1400);
    } else {
      haptic.deny();
      setStatus({
        kind: "error",
        action,
        error: result.error ?? "Decision failed.",
      });
    }
  }

  if (isLoading) {
    return (
      <div>
        <DetailHeader label="Maintenance" onClose={onClose} />
        <Placeholder>[LOADING REQUEST...]</Placeholder>
      </div>
    );
  }
  if (error || !request) {
    return (
      <div>
        <DetailHeader label="Maintenance" onClose={onClose} />
        <Placeholder>{error ?? "Request not available."}</Placeholder>
      </div>
    );
  }

  const working = status.kind === "working";
  const done = status.kind === "done";

  return (
    <div>
      <DetailHeader
        label="Maintenance"
        severity={headerSev}
        timeLabel={formatTime(request.createdAt)}
        onClose={onClose}
      />

      <motion.div
        initial="hidden"
        animate="shown"
        variants={{
          hidden: {},
          shown: { transition: { staggerChildren: 0.08 } },
        }}
      >
        <Row>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 20,
              lineHeight: 1.28,
              color: "var(--text-primary)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {request.issuePreview.split("\n")[0]}
          </h2>
          <MetaRow severity={severity} commit={request.sourceCommit} />
        </Row>

        <Row>
          <Block label="Issue">{request.issuePreview}</Block>
        </Row>

        <Row>
          <Block label="Fix applied">{request.fixDescription}</Block>
        </Row>
      </motion.div>

      {isSuperAdmin ? (
        <ActionBar
          working={working}
          done={done}
          onCommit={() => act("approve_commit")}
          onCommitDeploy={() => act("approve_and_deploy")}
          onDeny={() => act("deny")}
        />
      ) : (
        <ReadOnlyFooter />
      )}

      {status.kind === "done" && (
        <StatusLine tone="ok">{status.message}</StatusLine>
      )}
      {status.kind === "error" && (
        <StatusLine tone="error">{status.error}</StatusLine>
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        shown: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: [0.22, 0.1, 0.2, 1] },
        },
      }}
      style={{ marginBottom: 14 }}
    >
      {children}
    </motion.div>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "color-mix(in srgb, var(--accent) 3%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MetaRow({ severity, commit }: { severity: string; commit?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <span>{severity}</span>
      {commit && (
        <>
          <span style={{ color: "var(--text-disabled)" }}>·</span>
          <span>commit {commit}</span>
        </>
      )}
    </div>
  );
}

function ActionBar({
  working,
  done,
  onCommit,
  onCommitDeploy,
  onDeny,
}: {
  working: boolean;
  done: boolean;
  onCommit: () => void;
  onCommitDeploy: () => void;
  onDeny: () => void;
}) {
  const disabled = working || done;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 20,
        paddingTop: 16,
        borderTop:
          "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onCommitDeploy}
        disabled={disabled}
        style={btnStyle("primary", disabled)}
      >
        COMMIT + DEPLOY
      </button>
      <button
        type="button"
        onClick={onCommit}
        disabled={disabled}
        style={btnStyle("outline", disabled)}
      >
        COMMIT ONLY
      </button>
      <button
        type="button"
        onClick={onDeny}
        disabled={disabled}
        style={btnStyle("muted", disabled)}
      >
        DENY
      </button>
    </div>
  );
}

function ReadOnlyFooter() {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop:
          "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: "var(--text-disabled)",
        textAlign: "center",
        textTransform: "uppercase",
      }}
    >
      [READ-ONLY — SUPER ADMIN DECISION PENDING]
    </div>
  );
}

function StatusLine({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        marginTop: 10,
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textAlign: "center",
        color: tone === "ok" ? "var(--accent)" : "var(--error, #d84f4f)",
      }}
    >
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "40px 0",
        display: "flex",
        justifyContent: "center",
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        color: "var(--text-disabled)",
      }}
    >
      {children}
    </div>
  );
}

function btnStyle(
  intent: "primary" | "outline" | "muted",
  disabled: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "12px 16px",
    fontFamily: "var(--font-data)",
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    WebkitTapHighlightColor: "transparent",
    opacity: disabled ? 0.55 : 1,
    borderRadius: 10,
    transition: "opacity 180ms ease, background 180ms ease",
  };
  if (intent === "primary") {
    return {
      ...base,
      background: "var(--accent)",
      border: "none",
      color: "var(--black, #000)",
    };
  }
  if (intent === "outline") {
    return {
      ...base,
      background: "transparent",
      border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
      color: "var(--accent)",
    };
  }
  return {
    ...base,
    background: "transparent",
    border:
      "1px solid color-mix(in srgb, var(--text-secondary) 30%, transparent)",
    color: "var(--text-secondary)",
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    hour12: true,
  });
}
