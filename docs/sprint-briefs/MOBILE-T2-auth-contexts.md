# Task Brief: T2 — Auth + Session Persistence + Core Contexts

**Date:** 2026-04-14
**Scope:** Wire Supabase Google OAuth, auto-session-restore, and slimmed provider contexts for the mobile app.
**Estimated files:** 6

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_never_bypass_auth, feedback_backend_client_pattern, feedback_secrets_vault_pattern, feedback_esm_no_require
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

The mobile app requires Google sign-in before any content is visible. Supabase manages auth with localStorage tokens that auto-restore sessions on reopen (no re-login needed). The mobile app wraps the frontend's existing Supabase client but adapts the OAuth flow for browser redirect (no Electron deep links). Theme system must import all 10 color presets + 4 font themes from the frontend.

## Files to Read First

- `frontend/contexts/AuthContext.tsx` — Full auth implementation with Supabase, Google OAuth, session management, UserTier type
- `frontend/contexts/ThemeContext.tsx` — ThemeProvider with DOM CSS var application, font theming, pompaEnabled, backend sync
- `frontend/contexts/SettingsContext.tsx` — Settings provider pattern
- `frontend/contexts/ToastContext.tsx` — Toast notification system (types, positions, DND blocklist)
- `frontend/lib/theme.ts` — THEME_PRESETS (10 presets), ThemeConfig interface, loadStoredTheme, saveTheme
- `frontend/lib/font-theme.ts` — FONT_THEMES (4 presets), FontTheme, loadStoredFontTheme, saveFontTheme
- `frontend/lib/supabase.ts` — Supabase client creation
- `frontend/lib/backend.ts` — useBackend() hook and createBackendClient()
- `frontend/lib/apiClient.ts` — ApiClient with JWT injection

## What to Build

### 1. `mobile/contexts/AuthContext.tsx`

