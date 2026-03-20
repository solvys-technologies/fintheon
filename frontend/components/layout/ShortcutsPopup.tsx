// [claude-code 2026-03-14] Keyboard shortcuts & easter egg hints modal

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ShortcutsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: '\u2318K', label: 'Summon the Index' },
  { keys: '\u2318\u21E71', label: 'Dashboard' },
  { keys: '\u2318\u21E72', label: 'Consilium' },
  { keys: '\u2318\u21E73', label: 'RiskFlow' },
  { keys: '\u2318\u21E74', label: 'Scriptorium' },
  { keys: '\u2318\u21E75', label: 'Calendar' },
  { keys: '\u2318\u21E76', label: 'Narratives' },
  { keys: '\u2318\u21E77', label: 'Performance' },
  { keys: 'Esc', label: 'Close modals' },
];

const SECRETS = [
  'The Senate remembers its roots...',
  'The gods favor the persistent...',
  'Beware the Ides...',
  'Three knocks open the gate...',
];

export default function ShortcutsPopup({ isOpen, onClose }: ShortcutsPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#0a0806',
          border: '1px solid rgba(199, 159, 74, 0.25)',
          borderRadius: '8px',
          padding: '2rem',
          width: '420px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontFamily: "'Cinzel', 'Georgia', serif",
              fontSize: '1.1rem',
              color: '#c79f4a',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Shortcuts
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
              <span style={{ color: '#f0ead6', fontSize: '0.85rem' }}>{s.label}</span>
              <kbd
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: '#c79f4a',
                  backgroundColor: 'rgba(199, 159, 74, 0.08)',
                  border: '1px solid rgba(199, 159, 74, 0.2)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        {/* Secrets section */}
        <div style={{ borderTop: '1px solid rgba(199, 159, 74, 0.12)', paddingTop: '1.25rem' }}>
          <h3
            style={{
              fontFamily: "'Cinzel', 'Georgia', serif",
              fontSize: '0.85rem',
              color: 'rgba(199, 159, 74, 0.7)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            Secrets of the Pantheon
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {SECRETS.map((hint) => (
              <p
                key={hint}
                style={{
                  color: 'rgba(240, 234, 214, 0.4)',
                  fontSize: '0.8rem',
                  fontStyle: 'italic',
                  margin: 0,
                  paddingLeft: '0.75rem',
                  borderLeft: '2px solid rgba(199, 159, 74, 0.15)',
                }}
              >
                {hint}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
