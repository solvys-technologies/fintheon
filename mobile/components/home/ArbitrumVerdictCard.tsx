// [claude-code 2026-04-25] S35: mobile Arbitrum surface — compact verdict card (consensus
// %, confidence %, dissent count, digest, seat strip) so chamber risk signals reach the
// mobile dash. Reads from /api/arbitrum/latest via useArbitrumLatest. Empty-state copy
// matches the desktop ArbitrumChamber so users see the same "no fresh read" wording.
import {
  useArbitrumLatest,
  type ArbitrumSeat,
} from "../../hooks/useArbitrumLatest";
import { AskAboutThis } from "../chat/AskAboutThis";

const SEAT_ROLES: ReadonlyArray<ArbitrumSeat["role"]> = [
  "Lead",
  "Forecaster",
  "Risk",
  "Quant",
  "Bear",
];

const EMPTY_COPY = "No fresh chamber read — convenes 17:00 ET or on IV ≥ 8.5.";

function seatLetter(role: string): string {
  return role.charAt(0).toUpperCase();
}

function HeaderRow({
  trigger,
  askPayload,
}: {
  trigger?: string;
  askPayload?: Record<string, unknown>;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        ARBITRUM CHAMBER
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {trigger && (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: "9px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}
          >
            {trigger}
          </span>
        )}
        {askPayload && (
          <AskAboutThis
            surface="arbitrum_verdict"
            label="this verdict"
            size={12}
            payload={askPayload}
          />
        )}
      </div>
    </div>
  );
}

function ConsensusRow({
  pct,
  conf,
  dissentCount,
}: {
  pct: number;
  conf: number;
  dissentCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "16px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          fontFamily: "Doto, var(--font-data)",
          fontSize: "32px",
          color: "var(--accent)",
          lineHeight: 1,
        }}
      >
        {pct}%
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "11px",
          color: "var(--text-secondary)",
        }}
      >
        consensus · conf {conf}%
      </span>
      {dissentCount > 0 && (
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-data)",
            fontSize: "10px",
            color: "var(--error)",
            border: "1px solid var(--error)",
            borderRadius: "999px",
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {dissentCount} dissent
        </span>
      )}
    </div>
  );
}

function SeatStrip({ seats }: { seats: ArbitrumSeat[] }) {
  const bySlot = new Map(seats.map((s) => [s.role, s] as const));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "6px",
        marginTop: "12px",
      }}
    >
      {SEAT_ROLES.map((role) => {
        const seat = bySlot.get(role);
        const has = Boolean(seat);
        const pct = seat ? Math.round(seat.probability * 100) : 0;
        const dissented = Boolean(seat?.dissented);
        return (
          <div
            key={role}
            style={{
              border: dissented
                ? "1px solid var(--accent)"
                : "1px solid var(--border)",
              borderRadius: "8px",
              padding: "6px 4px",
              textAlign: "center",
              backgroundColor: "var(--surface)",
              opacity: has ? 1 : 0.45,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: "9px",
                color: "var(--accent)",
                letterSpacing: "0.06em",
                marginBottom: "2px",
              }}
            >
              {seatLetter(role)}
            </div>
            <div
              style={{
                fontFamily: "Doto, var(--font-data)",
                fontSize: "13px",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              {has ? `${pct}%` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ArbitrumVerdictCard() {
  const { verdict, isLoading, error } = useArbitrumLatest();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px 20px",
      }}
    >
      <HeaderRow
        trigger={verdict?.trigger_type?.toUpperCase()}
        askPayload={
          verdict
            ? {
                verdict_id: verdict.id,
                consensus_probability: verdict.consensus_probability,
                confidence: verdict.confidence,
                dissent_count: verdict.dissent?.count ?? 0,
              }
            : undefined
        }
      />

      {!verdict && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px",
            backgroundColor: "var(--surface)",
          }}
        >
          {isLoading
            ? "Loading chamber read…"
            : error
              ? `Chamber unreachable (${error})`
              : EMPTY_COPY}
        </div>
      )}

      {verdict && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "14px 16px",
            backgroundColor: "var(--surface)",
          }}
        >
          <ConsensusRow
            pct={Math.round((verdict.consensus_probability ?? 0) * 100)}
            conf={Math.round((verdict.confidence ?? 0) * 100)}
            dissentCount={verdict.dissent?.count ?? 0}
          />
          {verdict.digest_text && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--text-primary)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {verdict.digest_text}
            </p>
          )}
          {verdict.seats && verdict.seats.length > 0 && (
            <SeatStrip seats={verdict.seats} />
          )}
          <div
            style={{
              marginTop: "10px",
              fontFamily: "var(--font-data)",
              fontSize: "9px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}
          >
            {new Date(verdict.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
