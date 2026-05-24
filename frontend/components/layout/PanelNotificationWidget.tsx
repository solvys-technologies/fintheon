import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface PanelNotificationWidgetProps {
  panelName: string;
  onRestore: () => void;
  onDismiss: () => void;
  position?: "top-right" | "bottom-right";
}

export function PanelNotificationWidget({
  panelName,
  onRestore,
  onDismiss,
  position = "top-right",
}: PanelNotificationWidgetProps) {
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
    <div
      className={`fixed right-6 z-50 animate-slide-in ${
        position === "bottom-right" ? "bottom-[364px]" : "top-24"
      }`}
    >
      <div
        className="fintheon-toast-surface p-3 min-w-[200px]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs text-[var(--fintheon-accent)] font-semibold mb-1">
              {panelName} Closed
            </p>
            <p className="text-[10px] text-gray-400">Click to restore</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRestore}
              className="px-2 py-1 text-[10px] bg-[var(--fintheon-accent)]/20 hover:bg-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] rounded transition-colors"
            >
              Restore
            </button>
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
