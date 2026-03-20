// [claude-code 2026-03-14] Full-screen achievement overlay — TRIUMPHUS!

import { useEffect, useState } from 'react';
import { playSound } from '../../lib/pompa';

interface TriumphusOverlayProps {
  visible: boolean;
  onComplete?: () => void;
}

export default function TriumphusOverlay({ visible, onComplete }: TriumphusOverlayProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'done'>('enter');

  useEffect(() => {
    if (!visible) {
      setPhase('enter');
      return;
    }
    playSound('colosseum-cheers');

    const t1 = setTimeout(() => setPhase('hold'), 500);
    const t2 = setTimeout(() => setPhase('exit'), 2500);
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible, onComplete]);

  if (!visible || phase === 'done') return null;

  const opacity = phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transition: phase === 'enter' ? 'opacity 0.5s ease-out' : 'opacity 0.5s ease-in',
      }}
    >
      {/* Laurel wreath — SVG */}
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" style={{ marginBottom: '1rem' }}>
        {/* Left branch */}
        <path
          d="M60 70 C50 60, 30 55, 20 40 C15 32, 18 20, 28 18 C38 16, 45 25, 48 35 C50 42, 52 50, 55 58"
          stroke="#c79f4a"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M55 58 C48 48, 35 42, 25 30 C20 24, 22 14, 30 12 C38 10, 42 18, 45 26"
          stroke="#c79f4a"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Right branch (mirrored) */}
        <path
          d="M60 70 C70 60, 90 55, 100 40 C105 32, 102 20, 92 18 C82 16, 75 25, 72 35 C70 42, 68 50, 65 58"
          stroke="#c79f4a"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M65 58 C72 48, 85 42, 95 30 C100 24, 98 14, 90 12 C82 10, 78 18, 75 26"
          stroke="#c79f4a"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>

      {/* TRIUMPHUS text */}
      <h1
        style={{
          fontFamily: "'Cinzel', 'Georgia', serif",
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#c79f4a',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          margin: 0,
          textShadow: '0 2px 20px rgba(199, 159, 74, 0.4)',
        }}
      >
        TRIUMPHUS!
      </h1>
    </div>
  );
}
