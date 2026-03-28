# S6-T3: Frontend — Execution Dashboard + Proposal Integration

**Sprint:** S6 (Intelligence Layer)
**Track:** T3 — Frontend
**Dependencies:** T1 complete (playbook API routes available)

---

## Objective
Three deliverables:
1. **Proposals panel upgrade** — show today's taken trades (executed proposals) with fill price, PnL, reconciler status, and fib context below the active proposal. Execution results surface inline, not buried in Agent Performance.
2. **RiskFlow confluence alerts** — inject high-confluence trade signals (score ≥ 8) as feed items with type `'confluence'`, showing the playbook enrichment data.
3. **Execution widgets** — ReconcilerStatus state machine + AlgoStatusWidget bridge/PDPT indicators.

---

## Files to Read First
- `frontend/components/proposals/ProposalWidget.tsx` — Full file (305 lines). The main proposals slide-out panel. Currently shows only the active pending proposal + Model Glossary. You'll add a "Today's Trades" section below.
- `frontend/components/feed/FeedItem.tsx` — Type discriminator renders ProposalCard for `type === 'proposal'`. You'll add `type === 'confluence'` path.
- `frontend/components/feed/ProposalCard.tsx` — Existing proposal card in RiskFlow feed (105 lines). Shows direction, price levels, approve/reject. Reference for styling.
- `frontend/types/feed.ts` — `FeedItem` type with `type: 'news' | 'market' | 'alert' | 'proposal'`. You'll add `'confluence'` and `'execution'`.
- `frontend/contexts/RiskFlowContext.tsx` — Merges Notion + backend sources into feed. You'll add a third source: executed trades from `/api/trading/trade-runs`.
- `frontend/lib/services.ts` — API service layer. Add new service methods here.
- `frontend/components/mission-control/AlgoStatusWidget.tsx` — Current algo status. Add bridge + PDPT indicators.
- `frontend/types/api.ts` — Existing types including `RiskFlowItem` with nested `proposal?` field.

---

## Files to Modify

### 1. `frontend/types/feed.ts`

**Add** new feed item types and execution data:

```typescript
// Add to FeedItem.type union:
export interface FeedItem {
  id: string;
  time: Date;
  text: string;
  source: string;
  type: 'news' | 'market' | 'alert' | 'proposal' | 'confluence' | 'execution';
  iv: IVIndicator;
  proposal?: ProposalData;
  confluence?: ConfluenceAlertData;   // NEW
  execution?: ExecutionData;           // NEW
}

// Add new interfaces:
export interface ConfluenceAlertData {
  confluenceScore: number;
  enrichedScore: number;
  symbol: string;
  direction: 'long' | 'short';
  hour: number;
  session: string;
  fibContext: {
    fib_1_41_probability: number;
    fib_1_68_probability: number;
    post_sweep_retrace_probability: number;
  };
  model: string;
}

export interface ExecutionData {
  tradeRunId: string;
  proposalId?: string;
  model: string;
  symbol: string;
  direction: 'long' | 'short';
  fillPrice: number | null;
  pnl: number | null;
  confluenceScore: number;
  reconcilerStatus: string;
  fibContext: {
    hour: number;
    fib_1_41_probability: number;
    post_sweep_retrace_probability: number;
  } | null;
}

// Add to ProposalData:
export interface ProposalData {
  // ... existing fields ...
  executionResult?: {
    orderId: string;
    fillPrice: number | null;
    reconcilerStatus: string;
    pnl?: number | null;
    filledAt?: string;
  };
  fibContext?: {
    hour: number;
    fib_1_41_probability: number;
    post_sweep_retrace_probability: number;
  };
}
```

### 2. `frontend/components/proposals/ProposalWidget.tsx`

**Major addition:** "Today's Trades" section below the active proposal card and above Model Glossary.

**What to add (after the Active Proposal Card div, before ModelGlossary):**

```tsx
{/* Today's Trades — executed proposals with results */}
<TodaysTrades backend={backend} />
```

**Create a `TodaysTrades` inline component (or extract to separate file if > 100 lines):**

Fetches `backend.autopilot.getHistory(10, 'executed')` on mount + every 30s. Displays:
- Section header: "Today's Trades" with count badge
- For each executed proposal today:
  - Compact row: time | symbol | direction badge | fill price | PnL (green/red)
  - Expandable detail: reconciler status, fib context (hour + reversion %), strategy name
  - Status badge: FILLED (green), REJECTED (red), TIMEOUT (amber)
- Empty state: "No trades executed today"
- Filter to today's date only (compare createdAt to current date)

