# RiskFlow Fix — Track 3: Type System + NarrativeFlow + Gateway Popup Fix

## Context
You are Track 3 of 3 parallel tracks fixing the Pulse RiskFlow system.

This track handles:
1. **Type system** — extend `RiskFlowAlert.source` union to include backend source strings
2. **Severity coverage** — ensure `'critical'` severity renders correctly in ALL consuming components
3. **NarrativeFlow** — verify `RiskFlowImportModal.tsx` handles backend-sourced alerts as catalysts
4. **Gateway popup** — the "OpenClaw Gateway Connected" toast/popup fires too often; fix it to
   only fire once on initial connection success, not on every reconnect or poll

Tracks 1 (backend) and 2 (frontend context) run in parallel. Read their plan files if needed:
- `.claude/plans/riskflow-t1-backend.md`
- `.claude/plans/riskflow-t2-frontend-context.md`

## Codebase Conventions
- Comment at top of modified files: `// [claude-code 2026-03-10] Description`
- Add changelog entry to `frontend/lib/changelog.ts`
- No gradients, no colored emojis in any UI
- Run `npx vite build` to verify after changes

---

## Files to Modify

### 1. Find and extend `RiskFlowAlert` type

Search for where `RiskFlowAlert` is defined (likely `frontend/lib/riskflow-feed.ts` or
`frontend/types/riskflow.ts`). Find the `source` field.

If it's a strict union, extend it:
```ts
// BEFORE (example):
source: 'marketwatch' | 'notion-trade-idea';

// AFTER:
source:
  | 'marketwatch'
  | 'notion-trade-idea'
  | 'financial-juice'
  | 'insider-wire'
  | 'economic-calendar'
  | 'polymarket'
  | 'twitter-cli';
```

If it's already `string`, no change needed — just note it.

Also ensure the `severity` field includes `'critical'`:
```ts
severity: 'low' | 'medium' | 'high' | 'critical';
```

---

### 2. Fix `'critical'` severity rendering in consuming components

Search for severity-based styling in these files (grep for `'high'` and `severity`):
- `frontend/components/RiskFlowPanel.tsx`
- `frontend/components/feed/NewsSection.tsx`
- `frontend/components/mission-control/RiskFlowMiniWidget.tsx`

For each file, find where severity maps to a CSS class, color, or label.
Add `critical` case:

Pattern to look for:
```ts
severity === 'high' ? 'text-red-400' : severity === 'medium' ? 'text-yellow-400' : 'text-gray-400'
```

Add critical:
```ts
severity === 'critical' ? 'text-red-500 font-bold animate-pulse' :
severity === 'high' ? 'text-red-400' :
severity === 'medium' ? 'text-yellow-400' :
'text-gray-400'
```

Use whatever CSS pattern the project already uses — don't invent new classes.
Critical should visually be the most prominent (bold, brighter red, or pulse).

---

### 3. `frontend/components/narrative/RiskFlowImportModal.tsx`

Read the full file. It imports RiskFlow alerts from context and converts them to narrative catalysts.

Find the scoring/conversion logic (likely maps `source` and `severity` to a score).

Ensure backend sources are handled:
- If there's a switch/map on `source` values, add cases for `'financial-juice'`, `'insider-wire'`,
  `'economic-calendar'`, `'polymarket'`, `'twitter-cli'`
- These should score similar to `'marketwatch'` (macro news) or appropriately higher for
  FinancialJuice/InsiderWire (real-time market alerts)
- `'critical'` severity should score the highest

Example pattern to find and extend:
```ts
// BEFORE:
const baseScore = source === 'notion-trade-idea' ? 90 : 60;

// AFTER:
const baseScore =
  source === 'notion-trade-idea' ? 90 :
  source === 'financial-juice' || source === 'insider-wire' ? 75 :
  source === 'economic-calendar' ? 70 :
  source === 'polymarket' ? 65 :
  60; // marketwatch, twitter-cli, other
```

Also ensure the severity multiplier includes `'critical'`:
```ts
// BEFORE:
const severityMult = severity === 'high' ? 1.3 : severity === 'medium' ? 1.1 : 1.0;

// AFTER:
const severityMult =
  severity === 'critical' ? 1.5 :
  severity === 'high' ? 1.3 :
  severity === 'medium' ? 1.1 :
  1.0;
```

---

### 4. Fix Gateway Connected popup firing too often

**Find the popup/toast:** Search for:
- `grep -r "gateway" frontend/components --include="*.tsx" -l`
- `grep -r "OpenClaw" frontend/components --include="*.tsx" -l`
- `grep -r "connected" frontend/components --include="*.tsx" -l`
- Look for toast/notification calls mentioning "connected" or "gateway"

**Common locations:**
- `frontend/hooks/useOpenClawRuntime.ts` or `useOpenClawChat.ts`
- `frontend/components/chat/` directory
- Any file that monitors the gateway connection status

**Fix strategy:**
The popup likely fires every time `isConnected` changes from `false` → `true`.
This happens on every mount, every reconnect, every polling cycle.

Fix: use a `hasShownConnectionToast` ref that only fires once per app session:

```ts
const hasShownConnectionToast = useRef(false);

useEffect(() => {
  if (isConnected && !hasShownConnectionToast.current) {
    hasShownConnectionToast.current = true;
    // show the toast/popup — only once
    showToast('OpenClaw Gateway Connected');
  }
}, [isConnected]);
```

OR if the toast fires on every status change, add a condition:
```ts
// BEFORE:
if (status === 'connected') {
  toast.success('Gateway Connected');
}

// AFTER:
// Only show on first connection, not reconnects
if (status === 'connected' && previousStatus !== 'connected') {
  if (!sessionStorage.getItem('gateway_connected_shown')) {
    sessionStorage.setItem('gateway_connected_shown', '1');
    toast.success('OpenClaw Gateway Connected');
  }
}
```

Use `sessionStorage` so it fires once per browser session (not per component mount).

Add comment near the fix: `// [claude-code 2026-03-10] Gateway toast: show once per session only`

---

## Changelog Entry

Add to `frontend/lib/changelog.ts`:
```ts
{
  date: '2026-03-10T18:30:00',
  agent: 'claude-code',
  summary: 'T3: Extend RiskFlowAlert source union, add critical severity rendering, fix NarrativeFlow import modal scoring, fix gateway popup firing once per session',
  files: [
    'frontend/lib/riskflow-feed.ts',
    'frontend/components/RiskFlowPanel.tsx',
    'frontend/components/narrative/RiskFlowImportModal.tsx',
    // + wherever gateway popup lives
  ],
},
```

---

## Verification

```bash
cd /Users/tifos/Desktop/Codebases/pulse
npx vite build
```

Zero build errors. Check:
- `grep -n "critical" frontend/components/RiskFlowPanel.tsx` — should have styling for critical
- `grep -n "sessionStorage\|hasShown" frontend/` — gateway popup fix present
