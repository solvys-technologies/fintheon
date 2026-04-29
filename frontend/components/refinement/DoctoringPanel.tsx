// [claude-code 2026-04-29] S53-T4B: Doctoring Panel — view and manage the incident
// queue for the next debug hook cycle. Submit, view, and clear tickets.
// Solvys materials: frosted-glass container, thin gold separators, monospace
// data, inline status text, muted labels quieter than values.

import { useEffect } from "react";
import { Stethoscope, Trash2 } from "lucide-react";
import { useDoctoringQueue } from "../../hooks/useDoctoringQueue";

const CONTAINER: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px 8px",
  background: "rgba(10, 9, 5, 0.72)",
  backdropFilter: "blur(18px) saturate(1.08)",
  border: "1px solid rgba(199, 159, 74, 0.12)",
};

const HEADER: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fintheon-accent)",
  marginBottom: 0,
};

const TICKET_ROW: React.CSSProperties = {
  padding: "4px 0",
  borderBottom: "1px solid rgba(199, 159, 74, 0.06)",
  fontSize: 10,
};

const TICKET_META: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 2,
};

const TICKET_TIME: React.CSSProperties = {
  color: "var(--fintheon-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  fontVariantNumeric: "tabular-nums",
};

const TICKET_SOURCE: React.CSSProperties = {
  color: "var(--fintheon-text)",
  fontWeight: 600,
  opacity: 0.72,
};

const TICKET_PIPE: React.CSSProperties = {
  color: "var(--fintheon-muted)",
  fontSize: 8,
  fontFamily: "var(--font-mono)",
};

const TICKET_HEADLINE: React.CSSProperties = {
  color: "var(--fintheon-muted)",
  fontSize: 9,
  fontFamily: "var(--font-mono)",
};

const TICKET_REASON: React.CSSProperties = {
  color: "var(--fintheon-accent)",
  fontSize: 8,
  fontFamily: "var(--font-mono)",
  marginTop: 1,
  opacity: 0.6,
};

export function DoctoringPanel() {
  const { tickets, loading, fetchTickets, clearQueue } = useDoctoringQueue();

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  return (
    <div style={CONTAINER}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Stethoscope className="w-3.5 h-3.5" style={{ color: "var(--fintheon-accent)" }} />
          <div style={HEADER}>Doctoring</div>
          {tickets.length > 0 && (
            <span style={{ fontSize: 9, fontFamily: "var(--font-data)", color: "var(--fintheon-accent)", opacity: 0.5 }}>
              {tickets.length}
            </span>
          )}
        </div>
        {tickets.length > 0 && (
          <button
            onClick={clearQueue}
            style={{
              background: "transparent",
              border: "1px solid rgba(239, 68, 68, 0.20)",
              color: "var(--fintheon-bearish)",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              padding: "1px 5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
              letterSpacing: "0.06em",
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
            CLEAR
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "6px 0", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fintheon-muted)" }}>
          [LOADING...]
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ padding: "6px 0", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fintheon-muted)" }}>
          Queue empty. Use Doctorate on source cards to flag incidents for debug review.
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: "auto" }}>
          {tickets.map((ticket) => (
            <div key={ticket.id} style={TICKET_ROW}>
              <div style={TICKET_META}>
                <span style={TICKET_TIME}>
                  {new Date(ticket.submitted_at).toLocaleTimeString("en-US", { hour12: false })}
                </span>
                <span style={TICKET_SOURCE}>{ticket.source}</span>
                <span style={TICKET_PIPE}>{ticket.pipeline}</span>
              </div>
              <div style={TICKET_HEADLINE}>{ticket.headline}</div>
              <div style={TICKET_REASON}>{ticket.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline Doctorate Button (used on source cards) ──────────────────────────

interface DoctorateButtonProps {
  source: string;
  pipeline?: string;
  headline: string;
  reason?: string;
}

export function DoctorateButton({ source, pipeline, headline, reason }: DoctorateButtonProps) {
  const { submitDoctorate } = useDoctoringQueue();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void submitDoctorate({ source, pipeline, headline, reason: reason ?? "operator-flagged" });
      }}
      style={{
        background: "transparent",
        border: "1px solid rgba(199, 159, 74, 0.20)",
        color: "var(--fintheon-accent)",
        fontSize: 8,
        fontFamily: "var(--font-mono)",
        padding: "1px 5px",
        cursor: "pointer",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        lineHeight: "16px",
      }}
      title="Queue for next debug hook cycle"
    >
      DOCTORATE
    </button>
  );
}
