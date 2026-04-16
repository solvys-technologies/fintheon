// [claude-code 2026-04-16] Global activity status — loading/success state for chat FAB indicator
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

type ActivityState = "idle" | "loading" | "success";

interface ActivityStatusContextValue {
  activityState: ActivityState;
  setActivity: (state: ActivityState, autoResetMs?: number) => void;
}

const ActivityStatusContext = createContext<
  ActivityStatusContextValue | undefined
>(undefined);

export function ActivityStatusProvider({ children }: { children: ReactNode }) {
  const [activityState, setActivityState] = useState<ActivityState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActivity = useCallback(
    (state: ActivityState, autoResetMs?: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActivityState(state);
      if (autoResetMs && autoResetMs > 0) {
        timerRef.current = setTimeout(() => {
          setActivityState("idle");
          timerRef.current = null;
        }, autoResetMs);
      }
    },
    [],
  );

  return (
    <ActivityStatusContext.Provider value={{ activityState, setActivity }}>
      {children}
    </ActivityStatusContext.Provider>
  );
}

export function useActivityStatus() {
  const ctx = useContext(ActivityStatusContext);
  if (!ctx)
    throw new Error(
      "useActivityStatus must be used within ActivityStatusProvider",
    );
  return ctx;
}
