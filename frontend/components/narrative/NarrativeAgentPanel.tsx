// [claude-code 2026-03-06] Agent review panel for NarrativeFlow — stubbed until chat interface is fixed
import { useEffect } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface NarrativeAgentPanelProps {
  open: boolean;
  position: { x: number; y: number };
  evaluating: boolean;
  verdict: { approved: boolean; reasoning: string } | null;
  onClose: () => void;
  onManualApprove?: () => void;
  onManualDeny?: () => void;
  providerMode: 'manual' | 'auto';
}

export function NarrativeAgentPanel({
  open,
  position,
  evaluating,
  verdict,
  onClose,
  onManualApprove,
  onManualDeny,
  providerMode,
}: NarrativeAgentPanelProps) {
  const { addToast } = useToast();

  // Auto-approve stub: when not in manual mode, approve after 500ms
  useEffect(() => {
    if (!open || providerMode === 'manual' || !evaluating) return;
    const timer = setTimeout(() => {
      onManualApprove?.();
    }, 500);
    return () => clearTimeout(timer);
  }, [open, providerMode, evaluating, onManualApprove]);

  if (!open) return null;

  return (
    <div
      className="fixed z-50 w-60 bg-[var(--fintheon-surface)]/95 backdrop-blur-lg border border-[var(--fintheon-border)]/30 rounded-lg shadow-xl p-3 animate-fade-in"
      style={{ left: position.x, top: position.y }}
    >
      {/* Evaluating state */}
      {evaluating && !verdict && (
        <div className="flex items-center gap-2 text-sm text-[var(--fintheon-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--fintheon-accent)]" />
          <span>Agent reviewing...</span>
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {verdict.approved ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${verdict.approved ? 'text-green-400' : 'text-red-400'}`}>
              {verdict.approved ? 'Approved' : 'Denied'}
            </span>
          </div>
          <p className="text-xs text-[var(--fintheon-muted)] leading-relaxed">{verdict.reasoning}</p>
          {!verdict.approved && (
            <button
              onClick={() => addToast(verdict.reasoning, 'info')}
              className="text-[10px] text-[var(--fintheon-accent)] hover:underline"
            >
              Learn from this
            </button>
          )}
        </div>
      )}

      {/* Manual mode buttons */}
      {providerMode === 'manual' && !verdict && !evaluating && (
        <div className="flex gap-2">
          <button
            onClick={onManualApprove}
            className="flex-1 px-3 py-1.5 bg-[var(--fintheon-accent)] hover:brightness-110 text-black rounded text-xs font-medium transition-all"
          >
            Approve
          </button>
          <button
            onClick={onManualDeny}
            className="flex-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-[var(--fintheon-text)] rounded text-xs font-medium transition-all"
          >
            Deny
          </button>
        </div>
      )}

      {/* Close button */}
      {verdict && (
        <button
          onClick={onClose}
          className="mt-2 w-full text-center text-[10px] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
