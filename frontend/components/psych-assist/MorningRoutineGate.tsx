// [claude-code 2026-03-22] Source of Truth fusion — morning routine gate (Commandment 14)
import { useState } from "react";
import { CheckCircle, Circle, Lock } from "lucide-react";

const ROUTINE_STEPS = [
  { id: "fintheon", label: "Open Fintheon — read the tape, see the briefing" },
  { id: "narrative", label: "Check Narrative Flow — Concilium analyst memos" },
  { id: "topdown", label: "Top-down analysis" },
  { id: "ready", label: "Mentally calibrated and ready to trade" },
];

interface MorningRoutineGateProps {
  onComplete: () => void;
  onDismiss?: () => void;
}

export function MorningRoutineGate({
  onComplete,
  onDismiss,
}: MorningRoutineGateProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const allDone = ROUTINE_STEPS.every((s) => checked.has(s.id));

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fintheon-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fintheon-modal-surface w-full max-w-sm mx-4">
        <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-accent)]/5 flex items-center gap-2">
          <Lock size={14} className="text-[var(--fintheon-accent)]" />
          <span className="text-xs font-semibold text-[var(--fintheon-accent)] tracking-wider uppercase">
            Commandment 14
          </span>
        </div>

        <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
          <p className="text-[11px] text-[var(--fintheon-text)]/70 leading-relaxed">
            The morning routine is non-negotiable. Complete your pre-market
            calibration before the first trade.
          </p>
        </div>

        <div className="px-4 py-3 space-y-2">
          {ROUTINE_STEPS.map((step) => {
            const done = checked.has(step.id);
            return (
              <button
                key={step.id}
                onClick={() => toggle(step.id)}
                className="w-full flex items-center gap-2.5 py-1.5 text-left group"
              >
                {done ? (
                  <CheckCircle
                    size={14}
                    className="text-[var(--fintheon-accent)] shrink-0"
                  />
                ) : (
                  <Circle
                    size={14}
                    className="text-[var(--fintheon-text)]/20 shrink-0 group-hover:text-[var(--fintheon-accent)]/40"
                  />
                )}
                <span
                  className={`text-[10px] font-mono transition-colors ${
                    done
                      ? "text-[var(--fintheon-text)]/70"
                      : "text-[var(--fintheon-text)]/40"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-end gap-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-[10px] font-mono text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/50 transition-colors"
            >
              Skip (not recommended)
            </button>
          )}
          <button
            onClick={onComplete}
            disabled={!allDone}
            className={`px-4 py-1.5 rounded text-[10px] font-mono transition-colors ${
              allDone
                ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/30"
                : "bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-accent)]/20 cursor-not-allowed"
            }`}
          >
            Routine Complete
          </button>
        </div>
      </div>
    </div>
  );
}
