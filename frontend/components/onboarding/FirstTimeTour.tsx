// [claude-code 2026-03-20] S3-FIX:T4 — Walkthrough overhaul: contextual floating cards, 11 steps
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../../contexts/ToastContext";
import { TourCard } from "./TourCard";
import {
  CURRENT_VERSION,
  LAST_VERSION_KEY,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
} from "./tour-content";

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
