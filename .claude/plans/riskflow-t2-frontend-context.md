# RiskFlow Fix — Track 2: Frontend Context + Backend Feed Wiring (THE CORE FIX)

## Context
You are Track 2 of 3 parallel tracks fixing the Pulse RiskFlow system.

**This is the most critical track.** The entire reason RiskFlow panels show no data is that
`RiskFlowContext.tsx` only polls MarketWatch RSS and Notion trade ideas. It NEVER calls
`/api/riskflow/feed` — the endpoint where all twitter-cli (FinancialJuice, InsiderWire),
X API, Polymarket, and Economic Calendar data lives.

Your job: wire the backend feed into the context so all 8+ consumer components immediately
get real data without any other changes.

Tracks 1 and 3 run in parallel on the backend and types respectively.

## Codebase Conventions
- Comment at top of modified files: `// [claude-code 2026-03-10] Description`
- Add changelog entry to `frontend/lib/changelog.ts`
- No gradients, no colored emojis in any UI
- Solvys Gold: `#c79f4a` — use for any new severity indicators
- Run `npx vite build` to verify after changes

---

## Import Contracts (Stable Types)

The backend `/api/riskflow/feed` returns an array of items with this shape:
```ts
interface FeedItem {
  tweet_id: string;
  source: 'FinancialJuice' | 'InsiderWire' | 'EconomicCalendar' | 'Polymarket' | 'TwitterCli';
  headline: string;
  body?: string;
  symbols: string[];
  tags: string[];
  is_breaking: boolean;
  urgency?: string;
  sentiment?: string;
  iv_score?: number;
  macro_level: number; // 1=Low, 2=Medium, 3=High, 4=Critical
  published_at: string;
  created_at: string;
}
```

The existing `RiskFlowAlert` in the frontend (check its current definition in `frontend/lib/riskflow-feed.ts` or wherever it's defined) has shape roughly:
```ts
interface RiskFlowAlert {
  id: string;
  headline: string;
  summary?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  symbols?: string[];
  tags?: string[];
  timestamp: string;
  isBreaking?: boolean;
  // trade-idea specific:
  openclawDescription?: string;
  direction?: string;
  ticker?: string;
  confidence?: number;
  entryPrice?: number;
}
```

---

## Files to Modify

### 1. `frontend/lib/services.ts`

Find the `BackendClient` class or object and add a `riskflow` namespace alongside the existing `notion` namespace:

```ts
riskflow: {
  getFeed: async (params?: { minMacroLevel?: number; limit?: number }): Promise<FeedItem[]> => {
    const qs = new URLSearchParams();
    if (params?.minMacroLevel !== undefined) qs.set('minMacroLevel', String(params.minMacroLevel));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const url = `/api/riskflow/feed${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  },
  getSources: async (): Promise<{ notion: boolean; twitterCli: boolean; xApi: boolean }> => {
    const res = await fetch('/api/riskflow/sources');
    if (!res.ok) return { notion: false, twitterCli: false, xApi: false };
    return res.json();
  },
},
```

You need to import or define the `FeedItem` type. Either import it from a shared types file if one exists, or define it inline in `services.ts` using the shape above.

Add comment at top: `// [claude-code 2026-03-10] Added riskflow namespace: getFeed, getSources`

---

### 2. `frontend/contexts/RiskFlowContext.tsx`

This is the main fix. Read the full file first to understand its current structure.

**Step A — Add `backendAlerts` state:**
```ts
const [backendAlerts, setBackendAlerts] = useState<RiskFlowAlert[]>([]);
```

