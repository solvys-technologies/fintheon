import { useEffect, useRef, useState } from "react";
import type { TourStep } from "./tour-content";

const CARD_WIDTH = 340;
const CARD_GAP = 16;
const VP_MARGIN = 12;

export function TourCard({
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

  const position = getCardPosition({ step, targetRect, cardHeight });
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      ref={cardRef}
      className="fixed z-[10000]"
      style={{
        top: position.top,
        left: position.left,
        width: CARD_WIDTH,
        transition: "top 300ms ease-out, left 300ms ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: "#0a0a00",
          border: "1px solid rgba(199, 159, 74, 0.3)",
          boxShadow:
            "0 0 40px rgba(199, 159, 74, 0.06), 0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center gap-2.5 px-5 pb-1 pt-4">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(199, 159, 74, 0.12)" }}
          />
          <h3 className="text-base font-bold" style={{ color: "#c79f4a" }}>
            {step.title}
          </h3>
        </div>

        <div className="px-5 py-3">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(240, 234, 214, 0.8)" }}
          >
            {step.description}
          </p>
        </div>

        <div
          className="flex items-center justify-between px-5 py-3"
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
                className="rounded px-3 py-1.5 text-xs transition-colors hover:text-[#f0ead6]"
                style={{ color: "rgba(240, 234, 214, 0.6)" }}
              >
                Previous
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded px-4 py-1.5 text-xs font-medium transition-all hover:brightness-110"
              style={{ background: "#c79f4a", color: "#050402" }}
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

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

function getCardPosition({
  step,
  targetRect,
  cardHeight,
}: {
  step: TourStep;
  targetRect: DOMRect | null;
  cardHeight: number;
}) {
  let top = window.innerHeight / 2 - cardHeight / 2;
  let left = window.innerWidth / 2 - CARD_WIDTH / 2;

  if (targetRect) {
    if (step.position === "right") {
      left = targetRect.right + CARD_GAP;
      top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
    }
    if (step.position === "left") {
      left = targetRect.left - CARD_WIDTH - CARD_GAP;
      top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
    }
    if (step.position === "bottom") {
      left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
      top = targetRect.bottom + CARD_GAP;
    }
    if (step.position === "top") {
      left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
      top = targetRect.top - cardHeight - CARD_GAP;
    }
  }

  return {
    left: Math.max(
      VP_MARGIN,
      Math.min(left, window.innerWidth - CARD_WIDTH - VP_MARGIN),
    ),
    top: Math.max(
      VP_MARGIN,
      Math.min(top, window.innerHeight - cardHeight - VP_MARGIN),
    ),
  };
}
