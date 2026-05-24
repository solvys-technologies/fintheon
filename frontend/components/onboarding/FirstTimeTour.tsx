// [claude-code 2026-03-20] S3-FIX:T4 — Walkthrough overhaul: contextual floating cards, 11 steps
import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

const TOUR_STORAGE_KEY = "fintheon:tour-completed";
const LAST_VERSION_KEY = "fintheon:last-seen-version";
const CURRENT_VERSION = "8.20.3";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

interface TourStep {
  title: string;
  description: string;
  nav: string | null;
  selector: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Dashboard",
    description:
      "Your command center. KPIs, calendar, and RiskFlow at a glance.",
    nav: "dashboard",
    selector: 'button[data-tour-target="dashboard"]',
    position: "right",
  },
  {
    title: "Consilium",
    description: "Where your AI agents debate, analyze, and surface proposals.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Chat",
    description:
      "Talk directly to Hermes. Ask questions, run reports, get briefs.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Boardroom",
    description:
      "The agent discussion room. Watch Oracle, Feucht, and Herald deliberate.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Predictions",
    description:
      "AgentDesk prediction engine. IV forecasts and risk visualization.",
    nav: "proposals",
    selector: 'button[data-tour-target="proposals"]',
    position: "right",
  },
  {
    title: "Proposals",
    description:
      "Active trade proposals from the agents. Chart them on TopStepX.",
    nav: "proposals",
    selector: 'button[data-tour-target="proposals"]',
    position: "right",
  },
  {
    title: "Narratives",
    description: "Map market narratives. Drag catalysts, draw connections.",
    nav: "narrative",
    selector: 'button[data-tour-target="narrative"]',
    position: "right",
  },
  {
    title: "Apparatus",
    description:
      "Agent intelligence. See what your agents know and when they work.",
    nav: "apparatus",
    selector: 'button[data-tour-target="apparatus"]',
    position: "right",
  },
  {
    title: "Strategium",
    description: "Mission Control: ER, account tracking, regime detection.",
    nav: "dashboard",
    selector: '[data-tour-target="strategium"]',
    position: "left",
  },
  {
    title: "RiskFlow",
    description: "Real-time market feed. News, prints, and trade ideas.",
    nav: "riskflow",
    selector: 'button[data-tour-target="riskflow"]',
    position: "right",
  },
  {
    title: "Toolbar",
    description: "VIX, IV scoring, platform controls, and layout options.",
    nav: null,
    selector: '[data-tour-target="toolbar"]',
    position: "bottom",
  },
];

const WHATS_NEW_ITEMS = [
  "Contextual walkthrough tour with 11-step guided overview",
  "Consilium — AI agents debate trades and surface proposals",
  "Apparatus — agent memory, reasoning, and schedule visibility",
  "Narrative Map canvas with AgentDesk integration",
  "Blindspots interview — personalized trader profile setup",
  "Setup wizard for backend dependency checks",
];

/* ------------------------------------------------------------------ */
/*  Floating tour card                                                 */
/* ------------------------------------------------------------------ */

const CARD_WIDTH = 340;
const CARD_GAP = 16;
const VP_MARGIN = 12;

