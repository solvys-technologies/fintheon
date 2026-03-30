# S2-T6: Developer Settings Overhaul + Password Gate

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T6 (Wave 3 — parallel with T5 after T2/T3/T4 complete)
**Depends on:** T1 (types), T2 (regime endpoints), T3 (commentator endpoints), T4 (calibration endpoints)

---

## Objective

Overhaul the Developer tab in Settings: add a password gate so developer settings require "Pricedin,./" to access, add a new RiskFlow subsection with event weight sliders and commentator tier filters, and add a toggle to show/hide the Refinement Engine sidebar tab. This track modifies ONLY the settings panel — the Refinement Engine itself is T7.

---

## Files to Read First

- `frontend/components/SettingsPanel.tsx` — THE settings component. Lines 220-231 (tab definitions), lines 1032-1110 (Developer tab content)
- `frontend/types/regime.ts` — MARKET_REGIMES, REGIME_LABELS (created by T1)
- `backend-hono/src/types/commentator.ts` — COMMENTATOR_TIERS (created by T1)
- `backend-hono/src/types/calibration.ts` — CalibrationEntry (created by T1)
- `frontend/lib/services.ts` — API call patterns used in the app
- `frontend/components/settings/` — existing settings sub-components (ClawnalystDesk, HermesSettings, ThemeSettings) for pattern reference

---

## Files to Create

### 1. `frontend/components/settings/RiskFlowSettings.tsx` (NEW, ~250 lines)

The RiskFlow subsection of the Developer tab. Contains:

**Section A: Event Weight Sliders**
```
┌─────────────────────────────────────────────────┐
│ EVENT WEIGHT CALIBRATION                        │
│ ───────────────────────────────────────────────  │
│ CPI Print         [████████░░] 7.5  [Reset]    │
│ NFP Print         [████████░░] 7.5  [Reset]    │
│ FOMC Decision     [█████████░] 8.5  [Reset]    │
│ Geopolitical      [█████████░] 8.5  [Reset]    │
│ Tariffs           [████████░░] 8.0  [Reset]    │
│ Jobless Claims    [████░░░░░░] 4.0  [Reset]    │
│ ... (all event types from calibration table)    │
│                                                 │
│ [Save All]  [Reset All to Defaults]             │
└─────────────────────────────────────────────────┘
```

- Fetch weights from `GET /api/calibration/weights`
- Each slider: 0-10 range, 0.5 step
- "Save All" calls `PUT /api/calibration/weight/:eventType` for each changed weight
- "Reset All to Defaults" calls `POST /api/calibration/seed`
- Group event types by category (Black Swan, Fed/Policy, Data Prints, Earnings, Other)
- Use `var(--fintheon-accent)` for slider track, `var(--fintheon-border)` for background

**Section B: Active Regime Display**
```
┌─────────────────────────────────────────────────┐
│ CURRENT MARKET REGIME                           │
│ ───────────────────────────────────────────────  │
│ [BEAR_TREND ▼]  Confidence: 80%                │
│ Set by: mdb_agent  •  2026-03-26 07:15         │
│                                                 │
│ Sentiment Multipliers:                          │
│   Bullish: 3.0x  |  Bearish: 1.0x  |  Neutral: 0.8x │
│                                                 │
│ [Override Regime]                                │
└─────────────────────────────────────────────────┘
```

- Fetch from `GET /api/regime/current`
- "Override Regime" dropdown calls `POST /api/regime/set` with `detectedBy: 'manual'`
- Show sentiment multipliers from DEFAULT_REGIME_MULTIPLIERS

**Section C: Commentator Tier Filters**
```
┌─────────────────────────────────────────────────┐
│ COMMENTATOR TIERS                               │
│ ───────────────────────────────────────────────  │
│ ☑ Tier 1 — Market Movers (1.5x)    [3 tagged] │
│ ☑ Tier 2 — Notable Officials (1.2x) [0 tagged] │
│ ☐ Tier 3 — Color Providers (1.0x)   [0 tagged] │
│ ☑ Untagged — Default (0.8x)                    │
│                                                 │
│ [Manage Registry →]                             │
└─────────────────────────────────────────────────┘
```

- Fetch from `GET /api/commentator/registry`
- Checkboxes filter which tiers appear in RiskFlow feed (store in localStorage)
- "Manage Registry →" links to Refinement Engine (if enabled) or shows disabled hint
- Count per tier from registry data

**Section D: Refinement Engine Toggle**
```
┌─────────────────────────────────────────────────┐
│ REFINEMENT ENGINE                               │
│ ───────────────────────────────────────────────  │
│ Show Refinement Engine tab  [  ON  ]            │
│ When enabled, a Refinement tab appears in the   │
│ sidebar above the notification bell.            │
└─────────────────────────────────────────────────┘
```

- Toggle stored in localStorage key `fintheon-refinement-enabled`
- When ON, NavSidebar shows the refinement icon (T7 reads this localStorage value)

### 2. `frontend/lib/dev-settings-auth.ts` (NEW, ~40 lines)

