// [claude-code 2026-05-16] Mobile-adapted Arbitrum chamber — agent seat cards with
//   DigitGroup scores, vertical SegmentedBar fuses, expandable rationale. Replaces
//   the old ArbitrumChamberSummary (which used dead miroshark endpoint).

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DotMatrixLoader } from "@frontend/components/icon-bank/DotMatrixLoader";
import { useSettings } from "../../contexts/SettingsContext";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { DigitGroup } from "../shared/DigitGroup";
import { FadingRuler } from "../shared/FadingRuler";
import { SegmentedBar } from "../shared/SegmentedBar";
import { DissentBadge } from "./DissentBadge";
import type { ArbitrumSeat, ArbitrumSeatRole } from "./types";

const DEFAULT_ROLES: ReadonlyArray<ArbitrumSeatRole> = [
  "Lead",
  "Forecaster",
  "Future PM",
  "Quant",
  "Skeptic",
];

const ROLE_DISPLAY_NAMES: Record<ArbitrumSeatRole, string> = {
  Lead: "Harper",
  Forecaster: "Oracle",
  "Future PM": "Feucht",
  Quant: "Consul",
  Skeptic: "Herald",
};

const ROLE_DESCRIPTORS: Record<ArbitrumSeatRole, string> = {
  Lead: "CAO \u00B7 Executive Synthesis",
  Forecaster: "Prediction Markets \u00B7 Probabilistic Models",
  "Future PM": "Futures Execution \u00B7 Risk Management",
  Quant: "Mega-Cap Fundamentals \u00B7 Earnings",
  Skeptic: "Social Sentiment \u00B7 Headline Risk",
};

const EMPTY_COPY = "No fresh read \u2014 chamber convenes at 17:00 ET or on IV \u2265 8.5.";

function AgentSeatRow({
  seat,
  expanded,
  onToggle,
}: {
  seat: ArbitrumSeat;
  expanded: boolean;
  onToggle: () => void;
}) {
  const score = Math.max(0, Math.min(10, seat.probability * 10));
  const dissented = Boolean(seat.dissented);
  const hasRationale = Boolean(seat.rationale.trim());
  const displayName = ROLE_DISPLAY_NAMES[seat.role] ?? seat.role;
  const descriptor = ROLE_DESCRIPTORS[seat.role] ?? "";

  return (
    <div
      style={{
        padding: "8px 0",
        cursor: hasRationale ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
      }}
      onClick={() => { if (hasRationale) onToggle(); }}
    >
      <FadingRuler style={{ marginBottom: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 16px", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: dissented ? "var(--accent)" : "var(--text-primary)",
              fontWeight: dissented ? 600 : 400,
            }}
          >
            {displayName}
          </span>
          <p style={{
            fontFamily: "var(--font-data)",
            fontSize: 7,
            color: "var(--text-disabled)",
            letterSpacing: "0.04em",
            marginTop: 2,
            marginBottom: 0,
            lineHeight: 1.3,
          }}>
            {descriptor}
          </p>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{
              fontFamily: "var(--font-data)",
              fontSize: 8,
              color: "var(--text-disabled)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              Fuse
            </span>
            <DigitGroup
              value={score.toFixed(1)}
              style={{
                fontFamily: "Doto, var(--font-data)",
                fontSize: 9,
                color: "var(--accent)",
              }}
            />
          </div>
          <SegmentedBar
            value={score * 10}
            color="var(--accent)"
            segments={10}
            size="compact"
          />
        </div>
        {hasRationale ? (
          expanded ? (
            <ChevronDown size={14} color="var(--text-secondary)" />
          ) : (
            <ChevronRight size={14} color="var(--text-secondary)" />
          )
        ) : (
          <span />
        )}
      </div>

      {/* Expandable rationale */}
      {expanded && hasRationale && (
        <div style={{ marginTop: 10, paddingLeft: 4 }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: "pre-wrap",
          }}>
            {seat.rationale}
          </p>
        </div>
      )}
    </div>
  );
}

function ConfidencePair({
  caoConfidence,
  chamberConfidence,
}: {
  caoConfidence: number;
  chamberConfidence: number;
}) {
  const rows = [
    { label: "CAO confidence", value: caoConfidence },
    { label: "Chamber confidence", value: chamberConfidence },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
      {rows.map((row) => {
        const value = Math.max(0, Math.min(1, row.value));
        return (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{
                fontFamily: "var(--font-data)",
                fontSize: 8,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-disabled)",
              }}>
                {row.label}
              </span>
              <DigitGroup
                value={`${(value * 100).toFixed(0)}%`}
                style={{
                  fontFamily: "Doto, var(--font-data)",
                  fontSize: 9,
                  color: "var(--text-secondary)",
                }}
              />
            </div>
            <SegmentedBar
              value={value * 100}
              color="var(--accent)"
              segments={10}
              size="compact"
            />
          </div>
        );
      })}
    </div>
  );
}

