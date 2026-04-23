// [claude-code 2026-04-19] S25-T3: Right-rail hover drawer — 4px hot zone on screen-right slides out a 240px Sanctum sitemap (Narrative Flow / Timeline / Aquarium → Command/Econ/Risk/5D). Auto-hides 1.5s after mouse leaves. Lets users jump anywhere in Sanctum without going back to the top tab strip.
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Clock,
  GitBranch,
  Fish,
  ChevronRight,
} from "lucide-react";
import type { SanctumSubView } from "../consilium/ConsiliumTabConfig";

const AUTO_HIDE_MS = 1500;

/** Aquarium sub-pages mirrored from SanctumPresets visible-list. Keep in sync. */
const AQUARIUM_PAGES: { id: number; label: string }[] = [
  { id: 0, label: "Command" },
  { id: 1, label: "Econ" },
  { id: 2, label: "Risk" },
];

interface SanctumSitemapDrawerProps {
  activeSubView: SanctumSubView;
  onNavigate: (sub: SanctumSubView) => void;
}

/**
 * Dispatches a window CustomEvent for Sanctum to scroll its internal page.
 * Sanctum.tsx listens via window.addEventListener("fintheon:aquarium-scroll-to", ...).
 */
function navigateAquariumPage(pageIndex: number): void {
  window.dispatchEvent(
    new CustomEvent("fintheon:aquarium-scroll-to", {
      detail: { page: pageIndex },
    }),
  );
}

export function SanctumSitemapDrawer({
  activeSubView,
  onNavigate,
}: SanctumSitemapDrawerProps) {
  const [open, setOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  }, [cancelHide]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  const handleSubClick = (sub: SanctumSubView) => {
    onNavigate(sub);
    scheduleHide();
  };

  const handleAquariumPage = (pageIndex: number) => {
    if (activeSubView !== "aquarium") onNavigate("aquarium");
    // Defer to next frame so Sanctum has mounted before receiving the event
    requestAnimationFrame(() => navigateAquariumPage(pageIndex));
    scheduleHide();
  };

  return (
    <>
      {/* 4px hot-zone — always present, screen-right edge */}
      <div
        aria-hidden="true"
        onMouseEnter={() => {
          cancelHide();
          setOpen(true);
        }}
        className="fixed top-12 bottom-0 right-0 w-[4px] z-40 cursor-e-resize"
      />

      {/* Slide-out drawer */}
      <div
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        className={`fixed top-12 right-0 z-40 w-[240px] flex flex-col bg-[var(--fintheon-bg)]/95 backdrop-blur-xl border-l border-[var(--fintheon-accent)]/15 shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out`}
        style={{
          bottom: 0,
          transform: open ? "translateX(0)" : "translateX(100%)",
          pointerEvents: open ? "auto" : "none",
        }}
        role="navigation"
        aria-label="Sanctum sitemap"
        aria-hidden={!open}
      >
        <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
          <span
            className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-muted)]/60"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Sanctum
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-2">
          <DrawerLeaf
            icon={<GitBranch size={13} />}
            label="Narrative Flow"
            active={activeSubView === "narratives"}
            onClick={() => handleSubClick("narratives")}
          />
          <DrawerLeaf
            icon={<Clock size={13} />}
            label="Timeline"
            active={activeSubView === "timeline"}
            onClick={() => handleSubClick("timeline")}
          />

          {/* Aquarium with nested page links */}
          <DrawerLeaf
            icon={<Fish size={13} />}
            label="Aquarium"
            active={activeSubView === "aquarium"}
            onClick={() => handleSubClick("aquarium")}
          />
          <div className="pl-9 pr-3 py-1 flex flex-col">
            {AQUARIUM_PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleAquariumPage(p.id)}
                className="group flex items-center justify-between text-left text-[10px] tracking-wide py-1 px-2 rounded text-[var(--fintheon-muted)]/55 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <span>{p.label}</span>
                <ChevronRight
                  size={10}
                  className="opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[var(--fintheon-accent)]/10 text-[9px] text-[var(--fintheon-muted)]/35">
          hover edge to reveal · auto-hides
        </div>
      </div>
    </>
  );
}

function DrawerLeaf({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
        active
          ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
          : "text-[var(--fintheon-text)]/55 hover:text-[var(--fintheon-text)]/85 hover:bg-[var(--fintheon-accent)]/5"
      }`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
