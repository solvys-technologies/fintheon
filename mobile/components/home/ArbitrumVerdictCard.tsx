// [claude-code 2026-05-16] S67: desktop-quality verdict card — DigitGroup consensus,
//   SegmentedBar confidence, DissentBadge, seat strip with proper agent names. Aligned
//   to desktop arbitrum types (Lead/Forecaster/Future PM/Quant/Skeptic).

import { useSettings } from "../../contexts/SettingsContext";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { DotMatrixLoader } from "@frontend/components/icon-bank/DotMatrixLoader";
import { DigitGroup } from "../shared/DigitGroup";
import { FadingRuler } from "../shared/FadingRuler";
import { SegmentedBar } from "../shared/SegmentedBar";
import { DissentBadge } from "../arbitrum/DissentBadge";
import type { ArbitrumSeat } from "../arbitrum/types";

const ROLE_DISPLAY_NAMES: Record<ArbitrumSeat["role"], string> = {
  Lead: "Harper",
  Forecaster: "Oracle",
  "Future PM": "Feucht",
  Quant: "Consul",
  Skeptic: "Herald",
};

const SEAT_ROLES: ReadonlyArray<ArbitrumSeat["role"]> = [
  "Lead",
  "Forecaster",
  "Future PM",
  "Quant",
  "Skeptic",
];

function seatLetter(role: string): string {
  const display = ROLE_DISPLAY_NAMES[role as ArbitrumSeat["role"]] ?? role;
  return display.charAt(0).toUpperCase();
}

function HeaderRow({ trigger }: { trigger?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        ARBITRUM CHAMBER
      </span>
      {trigger && (
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}
        >
          {trigger}
        </span>
      )}
    </div>
  );
}

function ConsensusRow({
  consensusScore,
  confidence,
  dissent,
}: {
  consensusScore: number;
  confidence: number;
  dissent?: { seat: string; magnitude_pp: number } | null;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <DigitGroup
          value={consensusScore.toFixed(1)}
          style={{
            fontFamily: "Doto, var(--font-data)",
            fontSize: 32,
            color: "var(--accent)",
            lineHeight: 1,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            color: "var(--text-secondary)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          consensus
        </span>
        {dissent && (
          <div style={{ marginLeft: "auto" }}>
            <DissentBadge dissent={dissent} />
          </div>
        )}
      </div>
      <div style={{ marginBottom: 2 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
          >
            chamber confidence
          </span>
          <DigitGroup
            value={confidence.toFixed(1)}
            style={{
              fontFamily: "Doto, var(--font-data)",
              fontSize: 10,
              color: "var(--text-primary)",
            }}
          />
        </div>
        <SegmentedBar
          value={Math.round(confidence * 100)}
          color="var(--accent)"
          size="compact"
          segments={10}
        />
      </div>
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
        gap: 6,
        marginTop: 12,
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
              borderRadius: 8,
              padding: "6px 4px",
              textAlign: "center",
              background: "var(--surface)",
              opacity: has ? 1 : 0.45,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                color: "var(--accent)",
                letterSpacing: "0.06em",
                marginBottom: 2,
              }}
            >
              {seatLetter(role)}
            </div>
            <div
              style={{
                fontFamily: "Doto, var(--font-data)",
                fontSize: 13,
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              {has ? `${pct}%` : "\u2014"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ArbitrumVerdictCard() {
  const { settings } = useSettings();
  const { verdict, isLoading, error } = useArbitrumLatest(
    settings.selectedInstrument,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "16px 20px",
      }}
    >
      <HeaderRow trigger={verdict?.trigger} />

      {!verdict && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            background: "var(--surface)",
          }}
        >
          {isLoading ? (
            <DotMatrixLoader
              variant="pyramid"
              size={24}
              label="Loading chamber read"
            />
          ) : error ? (
            `Chamber unreachable (${error})`
          ) : (
            "No fresh chamber read \u2014 convenes 17:00 ET or on IV \u2265 8.5."
          )}
        </div>
      )}

      {verdict && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--surface)",
          }}
        >
          <ConsensusRow
            consensusScore={Math.max(
              0,
              Math.min(10, (verdict.consensus_probability ?? 0) * 10),
            )}
            confidence={verdict.confidence ?? 0}
            dissent={verdict.dissent}
          />

          {verdict.digest_text && (
            <>
              <FadingRuler style={{ margin: "10px 0" }} />
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {verdict.digest_text}
              </p>
            </>
          )}

          {verdict.seats && verdict.seats.length > 0 && (
            <SeatStrip seats={verdict.seats} />
          )}

          {!verdict.digest_text &&
            verdict.seats &&
            verdict.seats.length > 0 && <SeatStrip seats={verdict.seats} />}

          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}
          >
            {new Date(verdict.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" \u00B7 "}
            {new Date(verdict.created_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
