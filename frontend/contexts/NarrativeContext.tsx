// [claude-code 2026-04-04] Cloud sync: pass getAccessToken to store for Supabase persistence
// [claude-code 2026-03-06] NarrativeFlow React context — wraps store, exposes derived state
import React, { createContext, useContext, useMemo } from 'react';
import { useNarrativeStore } from '../lib/narrative-store';
import { useAuth } from './AuthContext';
import { calculateHealthScore } from '../lib/narrative-health';
import { isSameDay } from '../lib/narrative-time';
import type {
  NarrativeFlowState,
  NarrativeSnapshot,
  NarrativeAction,
  CatalystCard,
  Rope,
  NarrativeLane,
} from '../lib/narrative-types';

interface NarrativeContextValue {
  state: NarrativeFlowState;
  snapshot: NarrativeSnapshot | null;
  dispatch: (action: NarrativeAction) => void;
  catalystsForDay: (date: Date) => CatalystCard[];
  catalystsForLane: (laneId: string) => CatalystCard[];
  cardChildren: (cardId: string) => CatalystCard[];
  cardParent: (cardId: string) => CatalystCard | undefined;
  ropesForCatalyst: (id: string) => Rope[];
  lanesFiltered: NarrativeLane[];
  activeLanes: NarrativeLane[];
  healthScores: Record<string, number>;
}

const NarrativeCtx = createContext<NarrativeContextValue | null>(null);

export function NarrativeProvider({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useAuth();
  const { state, snapshot, dispatch } = useNarrativeStore(getAccessToken);

  const catalystsForDay = useMemo(
    () => (date: Date) => state.catalysts.filter((c) => isSameDay(new Date(c.date), date)),
    [state.catalysts]
  );

  const catalystsForLane = useMemo(
    () => (laneId: string) => state.catalysts.filter(c => c.narrativeIds.includes(laneId)),
    [state.catalysts]
  );

  const cardChildren = useMemo(
    () => (cardId: string) => state.catalysts.filter(c => c.parentCardId === cardId),
    [state.catalysts]
  );

  const cardParent = useMemo(
    () => (cardId: string) => {
      const card = state.catalysts.find(c => c.id === cardId);
      return card?.parentCardId ? state.catalysts.find(c => c.id === card.parentCardId) : undefined;
    },
    [state.catalysts]
  );

  const ropesForCatalyst = useMemo(
    () => (id: string) => state.ropes.filter((r) => r.fromId === id || r.toId === id),
    [state.ropes]
  );

  const lanesFiltered = useMemo(() => {
    if (state.filterSentiment === 'all') return state.lanes;
    return state.lanes.filter((lane) => {
      const laneCatalysts = state.catalysts.filter((c) => c.narrativeIds.includes(lane.id));
      return laneCatalysts.some((c) => c.sentiment === state.filterSentiment);
    });
  }, [state.lanes, state.catalysts, state.filterSentiment]);

  const activeLanes = useMemo(
    () => state.lanes.filter((l) => l.status !== 'archived'),
    [state.lanes]
  );

  const healthScores = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const lane of state.lanes) {
      scores[lane.id] = calculateHealthScore(lane, state.catalysts, state.ropes, state.conflicts);
    }
    return scores;
  }, [state.lanes, state.catalysts, state.ropes, state.conflicts]);

  const value = useMemo<NarrativeContextValue>(
    () => ({ state, snapshot, dispatch, catalystsForDay, catalystsForLane, cardChildren, cardParent, ropesForCatalyst, lanesFiltered, activeLanes, healthScores }),
    [state, snapshot, dispatch, catalystsForDay, catalystsForLane, cardChildren, cardParent, ropesForCatalyst, lanesFiltered, activeLanes, healthScores]
  );

  return <NarrativeCtx.Provider value={value}>{children}</NarrativeCtx.Provider>;
}

export function useNarrative(): NarrativeContextValue {
  const ctx = useContext(NarrativeCtx);
  if (!ctx) throw new Error('useNarrative must be used within NarrativeProvider');
  return ctx;
}
