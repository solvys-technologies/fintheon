// [claude-code 2026-03-06] NarrativeFlow CatalystPillInput — floating quick-add input for catalysts
import { useState, useRef, useEffect, useCallback } from 'react';

interface CatalystPillInputProps {
  position: { x: number; y: number };
  date: string;
  narrativeId: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
}

export default function CatalystPillInput({
  position,
  onSubmit,
  onClose,
}: CatalystPillInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim());
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [value, onSubmit, onClose]);

  return (
    <div
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="rounded-full px-3 py-1.5 flex items-center"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 80%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fintheon-border) 30%, transparent)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onClose}
          placeholder="Add catalyst..."
          className="bg-transparent border-none outline-none"
          style={{
            fontSize: '11px',
            color: 'var(--fintheon-text)',
            width: '140px',
          }}
        />
      </div>
    </div>
  );
}
