import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HOST_ID = "main-content-overlay-host";

export interface MainContentOverlayAnchorRef {
  current: HTMLElement | null;
}

interface MainContentOverlayPortalProps {
  open: boolean;
  anchorRef: MainContentOverlayAnchorRef;
  width?: number;
  gap?: number;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}

export function MainContentOverlayHost() {
  return (
    <div id={HOST_ID} className="pointer-events-none fixed inset-0 z-[9997]" />
  );
}

export function MainContentOverlayPortal({
  open,
  anchorRef,
  width = 300,
  gap = 8,
  align = "right",
  className,
  children,
}: MainContentOverlayPortalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const sync = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelWidth = Math.min(width, window.innerWidth - 24);
      const left =
        align === "left"
          ? clamp(rect.left, 12, window.innerWidth - panelWidth - 12)
          : clamp(
              rect.right - panelWidth,
              12,
              window.innerWidth - panelWidth - 12,
            );
      const top = clamp(rect.bottom + gap, 12, window.innerHeight - 80);
      setPosition({ left, top, width: panelWidth });
    };

    setHost(document.getElementById(HOST_ID) ?? document.body);
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [align, anchorRef, gap, open, width]);

  if (!open || !position) return null;

  return createPortal(
    <div
      className={className}
      style={{
        left: position.left,
        pointerEvents: "auto",
        position: "fixed",
        top: position.top,
        width: position.width,
        zIndex: 9998,
      }}
    >
      {children}
    </div>,
    host ?? document.body,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
