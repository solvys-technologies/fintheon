// [claude-code 2026-04-19] S25: single source of truth for the full-viewport catalyst/approval
//   DetailSheet. Open via `useNotificationModal().open({kind,...})`. Close via `.close()`.
//   Works for both push-tap flow (App.tsx SW handler) AND card-tap flow (CatalystCards etc.).
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ModalPayload =
  | { kind: "toolApproval"; approvalId: string }
  | { kind: "riskflowItem"; itemId: string }
  | { kind: "catalyst"; catalystId: string }
  | { kind: "dailyBrief"; briefId?: string }
  | { kind: "maintenanceRequest"; requestId: string };

interface ContextValue {
  current: ModalPayload | null;
  open: (payload: ModalPayload) => void;
  close: () => void;
}

const Ctx = createContext<ContextValue | undefined>(undefined);

export function NotificationModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [current, setCurrent] = useState<ModalPayload | null>(null);

  const open = useCallback((p: ModalPayload) => setCurrent(p), []);
  const close = useCallback(() => setCurrent(null), []);

  const value = useMemo(
    () => ({ current, open, close }),
    [current, open, close],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotificationModal(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useNotificationModal must be used within NotificationModalProvider",
    );
  }
  return ctx;
}
