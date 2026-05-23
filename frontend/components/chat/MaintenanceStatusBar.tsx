// S38-T2: Replaced Loader2 with BrailleSpinner. Nothing-design, flat surface.
import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { BrailleSpinner } from "./primitive/BrailleSpinner";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type MaintenanceStatus = "idle" | "updating" | "applied" | "changelog" | "done";

interface MaintenanceStatusBarProps {
  status: MaintenanceStatus;
  message?: string;
  onDismiss: () => void;
}

export function MaintenanceStatusBar({
  status,
  message,
  onDismiss,
}: MaintenanceStatusBarProps) {
  // Auto-dismiss after 3s when done
  useEffect(() => {
    if (status === "done") {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  if (status === "idle") return null;

  const isUpdating = status === "updating";
  const statusLabel = (() => {
    switch (status) {
      case "updating":
        return message || "Updating...";
      case "applied":
        return "Changes applied";
      case "changelog":
        return "Changelog updated";
      case "done":
        return "Maintenance complete";
    }
  })();

  return (
    <div className="border-l border-[#c79f4a] rounded-r px-4 py-2 bg-[var(--fintheon-surface)] flex items-center gap-3">
      {isUpdating ? (
        <BrailleSpinner size={16} />
      ) : (
        <Check size={16} style={{ color: "#22C55E", flexShrink: 0 }} />
      )}
      <span className="text-sm text-zinc-300 font-medium flex-1">
        {statusLabel}
      </span>
      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
