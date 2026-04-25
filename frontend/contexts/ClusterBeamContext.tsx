// [claude-code 2026-04-24] S36 ClusterBeam — dedicated context for the right-docked cluster panel.
// Kept separate from NarrativeContext so panel open/close doesn't re-render everything that
// consumes the narrative store.
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CatalystCard } from "../lib/narrative-types";

export interface ClusterBeamPayload {
  groupId: string;
  clusterNodeId: string;
  narrativeSlug?: string;
  narrativeTitle?: string;
  narrativeColor: string;
  label: string;
  cards: CatalystCard[];
}

interface ClusterBeamContextValue {
  active: ClusterBeamPayload | null;
  open: (payload: ClusterBeamPayload) => void;
  close: () => void;
  toggle: (payload: ClusterBeamPayload) => void;
}

const ClusterBeamCtx = createContext<ClusterBeamContextValue | null>(null);

export function ClusterBeamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<ClusterBeamPayload | null>(null);

  const open = useCallback((payload: ClusterBeamPayload) => {
    setActive(payload);
  }, []);

  const close = useCallback(() => {
    setActive(null);
  }, []);

  const toggle = useCallback((payload: ClusterBeamPayload) => {
    setActive((prev) => {
      if (prev && prev.groupId === payload.groupId) return null;
      return payload;
    });
  }, []);

  const value = useMemo<ClusterBeamContextValue>(
    () => ({ active, open, close, toggle }),
    [active, open, close, toggle],
  );

  return (
    <ClusterBeamCtx.Provider value={value}>{children}</ClusterBeamCtx.Provider>
  );
}

export function useClusterBeam(): ClusterBeamContextValue {
  const ctx = useContext(ClusterBeamCtx);
  if (!ctx) {
    throw new Error("useClusterBeam must be used within ClusterBeamProvider");
  }
  return ctx;
}

/** Narrow selector — consume when you only need the active payload. */
export function useActiveCluster(): ClusterBeamPayload | null {
  return useClusterBeam().active;
}
