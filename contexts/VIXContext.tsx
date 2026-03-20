// [claude-code 2026-03-09] Expanded VIXContext with status field for degraded-state awareness
import React, { createContext, useContext, useEffect, useState } from 'react';
import { vixFeed, type VIXData, type VIXFeedStatus } from '../lib/vix-feed';

interface VIXContextValue {
  data: VIXData | null;
  status: VIXFeedStatus;
}

const VIXContext = createContext<VIXContextValue>({ data: null, status: 'loading' });

export function VIXProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<VIXData | null>(vixFeed.current);
  const [status, setStatus] = useState<VIXFeedStatus>(vixFeed.status);

  useEffect(() => {
    vixFeed.start();
    const unsubData = vixFeed.subscribe(setData);
    const unsubStatus = vixFeed.subscribeStatus(setStatus);
    return () => {
      unsubData();
      unsubStatus();
      vixFeed.stop();
    };
  }, []);

  return <VIXContext.Provider value={{ data, status }}>{children}</VIXContext.Provider>;
}

export function useVIX() {
  return useContext(VIXContext);
}
