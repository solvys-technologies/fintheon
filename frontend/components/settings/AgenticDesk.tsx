// [claude-code 2026-04-11] S14-T8: CAO name persists to user_settings via SettingsContext
// S13-T1: AgenticDesk — read-only subanalyst cards, CAO name-only editable
import { useState, useCallback, useEffect } from "react";
import { Save, Check } from "lucide-react";
import {
  useFintheonAgents,
  type FintheonAgent,
} from "../../contexts/FintheonAgentContext";
import { useToast } from "../../contexts/ToastContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  fetchDeskAgentStyle,
  saveDeskAgentStyle,
  type DeskAgentStyle,
} from "../../lib/coliseum-api";
import { ClientHermesSettings } from "./ClientHermesSettings";
import { SettingsActionStatus } from "./SettingsActionStatus";

/* ------------------------------------------------------------------ */
/*  Agent dossiers                                                      */
/* ------------------------------------------------------------------ */

const DOSSIERS: Record<string, string> = {
  harper:
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
  const [style, setStyle] = useState<DeskAgentStyle>(defaultDeskStyle);
  const [styleStatus, setStyleStatus] = useState<string | null>(null);

  const handleSaveCaoName = useCallback(() => {
    const trimmed = caoName.trim();
    if (!trimmed) return;
    updateAgent("harper", { name: trimmed });
    persistCaoName(trimmed); // persist to backend + localStorage
    setSaved(true);
    addToast("CAO name updated", "success");
    setTimeout(() => setSaved(false), 2000);
  }, [caoName, updateAgent, persistCaoName, addToast]);

  useEffect(() => {
    let cancelled = false;
    fetchDeskAgentStyle()
      .then((nextStyle) => {
        if (!cancelled && nextStyle) setStyle(nextStyle);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveStyle = useCallback(async () => {
    try {
      const nextStyle = await saveDeskAgentStyle(style);
      setStyle(nextStyle);
      setStyleStatus("Saved");
      addToast("Desk style saved", "success");
      setTimeout(() => setStyleStatus(null), 1600);
    } catch (err) {
      setStyleStatus("Save Failed");
      addToast(
        err instanceof Error ? err.message : "Desk style failed",
        "error",
      );
    }
  }, [addToast, style]);

  const cao = agents.find((a) => a.id === "harper");
  const subanalysts = agents.filter((a) =>
    ["oracle", "feucht", "consul", "herald"].includes(a.id),
  );

  return (
    <div className="h-full overflow-y-auto text-right">
      <ClientHermesSettings />

      {cao && (
        <section className="fintheon-fade-divider mb-6 pb-4">
          <div className="mb-4 flex items-start justify-between gap-4 text-right">
            <div className="min-w-0 flex-1 text-right">
              <span className="block truncate text-[14px] font-semibold text-white">
                {cao.name}
              </span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/75">
                {cao.sector}
              </span>
              <p className="mt-3 text-[12px] leading-relaxed text-gray-400">
                {DOSSIERS["harper"]}
              </p>
            </div>
            <div className="flex shrink-0 items-start justify-end">
              <div
                className="flex items-center justify-center rounded-full bg-[var(--fintheon-accent)]/10 text-xl"
                style={{ width: "48px", height: "48px" }}
              >
                {cao.icon}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-right text-[11px] font-medium text-gray-500">
                CAO Name
              </label>
              <input
                type="text"
                value={caoName}
                onChange={(e) => setCaoName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCaoName();
                }}
                className="w-full rounded-md border border-[var(--fintheon-accent)]/15 bg-[#070704] px-3 py-2 text-right text-[13px] text-white placeholder:text-gray-600 transition-colors focus:border-[var(--fintheon-accent)]/40 focus:outline-none"
                placeholder="CAO display name"
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <button
                onClick={handleSaveCaoName}
                className="fintheon-icon-button"
                title="Save CAO name"
              >
                {saved ? <Check size={15} /> : <Save size={15} />}
              </button>
              {saved && (
                <SettingsActionStatus
                  label="Saved"
                  detail="CAO name"
                  tone="success"
                />
              )}
            </div>
          </div>
        </section>
      )}

      <DeskStyleEditor
        style={style}
        onChange={setStyle}
        onSave={handleSaveStyle}
        status={styleStatus}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {subanalysts.map((agent) => (
          <AgentMiniFields key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function DeskStyleEditor({
  style,
  onChange,
  onSave,
  status,
}: {
  style: DeskAgentStyle;
  onChange: (style: DeskAgentStyle) => void;
  onSave: () => void;
  status: string | null;
}) {
  return (
    <section className="fintheon-fade-divider mb-6 pb-4">
      <div className="mb-3 flex items-start justify-between gap-3 text-right">
        <div className="min-w-0 text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]">
            Desk Style
          </p>
          <p className="mt-1 text-[12px] text-gray-500">
            Harper and Oracle context.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <button
            type="button"
            onClick={onSave}
            className="flex h-8 items-center justify-center rounded-[4px] border border-[var(--fintheon-accent)] px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:bg-[var(--fintheon-accent)] hover:text-black"
          >
            Save
          </button>
          {status && (
            <SettingsActionStatus
              label={status}
              detail="Desk style"
              tone={status === "Saved" ? "success" : "error"}
            />
          )}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <StyleField
          label="Bias"
          value={style.houseBias ?? ""}
          onChange={(houseBias) => onChange({ ...style, houseBias })}
        />
        <StyleField
          label="Risk"
          value={style.riskPosture ?? ""}
          onChange={(riskPosture) => onChange({ ...style, riskPosture })}
        />
        <StyleField
          label="Horizon"
          value={style.timeHorizon ?? ""}
          onChange={(timeHorizon) => onChange({ ...style, timeHorizon })}
        />
        <StyleField
          label="Evidence"
          value={style.preferredEvidenceSources.join(", ")}
          onChange={(value) =>
            onChange({ ...style, preferredEvidenceSources: toList(value) })
          }
        />
      </div>
      <StyleField
        label="Forbidden"
        value={style.forbiddenClaims.join(", ")}
        onChange={(value) =>
          onChange({ ...style, forbiddenClaims: toList(value) })
        }
      />
      <label className="mt-2 block text-right text-[10px] uppercase tracking-[0.12em] text-gray-500">
        Instruction
        <textarea
          value={style.customInstruction ?? ""}
          onChange={(event) =>
            onChange({ ...style, customInstruction: event.target.value })
          }
          maxLength={600}
          className="mt-1 min-h-20 w-full resize-y rounded-[4px] border border-[var(--fintheon-accent)]/15 bg-[#070704] px-3 py-2 text-right text-[12px] normal-case leading-5 tracking-normal text-white outline-none focus:border-[var(--fintheon-accent)]/40"
        />
      </label>
    </section>
  );
}

function StyleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-right text-[10px] uppercase tracking-[0.12em] text-gray-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-8 w-full rounded-[4px] border border-[var(--fintheon-accent)]/15 bg-[#070704] px-3 text-right text-[12px] normal-case tracking-normal text-white outline-none focus:border-[var(--fintheon-accent)]/40"
      />
    </label>
  );
}

function toList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultDeskStyle(): DeskAgentStyle {
  return {
    archetypeMix: ["macro"],
    houseBias: "",
    preferredEvidenceSources: [],
    riskPosture: "",
    timeHorizon: "",
    forbiddenClaims: [],
    customInstruction: "",
  };
}

function AgentMiniFields({ agent }: { agent: FintheonAgent }) {
  return (
    <section className="fintheon-fade-divider pb-4 text-right">
      <div className="mb-3 flex items-start justify-between gap-3 text-right">
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[13px] font-semibold text-white">
            {agent.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/75">
            {agent.sector}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fintheon-accent)]/10 text-sm">
          {agent.icon}
        </div>
      </div>

      <div className="space-y-2">
        <ReadonlyField label="Name" value={agent.name} />
        <ReadonlyField label="Sector" value={agent.sector} />
        <ReadonlyField
          label="Brief"
          value={DOSSIERS[agent.id] ?? agent.description}
          multiline
        />
      </div>
    </section>
  );
}

function ReadonlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-right text-[10px] uppercase tracking-[0.12em] text-gray-500">
      {label}
      {multiline ? (
        <textarea
          value={value}
          readOnly
          className="mt-1 min-h-16 w-full resize-none rounded-[4px] border border-[var(--fintheon-accent)]/15 bg-[#070704] px-3 py-2 text-right text-[12px] normal-case leading-5 tracking-normal text-white outline-none"
        />
      ) : (
        <input
          value={value}
          readOnly
          className="mt-1 h-8 w-full rounded-[4px] border border-[var(--fintheon-accent)]/15 bg-[#070704] px-3 text-right text-[12px] normal-case tracking-normal text-white outline-none"
        />
      )}
    </label>
  );
}
