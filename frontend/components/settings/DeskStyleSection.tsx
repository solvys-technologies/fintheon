// [claude-code 2026-05-26] S80-T3: Desk style settings for closed beta users
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchDeskAgentStyle,
  saveDeskAgentStyle,
  type DeskAgentStyle,
} from "../../lib/coliseum-api";
import { SettingsActionStatus } from "./SettingsActionStatus";

const ARCHETYPES = [
  "narrative trader",
  "thematic investor",
  "nothing-happens",
  "macro",
  "doomer",
  "technician",
  "contrarian",
  "vol trader",
  "policy watcher",
  "fundamentalist",
] as const;

const MAX_CUSTOM = 500;

const INPUT_CLS =
  "w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 placeholder:text-[var(--fintheon-text)]/22 focus:bg-[#110f0a]";

const LABEL_CLS =
  "mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38";

function toList(arr: string[]): string {
  return arr.join(", ");
}

function fromList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function DeskStyleSection() {
  const { getAccessToken } = useAuth();
  const [archetypeMix, setArchetypeMix] = useState<string[]>([]);
  const [houseBias, setHouseBias] = useState("");
  const [preferredEvidence, setPreferredEvidence] = useState("");
  const [riskPosture, setRiskPosture] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [forbiddenClaims, setForbiddenClaims] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchDeskAgentStyle()
      .then((style) => {
        if (!style) return;
        setArchetypeMix(style.archetypeMix);
        setHouseBias(style.houseBias ?? "");
        setPreferredEvidence(toList(style.preferredEvidenceSources));
        setRiskPosture(style.riskPosture ?? "");
        setTimeHorizon(style.timeHorizon ?? "");
        setForbiddenClaims(toList(style.forbiddenClaims));
        setCustomInstruction(style.customInstruction ?? "");
      })
      .catch(() => {});
  }, []);

  const toggleArchetype = (type: string) => {
    setArchetypeMix((prev) =>
      prev.includes(type)
        ? prev.filter((a) => a !== type)
        : [...prev, type].slice(0, 4),
    );
  };

  const save = async () => {
    if (customInstruction.length > MAX_CUSTOM) {
      setStatus("[TOO LONG]");
      return;
    }
    setStatus("[SAVING]");
    const style: DeskAgentStyle = {
      archetypeMix,
      houseBias: houseBias.trim() || null,
      preferredEvidenceSources: fromList(preferredEvidence),
      riskPosture: riskPosture.trim() || null,
      timeHorizon: timeHorizon.trim() || null,
      forbiddenClaims: fromList(forbiddenClaims),
      customInstruction: customInstruction.trim() || null,
    };
    try {
      const token = await getAccessToken();
      await saveDeskAgentStyle(style, token ?? undefined);
      setStatus("[SAVED]");
      window.setTimeout(() => setStatus(null), 1400);
    } catch {
      setStatus("[ERROR]");
    }
  };

  return (
    <section className="fintheon-fade-divider mt-6 pb-1">
      <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
        Desk Style
      </h3>

      <div className="space-y-4">
        <div>
          <span className={LABEL_CLS}>Archetype Mix</span>
          <div className="flex flex-wrap gap-1.5">
            {ARCHETYPES.map((type) => {
              const active = archetypeMix.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleArchetype(type)}
                  className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                      : "bg-[var(--fintheon-surface)] text-[var(--fintheon-text)]/45 hover:text-[var(--fintheon-text)]/70"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[9px] text-[var(--fintheon-text)]/28">
            Max 4
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLS}>House Bias</span>
            <input
              value={houseBias}
              onChange={(e) => setHouseBias(e.target.value.slice(0, 240))}
              placeholder="Cautiously bullish SPX"
              className={INPUT_CLS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLS}>Risk Posture</span>
            <input
              value={riskPosture}
              onChange={(e) => setRiskPosture(e.target.value.slice(0, 240))}
              placeholder="Defined-risk, no overnight"
              className={INPUT_CLS}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLS}>Time Horizon</span>
            <input
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value.slice(0, 240))}
              placeholder="Intraday, swing 1-3 days"
              className={INPUT_CLS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLS}>Preferred Evidence</span>
            <input
              value={preferredEvidence}
              onChange={(e) => setPreferredEvidence(e.target.value)}
              placeholder="Fed minutes, options flow, IV"
              className={INPUT_CLS}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLS}>Forbidden Claims</span>
          <input
            value={forbiddenClaims}
            onChange={(e) => setForbiddenClaims(e.target.value)}
            placeholder="No macro doom calls, no yield-curve inversion"
            className={INPUT_CLS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLS}>
            Custom Instruction
            <span className="ml-2 normal-case tracking-normal text-[var(--fintheon-text)]/28">
              ({customInstruction.length}/{MAX_CUSTOM})
            </span>
          </span>
          <textarea
            value={customInstruction}
            onChange={(e) =>
              setCustomInstruction(e.target.value.slice(0, MAX_CUSTOM))
            }
            rows={3}
            placeholder="Additional context for Harper and Oracle…"
            className={`${INPUT_CLS} resize-none`}
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <SettingsActionStatus label={status} />
          <button
            type="button"
            onClick={save}
            className="fintheon-action-link text-[11px] font-semibold uppercase tracking-[0.14em]"
          >
            Save Style
          </button>
        </div>
      </div>
    </section>
  );
}
