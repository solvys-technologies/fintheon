import { useCallback, useEffect, useRef } from "react";

interface AutoCollapseDrawerOptions {
  isOpen: boolean;
  isAgentActive: boolean;
  onCollapse: () => void;
  delayMs?: number;
}

export function useAutoCollapseDrawer({
  isOpen,
  isAgentActive,
  onCollapse,
  delayMs = 10000,
}: AutoCollapseDrawerOptions) {
  const lastActivityRef = useRef(Date.now());

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    markActivity();
    if (isAgentActive) return;

    const activityOptions: AddEventListenerOptions = { capture: true };
    const handleUserActivity = () => markActivity();

    const activityEvents = [
      "pointerdown",
      "keydown",
      "wheel",
      "scroll",
      "focusin",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, activityOptions);
    });

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= delayMs) {
        onCollapse();
      }
    }, 500);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          handleUserActivity,
          activityOptions,
        );
      });
      window.clearInterval(interval);
    };
  }, [delayMs, isAgentActive, isOpen, markActivity, onCollapse]);

  return markActivity;
}
