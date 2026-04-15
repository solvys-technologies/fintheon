// [claude-code 2026-04-15] T2: Mobile inline status system — [SAVED], [ERROR: ...] style, auto-dismiss 3s
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface StatusMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
}

interface StatusContextValue {
  statuses: StatusMessage[];
  showStatus: (message: string, type?: "success" | "error" | "info") => void;
}

const StatusContext = createContext<StatusContextValue>({
  statuses: [],
  showStatus: () => {},
});

export function StatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMessage[]>([]);

  const showStatus = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = `status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: StatusMessage = { id, message, type, timestamp: Date.now() };
      setStatuses((prev) => [...prev, entry]);
      setTimeout(() => {
        setStatuses((prev) => prev.filter((s) => s.id !== id));
      }, 3000);
    },
    [],
  );

  return (
    <StatusContext.Provider value={{ statuses, showStatus }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  return useContext(StatusContext);
}
