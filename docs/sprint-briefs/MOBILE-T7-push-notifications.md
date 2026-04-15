# Task Brief: T7 — Push Notifications (Service Worker + Backend)

**Date:** 2026-04-14
**Scope:** Web Push API integration with service worker, VAPID key management, backend subscription storage, multi-category notification triggers, and Nothing-style settings UI.
**Estimated files:** 8 (4 mobile + 4 backend)

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_never_bypass_auth, feedback_backend_dist_not_src, feedback_esm_no_require, feedback_dropped_items_must_mark_scored
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

Mobile users need push notifications for three categories: RiskFlow high-severity alerts, daily brief availability, and regime activations. Each category is independently toggleable. The service worker handles push events and displays native notifications. Backend stores subscriptions in Supabase and triggers pushes from existing scoring/cron systems.

## Files to Read First

- `backend-hono/src/services/riskflow/central-scorer.ts` — Where RiskFlow items get scored (add push trigger here)
- `backend-hono/src/routes/notifications.ts` — Existing notification routes (if any)
- `backend-hono/src/db/` — Database connection pattern (Neon/Supabase)
- `supabase/` — Migration file pattern
- `mobile/contexts/SettingsContext.tsx` — Settings with notification prefs (T2)
- `mobile/components/shared/BottomSheet.tsx` — Reusable bottom sheet (T4)
- `mobile/components/shared/SegmentedBar.tsx` — Segmented controls (T4)

## What to Build

### MOBILE COMPONENTS

### 1. `mobile/sw.ts`

- **Path:** `mobile/sw.ts`
- **Action:** Create
- **Spec:** Service Worker source. Handles:
  - `install` event: `self.skipWaiting()` for immediate activation
  - `activate` event: `clients.claim()` to take control immediately
  - `push` event: extracts `event.data.json()` payload `{ title, body, category, url?, icon? }`. Displays via `self.registration.showNotification(title, { body, icon: icon || '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url }, tag: category })`. Tag groups notifications by category.
  - `notificationclick` event: `event.notification.close()`. Opens `event.notification.data.url || '/'` — either focuses existing window or opens new one via `clients.openWindow()`.
    Must be compiled to `sw.js` in the build output. Add to Vite config: `build.rollupOptions.input` should include sw.ts as a separate entry that outputs to `sw.js` (or use a simple copy/build step).
- **Max lines:** 50

### 2. `mobile/lib/push.ts`

- **Path:** `mobile/lib/push.ts`
- **Action:** Create
- **Spec:** Push subscription management utilities:
  - `registerServiceWorker()`: registers `/sw.js` if supported
  - `subscribeToPush(backend, categories)`: requests Notification permission, calls `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY) })`, sends subscription JSON to `POST /api/notifications/web-push/subscribe` with categories
  - `unsubscribeFromPush(backend)`: unsubscribes PushManager, calls `DELETE /api/notifications/web-push/unsubscribe`
  - `updateCategories(backend, categories)`: calls `PATCH /api/notifications/web-push/preferences`
  - `urlBase64ToUint8Array(base64)`: standard VAPID key conversion utility
  - `getPermissionStatus()`: returns `Notification.permission`
- **Max lines:** 80

### 3. `mobile/hooks/usePushNotifications.ts`

- **Path:** `mobile/hooks/usePushNotifications.ts`
- **Action:** Create
- **Spec:** Hook managing push notification lifecycle. State: `permissionStatus: 'default' | 'granted' | 'denied'`, `isSubscribed: boolean`, `isLoading: boolean`. Methods: `enable()` (calls subscribeToPush), `disable()` (calls unsubscribeFromPush), `updateCategories(cats)`, `sendTestNotification()` (calls `POST /api/notifications/web-push/test`). Reads category prefs from SettingsContext. On mount: checks permission status and existing subscription.
- **Max lines:** 60

### 4. `mobile/components/settings/SettingsPage.tsx`

- **Path:** `mobile/components/settings/SettingsPage.tsx`
- **Action:** Create
- **Spec:** Settings tab page. Vertical list of sections separated by `var(--space-xl)` gaps. Sections:
  1. **NOTIFICATIONS** — header in Space Mono ALL CAPS `--text-secondary`. Master toggle (Nothing-style pill toggle). Below when enabled: three category toggles (RiskFlow Alerts, Daily Brief, Regime Activations) each with mechanical toggle. Severity threshold: segmented control with 4 segments (CRIT / HIGH / MED / LOW). `[TEST NOTIFICATION]` ghost button at bottom.
  2. **APPEARANCE** — Theme picker (grid of color swatches from `availableThemes`), font picker (list of `availableFonts`). Active theme/font highlighted with `--accent` border.
  3. **ACCOUNT** — User email in `--text-primary`, tier badge, `[SIGN OUT]` destructive button.
  4. **ABOUT** — Version, build timestamp in `--text-disabled`.
     All toggles: pill track + circle thumb, 44px touch target. Off: `--border-visible` track. On: `--text-display` track, `--black` thumb.
