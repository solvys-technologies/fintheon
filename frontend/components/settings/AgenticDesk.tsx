// [claude-code 2026-04-11] S14-T8: CAO name persists to user_settings via SettingsContext
// S13-T1: AgenticDesk — read-only subanalyst cards, CAO name-only editable
import { useState, useCallback } from "react";
import { Save, Check } from "lucide-react";
import {
  useFintheonAgents,
  type FintheonAgent,
} from "../../contexts/FintheonAgentContext";
import { useToast } from "../../contexts/ToastContext";
import { useSettings } from "../../contexts/SettingsContext";

/* ------------------------------------------------------------------ */
/*  Agent dossiers                                                      */
/* ------------------------------------------------------------------ */

const DOSSIERS: Record<string, string> = {
  "harper-2.1":
    "Chief Agentic Officer — executive strategy, oversight, and final trade authorization",
  oracle:
    "The All-Seeing Speculator — prediction markets, probabilistic reasoning, cross-domain intelligence",
  feucht:
    "The Tape Reader — futures execution, technical levels, price action, risk management",
  consul:
    "The Statistical Surgeon — mega-cap fundamentals, earnings, data-driven conviction",
  herald:
    "The Contrarian Elder — news & sentiment intelligence, risk oversight, contrarian positioning",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AgenticDesk() {
  const { agents, updateAgent } = useFintheonAgents();
  const { addToast } = useToast();
  const { caoName: persistedCaoName, setCaoName: persistCaoName } =
    useSettings();

  const [caoName, setCaoName] = useState(() => persistedCaoName || "Harper");
  const [saved, setSaved] = useState(false);

  const handleSaveCaoName = useCallback(() => {
    const trimmed = caoName.trim();
    if (!trimmed) return;
    updateAgent("harper-2.1", { name: trimmed });
    persistCaoName(trimmed); // persist to backend + localStorage
    setSaved(true);
    addToast("CAO name updated", "success");
    setTimeout(() => setSaved(false), 2000);
  }, [caoName, updateAgent, persistCaoName, addToast]);

  const cao = agents.find((a) => a.id === "harper-2.1");
  const subanalysts = agents.filter((a) =>
    ["oracle", "feucht", "consul", "herald"].includes(a.id),
  );

  return (
    <div className="h-full overflow-y-auto">
      {/* CAO — elevated lead card, centered */}
      {cao && (
        <div className="max-w-xl mx-auto mb-6">
          <div
            className="border border-[var(--fintheon-accent)]/15 hover:border-[var(--fintheon-accent)]/35 bg-[#0b0b08] rounded-lg transition-all duration-200"
            style={{ padding: "20px 22px" }}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className="flex items-center justify-center rounded-full bg-[var(--fintheon-accent)]/10 text-xl shrink-0"
                style={{ width: "48px", height: "48px" }}
              >
                {cao.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <span className="text-[14px] font-semibold text-white truncate block">
                  {cao.name}
                </span>
                <span
                  className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[180px]"
                  style={{
                    backgroundColor: "rgba(217,119,6,0.1)",
                    color: "#D97706",
                  }}
                >
                  {cao.sector}
                </span>
              </div>
            </div>

            <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">
              {DOSSIERS["harper-2.1"]}
            </p>

            {/* Editable name field */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                  CAO Name
                </label>
                <input
                  type="text"
                  value={caoName}
                  onChange={(e) => setCaoName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCaoName();
                  }}
                  className="w-full rounded-md border border-[var(--fintheon-accent)]/15 bg-[#070704] text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/40 px-3 py-2 transition-colors"
                  placeholder="CAO display name"
                />
              </div>
              <button
                onClick={handleSaveCaoName}
                className="flex items-center justify-center rounded-[8px] border border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)] hover:text-black transition-all duration-200 active:scale-[0.93]"
                style={{ width: "34px", height: "34px", flexShrink: 0 }}
                title="Save CAO name"
              >
                {saved ? <Check size={15} /> : <Save size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subanalyst cards — 2x2 grid, fully read-only */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {subanalysts.map((agent) => (
          <ReadOnlyAgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only agent card                                                */
/* ------------------------------------------------------------------ */

function ReadOnlyAgentCard({ agent }: { agent: FintheonAgent }) {
  return (
    <div
      className="border border-[var(--fintheon-accent)]/15 hover:border-[var(--fintheon-accent)]/35 bg-[#0b0b08] rounded-lg transition-all duration-200"
      style={{ padding: "20px 22px" }}
    >
      <div className="flex items-start gap-3.5 mb-3">
        <div
          className="flex items-center justify-center rounded-full bg-[var(--fintheon-accent)]/10 text-xl shrink-0"
          style={{ width: "48px", height: "48px" }}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-white truncate">
              {agent.name}
            </span>
          </div>
          <span
            className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[180px]"
            style={{ backgroundColor: "rgba(217,119,6,0.1)", color: "#D97706" }}
          >
            {agent.sector}
          </span>
        </div>
      </div>

      <p className="text-[12px] text-gray-400 leading-relaxed">
        {DOSSIERS[agent.id] ?? agent.description}
      </p>
    </div>
  );
}