- **Path:** `mobile/contexts/AuthContext.tsx`
- **Action:** Create
- **Spec:** Wrap Supabase auth for mobile web. On mount, call `supabase.auth.getSession()` to restore existing session from localStorage (this is the session persistence — no cookies needed). Listen to `onAuthStateChange` for token refresh. `signIn()` uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` — browser redirect, NOT Electron deep link. Export `useAuth()` hook with: `isAuthenticated`, `isLoading`, `userId`, `session`, `user`, `tier` (UserTier), `signIn`, `signOut`, `getAccessToken`. NO GitHub OAuth (desktop-only feature). NO `window.electron` references.
- **Max lines:** 120

### 2. `mobile/contexts/ThemeContext.tsx`

- **Path:** `mobile/contexts/ThemeContext.tsx`
- **Action:** Create
- **Spec:** Import `THEME_PRESETS`, `ThemeConfig`, `loadStoredTheme`, `saveTheme` from `@frontend/lib/theme`. Import `FONT_THEMES`, `loadStoredFontTheme`, `saveFontTheme` from `@frontend/lib/font-theme`. On mount, load stored theme + font theme from localStorage and apply CSS vars to `:root` (same `applyThemeToDOM` pattern as frontend). Sync to backend via `PUT /api/settings` when theme changes (requires auth). Export `useTheme()` with: `theme`, `setTheme`, `fontTheme`, `setFontTheme`, `availableThemes` (THEME_PRESETS), `availableFonts` (FONT_THEMES). Map theme colors to BOTH Fintheon vars (`--fintheon-accent` etc.) AND Nothing tokens (`--accent`, `--surface`, etc.) so both shared and mobile-only components work.
- **Max lines:** 150

### 3. `mobile/contexts/SettingsContext.tsx`

- **Path:** `mobile/contexts/SettingsContext.tsx`
- **Action:** Create
- **Spec:** Mobile-specific settings persisted to localStorage. Settings: `notificationPrefs` (object with `riskflow: boolean`, `dailyBrief: boolean`, `regimeActivations: boolean`, `severityThreshold: 'critical' | 'high' | 'medium' | 'low'`), `hapticEnabled: boolean`. Load from localStorage key `fintheon-mobile:settings` on mount. Provide `updateSettings(partial)` that merges and saves. Export `useSettings()` hook.
- **Max lines:** 80

### 4. `mobile/contexts/ToastContext.tsx`

- **Path:** `mobile/contexts/ToastContext.tsx`
- **Action:** Create
- **Spec:** Simplified toast/inline-status system. Since Nothing design uses inline status text (`[SAVED]`, `[ERROR: ...]`) instead of toast popups, this context manages a queue of status messages with auto-dismiss (3s). Each status: `{ id, message, type: 'success' | 'error' | 'info', timestamp }`. Export `useStatus()` with `showStatus(message, type)` and `statuses` array. Components render these inline near the trigger, not as floating toasts.
- **Max lines:** 60

### 5. `mobile/lib/backend.ts`

- **Path:** `mobile/lib/backend.ts`
- **Action:** Create
- **Spec:** Re-export the backend client from frontend. Import `ApiClient` from `@frontend/lib/apiClient`, import `createBackendClient` from `@frontend/lib/services`. Create a mobile-specific singleton that gets `getAccessToken` from the mobile AuthContext. Export `useBackend()` hook that returns the `BackendClient`. Pattern: lazy init on first call, pass async token getter from auth context.
- **Max lines:** 50

### 6. `mobile/App.tsx` (UPDATE)

- **Path:** `mobile/App.tsx`
- **Action:** Modify (replace T1 placeholder)
- **Spec:** Full provider tree wrapping a placeholder content area. Order (outermost to innermost): `AuthProvider` -> `ThemeProvider` -> `SettingsProvider` -> `StatusProvider` -> auth gate. The auth gate checks `useAuth().isAuthenticated`: if false, render a Nothing-style login screen (black bg, centered "FINTHEON" in Doto font at 48px, `[SIGN IN WITH GOOGLE]` pill button below in Space Mono ALL CAPS). If true, render `[AUTHENTICATED]` placeholder text. NO routing yet (T3 adds navigation).
- **Max lines:** 80

## Key Rules

- Supabase JWT is ALWAYS enforced — never set BYPASS_AUTH in any env (see memory: feedback_never_bypass_auth)
- BackendClient has no raw HTTP methods (get/post/put) — use the service classes or fetch()+API_BASE (see memory: feedback_backend_client_pattern)
- Project is type:module — NEVER use require(), always import (see memory: feedback_esm_no_require)
- Session persistence works via Supabase's built-in localStorage token storage — no custom cookie logic needed
- Theme CSS vars must map to BOTH naming conventions (Nothing tokens for mobile components, Fintheon tokens for shared imports)
- Default theme: `solvys-gold` preset
- Default font theme: `default` (Inter) — but mobile will override with Space Grotesk/Mono via Nothing tokens

## DO NOT

- Bypass auth or add BYPASS_AUTH env var
- Reference `window.electron` or Electron deep links
- Add GitHub OAuth (desktop-only)
- Create navigation, routing, or any UI components beyond the login screen
- Touch any files in `frontend/` or `backend-hono/`
- Use require() — ESM only

## Verification

```bash
cd mobile && bun run build
# Should compile with zero errors
cd mobile && bun run dev
# Should show login screen on black background
# After Google sign-in: should show [AUTHENTICATED] text
# Close browser, reopen localhost:7778 — should auto-restore session (no re-login)
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T2: Auth + session persistence + theme/settings/status contexts for Fintheon Mobile, imports all 10 color presets + 4 font themes from frontend',
  files: ['mobile/contexts/AuthContext.tsx', 'mobile/contexts/ThemeContext.tsx', 'mobile/contexts/SettingsContext.tsx', 'mobile/contexts/ToastContext.tsx', 'mobile/lib/backend.ts', 'mobile/App.tsx']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
