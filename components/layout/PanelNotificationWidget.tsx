import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PanelNotificationWidgetProps {
  panelName: string;
  onRestore: () => void;
  onDismiss: () => void;
}

export function PanelNotificationWidget({ panelName, onRestore, onDismiss }: PanelNotificationWidgetProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-24 right-6 z-50 animate-slide-in">
      <div
        className="backdrop-blur-3xl bg-gradient-to-br from-[#0a0a00]/80 via-[#0a0a00]/70 to-[#0a0a00]/60 border border-[#D4AF37]/30 rounded-xl p-3 shadow-2xl min-w-[200px]"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs text-[#D4AF37] font-semibold mb-1">{panelName} Closed</p>
            <p className="text-[10px] text-gray-400">Click to restore</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRestore}
              className="px-2 py-1 text-[10px] bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] rounded transition-colors"
            >
              Restore
            </button>
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="p-1 hover:bg-[#D4AF37]/10 rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
