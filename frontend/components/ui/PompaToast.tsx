// [claude-code 2026-03-14] Pompa Mode themed toast notification

import { useEffect, useState } from 'react';
import { Award, ShieldAlert } from 'lucide-react';
import { playSound } from '../../lib/pompa';

interface PompaToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export default function PompaToast({ message, type, onDismiss }: PompaToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    playSound('glass-clink');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const Icon = type === 'success' ? Award : type === 'error' ? ShieldAlert : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9995,
        backgroundColor: '#0a0806',
        border: '1px solid #c79f4a',
        borderRadius: '6px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        maxWidth: '380px',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Left laurel decoration */}
      <div
        style={{
          position: 'absolute',
          left: '-1px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '3px',
          height: '60%',
          backgroundColor: 'rgba(199, 159, 74, 0.4)',
          borderRadius: '2px',
        }}
      />
      {Icon && <Icon size={16} style={{ color: '#c79f4a', flexShrink: 0 }} />}
      <span style={{ color: '#f0ead6', fontSize: '0.85rem', lineHeight: 1.4 }}>
        {message}
      </span>
      {/* Right laurel decoration */}
      <div
        style={{
          position: 'absolute',
          right: '-1px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '3px',
          height: '60%',
          backgroundColor: 'rgba(199, 159, 74, 0.4)',
          borderRadius: '2px',
        }}
      />
    </div>
  );
}
