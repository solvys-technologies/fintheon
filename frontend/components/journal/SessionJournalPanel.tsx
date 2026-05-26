// [claude-code 2026-04-23] S30-T2: Consolidated Session Journal panel.
// Replaces the former 3 session cards + Hermes Summary card + Your Notes card.
// All sliders are locked to the 0.0-10.0 decimal scale (step 0.1) per TP.
// Submit is explicit — no auto-save — via PUT /api/session-journal (T3 endpoint).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  FileText,
  Heart,
  Lock,
  Save,
  Shield,
  Minus,
  Plus,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import type { SessionJournal } from "../../../shared";
import { useDayPlan } from "../../hooks/useDayPlan";
import { PlanFeedbackBlock } from "./PlanFeedbackBlock";
import { FadingRuler } from "../shared/FadingRuler";

const SCORE_MIN = 0;
const SCORE_MAX = 10;
const SCORE_STEP = 0.1;

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return SCORE_MIN;
  if (value < SCORE_MIN) return SCORE_MIN;
  if (value > SCORE_MAX) return SCORE_MAX;
  return Math.round(value * 10) / 10;
}

function formatScore(value: number): string {
  return `${value.toFixed(1)} / ${SCORE_MAX.toFixed(1)}`;
}

export function SessionJournalPanel() {
  const backend = useBackend();
  const date = useMemo(() => todayIso(), []);
  const { data: dayPlan } = useDayPlan();
  const [infractions, setInfractions] = useState(0);
  const [discipline, setDiscipline] = useState(5.0);
  const [emotional, setEmotional] = useState(5.0);
  const [notes, setNotes] = useState("");
  const [hermesSummary, setHermesSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const existing = await backend.sessionJournal.get(date);
      if (cancelled || !existing) return;
      setInfractions(existing.infractions ?? 0);
      setDiscipline(clampScore(existing.disciplineScore ?? 5));
      setEmotional(clampScore(existing.emotionalControl ?? 5));
      setNotes(existing.notes ?? "");
      setHermesSummary(existing.hermesSummary ?? null);
      setLoadedAt(existing.updatedAt ?? existing.createdAt ?? null);
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [backend, date]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const next = await backend.sessionJournal.save({
        date,
        infractions,
        disciplineScore: discipline,
        emotionalControl: emotional,
        notes,
      });
      if (next) {
        setHermesSummary(next.hermesSummary ?? hermesSummary);
        setLoadedAt(next.updatedAt ?? next.createdAt ?? loadedAt);
      }
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={`bg-[var(--fintheon-surface)] border rounded-lg p-3 transition-colors duration-500 ${
        saveFlash
          ? "border-(--fintheon-accent)"
          : "border-(--fintheon-accent)/15"
      }`}
      aria-label="Session journal"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[var(--fintheon-text)]">
          Session Journal
        </h3>
        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--fintheon-muted)]">
          {loadedAt ? "Saved" : "Unsaved"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <InfractionsField
            value={infractions}
            onChange={(v) => setInfractions(Math.max(0, v))}
          />
          <DecimalSliderField
            icon={<Shield className="w-3 h-3 text-[var(--fintheon-accent)]" />}
            label="Discipline Score"
            value={discipline}
            onChange={setDiscipline}
          />
          <DecimalSliderField
            icon={<Heart className="w-3 h-3 text-[var(--fintheon-accent)]" />}
            label="Emotional Control"
            value={emotional}
            onChange={setEmotional}
            leftTag="Tilted"
            rightTag="Composed"
          />
        </div>

        <div className="flex flex-col gap-3">
          <HermesSummaryBlock summary={hermesSummary} />
          <NotesBlock notes={notes} onChange={setNotes} />
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium bg-[var(--fintheon-accent)] text-black rounded hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {saving ? "Saving…" : "Submit"}
        </button>
      </div>

      {dayPlan && dayPlan.windows.length > 0 && (
        <div className="mt-4">
          <div className="mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--fintheon-accent)" }}
            >
              Plan Feedback
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {dayPlan.windows.map((w, i) => (
              <div key={w.id} className="flex flex-col gap-3">
                {i > 0 && <FadingRuler />}
                <PlanFeedbackBlock window={w} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function InfractionsField({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span className="text-[10px] text-[var(--fintheon-muted)]">
          Infractions Today
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/50 transition-colors disabled:opacity-40"
          disabled={value <= 0}
          aria-label="Decrement infractions"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="flex-1 text-center text-lg font-mono tabular-nums text-[var(--fintheon-text)]">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/50 transition-colors"
          aria-label="Increment infractions"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function DecimalSliderField({
  icon,
  label,
  value,
  onChange,
  leftTag,
  rightTag,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (next: number) => void;
  leftTag?: string;
  rightTag?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-[var(--fintheon-muted)]">
          {label}
        </span>
        <span className="ml-auto text-[9px] font-mono text-[var(--fintheon-accent)] tabular-nums">
          {formatScore(value)}
        </span>
      </div>
      <input
        type="range"
        min={SCORE_MIN}
        max={SCORE_MAX}
        step={SCORE_STEP}
        value={value}
        onChange={(e) => onChange(clampScore(parseFloat(e.target.value)))}
        className="w-full h-1.5 appearance-none bg-black/40 rounded-full cursor-pointer"
        style={{ accentColor: "var(--fintheon-accent)" }}
        aria-label={label}
      />
      {(leftTag || rightTag) && (
        <div className="flex justify-between text-[9px] text-[var(--fintheon-muted)] mt-0.5">
          <span>{leftTag}</span>
          <span>{rightTag}</span>
        </div>
      )}
    </div>
  );
}

function HermesSummaryBlock({ summary }: { summary: string | null }) {
  return (
    <div className="bg-black/30 border border-[var(--fintheon-accent)]/10 rounded-lg overflow-hidden">
      <header className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--fintheon-accent)]/10 bg-black/20">
        <Bot className="w-3 h-3 text-[var(--fintheon-accent)]" />
        <span className="text-[9px] font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">
          Hermes Summary
        </span>
        <Lock className="w-2.5 h-2.5 text-zinc-600 ml-auto" />
      </header>
      <div className="px-2.5 py-2 max-h-[100px] overflow-y-auto text-[10px] leading-relaxed text-[var(--fintheon-text)]">
        {summary ? (
          summary
        ) : (
          <p className="text-zinc-500 italic">No session data yet.</p>
        )}
      </div>
    </div>
  );
}

function NotesBlock({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="bg-black/30 border border-[var(--fintheon-accent)]/10 rounded-lg overflow-hidden flex-1 min-h-[120px] flex flex-col">
      <header className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--fintheon-accent)]/10 bg-black/20">
        <FileText className="w-3 h-3 text-[var(--fintheon-accent)]" />
        <span className="text-[9px] font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">
          Your Notes
        </span>
      </header>
      <textarea
        ref={textareaRef}
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Observations, reflections, lessons learned…"
        className="flex-1 w-full bg-transparent border-none px-2.5 py-2 text-[10px] text-[var(--fintheon-text)] placeholder:text-zinc-600 resize-none focus:outline-none leading-relaxed min-h-[80px]"
      />
    </div>
  );
}

/** Re-export for tests / programmatic access. */
export type { SessionJournal };
