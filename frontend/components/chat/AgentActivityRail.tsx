export interface ActivityEntry {
  id: string;
  type?: string;
  label: string;
  detail?: string;
  timestamp?: string | Date;
  status?: string;
}

interface AgentActivityRailProps {
  entries: ActivityEntry[];
  isStreaming?: boolean;
  variant?: "drawer" | "inline";
}

export function AgentActivityRail({
  entries,
  isStreaming,
}: AgentActivityRailProps) {
  if (!entries.length) return null;
  return (
    <div
      className="fintheon-rail-surface"
      style={{ marginTop: 8, padding: "6px 10px" }}
    >
      {entries.map((entry) => (
        <div key={entry.id} style={{ fontSize: 11, color: "#a1a1aa" }}>
          {entry.label}
          {entry.detail ? ` — ${entry.detail}` : ""}
        </div>
      ))}
      {isStreaming ? (
        <div style={{ fontSize: 10, color: "#71717a", marginTop: 6 }}>
          Streaming…
        </div>
      ) : null}
    </div>
  );
}
