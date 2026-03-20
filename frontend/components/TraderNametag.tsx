// [claude-code 2026-03-14] Compact nametag with ER emotional pulse (green=stable, red=tilt)
import { useERSafe } from '../contexts/ERContext';

interface TraderNametagProps {
  name: string;
  disablePulse?: boolean;
}

export function TraderNametag({ name, disablePulse }: TraderNametagProps) {
  if (!name) return null;

  const er = useERSafe();
  const resonance = er?.resonanceState ?? 'neutral';
  const showPulse = !disablePulse && resonance !== 'poised';

  const pulseClass = showPulse
    ? resonance === 'steadfast'
      ? 'nametag-pulse-stable'
      : 'nametag-pulse-tilt'
    : '';

  return (
    <div
      className={`relative bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-md px-2 h-7 flex items-center overflow-hidden ${pulseClass}`}
      style={{ boxShadow: 'inset 0 1px 0 rgba(199,159,74,0.25)' }}
    >
      <span className="relative z-10 text-[10px] font-semibold tracking-[0.14em] text-[var(--fintheon-accent)] uppercase select-none">
        {name}
      </span>
      <div
        className="absolute inset-0 z-0 nametag-shimmer"
        style={{
          background: 'linear-gradient(135deg, rgba(199,159,74,0.15) 0%, transparent 50%, rgba(199,159,74,0.08) 100%)',
          backgroundSize: '200% 100%',
        }}
      />
      <style>{`
        @keyframes nametag-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .nametag-shimmer {
          animation: nametag-shimmer 3s ease-in-out infinite;
        }
        @keyframes nametag-er-stable {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(34, 197, 94, 0.12); }
        }
        @keyframes nametag-er-tilt {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.12); }
        }
        .nametag-pulse-stable {
          animation: nametag-er-stable 2.5s ease-in-out infinite;
        }
        .nametag-pulse-tilt {
          animation: nametag-er-tilt 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
