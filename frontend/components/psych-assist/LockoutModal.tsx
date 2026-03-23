// [claude-code 2026-03-22] Source of Truth fusion — lockout popup modal with debrief
import { useState } from 'react';
import { Lock, AlertTriangle, Send } from 'lucide-react';

export type LockoutLevel = 'soft' | 'hard';

export interface LockoutModalProps {
  level: LockoutLevel;
  reason: string;
  commandmentRefs: number[];
  debriefQuestions: string[];
  onDismiss: () => void;
  onSubmitDebrief: (answers: Record<string, string>) => void;
}

export function LockoutModal({
  level,
  reason,
  commandmentRefs,
  debriefQuestions,
  onDismiss,
  onSubmitDebrief,
}: LockoutModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const isHard = level === 'hard';
  const allAnswered = debriefQuestions.every(q => (answers[q] ?? '').trim().length > 0);

  const handleSubmit = () => {
    if (isHard && !allAnswered) return;
    onSubmitDebrief(answers);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 border rounded-lg bg-[var(--fintheon-bg)] border-[var(--fintheon-accent)]/30 shadow-2xl">
        {/* Header */}
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${
          isHard
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-accent)]/5'
        }`}>
          {isHard
            ? <Lock size={14} className="text-red-400" />
            : <AlertTriangle size={14} className="text-[var(--fintheon-accent)]" />
          }
          <span className={`text-xs font-semibold tracking-wider uppercase ${
            isHard ? 'text-red-400' : 'text-[var(--fintheon-accent)]'
          }`}>
            {isHard ? 'Hard Lockout' : 'Soft Lockout'}
          </span>
          <div className="flex-1" />
          <div className="flex gap-1">
            {commandmentRefs.map(n => (
              <span key={n} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/40">
                C{n}
              </span>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
          <p className="text-[11px] text-[var(--fintheon-text)]/70 leading-relaxed">
            {reason}
          </p>
        </div>

        {/* Debrief questions */}
        <div className="px-4 py-3 space-y-3">
          <span className="text-[9px] font-mono text-[var(--fintheon-accent)]/50 uppercase tracking-wider">
            Debrief {isHard ? '(required)' : '(recommended)'}
          </span>
          {debriefQuestions.map(question => (
            <div key={question}>
              <label className="text-[10px] text-[var(--fintheon-text)]/60 block mb-1">
                {question}
              </label>
              <textarea
                value={answers[question] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [question]: e.target.value }))}
                className="w-full bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded px-2 py-1.5 text-[10px] text-[var(--fintheon-text)]/80 font-mono resize-none focus:outline-none focus:border-[var(--fintheon-accent)]/40"
                rows={2}
                placeholder={isHard ? 'Required before trading resumes...' : 'Optional but recommended...'}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-end gap-2">
          {!isHard && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-[10px] font-mono text-[var(--fintheon-text)]/40 hover:text-[var(--fintheon-text)]/60 transition-colors"
            >
              Acknowledge
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isHard && !allAnswered}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono transition-colors ${
              isHard && !allAnswered
                ? 'bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/30 cursor-not-allowed'
                : 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/30'
            }`}
          >
            <Send size={10} />
            {isHard ? 'Submit Debrief' : 'Submit & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
