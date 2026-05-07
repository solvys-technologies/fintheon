// [claude-code 2026-03-22] Track 4: inline persona dropdown replacing persona pills
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";

const PERSONA_META: Record<string, string> = {
  harper: "CAO",
  oracle: "All-Seer",
  feucht: "Futures & Risk",
  consul: "Fundamentals",
  herald: "News & Sentiment",
};

function statusColor(status: string): string {
  switch (status) {
    case "working":
      return "#22c55e";
    case "idle":
      return "#eab308";
    case "blocked":
      return "#ef4444";
    default:
      return "#52525b";
  }
}

interface PersonaDropdownProps {
  mode?: "work" | "plan";
  onModeChange?: (mode: "work" | "plan") => void;
}

export function PersonaDropdown({
  mode = "work",
  onModeChange,
}: PersonaDropdownProps) {
  const { agents, activeAgent, setActiveAgent } = useFintheonAgents();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = activeAgent ?? agents[0];
  if (!current) return null;

  return (
    <div ref={ref} className="relative flex items-center">
      {/* Compact trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-[11px]",
          "border border-[var(--fintheon-accent)]/30 hover:border-[var(--fintheon-accent)]/50",
          open ? "bg-[var(--fintheon-accent)]/10" : "bg-transparent",
        ].join(" ")}
        style={{ height: "28px" }}
      >
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ backgroundColor: statusColor(current.status) }}
        />
        <span className="font-semibold text-[var(--fintheon-accent)] truncate max-w-[80px]">
          {current.name}
        </span>
        <ChevronDown
          size={10}
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 w-[200px] rounded-2xl border border-[var(--fintheon-accent)]/20 overflow-hidden shadow-xl z-50"
          style={{ backgroundColor: "#0a0805" }}
        >
          <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
            <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 mb-1.5">
              Mode
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onModeChange?.("work")}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  mode === "work"
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "bg-transparent text-zinc-400 hover:bg-[var(--fintheon-accent)]/5 hover:text-zinc-200"
                }`}
              >
                Work
              </button>
              <button
                onClick={() => onModeChange?.("plan")}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  mode === "plan"
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "bg-transparent text-zinc-400 hover:bg-[var(--fintheon-accent)]/5 hover:text-zinc-200"
                }`}
              >
                Plan
              </button>
            </div>
          </div>
          {agents.map((agent) => {
            const isActive = agent.id === current.id;
            const sectorLabel = PERSONA_META[agent.id] ?? agent.sector;
            return (
              <button
                key={agent.id}
                onClick={() => {
                  setActiveAgent(agent);
                  setOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 transition-colors text-left",
                  isActive
                    ? "bg-[var(--fintheon-accent)]/10"
                    : "hover:bg-[var(--fintheon-accent)]/5",
                ].join(" ")}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ backgroundColor: statusColor(agent.status) }}
                />
                <div className="flex flex-col leading-none min-w-0">
                  <span
                    className={`text-[11px] font-semibold truncate ${isActive ? "text-[var(--fintheon-accent)]" : "text-zinc-300"}`}
                  >
                    {agent.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 mt-[2px]">
                    {sectorLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
