// [claude-code 2026-04-18] S24-T4: InlineDiff — rescore-impact preview + lexicon diff approval cells
import { useMemo } from "react";
import { ArrowRight, Plus, Minus } from "@/components/shared/iso-icons";

export interface ScoreBucketDelta {
  bucket: string; // e.g. "L10", "L9", "score >=8"
  before: number;
  after: number;
}

export interface KeywordDiff {
  keyword: string;
  action: "add" | "remove" | "modify";
  sentimentBefore?: "bullish" | "bearish" | "neutral";
  sentimentAfter?: "bullish" | "bearish" | "neutral";
  isMatrixFlip?: boolean;
}

/* ---------------------------------------------------------------- */
/*  Score-bucket preview — used by RefinementEngine before commit   */
/* ---------------------------------------------------------------- */

export function ScoreImpactPreview({
  deltas,
  itemsAffected,
}: {
  deltas: ScoreBucketDelta[];
  itemsAffected: number;
}) {
  const sorted = useMemo(
    () =>
      [...deltas].sort(
        (a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before),
      ),
    [deltas],
  );

  if (itemsAffected === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          color: "var(--fintheon-muted)",
          fontFamily: "var(--font-data)",
          letterSpacing: "0.04em",
        }}
      >
        No score changes predicted.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--fintheon-glass-border)",
        borderRadius: 6,
        padding: "10px 12px",
        background:
          "color-mix(in srgb, var(--fintheon-accent) 4%, transparent)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fintheon-accent)",
          marginBottom: 8,
        }}
      >
        {itemsAffected} {itemsAffected === 1 ? "item" : "items"} would shift
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sorted.map((d) => {
          const delta = d.after - d.before;
          const sign = delta > 0 ? "+" : "";
          return (
            <div
              key={d.bucket}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                fontFamily: "var(--font-data)",
              }}
            >
              <span style={{ color: "var(--fintheon-text)" }}>{d.bucket}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--fintheon-muted)",
                }}
              >
                <span>{d.before}</span>
                <ArrowRight size={10} />
                <span
                  style={{
                    color:
                      delta > 0
                        ? "var(--fintheon-accent)"
                        : delta < 0
                          ? "var(--fintheon-muted)"
                          : "var(--fintheon-text)",
                    fontWeight: 600,
                  }}
                >
                  {d.after}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--fintheon-muted)",
                    minWidth: 30,
                    textAlign: "right",
                  }}
                >
                  {delta === 0 ? "—" : `${sign}${delta}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Keyword diff row — used by LexiconEditor for per-keyword approve */
/* ---------------------------------------------------------------- */

export function KeywordDiffRow({
  diff,
  onApprove,
  onReject,
  approved,
  rejected,
}: {
  diff: KeywordDiff;
  onApprove?: () => void;
  onReject?: () => void;
  approved?: boolean;
  rejected?: boolean;
}) {
  const actionIcon =
    diff.action === "add" ? (
      <Plus size={12} />
    ) : diff.action === "remove" ? (
      <Minus size={12} />
    ) : (
      <ArrowRight size={12} />
    );

  const actionLabel =
    diff.action === "add"
      ? "ADD"
      : diff.action === "remove"
        ? "REMOVE"
        : "MODIFY";

  const muted = approved || rejected;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid var(--fintheon-glass-border)",
        borderRadius: 6,
        opacity: muted ? 0.5 : 1,
        background: approved
          ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
          : rejected
            ? "color-mix(in srgb, var(--fintheon-muted) 6%, transparent)"
            : "transparent",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 6px",
          borderRadius: 3,
          fontSize: 9,
          fontFamily: "var(--font-data)",
          letterSpacing: "0.08em",
          color: "var(--fintheon-accent)",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
          flexShrink: 0,
        }}
      >
        {actionIcon}
        {actionLabel}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-data)",
          fontSize: 13,
          color: "var(--fintheon-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {diff.keyword}
      </span>
      {diff.sentimentAfter && (
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-data)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color:
              diff.sentimentAfter === "bullish"
                ? "var(--fintheon-accent)"
                : diff.sentimentAfter === "bearish"
                  ? "var(--fintheon-muted)"
                  : "var(--fintheon-text)",
          }}
        >
          {diff.sentimentAfter}
        </span>
      )}
      {diff.isMatrixFlip && (
        <span
          style={{
            padding: "2px 5px",
            borderRadius: 3,
            fontSize: 9,
            fontFamily: "var(--font-data)",
            letterSpacing: "0.08em",
            color: "var(--fintheon-bg)",
            background: "var(--fintheon-accent)",
            flexShrink: 0,
          }}
        >
          MATRIX FLIP
        </span>
      )}
      {!muted && (onApprove || onReject) && (
        <div style={{ display: "flex", gap: 4 }}>
          {onApprove && (
            <button
              onClick={onApprove}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                letterSpacing: "0.04em",
                color: "var(--fintheon-accent)",
                background: "transparent",
                border: "1px solid var(--fintheon-accent)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                letterSpacing: "0.04em",
                color: "var(--fintheon-muted)",
                background: "transparent",
                border: "1px solid var(--fintheon-glass-border)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
