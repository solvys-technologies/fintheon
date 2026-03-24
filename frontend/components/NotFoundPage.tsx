// [claude-code 2026-03-14] 404 page with rotating Roman messages

import { useMemo } from 'react';
import { isPompaEnabled } from '../lib/pompa';

const ROMAN_MESSAGES = [
  'This road leads to Carthage. Turn back.',
  'The scroll you seek has been lost to the sands of time.',
  'The legion found nothing at these coordinates.',
];

export default function NotFoundPage() {
  const pompa = isPompaEnabled();

  const message = useMemo(() => {
    if (!pompa) return 'Page not found.';
    return ROMAN_MESSAGES[Math.floor(Math.random() * ROMAN_MESSAGES.length)];
  }, [pompa]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1
        style={{
          fontFamily: "'Cinzel', 'Georgia', serif",
          fontSize: '4rem',
          fontWeight: 700,
          color: '#c79f4a',
          margin: 0,
          letterSpacing: '0.1em',
        }}
      >
        404
      </h1>
      <div
        style={{
          width: '60px',
          height: '2px',
          backgroundColor: '#c79f4a',
          margin: '1rem 0 1.5rem',
        }}
      />
      <p style={{ color: '#f0ead6', fontSize: '1rem', maxWidth: '400px', lineHeight: 1.6 }}>
        {message}
      </p>
      <a
        href="/"
        style={{
          marginTop: '2rem',
          color: 'rgba(199, 159, 74, 0.7)',
          fontSize: '0.85rem',
          textDecoration: 'none',
          letterSpacing: '0.08em',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#c79f4a')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(199, 159, 74, 0.7)')}
      >
        Return to the Forum
      </a>
    </div>
  );
}
