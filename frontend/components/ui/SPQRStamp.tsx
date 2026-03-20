// [claude-code 2026-03-14] Animated SPQR approval stamp

import { useEffect, useState } from 'react';
import { playSound } from '../../lib/pompa';

interface SPQRStampProps {
  visible: boolean;
  onComplete?: () => void;
}

export default function SPQRStamp({ visible, onComplete }: SPQRStampProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'done'>('enter');

  useEffect(() => {
    if (!visible) {
      setPhase('enter');
      return;
    }
    playSound('coin-clink');

    // enter -> hold after 0.4s
    const t1 = setTimeout(() => setPhase('hold'), 400);
    // hold -> exit after 1.4s total
    const t2 = setTimeout(() => setPhase('exit'), 1400);
    // exit -> done after 1.7s total
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 1700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible, onComplete]);

  if (!visible || phase === 'done') return null;

  const opacity = phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1;
  const scale = phase === 'enter' ? 1.5 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'Cinzel', 'Georgia', serif",
          fontSize: '2.5rem',
          fontWeight: 700,
          color: '#c79f4a',
          letterSpacing: '0.22em',
          transform: `rotate(-12deg) scale(${scale})`,
          opacity,
          transition: phase === 'enter'
            ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out'
            : 'opacity 0.3s ease-out',
          textShadow: '0 2px 12px rgba(199, 159, 74, 0.3)',
          userSelect: 'none',
        }}
      >
        SPQR
      </span>
    </div>
  );
}
