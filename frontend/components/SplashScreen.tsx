// [claude-code 2026-03-14] Temple doors splash screen — Fintheon rebrand

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  isReady: boolean;
  pompaEnabled: boolean;
}

const STATUS_MESSAGES = [
  'Initializing Strategium...',
  'Summoning the Consilium...',
  'Agents standing by...',
  'The Tape is unwinding...',
];

export default function SplashScreen({ isReady, pompaEnabled }: SplashScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  // Cycle status messages
  useEffect(() => {
    if (doorsOpen) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [doorsOpen]);

  // When ready, open the doors
  useEffect(() => {
    if (!isReady) return;
    setDoorsOpen(true);
    const timer = setTimeout(() => setUnmounted(true), 1400);
    return () => clearTimeout(timer);
  }, [isReady]);

  if (!pompaEnabled || unmounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: doorsOpen ? 'none' : 'all',
      }}
    >
      {/* Left door */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50vw',
          height: '100vh',
          backgroundColor: '#050402',
          transition: 'transform 1.2s ease-out',
          transform: doorsOpen ? 'translateX(-100%)' : 'translateX(0)',
          borderRight: '1px solid rgba(199, 159, 74, 0.15)',
        }}
      />
      {/* Right door */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50vw',
          height: '100vh',
          backgroundColor: '#050402',
          transition: 'transform 1.2s ease-out',
          transform: doorsOpen ? 'translateX(100%)' : 'translateX(0)',
          borderLeft: '1px solid rgba(199, 159, 74, 0.15)',
        }}
      />
      {/* Center content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          opacity: doorsOpen ? 0 : 1,
          transition: 'opacity 0.6s ease-out',
          pointerEvents: 'none',
        }}
      >
        <h1
          style={{
            fontFamily: "'Cinzel', 'Georgia', serif",
            fontSize: '3.5rem',
            fontWeight: 700,
            color: '#c79f4a',
            letterSpacing: '0.22em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          FINTHEON
        </h1>
        <p
          style={{
            fontFamily: "'Cinzel', 'Georgia', serif",
            fontSize: '0.85rem',
            color: 'rgba(199, 159, 74, 0.6)',
            letterSpacing: '0.14em',
            marginTop: '2rem',
            textTransform: 'uppercase',
            minHeight: '1.4em',
          }}
        >
          {STATUS_MESSAGES[messageIndex]}
        </p>
        {/* Subtle pulsing underline */}
        <div
          style={{
            width: '60px',
            height: '1px',
            backgroundColor: 'rgba(199, 159, 74, 0.3)',
            marginTop: '1.5rem',
            animation: 'splashPulse 2s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 0.3; width: 60px; }
          50% { opacity: 0.7; width: 100px; }
        }
      `}</style>
    </div>
  );
}