function TourCard({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(200);

  useEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step]);

  // Default: center of viewport
  let top = window.innerHeight / 2 - cardHeight / 2;
  let left = window.innerWidth / 2 - CARD_WIDTH / 2;

  if (targetRect) {
    switch (step.position) {
      case "right":
        left = targetRect.right + CARD_GAP;
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        break;
      case "left":
        left = targetRect.left - CARD_WIDTH - CARD_GAP;
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        break;
      case "bottom":
        left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
        top = targetRect.bottom + CARD_GAP;
        break;
      case "top":
        left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
        top = targetRect.top - cardHeight - CARD_GAP;
        break;
    }
  }

  // Clamp to viewport
  left = Math.max(
    VP_MARGIN,
    Math.min(left, window.innerWidth - CARD_WIDTH - VP_MARGIN),
  );
  top = Math.max(
    VP_MARGIN,
    Math.min(top, window.innerHeight - cardHeight - VP_MARGIN),
  );

  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      ref={cardRef}
      className="fixed z-[10000]"
      style={{
        top,
        left,
        width: CARD_WIDTH,
        transition: "top 300ms ease-out, left 300ms ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "#0a0a00",
          border: "1px solid rgba(199, 159, 74, 0.3)",
          boxShadow:
            "0 0 40px rgba(199, 159, 74, 0.06), 0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header with icon */}
        <div className="px-5 pt-4 pb-1 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(199, 159, 74, 0.12)" }}
          ></div>
          <h3 className="text-base font-bold" style={{ color: "#c79f4a" }}>
            {step.title}
          </h3>
        </div>

        {/* Description */}
        <div className="px-5 py-3">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(240, 234, 214, 0.8)" }}
          >
            {step.description}
          </p>
        </div>

        {/* Footer: step counter + nav */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(199, 159, 74, 0.1)" }}
        >
          <span
            className="text-xs"
            style={{ color: "rgba(240, 234, 214, 0.4)" }}
          >
            {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-xs rounded transition-colors hover:text-[#f0ead6]"
                style={{ color: "rgba(240, 234, 214, 0.6)" }}
              >
                Previous
              </button>
            )}
            <button
              onClick={onNext}
              className="px-4 py-1.5 text-xs font-medium rounded transition-all hover:brightness-110"
              style={{ background: "#c79f4a", color: "#050402" }}
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

        {/* Skip link */}
        <div className="px-5 pb-3 text-center">
          <button
            onClick={onSkip}
            className="text-[11px] transition-colors"
            style={{ color: "rgba(240, 234, 214, 0.3)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(240, 234, 214, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(240, 234, 214, 0.3)";
            }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tour orchestrator                                                  */
/* ------------------------------------------------------------------ */

export function FirstTimeTour({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [opacity, setOpacity] = useState(0);
  const measureTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { addToast } = useToast();

  // Auto-start after 1s on first visit
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        setActive(true);
        onNavigate?.(TOUR_STEPS[0].nav!);
        requestAnimationFrame(() => setOpacity(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure target element on step change
  useEffect(() => {
    if (!active) return;
    const current = TOUR_STEPS[step];
    if (!current) return;

    if (current.nav) onNavigate?.(current.nav);

    clearTimeout(measureTimer.current);
    measureTimer.current = setTimeout(() => {
      const el = document.querySelector(current.selector);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    }, 250);

    return () => clearTimeout(measureTimer.current);
  }, [step, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on resize
  useEffect(() => {
    if (!active) return;
    const handle = () => {
      const el = document.querySelector(TOUR_STEPS[step]?.selector ?? "");
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [active, step]);

  const completeTour = useCallback(() => {
    setOpacity(0);
    setTimeout(() => {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
      setActive(false);
      onNavigate?.("dashboard");
      addToast(
        "Welcome to Fintheon",
        "success",
        "Your tour is complete. Explore at your own pace.",
      );
    }, 300);
  }, [addToast, onNavigate]);

  const goNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else completeTour();
  }, [step, completeTour]);

  const goPrev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  if (!active) return null;

  return (
    <>
      {/* Dim overlay — semi-transparent, no blur */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          opacity,
          transition: "opacity 300ms ease-out",
        }}
        onClick={completeTour}
      />

      {/* Floating card */}
      <TourCard
        step={TOUR_STEPS[step]}
        stepIndex={step}
        totalSteps={TOUR_STEPS.length}
        targetRect={targetRect}
        onNext={goNext}
        onPrev={goPrev}
        onSkip={completeTour}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  What's New button (toolbar — appears 30s after version update)     */
/* ------------------------------------------------------------------ */

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
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium bg-[var(--fintheon-accent)]/15 border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 transition-colors animate-pulse"
      >
        Welcome to the Pantheon
      </button>

      {showPanel && (
        <div className="fintheon-dropdown-surface absolute right-0 top-full mt-2 w-80 bg-[#0c0a06] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">
                v{CURRENT_VERSION}
              </span>
              <button
                onClick={() => {
                  setShowPanel(false);
                  setVisible(false);
                  localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            {WHATS_NEW_ITEMS.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[var(--fintheon-accent)] text-xs mt-0.5">
                  -
                </span>
                <span className="text-xs text-gray-400 leading-relaxed">
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