**Also add to ActiveProposal interface:**
```typescript
interface ActiveProposal {
  // ... existing fields ...
  fibContext?: {
    hour: number;
    fib_1_41_probability: number;
    post_sweep_retrace_probability: number;
  };
}
```

**In the Active Proposal Card**, if `proposal.fibContext` exists, show a small tag below the strategy line:
```tsx
{proposal.fibContext && (
  <div className="text-[9px] text-[#c79f4a]/60 font-mono">
    H{proposal.fibContext.hour} Rev {(proposal.fibContext.post_sweep_retrace_probability * 100).toFixed(0)}% | Fib 1.41 {(proposal.fibContext.fib_1_41_probability * 100).toFixed(0)}%
  </div>
)}
```

### 3. `frontend/components/feed/FeedItem.tsx`

**Add** confluence alert rendering path. Insert after the proposal check (line 12-14):

```tsx
// Confluence alert — high-score trade signal with playbook enrichment
if (item.type === 'confluence' && item.confluence) {
  return <ConfluenceAlertCard confluence={item.confluence} timestamp={item.time} />;
}

// Execution result — taken trade surfacing in feed
if (item.type === 'execution' && item.execution) {
  return <ExecutionResultCard execution={item.execution} timestamp={item.time} />;
}
```

### 4. `frontend/components/feed/ConfluenceAlertCard.tsx` (NEW)

**Max 120 lines.** Compact card for high-confluence trade signals in the RiskFlow feed.

**Design:**
- Gold border-left (Solvys accent) to distinguish from regular news
- Header: "CONFLUENCE {score}" badge + symbol + direction
- Body: one-line fib context — "H9 | Rev 75% | Fib 1.41 65% | MFE/MAE 1.51x"
- Model name and session tag
- No action buttons (this is informational — the proposal panel handles execution)
- Styling matches existing FeedItem/ProposalCard patterns (bg `#050402`, gold accents)

### 5. `frontend/components/feed/ExecutionResultCard.tsx` (NEW)

**Max 100 lines.** Compact card for executed trades appearing in the RiskFlow feed.

**Design:**
- Green border-left for fills, red for rejections
- Header: "EXECUTED" badge + symbol + direction + fill price
- PnL display (green/red) if available
- Reconciler status badge
- One-line fib context if available
- Compact — max 3 lines visible

### 6. `frontend/contexts/RiskFlowContext.tsx`

**Add** a third polling source that injects confluence alerts and execution results into the feed.

**Where:** In the main polling effect (where Notion and backend sources are fetched), add:

```typescript
// Third source: trade runs + playbook alerts
try {
  const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

  // Fetch today's trade runs
  const runsRes = await fetch(`${API_BASE}/api/trading/trade-runs?limit=10`);
  if (runsRes.ok) {
    const { runs } = await runsRes.json();
    const executionItems: FeedItem[] = runs
      .filter((r: any) => isToday(new Date(r.timestamp)))
      .map((run: any) => ({
        id: `exec-${run.id}`,
        time: new Date(run.timestamp),
        text: `${run.direction.toUpperCase()} ${run.symbol} @ ${run.fillPrice?.toFixed(2) || 'Market'} — ${run.model}`,
        source: 'Execution Bridge',
        type: 'execution' as const,
        iv: { value: run.confluenceScore, type: run.direction === 'long' ? 'Bullish' : 'Bearish', classification: 'Neutral' },
        execution: {
          tradeRunId: run.id,
          proposalId: run.proposalId,
          model: run.model,
          symbol: run.symbol,
          direction: run.direction,
          fillPrice: run.fillPrice,
          pnl: run.pnl,
          confluenceScore: run.confluenceScore,
          reconcilerStatus: run.reconcilerStatus,
          fibContext: run.fibContext,
        },
      }));
    // Merge into feed (after Notion, before regular backend items)
  }

  // Fetch current playbook for confluence alert
  const playbookRes = await fetch(`${API_BASE}/api/trading/playbook/current`);
  if (playbookRes.ok) {
    const playbook = await playbookRes.json();
    if (playbook.enrichedConfluence >= 8) {
      // Inject as confluence alert
      const confluenceItem: FeedItem = {
        id: `confluence-${playbook.hour}-${Date.now()}`,
        time: new Date(),
        text: `Confluence ${playbook.enrichedConfluence}/15 — H${playbook.hour} ${playbook.session}`,
        source: 'Algo Playbook',
        type: 'confluence',
        iv: { value: playbook.enrichedConfluence, type: 'Bullish', classification: 'Neutral' },
        confluence: {
          confluenceScore: playbook.enrichedConfluence - (playbook.fibContext?.confluenceAdd ?? 0),
          enrichedScore: playbook.enrichedConfluence,
          symbol: 'MNQ',
          direction: 'long',
          hour: playbook.hour,
          session: playbook.session,
          fibContext: playbook.fibContext,
          model: '40_40_club',
        },
      };
      // Add to feed (deduplicate by hour — only one confluence alert per hour)
    }
  }
} catch (err) {
  console.warn('[RiskFlow] Execution/playbook polling failed:', err);
}
```