- **Max lines:** 200

### BACKEND COMPONENTS

### 5. `supabase/migrations/XXXXXX_web_push_subscriptions.sql`

- **Path:** `supabase/migrations/[next_sequence]_web_push_subscriptions.sql`
- **Action:** Create
- **Spec:** Create `web_push_subscriptions` table:
  ```sql
  CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    categories JSONB NOT NULL DEFAULT '{"riskflow": true, "dailyBrief": true, "regimeActivations": true}'::jsonb,
    severity_threshold TEXT NOT NULL DEFAULT 'high',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_web_push_user ON web_push_subscriptions(user_id);
  ```
- **Max lines:** 15

### 6. `backend-hono/src/routes/web-push.ts`

- **Path:** `backend-hono/src/routes/web-push.ts`
- **Action:** Create
- **Spec:** Web push management endpoints (all auth required):
  - `POST /subscribe` — Receives `{ subscription: PushSubscription, categories: object }`. Upserts into `web_push_subscriptions` (keyed by endpoint). Returns 201.
  - `DELETE /unsubscribe` — Receives `{ endpoint: string }`. Deletes matching row. Returns 200.
  - `PATCH /preferences` — Receives `{ categories: object, severityThreshold?: string }`. Updates user's subscription. Returns 200.
  - `POST /test` — Sends a test notification to the authenticated user's subscription: `{ title: '[TEST] Fintheon', body: 'Push notifications are working', category: 'test' }`. Returns 200.
    Register in main router as `/api/notifications/web-push`.
- **Max lines:** 100

### 7. `backend-hono/src/services/web-push-sender.ts`

- **Path:** `backend-hono/src/services/web-push-sender.ts`
- **Action:** Create
- **Spec:** Web push sending service using `web-push` npm package. Configuration: reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` from env. Methods:
  - `sendToUser(userId, payload, category)` — Queries all subscriptions for user where `categories->>category = true`. For RiskFlow: also checks `severity_threshold`. Sends via `webpush.sendNotification()`. Handles 410 Gone responses by deleting stale subscriptions.
  - `sendToAllUsers(payload, category)` — Queries all subscriptions with matching category enabled. Sends in parallel with concurrency limit (10).
    Add `web-push` to backend-hono/package.json dependencies.
- **Max lines:** 80

### 8. `backend-hono/src/services/riskflow/central-scorer.ts` (MODIFY)

- **Path:** `backend-hono/src/services/riskflow/central-scorer.ts`
- **Action:** Modify (add push trigger)
- **Spec:** After a new item is scored as 'critical' or 'high' severity, call `webPushSender.sendToAllUsers({ title: '[RISKFLOW] ' + item.title, body: item.summary || item.content?.substring(0, 100), category: 'riskflow', url: '/riskflow' }, 'riskflow')`. Import WebPushSender. Wrap in try/catch — push failure should never block scoring. Log errors but don't throw.
- **Max lines:** N/A (small modification)

## Key Rules

- Service worker must be compiled to `sw.js` in the dist root (not hashed filename)
- VAPID keys: public key in `VITE_VAPID_PUBLIC_KEY` (client), private in `VAPID_PRIVATE_KEY` (server only)
- Push failure must NEVER block scoring or other backend operations — always wrap in try/catch
- Handle 410 Gone from expired subscriptions — delete them
- Backend runs from dist/ not src/ — must `bun run build` before restart (memory: feedback_backend_dist_not_src)
- Nothing-style toggles: mechanical pill + thumb, no spring animation
- Settings labels: Space Mono ALL CAPS

## DO NOT

- Block scoring on push notification failure
- Store VAPID private key in frontend env vars
- Use spring/bounce on toggle animations
- Add skeleton loading to settings
- Create toast popups for notification status — use inline `[ENABLED]` / `[DISABLED]` text

## Verification

```bash
# Generate VAPID keys (one-time):
npx web-push generate-vapid-keys
# Add to backend .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:admin@pricedinresearch.io
# Add to mobile .env: VITE_VAPID_PUBLIC_KEY

cd backend-hono && bun run build
cd mobile && bun run build

# Test flow:
# 1. Open mobile dev server
# 2. Go to Settings tab
# 3. Enable notifications — browser permission prompt appears
# 4. Toggle categories on/off
# 5. Tap [TEST NOTIFICATION] — native notification appears
# 6. Trigger a high-severity RiskFlow item — push notification fires
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T7: Web Push notifications with service worker, VAPID auth, multi-category toggles (RiskFlow/Brief/Regimes), backend subscription storage, scorer push trigger',
  files: ['mobile/sw.ts', 'mobile/lib/push.ts', 'mobile/hooks/usePushNotifications.ts', 'mobile/components/settings/SettingsPage.tsx', 'backend-hono/src/routes/web-push.ts', 'backend-hono/src/services/web-push-sender.ts', 'backend-hono/src/services/riskflow/central-scorer.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