Password gate for Developer Settings:

```typescript
const DEV_PASSWORD_HASH = '...'; // SHA-256 of "Pricedin,./"

export function isDevAuthenticated(): boolean
// Check if localStorage has 'fintheon-dev-auth' = true AND
// sessionStorage has 'fintheon-dev-session' = true (re-auth each session)

export async function authenticateDev(password: string): Promise<boolean>
// Hash the input with SHA-256 (Web Crypto API)
// Compare against DEV_PASSWORD_HASH
// If match: set localStorage + sessionStorage flags, return true
// If no match: return false

export function clearDevAuth(): void
// Remove both storage keys
```

**Computing the hash:**
```typescript
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// Pre-compute: sha256("Pricedin,./") → store as DEV_PASSWORD_HASH constant
```

### 3. `frontend/components/settings/DevPasswordGate.tsx` (NEW, ~80 lines)

A password input component shown when Developer tab is selected but not authenticated:

```
┌─────────────────────────────────────────────────┐
│          🔒 Developer Settings                  │
│                                                 │
│   Enter password to access developer tools.     │
│                                                 │
│   [________________________]  [Unlock]          │
│                                                 │
│   Incorrect password. (if failed)               │
└─────────────────────────────────────────────────┘
```

- Renders INSTEAD of Developer tab content when not authenticated
- On successful auth, shows full Developer tab content
- Uses same Fintheon styling (dark bg, accent border, monospace input)

---

## Files to Modify

### 1. `frontend/components/SettingsPanel.tsx`

**Changes:**

1. **Import DevPasswordGate and RiskFlowSettings:**
```typescript
import { DevPasswordGate } from './settings/DevPasswordGate';
import { RiskFlowSettings } from './settings/RiskFlowSettings';
import { isDevAuthenticated } from '../lib/dev-settings-auth';
```

2. **Add state for dev auth:**
```typescript
const [devAuthenticated, setDevAuthenticated] = useState(isDevAuthenticated());
```

3. **Wrap Developer tab content with password gate (around line 1032):**
```typescript
{activeTab === 'developer' && (
  devAuthenticated ? (
    <div className="space-y-6">
      {/* NEW: RiskFlow Settings at the top */}
      <RiskFlowSettings />

      {/* Existing Developer Settings below */}
      <div className="...existing developer content...">
        {/* Account Tier, Mock Data, Feature Flags — keep all existing */}
      </div>
    </div>
  ) : (
    <DevPasswordGate onAuthenticated={() => setDevAuthenticated(true)} />
  )
)}
```

4. **Update Developer tab description** in the tabs array:
```typescript
{ id: 'developer', label: 'Developer', icon: Terminal,
  description: 'RiskFlow calibration, mock data, test tools, and tier management' },
```

---

## Key Rules / Corrections

- **Password is "Pricedin,./"** — hash it with SHA-256 at build time and store the hash. Do NOT store the plaintext password in source code. The hash is fine in source — you can't reverse SHA-256.
- **Re-auth each browser session** — use sessionStorage for session flag, localStorage for "remembered" flag. User enters password once per session.
- **Weight sliders save individually** — don't require saving all at once. But provide a "Save All" convenience button.
- **Regime override is IMMEDIATE** — when the user changes regime in settings, it calls the API and the scoring engine picks it up on next score cycle.
- **Refinement Engine toggle** — this track only creates the toggle (localStorage `fintheon-refinement-enabled`). T7 reads this value to conditionally show the sidebar icon.
- **No gradients, no colored emojis** — per global rules. Use monochrome lucide icons.
- **Slider styling** — use custom CSS with `var(--fintheon-accent)` for the filled track. The native range input needs custom styling to match the dark theme.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Build passes
bun run build

# 3. Manual testing in browser:
# - Navigate to Settings → Developer
# - Should see password gate
# - Enter "Pricedin,./" → should unlock
# - Should see RiskFlow Settings section with:
#   - Event weight sliders (fetched from API)
#   - Current regime display
#   - Commentator tier checkboxes
#   - Refinement Engine toggle
# - Adjust a weight slider → Save → verify API call succeeds
# - Toggle Refinement Engine ON → verify localStorage key set
# - Reload page → Developer tab should still be unlocked (same session)
# - New incognito window → should require password again
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T6: Developer Settings overhaul — password gate, RiskFlow calibration UI with weight sliders, regime display, commentator filters, refinement toggle', files: ['frontend/components/settings/RiskFlowSettings.tsx', 'frontend/components/settings/DevPasswordGate.tsx', 'frontend/lib/dev-settings-auth.ts', 'frontend/components/SettingsPanel.tsx'] }
```

---

## DO NOT

- Do NOT create the Refinement Engine view/tab (T7 scope)
- Do NOT modify NavSidebar.tsx (T7 scope)
- Do NOT modify backend scoring logic (T5 scope)
- Do NOT modify backend API endpoints (T2/T3/T4/T5 scope)
- Do NOT store the password in plaintext — use SHA-256 hash
- Do NOT add gradients or colored emojis to the UI
