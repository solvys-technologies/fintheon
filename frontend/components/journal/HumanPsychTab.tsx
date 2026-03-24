// [claude-code 2026-03-20] 8h: Session Notes block editor — agent summary (read-only) + user notes (editable)
import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Shield, Save, Heart, Bot, FileText, Lock } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import { useERSafe } from '../../contexts/ERContext';
import type { JournalEntryItem } from '../../lib/services';

interface SessionNotesPanelProps {
  entries: JournalEntryItem[];
  onRefresh: () => void;
  todayInfractions: number;
  avgDiscipline: number;
}

function DisciplineGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? '#34D399' : pct >= 50 ? 'var(--fintheon-accent)' : '#EF4444';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

/** Agent-generated session summary block (read-only, lock-scrolled) */
function AgentSummaryBlock({ entries }: { entries: JournalEntryItem[] }) {
  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === today && e.type === 'agent');

  // Build a structured agent summary from today's data
  const agentSummary = todayEntry?.notes;
  const todayHuman = entries.find(e => e.date === today && e.type === 'human');
  const tradeCount = todayEntry?.proposalCount ?? 0;
  const pnl = todayEntry?.totalPnl ?? todayHuman?.totalPnl ?? 0;
  const winRate = todayEntry?.winRate ?? 0;

  const hasContent = !!(agentSummary || tradeCount > 0);

  return (
    <div className="bg-black/30 border border-[var(--fintheon-accent)]/10 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10 bg-black/20">
        <Bot className="w-3 h-3 text-[var(--fintheon-accent)]" />
        <span className="text-[9px] font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">Hermes Summary</span>
        <Lock className="w-2.5 h-2.5 text-zinc-600 ml-auto" />
      </div>
      <div className="px-3 py-2 max-h-[100px] overflow-y-auto text-[10px] text-[var(--fintheon-text)] leading-relaxed">
        {hasContent ? (
          <div className="space-y-1.5">
            {tradeCount > 0 && (
              <div className="flex items-center gap-2 text-[9px] text-zinc-400">
                <span>{tradeCount} trades</span>
                <span className="text-zinc-600">|</span>
                <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                </span>
                {winRate > 0 && (
                  <>
                    <span className="text-zinc-600">|</span>
                    <span>{winRate.toFixed(0)}% WR</span>
                  </>
                )}
              </div>
            )}
            {agentSummary && (
              <p className="text-[var(--fintheon-text)]">{agentSummary}</p>
            )}
            {!agentSummary && (
              <p className="text-zinc-500 italic">Hermes will auto-generate a summary from today's trading activity.</p>
            )}
          </div>
        ) : (
          <p className="text-zinc-600 italic py-1">No session data yet. Trade to generate a summary.</p>
        )}
      </div>
    </div>
  );
}

/** User notes block editor (editable, lock-scrolled) */
function UserNotesBlock({
  initialNotes,
  onSave,
  saving,
  saveFlash,
}: {
  initialNotes: string;
  onSave: (notes: string) => void;
  saving: boolean;
  saveFlash: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  return (
    <div className={`bg-black/30 border rounded-lg overflow-hidden transition-colors duration-500 ${
      saveFlash ? 'border-emerald-400' : 'border-[var(--fintheon-accent)]/10'
    }`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10 bg-black/20">
        <FileText className="w-3 h-3 text-[var(--fintheon-accent)]" />
        <span className="text-[9px] font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">Your Notes</span>
      </div>
      <div className="px-3 py-2">
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observations, reflections, lessons learned..."
          className="w-full bg-transparent border-none text-[10px] text-[var(--fintheon-text)] placeholder:text-zinc-600 resize-none focus:outline-none min-h-[60px] leading-relaxed"
          rows={3}
        />
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={() => onSave(notes)}
          disabled={saving}
          className="flex items-center justify-center gap-1 px-3 py-1 text-[9px] font-medium bg-[var(--fintheon-accent)] text-black rounded hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 float-right"
        >
          <Save className="w-3 h-3" />
          {saving ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

export function SessionNotesPanel({ entries, onRefresh, todayInfractions, avgDiscipline }: SessionNotesPanelProps) {
  const backend = useBackend();
  const er = useERSafe();
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [emotionalRating, setEmotionalRating] = useState<number | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === today && e.type === 'human');

  useEffect(() => {
    if (todayEntry?.emotionalControlRating) setEmotionalRating(todayEntry.emotionalControlRating);
  }, [todayEntry]);

  // ER-derived score
  const erDerivedScore = er ? Math.max(1, Math.min(10, Math.round(5 + er.erScore * 2.5))) : null;

  // Discipline from today or avg
  const disciplineScore = todayEntry?.disciplineScore ?? avgDiscipline;

  const handleSave = async (notes: string) => {
    setSaving(true);
    try {
      const liveSnapshots = er?.getRecentSnapshots?.() ?? [];
      const liveTrend = liveSnapshots.map(s => s.score).reverse();
      const erTrend = liveTrend.length > 0 ? liveTrend : undefined;
      const discScore = er
        ? Math.max(0, Math.min(100, Math.round(50 + (er.erScore * 5) - (er.infractionCount * 10))))
        : undefined;

      await backend.journal.saveEntry({
        type: 'human',
        date: today,
        erTrend,
        disciplineScore: discScore,
        emotionalControlRating: emotionalRating ?? undefined,
        notes: notes.trim() || undefined,
      });
      onRefresh();
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } catch (err) {
      console.error('Failed to save journal entry:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-3">
      {/* Left: Session metrics card */}
      <div className="flex-1 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3 flex flex-col gap-2.5">
        <div className="text-xs font-semibold text-[var(--fintheon-text)]">Session</div>

        {/* Infractions Today */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-[var(--fintheon-muted)]">Infractions Today</span>
          </div>
          <span className="text-sm font-mono text-[var(--fintheon-text)]">{todayInfractions}</span>
        </div>

        {/* Discipline Score bar */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3 h-3 text-[var(--fintheon-accent)]" />
            <span className="text-[10px] text-[var(--fintheon-muted)]">Discipline Score</span>
          </div>
          <DisciplineGauge score={disciplineScore} />
        </div>

        {/* Emotional Control slider */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Heart className="w-3 h-3 text-[var(--fintheon-accent)]" />
            <span className="text-[10px] text-[var(--fintheon-muted)]">Emotional Control</span>
            {erDerivedScore && (
              <span className="text-[9px] text-[var(--fintheon-accent)] font-mono ml-auto">{erDerivedScore}/10</span>
            )}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={emotionalRating ?? 5}
            onChange={e => setEmotionalRating(Number(e.target.value))}
            className="w-full h-1.5 appearance-none bg-black/40 rounded-full cursor-pointer accent-[var(--fintheon-accent)]"
            style={{ accentColor: 'var(--fintheon-accent)' }}
          />
          <div className="flex justify-between text-[9px] text-[var(--fintheon-muted)] mt-0.5">
            <span>Tilted</span>
            <span className="font-mono text-[var(--fintheon-text)]">{emotionalRating ?? '--'}</span>
            <span>Composed</span>
          </div>
        </div>
      </div>

      {/* Right: Block editor — agent summary (top, read-only) + user notes (bottom, editable) */}
      <div className="flex-1 flex flex-col gap-2">
        <AgentSummaryBlock entries={entries} />
        <UserNotesBlock
          initialNotes={todayEntry?.notes ?? ''}
          onSave={handleSave}
          saving={saving}
          saveFlash={saveFlash}
        />
      </div>
    </div>
  );
}

// Keep legacy export name for backward compatibility
export { SessionNotesPanel as HumanPsychTab };
