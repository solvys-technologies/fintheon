// [claude-code 2026-04-04] Cloud persistence: NarrativeFlow state syncs to Supabase app_state (survives refresh/reboot)
// [claude-code 2026-03-31] Restored simple catalyst normalization (removed auto-classify/auto-purge)
// [claude-code 2026-03-30] Wire DB narrative_threads as lane source of truth, enrich catalysts with card-links
// [claude-code 2026-03-29] S9-T5-T1: Normalize catalyst tags/narrative fields on load for rope engine
// [claude-code 2026-03-28] NarrativeFlow localStorage CRUD + useNarrativeStore hook
// S5-T1: Added viewport + dateFilter state and SET_VIEWPORT / SET_DATE_FILTER actions
import { useCallback, useEffect, useRef, useState } from "react";
import { getMonday } from "./narrative-time";
import type {
  NarrativeFlowState,
  NarrativeSnapshot,
  AgentProviderConfig,
  NarrativeAction,
  NarrativeLane,
  CatalystCard,
  CanvasViewport,
  Rope,
} from "./narrative-types";
import { DEFAULT_VIEWPORT } from "./narrative-types";
import type { NarrativeThreadRow, NarrativeCardLink } from "./services";

const STORAGE_KEY = "fintheon:narrative:v1";
const SNAPSHOT_KEY = "fintheon:narrative-snapshot:v1";
const AGENT_CONFIG_KEY = "fintheon:narrative-agent:v1";

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function defaultState(): NarrativeFlowState {
  const now = new Date();
  return {
    lanes: [],
    catalysts: [],
    ropes: [],
    confluenceNodes: [],
    conflicts: [],
    zoomLevel: "week",
    currentWeekStart: getMonday(now).toISOString(),
    selectedCatalystId: null,
    selectedLaneId: null,
    filterSentiment: "all",
    categoryFilter: new Set(),
    severitySort: null,
    heatmapEnabled: false,
    replayMode: false,
    replayPosition: 0,
    agentProvider: { provider: "manual", autoApprove: false },
    viewport: { ...DEFAULT_VIEWPORT },
    dateFilter: null,
  };
}

export function loadNarrativeState(): NarrativeFlowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = { ...defaultState(), ...JSON.parse(raw) };
    // Normalize catalysts — ensure tags and narrative fields exist for rope engine
    parsed.catalysts = parsed.catalysts.map((c: any) => ({
      ...c,
      tags: c.tags ?? [],
      narrative: c.narrative ?? undefined,
      narrativeThreads: c.narrativeThreads ?? [],
    }));
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveNarrativeState(state: NarrativeFlowState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silent
  }
}

// ── Cloud persistence (Supabase app_state) ────────────────────────

const CLOUD_KEY = "narrative_layout";
const CLOUD_DEBOUNCE_MS = 2000;

/** Persist layout-relevant state to Supabase via /api/profile/app-state. */
async function saveNarrativeToCloud(
  state: NarrativeFlowState,
  getAccessToken: () => Promise<string | null>,
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    // Only persist layout-meaningful fields (not transient UI state)
    const payload = {
      ropes: state.ropes,
      viewport: state.viewport,
      zoomLevel: state.zoomLevel,
      currentWeekStart: state.currentWeekStart,
      filterSentiment: state.filterSentiment,
      heatmapEnabled: state.heatmapEnabled,
      dateFilter: state.dateFilter,
      agentProvider: state.agentProvider,
    };

    await fetch(`${API_BASE}/api/profile/app-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ state: { [CLOUD_KEY]: payload } }),
    });
  } catch {
    // Silent — localStorage is fallback
  }
}

/** Load layout state from Supabase cloud. Returns null if unavailable. */
async function loadNarrativeFromCloud(
  getAccessToken: () => Promise<string | null>,
): Promise<Partial<NarrativeFlowState> | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    const res = await fetch(`${API_BASE}/api/profile/app-state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const cloud = data?.[CLOUD_KEY] as Record<string, unknown> | undefined;
    if (!cloud) return null;

    return {
      ropes: (cloud.ropes as Rope[]) ?? [],
      viewport: (cloud.viewport as CanvasViewport) ?? DEFAULT_VIEWPORT,
      zoomLevel: (cloud.zoomLevel as NarrativeFlowState["zoomLevel"]) ?? "week",
      currentWeekStart: (cloud.currentWeekStart as string) ?? undefined,
      filterSentiment:
        (cloud.filterSentiment as NarrativeFlowState["filterSentiment"]) ??
        "all",
      heatmapEnabled: (cloud.heatmapEnabled as boolean) ?? false,
      dateFilter:
        (cloud.dateFilter as NarrativeFlowState["dateFilter"]) ?? null,
    };
  } catch {
    return null;
  }
}

