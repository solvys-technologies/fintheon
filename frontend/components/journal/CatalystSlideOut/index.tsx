import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  useCatalystsByDate,
  type CalendarSelection,
} from "./hooks/useCatalystsByDate.js";
import { CatalystList } from "./CatalystList.js";

export type { CalendarSelection };

interface CatalystSlideOutProps {
  selection: CalendarSelection | null;
  onClose: () => void;
}

function buildSelectionLabel(selection: CalendarSelection): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (selection.kind === "day") {
    return selection.from.toLocaleDateString("en-US", opts);
  }
  if (selection.kind === "week") {
    const from = selection.from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const to = selection.to.toLocaleDateString("en-US", opts);
    return `Week of ${from} – ${to}`;
  }
  return selection.from.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function CatalystSlideOut({
  selection,
  onClose,
}: CatalystSlideOutProps) {
  const { catalysts, isLoading } = useCatalystsByDate(selection);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = selection !== null;
  const selectionLabel = selection ? buildSelectionLabel(selection) : "";

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the panel from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      className="fintheon-rail-surface fixed top-0 right-0 h-full z-50 flex flex-col"
      style={{
        width: 400,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 200ms ease-out",
        willChange: "transform",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-start justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #1a1a1a" }}
      >
        <div>
          <h2
            className="text-[11px] uppercase tracking-widest font-bold"
            style={{ color: "#c79f4a", fontFamily: "var(--font-heading)" }}
          >
            RiskFlow Catalysts
          </h2>
          <p
            className="text-[14px] font-semibold mt-0.5"
            style={{ color: "#f0ead6", fontFamily: "var(--font-body)" }}
          >
            {selectionLabel}
          </p>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5"
              style={{
                color: "rgba(240, 234, 214, 0.3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {catalysts.length} headline{catalysts.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded transition-colors hover:bg-white/5 mt-0.5"
          style={{ color: "rgba(240, 234, 214, 0.4)" }}
          aria-label="Close catalyst panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <CatalystList
          catalysts={catalysts}
          isLoading={isLoading}
          selectionLabel={selectionLabel}
        />
      </div>
    </div>
  );
}
