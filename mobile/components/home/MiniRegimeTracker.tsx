// [claude-code 2026-04-15] T4: Mini regime tracker — Doto countdown hero, bias badge, confidence bar
import { useState } from "react";
import { SurfaceCard } from "../shared/SurfaceCard";
import { SegmentedBar } from "../shared/SegmentedBar";
import { BottomSheet } from "../shared/BottomSheet";
import { useRegimeTracker, formatTime12H } from "../../hooks/useRegimeTracker";
import type { TradingRegime } from "@frontend/lib/regimes";

const BIAS_LABELS: Record<string, string> = {
  continuation: "CONTINUATION",
  reversal: "REVERSAL",
  convergence: "CONVERGENCE",
  consolidation: "CONSOLIDATION",
  rotation: "ROTATION",
};

export function MiniRegimeTracker() {
  const { activeRegimes, upcomingRegimes, timeRemaining } = useRegimeTracker();
  const [selectedRegime, setSelectedRegime] = useState<TradingRegime | null>(
    null,
  );

  const primary = activeRegimes[0] ?? null;

  return (
    <>
      <SurfaceCard accentBorder="left">
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          ACTIVE REGIMES
        </span>

        {primary ? (
          <div
            style={{ marginTop: 8, cursor: "pointer" }}
            onClick={() => setSelectedRegime(primary)}
          >
            {/* Regime name */}
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                color: "var(--text-primary)",
              }}
            >
              {primary.name}
            </div>

            {/* Doto countdown — hero moment */}
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 36,
                color: "var(--text-display)",
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              {timeRemaining[primary.id] ?? "—"}
            </div>

            {/* Bias chip */}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-visible)",
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                {BIAS_LABELS[primary.bias] ?? primary.bias}
              </span>
            </div>

            {/* Confidence bar */}
            <div style={{ marginTop: 8 }}>
              <SegmentedBar value={primary.confidence} size="standard" />
            </div>
          </div>
        ) : (
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              color: "var(--text-disabled)",
              marginTop: 12,
              letterSpacing: "0.06em",
            }}
          >
            [NO ACTIVE REGIME]
          </div>
        )}

        {/* Upcoming regimes (max 2) */}
        {upcomingRegimes.slice(0, 2).map((r) => (
          <div
            key={r.id}
            onClick={() => setSelectedRegime(r)}
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              {r.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              {formatTime12H(r.timeRange.start)}
            </span>
          </div>
        ))}
      </SurfaceCard>

      {/* Detail bottom sheet */}
      <BottomSheet
        isOpen={!!selectedRegime}
        onClose={() => setSelectedRegime(null)}
        title={selectedRegime?.name}
      >
        {selectedRegime && <RegimeDetail regime={selectedRegime} />}
      </BottomSheet>
    </>
  );
}

function RegimeDetail({ regime }: { regime: TradingRegime }) {
  const total = regime.record.bullishDays + regime.record.bearishDays;
  const winRate =
    total > 0 ? Math.round((regime.record.bullishDays / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Description */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.5,
        }}
      >
        {regime.description}
      </div>

      {/* Time range */}
      <InfoRow
        label="TIME"
        value={`${formatTime12H(regime.timeRange.start)} — ${formatTime12H(regime.timeRange.end)} NY`}
      />

      {/* Instruments */}
      <InfoRow label="INSTRUMENTS" value={regime.instruments.join(", ")} />

      {/* Bias */}
      <InfoRow label="BIAS" value={BIAS_LABELS[regime.bias] ?? regime.bias} />

      {/* Confidence */}
      <div>
        <InfoLabel>CONFIDENCE</InfoLabel>
        <div style={{ marginTop: 4 }}>
          <SegmentedBar value={regime.confidence} size="standard" />
        </div>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-secondary)",
            marginTop: 2,
            display: "block",
          }}
        >
          {regime.confidence}%
        </span>
      </div>

      {/* Record */}
      <InfoRow
        label="RECORD"
        value={`${regime.record.bullishDays}B / ${regime.record.bearishDays}Be — ${winRate}% bull rate (${regime.daysObserved} days)`}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <InfoLabel>{label}</InfoLabel>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-primary)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
