// [claude-code 2026-03-06] CSS ripple animation on catalyst hover/click
import type { Point } from '../../lib/narrative-catenary';

interface ImpactRippleProps {
  position: Point;
  active: boolean;
  onAnimationEnd: () => void;
}

const RING_COUNT = 3;
const RING_DELAYS = [0, 150, 300];

export function ImpactRipple({ position, active, onAnimationEnd }: ImpactRippleProps) {
  if (!active) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 15,
      }}
    >
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <div
          key={i}
          onAnimationEnd={i === RING_COUNT - 1 ? onAnimationEnd : undefined}
          style={{
            position: 'absolute',
            left: -20,
            top: -20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1.5px solid var(--fintheon-accent)',
            opacity: 0.2,
            animation: `ripple-expand 800ms cubic-bezier(0.4, 0, 0.2, 1) ${RING_DELAYS[i]}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