**Step B — Add helper functions (place near the existing Notion conversion helpers):**
```ts
const SOURCE_LABEL_MAP: Record<string, string> = {
  FinancialJuice: 'financial-juice',
  InsiderWire: 'insider-wire',
  EconomicCalendar: 'economic-calendar',
  Polymarket: 'polymarket',
  TwitterCli: 'twitter-cli',
};

function macroLevelToSeverity(level: number): 'low' | 'medium' | 'high' | 'critical' {
  if (level >= 4) return 'critical';
  if (level >= 3) return 'high';
  if (level >= 2) return 'medium';
  return 'low';
}

function feedItemToAlert(item: FeedItem): RiskFlowAlert {
  return {
    id: item.tweet_id,
    headline: item.headline,
    summary: item.body ?? '',
    severity: macroLevelToSeverity(item.macro_level),
    source: SOURCE_LABEL_MAP[item.source] ?? item.source.toLowerCase(),
    symbols: item.symbols ?? [],
    tags: item.tags ?? [],
    timestamp: item.published_at,
    isBreaking: item.is_breaking ?? false,
  };
}
```

**Step C — Add `pollBackendFeed` callback (alongside the existing `pollNotion` callback):**
```ts
const pollBackendFeed = useCallback(async () => {
  try {
    const items = await services.riskflow.getFeed({ minMacroLevel: 2, limit: 30 });
    if (Array.isArray(items) && items.length > 0) {
      setBackendAlerts(items.map(feedItemToAlert));
    }
  } catch (err) {
    console.warn('[RiskFlowContext] Backend feed poll failed:', err);
  }
}, []);
```

**Step D — Add polling interval in the existing `useEffect` that starts RSS/Notion polling:**

Find the useEffect that starts the Notion polling interval. Add a backend feed poll:
```ts
// Poll backend feed every 30s (twitter-cli, X API, economic calendar, polymarket)
pollBackendFeed(); // immediate first call
const backendFeedInterval = setInterval(pollBackendFeed, 30_000);

// Add to cleanup:
return () => {
  // ... existing cleanups ...
  clearInterval(backendFeedInterval);
};
```

**Step E — Update the merge logic:**

Find the line that merges `notionAlerts` and `rssAlerts` (something like `[...notionAlerts, ...rssAlerts]`).

Change it to include `backendAlerts`:
```ts
// BEFORE:
const merged = [...notionAlerts, ...rssAlerts];

// AFTER:
// Dedup backend alerts against Notion (by id)
const notionIds = new Set(notionAlerts.map((a) => a.id));
const dedupedBackend = backendAlerts.filter((a) => !notionIds.has(a.id));
const merged = [...notionAlerts, ...dedupedBackend, ...rssAlerts];
```

**Step F — Verify the `visibleAlerts` computation:**

Find where `visibleAlerts` is computed (likely filters out dismissed IDs from merged alerts).
Make sure it handles `severity === 'critical'` — if it only handles `'low'|'medium'|'high'`,
add `'critical'` so critical items aren't accidentally filtered.

If there's a `dismissed` filter like `!dismissed.has(alert.id)`, that's fine — critical items
should be allowed to be dismissed. But make sure they're not hidden by default.

Add comment at top of file: `// [claude-code 2026-03-10] Wire backend /api/riskflow/feed into context — 30s polling, medium+ items`

---

## Type Safety Notes

- Import `FeedItem` type: if `services.ts` exports it, import it; otherwise define locally in context.
- The `RiskFlowAlert` type's `source` field is likely `string` (not a strict union) — if it's already `string`, no change needed. If it's a union, read Track 3's output to see the extended union before finalizing.
- If `services` object isn't imported in the context, find how Notion calls are made and mirror the import pattern.

---

## Changelog Entry

Add to `frontend/lib/changelog.ts`:
```ts
{
  date: '2026-03-10T18:30:00',
  agent: 'claude-code',
  summary: 'T2 CORE FIX: Wire /api/riskflow/feed into RiskFlowContext — twitter-cli, X API, economic calendar, polymarket now populate frontend feed',
  files: [
    'frontend/lib/services.ts',
    'frontend/contexts/RiskFlowContext.tsx',
  ],
},
```

---

## Verification

```bash
cd /Users/tifos/Desktop/Codebases/pulse
npx vite build
```

Zero build errors. After starting the backend (`cd backend-hono && npm run dev`), the frontend RiskFlow panels should show items from FinancialJuice and InsiderWire within 30 seconds of load.