**Deduplication:** Confluence alerts deduplicate by `hour` — only show one per hour. Execution items deduplicate by `tradeRunId`.

**Helper function:**
```typescript
function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}
```

### 7. `frontend/lib/services.ts`

**Add** new service methods (use `fetch()` + `API_BASE` pattern, NOT `backend.get()`):

```typescript
// Trade runs (for Proposals panel "Today's Trades")
async getTradeRuns(limit = 20): Promise<{ runs: any[]; total: number }> {
  const res = await fetch(`${this.baseUrl}/api/trading/trade-runs?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch trade runs');
  return res.json();
}

// Bridge account (for AlgoStatusWidget)
async getBridgeAccount(): Promise<{
  account_id: string; balance: number; buying_power: number;
  can_trade: boolean; pdpt_remaining: number;
}> {
  const res = await fetch(`${this.baseUrl}/api/trading/bridge-account`);
  if (!res.ok) throw new Error('Failed to fetch bridge account');
  return res.json();
}

// Reconciler status
async getReconcilerStatus(): Promise<any> {
  const res = await fetch(`${this.baseUrl}/api/trading/reconciler-status`);
  if (!res.ok) throw new Error('Failed to fetch reconciler status');
  return res.json();
}

// Current playbook context
async getCurrentPlaybook(): Promise<any> {
  const res = await fetch(`${this.baseUrl}/api/trading/playbook/current`);
  if (!res.ok) throw new Error('Failed to fetch playbook');
  return res.json();
}
```

### 8. `frontend/components/mission-control/AlgoStatusWidget.tsx`

**Add** below existing algo toggle:
- Bridge connectivity dot: green "Connected" / red "Offline" (poll `/api/trading/bridge-account` every 10s)
- PDPT bar: horizontal progress bar showing `pdpt_remaining` as percentage of starting balance, color-coded (green > $500, amber $200-500, red < $200)
- Current hour context: "H9 Rev 75%" from `/api/trading/playbook/current`

---

## Files to Create

### 9. `frontend/components/feed/ConfluenceAlertCard.tsx` (NEW, max 120 lines)
### 10. `frontend/components/feed/ExecutionResultCard.tsx` (NEW, max 100 lines)
### 11. `frontend/components/execution/ReconcilerStatus.tsx` (NEW, max 200 lines)

See original brief specs for ReconcilerStatus (state machine visualization, guard status, mini-log).

---

## Verification
1. `npx vite build` — passes
2. Dev server: Proposals panel shows "Today's Trades" section (empty state or with test data)
3. RiskFlow feed shows confluence alerts when playbook enrichedConfluence >= 8
4. RiskFlow feed shows execution result cards for today's trades
5. AlgoStatusWidget shows bridge connectivity + PDPT bar
6. No console errors, no missing imports

---

## Changelog Entry
```typescript
{ date: '2026-03-28T16:00:00', agent: 'claude-code', summary: 'S6-T3: Frontend execution dashboard — Today\'s Trades in proposals panel, confluence alerts in RiskFlow feed, execution result cards, bridge/PDPT indicators, reconciler state machine', files: ['frontend/types/feed.ts', 'frontend/components/proposals/ProposalWidget.tsx', 'frontend/components/feed/FeedItem.tsx', 'frontend/components/feed/ConfluenceAlertCard.tsx', 'frontend/components/feed/ExecutionResultCard.tsx', 'frontend/components/execution/ReconcilerStatus.tsx', 'frontend/contexts/RiskFlowContext.tsx', 'frontend/lib/services.ts', 'frontend/components/mission-control/AlgoStatusWidget.tsx'] }
```

---

## DO NOT
- Do NOT modify backend TypeScript files (T1/T2 own those)
- Do NOT create Python code
- Do NOT modify reconciler-service.ts or algo-playbook.ts
- Do NOT use gradients or colored emojis (CLAUDE.md rule)
- Do NOT use `backend.get()` / `backend.post()` — use `fetch()` + API_BASE pattern
- Do NOT remove existing FeedItem types — only extend the union
- Do NOT break the existing ProposalCard or FeedItem rendering for existing types
