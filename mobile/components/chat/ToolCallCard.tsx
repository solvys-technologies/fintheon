// [claude-code 2026-04-15] Compact tool call display — read-only, Nothing-styled
interface ToolCallCardProps {
  toolName: string;
  input?: string;
}

export function ToolCallCard({ toolName, input }: ToolCallCardProps) {
  return (
    <div
      style={{
        margin: "4px 16px",
        border: "1px solid var(--border-visible)",
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent)",
        }}
      >
        TOOL: {toolName}
      </span>
      {input && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {input}
        </span>
      )}
    </div>
  );
}
