// [claude-code 2026-03-16] T4: Session + Notes bottom panel for journal dashboard Page 1
import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Shield, Save, Heart } from 'lucide-react';
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

export function SessionNotesPanel({ entries, onRefresh, todayInfractions, avgDiscipline }: SessionNotesPanelProps) {
  const backend = useBackend();
  const er = useERSafe();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [emotionalRating, setEmotionalRating] = useState<number | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === today && e.type === 'human');
  const hasSessionData = !!(todayEntry?.notes || todayEntry?.emotionalControlRating);

  useEffect(() => {
    if (todayEntry?.notes) setNotes(todayEntry.notes);
    if (todayEntry?.emotionalControlRating) setEmotionalRating(todayEntry.emotionalControlRating);
  }, [todayEntry]);

  // ER-derived score
  const erDerivedScore = er ? Math.max(1, Math.min(10, Math.round(5 + er.erScore * 2.5))) : null;

  // Discipline from today or avg
  const disciplineScore = todayEntry?.disciplineScore ?? avgDiscipline;

  const handleSave = async () => {
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
      // Green flicker
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
      {/* Left: Session card */}
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
            ref={sliderRef}
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

      {/* Right: Notes card */}
      <div
        className={`flex-1 rounded-lg p-3 flex flex-col transition-colors duration-500 ${
          saveFlash
            ? 'border-2 border-emerald-400 bg-[var(--fintheon-surface)]'
            : 'border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]'
        }`}
      >
        <div className="text-xs font-semibold text-[var(--fintheon-text)] mb-2">Notes</div>

        {hasSessionData || notes ? (
          <>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Session notes..."
              className="flex-1 bg-black/30 border border-[var(--fintheon-accent)]/10 rounded p-2 text-xs text-[var(--fintheon-text)] placeholder:text-[var(--fintheon-muted)] resize-none focus:outline-none focus:border-[var(--fintheon-accent)]/30 min-h-[60px]"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium bg-[var(--fintheon-accent)] text-black rounded hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </>
        ) : (
          <div className="flex-1 bg-black rounded flex items-center justify-center min-h-[60px]">
            <span className="text-[10px] text-[var(--fintheon-muted)]">No session data</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Keep legacy export name for backward compatibility
export { SessionNotesPanel as HumanPsychTab };
