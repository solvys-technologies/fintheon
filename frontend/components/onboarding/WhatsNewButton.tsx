import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  CURRENT_VERSION,
  LAST_VERSION_KEY,
  TOUR_STORAGE_KEY,
  WHATS_NEW_ITEMS,
} from "./tour-content";

const WHATS_NEW_TIMEOUT_MS = 30_000;

export function WhatsNewButton() {
  const [visible, setVisible] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
    const tourDone = localStorage.getItem(TOUR_STORAGE_KEY);

    if (tourDone && lastVersion && lastVersion !== CURRENT_VERSION) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
      }, WHATS_NEW_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    if (tourDone && !lastVersion) {
      localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/15 px-3 text-xs font-medium text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/25"
      >
        Welcome to the Pantheon
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/20 bg-[#0c0a06] shadow-xl">
          <div className="border-b border-[var(--fintheon-accent)]/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--fintheon-accent)]">
                v{CURRENT_VERSION}
              </span>
              <button
                onClick={() => {
                  setShowPanel(false);
                  setVisible(false);
                  localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
                }}
                className="text-gray-500 transition-colors hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="space-y-2 px-4 py-3">
            {WHATS_NEW_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-xs text-[var(--fintheon-accent)]">
                  -
                </span>
                <span className="text-xs leading-relaxed text-gray-400">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