export function ArbitrumChamber() {
  const { settings, updateSettings } = useSettings();
  const { verdict, isLoading, error, refresh } = useArbitrumLatest(settings.selectedInstrument);
  const [expandedSeat, setExpandedSeat] = useState<ArbitrumSeatRole | null>(null);
  const [digestOpen, setDigestOpen] = useState(false);

  const seats: ArbitrumSeat[] = (() => {
    const supplied = verdict?.seats ?? [];
    if (supplied.length >= 5) return supplied.slice(0, 5);
    const bySlot = new Map(supplied.map((s) => [s.role, s] as const));
    return DEFAULT_ROLES.map(
      (role): ArbitrumSeat =>
        bySlot.get(role) ?? {
          role,
          model: "\u2014",
          probability: 0,
          confidence: 0,
          rationale: "",
        },
    );
  })();

  const caoSeat = seats.find((s) => s.role === "Lead") ?? null;
  const hasVerdict = Boolean(verdict);
  const hasRealSeats = (verdict?.seats?.length ?? 0) > 0;
  const chamberSummary = verdict?.digest_text ?? "";

  const instrumentOptions = ["/NQ", "/ES", "/YM", "/RTY", "/CL", "/GC", "/ZB", "/ZN", "/ZT", "/BTC", "/ETH", "/6E", "/6J", "/6B"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}>
            Arbitrum Chamber
          </span>
          <select
            value={settings.selectedInstrument}
            onChange={(e) => updateSettings({ selectedInstrument: e.target.value })}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 6px",
              color: "var(--text-secondary)",
              outline: "none",
            }}
          >
            {instrumentOptions.map((s) => (
              <option key={s} value={s} style={{ background: "var(--surface)", color: "var(--text-primary)" }}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {verdict && (
          <span style={{
            fontFamily: "var(--font-data)",
            fontSize: 8,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}>
            {verdict.phase ?? "complete"}
          </span>
        )}
      </div>

      {/* Seat fuses */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        padding: "0 12px",
      }}>
        {hasRealSeats
          ? seats.map((seat) => (
              <AgentSeatRow
                key={`${verdict?.id ?? "empty"}-${seat.role}`}
                seat={seat}
                expanded={expandedSeat === seat.role}
                onToggle={() =>
                  setExpandedSeat(expandedSeat === seat.role ? null : seat.role)
                }
              />
            ))
          : seats.map((seat) => (
              <div
                key={`empty-${seat.role}`}
                style={{
                  padding: "10px 0",
                  opacity: 0.45,
                }}
              >
                <FadingRuler style={{ marginBottom: 10 }} />
                <span style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-disabled)",
                }}>
                  {ROLE_DISPLAY_NAMES[seat.role] ?? seat.role}
                </span>
                <p style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 7,
                  color: "var(--text-disabled)",
                  marginTop: 4,
                  marginBottom: 0,
                  lineHeight: 1.3,
                }}>
                  {ROLE_DESCRIPTORS[seat.role] ?? ""}
                </p>
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  color: "var(--text-disabled)",
                  marginTop: 8,
                }}>
                  Awaiting seat\u2026
                </p>
              </div>
            ))}
      </div>

      {/* Confidence pair */}
      {hasVerdict && (
        <div style={{ padding: "0 12px" }}>
          <ConfidencePair
            caoConfidence={caoSeat?.confidence ?? 0}
            chamberConfidence={verdict?.confidence ?? 0}
          />
        </div>
      )}

      {/* Consensus + expandable chamber read */}
      {hasVerdict && (
        <div style={{
          margin: "0 12px",
        }}>
          <FadingRuler style={{ marginBottom: 10 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <DigitGroup
              value={(Math.max(0, Math.min(10, (verdict!.consensus_probability ?? 0) * 10))).toFixed(1)}
              style={{
                fontFamily: "Doto, var(--font-data)",
                fontSize: 24,
                color: "var(--accent)",
                lineHeight: 1,
              }}
            />
            <span style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}>
              consensus score
            </span>
            {verdict!.dissent && (
              <div style={{ marginLeft: "auto" }}>
                <DissentBadge dissent={verdict!.dissent} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDigestOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 0",
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Chamber Read
            {digestOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {digestOpen && chamberSummary && (
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: 0,
            }}>
              {chamberSummary}
            </p>
          )}
          {verdict && (
            <div style={{
              marginTop: 8,
              fontFamily: "var(--font-data)",
              fontSize: 8,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}>
              {new Date(verdict.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" \u00B7 "}
              {new Date(verdict.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      )}

      {/* Empty/loading state */}
      {!hasVerdict && (
        <div style={{ padding: "0 12px" }}>
          <FadingRuler style={{ marginBottom: 10 }} />
          <div style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "var(--text-disabled)",
            padding: 12,
          }}>
            {isLoading ? (
              <DotMatrixLoader variant="pyramid" size={24} label="Loading chamber read" />
            ) : error ? (
              `Chamber unreachable (${error})`
            ) : (
              EMPTY_COPY
            )}
          </div>
        </div>
      )}
    </div>
  );
}
