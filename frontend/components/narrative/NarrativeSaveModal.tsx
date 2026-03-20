// [claude-code 2026-03-06] Save confirmation modal for NarrativeFlow state persistence
import { useState } from 'react';
import { Save, X } from 'lucide-react';

interface NarrativeSaveModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NarrativeSaveModal({ open, onConfirm, onCancel }: NarrativeSaveModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  if (!open && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onCancel();
    }, 300);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onConfirm();
    }, 300);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`max-w-sm w-full bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/40 rounded-lg shadow-[0_0_40px_rgba(199,159,74,0.15)] ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-bold text-[var(--fintheon-accent)]">Save Changes</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-zinc-900 rounded transition-all">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-[var(--fintheon-muted)] leading-relaxed">
            Once saved, the previous state cannot be recovered. The agent will need to rebuild from context if you need to revert beyond this point.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-zinc-900">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-[var(--fintheon-text)] rounded-lg text-sm font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-[var(--fintheon-accent)] hover:brightness-110 text-black rounded-lg text-sm font-medium transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
