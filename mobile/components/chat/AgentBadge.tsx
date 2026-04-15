// [claude-code 2026-04-15] T6: Agent identity chip — always Solvys Gold, never per-agent colors

interface AgentBadgeProps {
  label?: string;
  showTitle?: boolean;
}

export default function AgentBadge({
  label = "H",
  showTitle = false,
}: AgentBadgeProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-visible)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            color: "var(--text-display)",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
      {showTitle && (
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          HARPER
        </span>
      )}
    </div>
  );
}
