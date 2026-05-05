import type { FintheonAgent } from "../../contexts/FintheonAgentContext";

interface CommandPaletteProps {
  onClose: () => void;
  onSelectSkill: (id: string | null) => void;
  onTogglePlan: () => void;
  onStop: () => void;
  agents: FintheonAgent[];
  onSwitchAgent: (agent: FintheonAgent) => void;
}

export function CommandPalette({ onClose, onTogglePlan, onStop, agents, onSwitchAgent }: CommandPaletteProps) {
  return (
    <div
      role="dialog"
      aria-label="Command Palette"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, border: "1px solid #3f3f46", borderRadius: 8, background: "#09090b", padding: 12 }}
      >
        <div style={{ fontSize: 12, marginBottom: 8, color: "#a1a1aa" }}>Command Palette</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={onTogglePlan}>Toggle Plan</button>
          <button type="button" onClick={onStop}>Stop</button>
        </div>
        <div style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 4 }}>Agents</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                onSwitchAgent(agent);
                onClose();
              }}
            >
              {agent.name ?? agent.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
