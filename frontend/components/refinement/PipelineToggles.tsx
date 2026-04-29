// [claude-code 2026-04-28] S48-T3: Pipeline on/off toggle switches. Each row shows
// the pipeline label + description + toggle. Optimistic update with revert on API
// failure. Gated behind the same edit lock as AdvancedPane.
// [claude-code 2026-04-29] S53-T2: Added lastAppliedAt, isMutating, degradedReason
// status indicators for module-level runtime display.
import type { PipelineState } from "../../hooks/usePipelineState";

interface Props {
  pipelines: PipelineState[];
  onToggle: (id: string, enabled: boolean) => void;
  disabled: boolean;
  loading: boolean;
  error: string | null;
  lastAppliedAt?: Date | null;
  isMutating?: boolean;
  degradedReason?: string | null;
}

const STATUS_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  padding: "3px 6px",
  background:
    "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)",
  borderLeft:
    "2px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
};

export function PipelineToggles({
  pipelines,
  onToggle,
  disabled,
  loading,
  error,
  lastAppliedAt,
  isMutating,
  degradedReason,
}: Props) {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 10,
        borderTop:
          "1px dotted color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fintheon-accent)",
          marginBottom: 8,
        }}
      >
        Pipeline Toggles
      </div>

      {degradedReason && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-bearish)" }}>degraded</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            {degradedReason}
          </span>
        </div>
      )}
      {isMutating && (
        <div style={STATUS_BAR}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--fintheon-accent)",
              animation: "fuse-shimmer 1.5s infinite",
            }}
          />
          <span style={{ color: "var(--fintheon-accent)" }}>
            toggling...
          </span>
        </div>
      )}
      {lastAppliedAt && !isMutating && !degradedReason && !error && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-accent)" }}>ok</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            last applied {lastAppliedAt.toLocaleTimeString()}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 26,
                background:
                  "color-mix(in srgb, var(--fintheon-accent) 3%, transparent)",
                animation: "fuse-shimmer 2s infinite",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 10,
            color: "var(--fintheon-bearish)",
            fontFamily: "var(--font-body)",
          }}
        >
          {error}
        </div>
      ) : pipelines.length === 0 ? (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 10,
            color: "var(--fintheon-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          No pipelines registered — backends may not be reporting
        </div>
      ) : (
        <div className="flex flex-col">
          {pipelines.map((p) => (
            <div
              key={p.pipeline_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 6px",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--fintheon-accent) 6%, transparent)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--fintheon-text)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {p.label}
                </span>
                {p.description && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--fintheon-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {p.description}
                  </span>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={p.enabled}
                disabled={disabled}
                onClick={() => onToggle(p.pipeline_id, !p.enabled)}
                style={{
                  position: "relative",
                  width: 38,
                  height: 22,
                  borderRadius: 11,
                  border: "none",
                  background: p.enabled
                    ? "var(--fintheon-accent)"
                    : "color-mix(in srgb, var(--fintheon-muted) 30%, transparent)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  transition: "background 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: p.enabled ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--fintheon-bg)",
                    transition: "left 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
