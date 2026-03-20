// [claude-code 2026-03-06] Mini popup for approving/denying user-suggested rope connections
import { Check, X } from 'lucide-react';
import type { RopePolarity } from '../../lib/narrative-types';
import type { Point } from '../../lib/narrative-catenary';

interface RopeSuggestModalProps {
  position: Point;
  fromId: string;
  toId: string;
  polarity: RopePolarity;
  onApprove: () => void;
  onDeny: () => void;
  onClose: () => void;
  agentVerdict?: { approved: boolean; reasoning: string } | null;
}

export function RopeSuggestModal({
  position,
  polarity,
  onApprove,
  onDeny,
  onClose,
  agentVerdict,
}: RopeSuggestModalProps) {
  const label = polarity === 'reinforcing' ? 'Reinforcing' : 'Contradicting';

  return (
    <div
      className="absolute z-30"
      style={{
        left: position.x - 80,
        top: position.y + 8,
      }}
    >
      <div
        className="rounded-lg border px-3 py-2"
        style={{
          width: 160,
          backgroundColor: 'var(--fintheon-surface)',
          borderColor: 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Polarity label */}
        <div
          className="text-xs font-medium mb-2 text-center"
          style={{
            color:
              polarity === 'contradicting'
                ? 'var(--fintheon-bearish)'
                : 'var(--fintheon-accent)',
          }}
        >
          {label}
        </div>

        {/* Agent verdict reasoning */}
        {agentVerdict && (
          <p
            className="text-xs mb-2 leading-tight"
            style={{ color: 'var(--fintheon-muted)' }}
          >
            {agentVerdict.reasoning}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onApprove}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
              color: 'var(--fintheon-accent)',
            }}
            title="Approve connection"
          >
            <Check size={14} />
          </button>
          <button
            onClick={onDeny}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 15%, transparent)',
              color: 'var(--fintheon-muted)',
            }}
            title="Deny connection"
          >
            <X size={14} />
          </button>
        </div>

        {/* Close on click outside */}
        <button
          onClick={onClose}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-xs cursor-pointer"
          style={{
            backgroundColor: 'var(--fintheon-surface)',
            border: '1px solid color-mix(in srgb, var(--fintheon-muted) 40%, transparent)',
            color: 'var(--fintheon-muted)',
          }}
        >
          <X size={8} />
        </button>
      </div>
    </div>
  );
}