export function loadSnapshot(): NarrativeSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: NarrativeSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // silent
  }
}

export function loadAgentConfig(): AgentProviderConfig {
  try {
    const raw = localStorage.getItem(AGENT_CONFIG_KEY);
    if (!raw) return { provider: "manual", autoApprove: false };
    return JSON.parse(raw);
  } catch {
    return { provider: "manual", autoApprove: false };
  }
}

export function saveAgentConfig(config: AgentProviderConfig): void {
  try {
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // silent
  }
}

// ── DB-backed lane + card-link sync ──────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function threadToLane(t: NarrativeThreadRow, idx: number): NarrativeLane {
  return {
    id: t.slug,
    title: t.title,
    instruments: [],
    directionBias: "neutral",
    category: "macroeconomic",
    status: (t.status as NarrativeLane["status"]) ?? "active",
    dateRange: { start: new Date().toISOString().slice(0, 10), end: null },
    healthScore: 50,
    color: t.color ?? "#c79f4a",
    order: t.sort_order ?? idx,
    parentId: null,
    forkDate: null,
    decayWeeks: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchDbThreads(): Promise<NarrativeLane[]> {
  try {
    const res = await fetch(`${API_BASE}/api/narrative/threads`);
    if (!res.ok) return [];
    const { threads } = (await res.json()) as { threads: NarrativeThreadRow[] };
    return threads.map(threadToLane);
  } catch {
    return [];
  }
}

async function fetchDbCardLinks(): Promise<NarrativeCardLink[]> {
  try {
    const res = await fetch(`${API_BASE}/api/narrative/card-links`);
    if (!res.ok) return [];
    const { links } = (await res.json()) as { links: NarrativeCardLink[] };
    return links;
  } catch {
    return [];
  }
}

/**
 * Fetch promoted catalysts from the unified scored_riskflow_items DB.
 * Returns CatalystCard-shaped objects ready for BULK_ADD_CATALYSTS.
 */
async function fetchDbCatalysts(since?: string): Promise<CatalystCard[]> {
  try {
    const params = since ? `?since=${encodeURIComponent(since)}` : "";
    const res = await fetch(`${API_BASE}/api/narrative/catalysts${params}`);
    if (!res.ok) return [];
    const { catalysts } = (await res.json()) as {
      catalysts: Array<Record<string, unknown>>;
    };
    return catalysts.map((c: Record<string, unknown>) => ({
      id: String(c.id ?? ""),
      title: String(c.title ?? ""),
      description: String(c.description ?? ""),
      date: String(c.date ?? new Date().toISOString()),
      sentiment: (c.sentiment === "bullish"
        ? "bullish"
        : "bearish") as CatalystCard["sentiment"],
      severity: (["high", "medium", "low"].includes(c.severity as string)
        ? c.severity
        : "medium") as CatalystCard["severity"],
      source: "riskflow" as const,
      narrativeIds: Array.isArray(c.narrativeIds)
        ? (c.narrativeIds as string[])
        : [],
      narrativeThreads: Array.isArray(c.narrativeThreads)
        ? (c.narrativeThreads as string[])
        : [],
      isGhost: false,
      templateType: null,
      position: null,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      category: (c.category ?? "macroeconomic") as CatalystCard["category"],
      riskflowItemId: String(c.riskflowItemId ?? c.id ?? ""),
      marketImpact: c.marketImpact as CatalystCard["marketImpact"],
      narrative: (c.narrative as string) ?? null,
      status: (c.status ?? "active") as CatalystCard["status"],
      drillDepth: 0,
      createdAt: String(c.createdAt ?? new Date().toISOString()),
      updatedAt: String(c.updatedAt ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

/** Strip `backend-` or `rf-backend-` prefix to get raw tweet_id for DB matching */
function stripIdPrefix(id: string): string {
  return id.replace(/^(rf-)?backend-/, "");
}

/** Apply DB card-links to catalysts — sets narrativeThreads + narrative fields */
function enrichCatalystsWithLinks(
  catalysts: CatalystCard[],
  links: NarrativeCardLink[],
): CatalystCard[] {
  if (links.length === 0) return catalysts;
  const linkMap = new Map<string, string[]>();
  for (const link of links) {
    const arr = linkMap.get(link.card_id) ?? [];
    arr.push(link.thread_slug);
    linkMap.set(link.card_id, arr);
  }
  return catalysts.map((c) => {
    // DB stores raw tweet_id; catalysts may have backend- or rf-backend- prefix
    const rawId = stripIdPrefix(c.id);
    const rawRfId = c.riskflowItemId ? stripIdPrefix(c.riskflowItemId) : "";
    const threads =
      linkMap.get(c.id) ?? linkMap.get(rawId) ?? linkMap.get(rawRfId) ?? [];
    if (threads.length === 0) return c;
    return {
      ...c,
      narrativeThreads: threads,
      narrative: threads[0],
      narrativeIds: threads,
    };
  });
}

function takeSnapshotFromState(state: NarrativeFlowState): NarrativeSnapshot {
  return {
    lanes: state.lanes,
    catalysts: state.catalysts,
    ropes: state.ropes,
    confluenceNodes: state.confluenceNodes,
    conflicts: state.conflicts,
    timestamp: new Date().toISOString(),
  };
}

function reduce(
  state: NarrativeFlowState,
  action: NarrativeAction,
): NarrativeFlowState {
  const now = new Date().toISOString();
  switch (action.type) {
    case "ADD_LANE": {
      const lane: NarrativeLane = {
        ...action.lane,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      return { ...state, lanes: [...state.lanes, lane] };
    }
    case "UPDATE_LANE":
      return {
        ...state,
        lanes: state.lanes.map((l) =>
          l.id === action.id ? { ...l, ...action.updates, updatedAt: now } : l,
        ),
      };
    case "REMOVE_LANE":
      return { ...state, lanes: state.lanes.filter((l) => l.id !== action.id) };
    case "REORDER_LANES": {
      const ordered = action.ids
        .map((id, i) => {
          const lane = state.lanes.find((l) => l.id === id);
          return lane ? { ...lane, order: i } : null;
        })
        .filter(Boolean) as NarrativeLane[];
      const remaining = state.lanes.filter((l) => !action.ids.includes(l.id));
      return { ...state, lanes: [...ordered, ...remaining] };
    }
    case "FORK_LANE": {
      const parent = state.lanes.find((l) => l.id === action.laneId);
      if (!parent) return state;
      const fork: NarrativeLane = {
        ...parent,
        id: generateId(),
        title: action.title,
        parentId: parent.id,
        forkDate: now,
        order: state.lanes.length,
        createdAt: now,
        updatedAt: now,
      };
      return { ...state, lanes: [...state.lanes, fork] };
    }
    case "ADD_CATALYST": {
      const catalyst: CatalystCard = {
        ...action.catalyst,
        drillDepth: action.catalyst.drillDepth ?? 0,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      return { ...state, catalysts: [...state.catalysts, catalyst] };
    }
    case "BULK_ADD_CATALYSTS": {
      const existingIds = new Set(state.catalysts.map((c) => c.id));
      const newOnes = action.catalysts.filter((c) => !existingIds.has(c.id));
      return { ...state, catalysts: [...state.catalysts, ...newOnes] };
    }
    case "IMPORT_CATALYSTS": {
      const now2 = new Date().toISOString();
      const newCatalysts = action.catalysts
        .filter(
          (c) =>
            !state.catalysts.some(
              (existing) =>
                existing.title === c.title && existing.date === c.date,
            ),
        )
        .map((c) => ({
          ...c,
          id: generateId(),
          createdAt: now2,
          updatedAt: now2,
        }));
      return { ...state, catalysts: [...state.catalysts, ...newCatalysts] };
    }
    case "UPDATE_CATALYST":
      return {
        ...state,
        catalysts: state.catalysts.map((c) =>
          c.id === action.id ? { ...c, ...action.updates, updatedAt: now } : c,
        ),
      };
    case "REMOVE_CATALYST":
      return {
        ...state,
        catalysts: state.catalysts.filter((c) => c.id !== action.id),
      };
    case "MOVE_CATALYST":
      return {
        ...state,
        catalysts: state.catalysts.map((c) =>
          c.id === action.id
            ? {
                ...c,
                date: action.date,
                position: action.position,
                updatedAt: now,
              }
            : c,
        ),
      };
    case "TAG_CATALYST":
      return {
        ...state,
        catalysts: state.catalysts.map((c) =>
          c.id === action.catalystId
            ? { ...c, tags: action.tags, updatedAt: now }
            : c,
        ),
      };
    case "ADD_ROPE": {
      const rope = { ...action.rope, id: generateId(), createdAt: now };
      return { ...state, ropes: [...state.ropes, rope] };
    }
    case "REMOVE_ROPE":
      return { ...state, ropes: state.ropes.filter((r) => r.id !== action.id) };
    case "APPROVE_ROPE":
      return {
        ...state,
        ropes: state.ropes.map((r) =>
          r.id === action.id ? { ...r, approved: true } : r,
        ),
      };
    case "ADD_CONFLUENCE": {
      const node = { ...action.node, id: generateId() };
      return { ...state, confluenceNodes: [...state.confluenceNodes, node] };
    }
    case "REMOVE_CONFLUENCE":
      return {
        ...state,
        confluenceNodes: state.confluenceNodes.filter(
          (n) => n.id !== action.id,
        ),
      };
    case "ADD_CONFLICT": {
      const conflict = { ...action.conflict, id: generateId() };
      return { ...state, conflicts: [...state.conflicts, conflict] };
    }
    case "RESOLVE_CONFLICT":
      return {
        ...state,
        conflicts: state.conflicts.map((c) =>
          c.id === action.id ? { ...c, resolved: true } : c,
        ),
      };
    case "HIGHLIGHT_BRANCH": {
      const parent = state.catalysts.find((c) => c.id === action.parentId);
      if (!parent) return state;
      const childId = generateId();
      const child: CatalystCard = {
        ...action.childCard,
        id: childId,
        parentCardId: action.parentId,
        parentHighlight: action.highlightText,
        drillDepth: parent.drillDepth + 1,
        source: "research",
        createdAt: now,
        updatedAt: now,
      };
      const updatedParent: CatalystCard = {
        ...parent,
        childCardIds: [...(parent.childCardIds ?? []), childId],
        updatedAt: now,
      };
      const rope: Rope = {
        id: generateId(),
        fromId: action.parentId,
        fromType: "catalyst",
        toId: childId,
        toType: "catalyst",
        polarity: "reinforcing",
        weight: 1,
        approved: true,
        createdAt: now,
      };
      return {
        ...state,
        catalysts: [
          ...state.catalysts.map((c) =>
            c.id === action.parentId ? updatedParent : c,
          ),
          child,
        ],
        ropes: [...state.ropes, rope],
      };
    }
    case "ADD_RESEARCH_BULLETS": {
      return {
        ...state,
        catalysts: state.catalysts.map((c) =>
          c.id === action.cardId
            ? { ...c, researchBullets: action.bullets, updatedAt: now }
            : c,
        ),
      };
    }
    case "MOVE_CARD_TO_LANE": {
      return {
        ...state,
        catalysts: state.catalysts.map((c) =>
          c.id === action.cardId
            ? { ...c, narrativeIds: [action.targetLaneId], updatedAt: now }
            : c,
        ),
      };
    }
    case "SET_ZOOM":
      return { ...state, zoomLevel: action.level };
    case "SET_WEEK":
      return { ...state, currentWeekStart: action.weekStart };
    case "SET_FILTER":
      return { ...state, filterSentiment: action.sentiment };
    case "TOGGLE_HEATMAP":
      return { ...state, heatmapEnabled: !state.heatmapEnabled };
    case "SET_REPLAY_MODE":
      return { ...state, replayMode: action.enabled };
    case "SET_REPLAY_POSITION":
      return { ...state, replayPosition: action.position };
    case "SET_VIEWPORT":
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    case "SET_DATE_FILTER":
      return { ...state, dateFilter: action.filter };
    case "TAKE_SNAPSHOT":
      return state; // handled outside reducer
    case "RESTORE_SNAPSHOT":
      return state; // handled outside reducer
    default:
      return state;
  }
}

const DESTRUCTIVE_ACTIONS = new Set([
  "REMOVE_LANE",
  "REMOVE_CATALYST",
  "REMOVE_ROPE",
  "RESTORE_SNAPSHOT",
]);

export function useNarrativeStore(
  getAccessToken?: () => Promise<string | null>,
) {
  const [state, setState] = useState<NarrativeFlowState>(loadNarrativeState);
  const [snapshot, setSnapshot] = useState<NarrativeSnapshot | null>(
    loadSnapshot,
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbLoadedRef = useRef(false);
  const cloudLoadedRef = useRef(false);
  const getTokenRef = useRef(getAccessToken);
  getTokenRef.current = getAccessToken;

  // Debounced persist — localStorage (fast) + cloud (debounced)
  const scheduleSave = useCallback((s: NarrativeFlowState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNarrativeState(s), 500);

    // Cloud persist with longer debounce
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(() => {
      if (getTokenRef.current) saveNarrativeToCloud(s, getTokenRef.current);
    }, CLOUD_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, []);

  // Load layout from cloud on mount (cloud overrides localStorage for ropes/viewport/filters)
  useEffect(() => {
    if (cloudLoadedRef.current || !getTokenRef.current) return;
    cloudLoadedRef.current = true;

    (async () => {
      const cloud = await loadNarrativeFromCloud(getTokenRef.current!);
      if (!cloud) return;

      setState((prev) => {
        const next = { ...prev, ...cloud };
        // Write back to localStorage so offline has latest cloud state
        saveNarrativeState(next);
        return next;
      });
    })();
  }, []);

  // Track last fetch timestamp for incremental polling
  const lastCatalystFetchRef = useRef<string | undefined>(undefined);

  // Fetch lanes + card-links + catalysts from DB on mount (source of truth)
  useEffect(() => {
    if (dbLoadedRef.current) return;
    dbLoadedRef.current = true;

    (async () => {
      const [dbLanes, dbLinks, dbCatalysts] = await Promise.all([
        fetchDbThreads(),
        fetchDbCardLinks(),
        fetchDbCatalysts(),
      ]);

      // Track latest promotedAt for incremental fetches
      if (dbCatalysts.length > 0) {
        lastCatalystFetchRef.current = new Date().toISOString();
      }

      setState((prev) => {
        // DB threads are the canonical lanes — replace any localStorage lanes
        const lanes = dbLanes.length > 0 ? dbLanes : prev.lanes;
        // Merge DB catalysts into local state (dedup by ID)
        const existingIds = new Set(prev.catalysts.map((c) => c.id));
        const newDbCatalysts = dbCatalysts.filter(
          (c) => !existingIds.has(c.id),
        );
        const mergedCatalysts = [...prev.catalysts, ...newDbCatalysts];
        // Enrich all catalysts with DB card-links
        const catalysts = enrichCatalystsWithLinks(mergedCatalysts, dbLinks);

        const next = { ...prev, lanes, catalysts };
        scheduleSave(next);
        return next;
      });
    })();
  }, [scheduleSave]);

  // Auto-populate: poll for new catalysts every 60s (incremental)
  useEffect(() => {
    const CATALYST_POLL_MS = 60_000;
    const interval = setInterval(async () => {
      // Only poll when tab is visible
      if (document.visibilityState !== "visible") return;

      const newCatalysts = await fetchDbCatalysts(lastCatalystFetchRef.current);
      if (newCatalysts.length === 0) return;

      lastCatalystFetchRef.current = new Date().toISOString();
      console.debug(
        `[NarrativeStore] Auto-populated ${newCatalysts.length} new catalysts from DB`,
      );

      setState((prev) => {
        const existingIds = new Set(prev.catalysts.map((c) => c.id));
        const fresh = newCatalysts.filter((c) => !existingIds.has(c.id));
        if (fresh.length === 0) return prev;
        const next = { ...prev, catalysts: [...prev.catalysts, ...fresh] };
        scheduleSave(next);
        return next;
      });
    }, CATALYST_POLL_MS);

    return () => clearInterval(interval);
  }, [scheduleSave]);

  const dispatch = useCallback(
    (action: NarrativeAction) => {
      setState((prev) => {
        // Snapshot before destructive operations
        if (DESTRUCTIVE_ACTIONS.has(action.type)) {
          const snap = takeSnapshotFromState(prev);
          setSnapshot(snap);
          saveSnapshot(snap);
        }

        if (action.type === "TAKE_SNAPSHOT") {
          const snap = takeSnapshotFromState(prev);
          setSnapshot(snap);
          saveSnapshot(snap);
          return prev;
        }

        if (action.type === "RESTORE_SNAPSHOT") {
          const snap = loadSnapshot();
          if (!snap) return prev;
          const restored: NarrativeFlowState = {
            ...prev,
            lanes: snap.lanes,
            catalysts: snap.catalysts,
            ropes: snap.ropes,
            confluenceNodes: snap.confluenceNodes,
            conflicts: snap.conflicts,
          };
          scheduleSave(restored);
          return restored;
        }

        const next = reduce(prev, action);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  return { state, snapshot, dispatch };
}
