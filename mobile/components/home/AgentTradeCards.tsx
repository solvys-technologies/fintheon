// [claude-code 2026-04-15] Agent trade proposal cards — direction, strategy, levels, confidence
import {
  useAgentProposals,
  type TradingProposal,
} from "../../hooks/useAgentProposals";
import { SegmentedBar } from "../shared/SegmentedBar";

const DIRECTION_COLORS: Record<string, string> = {
  long: "var(--success)",
  short: "var(--error)",
  flat: "var(--text-secondary)",
};

const DIRECTION_LABELS: Record<string, string> = {
  long: "\u25B2 LONG",
  short: "\u25BC SHORT",
  flat: "\u25C6 FLAT",
};

function ProposalCard({ proposal }: { proposal: TradingProposal }) {
  const dirColor =
    DIRECTION_COLORS[proposal.direction] || "var(--text-secondary)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header: instrument + direction */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            color: "var(--text-display)",
          }}
        >
          {proposal.instrument}
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: dirColor,
            letterSpacing: "0.06em",
          }}
        >
          {DIRECTION_LABELS[proposal.direction] ||
            proposal.direction.toUpperCase()}
        </span>
      </div>

      {/* Strategy + setup */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "2px 6px",
          }}
        >
          {proposal.strategyName.replace(/_/g, " ")}
        </span>
        {proposal.setupType && (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}
          >
            {proposal.setupType}
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            width: 48,
          }}
        >
          CONF
        </span>
        <div style={{ flex: 1 }}>
          <SegmentedBar
            value={proposal.confidence}
            segments={10}
            size="compact"
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-primary)",
            width: 28,
            textAlign: "right",
          }}
        >
          {proposal.confidence}%
        </span>
      </div>

      {/* Price levels */}
      {(proposal.entryPrice || proposal.stopLoss) && (
        <div
          style={{
            display: "flex",
            gap: 16,
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {proposal.entryPrice && (
            <span>
              ENTRY{" "}
              <span style={{ color: "var(--text-primary)" }}>
                {proposal.entryPrice.toFixed(1)}
              </span>
            </span>
          )}
          {proposal.stopLoss && (
            <span>
              STOP{" "}
              <span style={{ color: "var(--error)" }}>
                {proposal.stopLoss.toFixed(1)}
              </span>
            </span>
          )}
          {proposal.takeProfit && proposal.takeProfit.length > 0 && (
            <span>
              TP{" "}
              <span style={{ color: "var(--success)" }}>
                {proposal.takeProfit[0].toFixed(1)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Rationale */}
      {proposal.rationale && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {proposal.rationale}
        </p>
      )}

      {/* R:R + timeframe */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        <span>R:R {proposal.riskRewardRatio.toFixed(1)}</span>
        <span>{proposal.timeframe}</span>
      </div>
    </div>
  );
}

export function AgentTradeCards() {
  const { proposals, isLoading } = useAgentProposals();

  if (isLoading) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING PROPOSALS...]
      </span>
    );
  }

  if (proposals.length === 0) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [NO ACTIVE PROPOSALS]
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        AGENT PROPOSALS
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </div>
  );
}
