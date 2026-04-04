# T5: Settings — iFrame List with Persistent Default

## Objective
Add an iFrame selector to Settings so users can choose a default "Proposer" iFrame. The selected default must persist in the Supabase user_settings table and be respected throughout the app wherever the Proposals/iFrame widget is rendered.

## Architecture

### Key Files to Investigate
- `frontend/components/settings/` — Settings page components
- `frontend/components/` — Search for "iframe", "Proposals", "PROPOSALS" (visible in screenshot)
- Supabase `user_settings` table — stores per-user preferences
- `backend-hono/src/routes/settings/` or `backend-hono/src/routes/user/` — Settings CRUD endpoints

### Screenshot Context
The second screenshot shows "PROPOSALS" label in the top-right area of the app with an iFrame widget below it. The user wants a settings page where they can choose which iFrame URL loads as the default Proposer widget.

## Requirements

### Settings UI
- Add an "iFrame Sources" or "Proposer Default" section to the Settings page
- Show a list of available iFrame URLs with labels
- Radio button or select to choose the default
- "Add Custom" option to add new iFrame URLs
- Delete button for custom entries (not for built-in ones)

### Built-in iFrame Options (research these — check existing code for current URLs)
Look in the codebase for any existing iFrame/embed URLs. Common ones for a trading platform:
- TradingView widget
- Unusual Whales flow
- Kalshi markets
- Custom dashboards
- Any URLs already embedded in the app

### Persistence
- Save to Supabase `user_settings` table
- Schema: `{ user_id, setting_key, setting_value }` or similar
- Key: `proposer_default_iframe` (or similar)
- Value: JSON with `{ url: string, label: string }`
- Must load on app startup and be available globally (context/store)

### App Integration
- Wherever the Proposer/PROPOSALS widget renders, it should read the user's default iFrame setting
- If no default set, use a sensible fallback (first in list)
- The iFrame should hot-swap when the user changes the setting (no page reload)

## Implementation Plan

### Step 1: Find Existing iFrame/Proposals Code
Search for:
- `iframe` in frontend components
- `PROPOSALS` text
- `Proposer` references
- Any embed/widget components
- Current settings page structure

### Step 2: Investigate user_settings Table
```sql
SELECT * FROM user_settings LIMIT 5;
-- or
\d user_settings
```
Check if the table exists and what schema it uses. If it doesn't exist, create a migration.

### Step 3: Build Settings UI Section
Add to existing Settings page. Style should match current settings patterns.

### Step 4: Wire Up Persistence
- Backend: GET/PUT `/api/settings/iframe-default`
- Frontend: Custom hook `useIFrameDefault()` that reads from settings and provides current URL
- Context provider at app root for global access

### Step 5: Apply Default in Proposals Widget
Update the Proposals/iFrame component to read from the settings hook instead of a hardcoded URL.

## Constraints
- Must use Supabase for persistence (never localStorage-only for user prefs)
- Auth must be enforced (NEVER bypass)
- Backend: `bun run build` after changes, restart via launchd
- Frontend: `npx vite build` from `frontend/` to verify
- Add changelog entry to `src/lib/changelog.ts`
- Solvys palette: BG #050402, Accent #c79f4a, Text #f0ead6
