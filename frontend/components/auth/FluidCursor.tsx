import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { LoadingGlobe, type LoadingGlobePhase } from "../loading/LoadingGlobe";

export type FluidCursorHandle = {
  snapTo: (x: number, y: number) => void;
};

interface FluidCursorProps {
  phase?: LoadingGlobePhase;
}

interface PointerState {
  x: number;
  y: number;
  isFine: boolean;
  isVisible: boolean;
  isInteractive: boolean;
}

const LENS_SIZE = 86;
const LENS_RADIUS = LENS_SIZE / 2;

export const FluidCursor = forwardRef<FluidCursorHandle, FluidCursorProps>(
  ({ phase = "idle" }, ref) => {
    const [pointer, setPointer] = useState<PointerState>({
      x: -120,
      y: -120,
      isFine: false,
      isVisible: false,
      isInteractive: false,
    });

    useImperativeHandle(
      ref,
      () => ({
        snapTo: (x, y) => {
          setPointer((current) => ({
            ...current,
            x,
            y,
            isVisible: true,
          }));
        },
      }),
      [],
    );

    useEffect(() => {
      if (typeof window === "undefined") return;
      const media = window.matchMedia("(pointer: fine)");

      function updateFinePointer() {
        setPointer((current) => ({ ...current, isFine: media.matches }));
      }

      function handlePointerMove(event: PointerEvent) {
        if (event.pointerType && event.pointerType !== "mouse") return;
        const target = event.target;
        const element = target instanceof Element ? target : null;
        const isInteractive = Boolean(
          element?.closest(
            "button,input,textarea,select,a,[role='button'],[contenteditable='true']",
          ),
        );

        setPointer({
          x: event.clientX,
          y: event.clientY,
          isFine: media.matches,
          isVisible: true,
          isInteractive,
        });
      }

      function handlePointerLeave() {
        setPointer((current) => ({ ...current, isVisible: false }));
      }

      updateFinePointer();
      media.addEventListener("change", updateFinePointer);
      window.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("mouseleave", handlePointerLeave);

      return () => {
        media.removeEventListener("change", updateFinePointer);
        window.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("mouseleave", handlePointerLeave);
      };
    }, []);

    if (!pointer.isFine || !pointer.isVisible || pointer.isInteractive)
      return null;

    return (
      <div
        aria-hidden="true"
        className="liquid-dot-cursor"
        style={{
          transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)`,
        }}
      >
        <style>{liquidCursorCss}</style>
        <div className="liquid-dot-cursor__lens">
          <div
            className="liquid-dot-cursor__viewport"
            style={{
              left: LENS_RADIUS - pointer.x,
              top: LENS_RADIUS - pointer.y,
              transform: "scale(1.2)",
              transformOrigin: `${pointer.x}px ${pointer.y}px`,
            }}
          >
            <LoadingGlobe
              phase={phase}
              density={0.82}
              className="liquid-dot-cursor__globe"
              style={{
                position: "absolute",
                inset: "-10vmin -18vmin -8vmin 24vmin",
                opacity: 0.82,
                filter: "saturate(1.2) contrast(1.18) brightness(1.08)",
              }}
            />
          </div>
        </div>
        <div className="liquid-dot-cursor__dot" />
      </div>
    );
  },
);

FluidCursor.displayName = "FluidCursor";

const liquidCursorCss = `
  .liquid-dot-cursor {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 20;
    width: 0;
    height: 0;
    pointer-events: none;
    mix-blend-mode: screen;
    will-change: transform;
  }

  .liquid-dot-cursor__lens {
    position: absolute;
    left: -${LENS_RADIUS}px;
    top: -${LENS_RADIUS}px;
    width: ${LENS_SIZE}px;
    height: ${LENS_SIZE}px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--fintheon-text, #f0ead6) 18%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--fintheon-text, #f0ead6) 6%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 34%, transparent),
      inset 0 -12px 24px color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 8%, transparent),
      0 0 22px color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 14%, transparent);
    backdrop-filter: blur(7px) saturate(1.45) contrast(1.16);
    -webkit-backdrop-filter: blur(7px) saturate(1.45) contrast(1.16);
  }

  .liquid-dot-cursor__viewport {
    position: absolute;
    width: 100vw;
    height: 100vh;
    will-change: transform;
  }

  .liquid-dot-cursor__dot {
    position: absolute;
    left: -2px;
    top: -2px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--fintheon-text, #f0ead6) 92%, white 8%);
    box-shadow:
      0 0 7px color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 72%, transparent),
      0 0 16px color-mix(in srgb, var(--fintheon-text, #f0ead6) 22%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .liquid-dot-cursor__lens {
      display: none;
    }
  }
`;
