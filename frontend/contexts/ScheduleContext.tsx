// [claude-code 2026-03-05] Phase 5A: Shared schedule context — polls /api/notion/schedule every 60s
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useBackend } from '../lib/backend';
import type { ExecutiveScheduleItem } from '../components/executive/mockExecutiveData';

interface ScheduleContextValue {
  items: ExecutiveScheduleItem[];
  loaded: boolean;
}

const ScheduleContext = createContext<ScheduleContextValue>({ items: [], loaded: false });

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const [items, setItems] = useState<ExecutiveScheduleItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await backend.notion.getSchedule();
        if (!cancelled) setItems(data as ExecutiveScheduleItem[]);
      } catch (err) {
        console.warn('[ScheduleContext] fetch failed:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [backend]);

  return (
    <ScheduleContext.Provider value={{ items, loaded }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  return useContext(ScheduleContext);
}
