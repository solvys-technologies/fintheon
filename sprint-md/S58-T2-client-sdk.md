# Sprint Brief: T2 -- Client SDK + Frontend Chat Overhaul

## Context

T1 makes DeepSeek v4 Pro primary using the app's existing canonical model name, `deepseek-reasoner`, and adds encrypted API key storage. This track builds the **client-side half**: a new SDK that supports both `DeepSeek (Direct)` via DeepSeek's OpenAI-compatible API and `DeepSeek (OC API)` via the OpenCode Go/Hermes agent API from any device (desktop Electron, web, mobile PWA), using the user's stored API key, updated chat hooks, provider selection UI in settings, and consistent thread bank integration.

The key architectural shift: instead of all chat proxying through `POST /api/harper/chat` on the Fintheon backend, the SDK fetches the user's provider key/settings from the backend, then calls either `api.deepseek.com` directly or the OpenCode Go/Hermes API. Only conversation persistence goes through the Fintheon backend.

## Branch Target

`s58-deepseek-primary` (shared branch with T1 — wait for T1's route + Supabase migration to land first)

## Dependency

**T1 must complete before this track starts.** T2 depends on:
- `POST /api/settings/ai-keys` route existing (to fetch encrypted key)
- `GET /api/settings/ai-keys` route existing (to list/manage keys)
- `user_api_keys` table existing (to store keys)
- DeepSeek provider being available in the routing layer (for fallback path)

## Scope -- Included

- [ ] **NEW**: `frontend/lib/deepseek-sdk.ts` — DeepSeek SDK with two transports: `DeepSeek (Direct)` via OpenAI-compat `/v1/chat/completions` streaming SSE and `DeepSeek (OC API)` via OpenCode Go/Hermes API. Fetches user's key/settings from backend, calls selected provider directly, persists messages to thread bank via backend.
- [ ] `frontend/components/chat/hooks/useHermesChat.ts` — add `deepseek-direct` and `deepseek-oc-api` provider modes that use the new SDK instead of `DefaultChatTransport` to backend. Keep existing backend-proxied path as fallback.
- [ ] `frontend/components/chat/ProviderDropdown.tsx` — add two top-level provider options: `DeepSeek (Direct)` and `DeepSeek (OC API)`. Default selected when user has a stored API key.
- [ ] `frontend/components/settings/ApiTab.tsx` — add "AI Provider API Key" section with DeepSeek key input (password field), masked key display, add/remove buttons. Follow existing Rettiwt key pattern.
- [ ] `frontend/components/settings/HermesAdminTab.tsx` — add "Default Chat Provider" dropdown (`DeepSeek (Direct)` / `DeepSeek (OC API)` / OpenRouter / VProxy). Add yellow warning banner: "Backend processes (briefs, Arbitrum, RiskFlow) always run on Hermes via OpenCode Go or the server DeepSeek API regardless of your personal chat provider setting."
- [ ] `frontend/lib/apiClient.ts` — add `getUserApiKey(provider)` method that calls `GET /api/settings/ai-keys` and returns decrypted key (or null if user hasn't set one).
- [ ] `frontend/lib/services/ai.ts` — add `persistConversationMessage()` helper for thread bank writes after direct API calls.
- [ ] `mobile/components/chat/ChatPage.tsx` — integrate `deepseek-sdk` for direct API path. Remove relay dependency when user has DeepSeek key set. Keep relay as fallback for users without own key.
- [ ] `mobile/hooks/useAskCAO.ts` — use `deepseek-sdk` for dispatch when key is available (no more `POST /api/harper/dispatch` for direct-path users).
- [ ] `mobile/components/settings/SettingsPage.tsx` — add "AI Provider" section with API key input matching desktop pattern. Reuse `deepseek-sdk` types.
- [ ] `mobile/lib/backend.ts` — add `getApiKey()` wrapper.
- [ ] `electron/main.cjs` — no major changes needed (Electron just hosts the frontend). Verify API base resolution still works.
- [ ] `electron/preload.cjs` — no changes needed unless exposing new APIs.
- [ ] `src/lib/changelog.ts` — add entry after completion.

## Scope -- Excluded (DO NOT TOUCH)

- Backend provider pipeline files (belongs to T1)
- `backend-hono/src/` (belongs to T1, except for verifying API compatibility)
- Agent instructions (T1 owns those)
- Supabase schema/migrations (T1 owns)
- RiskFlow worker
- Sanctum, Arbitrum UI, Dashboard (unrelated surfaces)

## Reuse Inventory (existing code to call, not reinvent)

- `useChat` from `@ai-sdk/react` at `useHermesChat.ts:13` — the Vercel AI SDK hook we wrap. The new direct-SDK path should produce the same `UIMessage` shape.
- `DefaultChatTransport` from `ai` at `useHermesChat.ts:14` — existing transport. The SDK provides an alternative transport.
- `API_BASE_URL` at `frontend/components/chat/constants.ts:16` — keep as backend base for thread bank operations.
- `backendToUIMessage()` at `useHermesChat.ts:20` — reuse for hydrating conversation history.
- `getAccessToken()` at `frontend/lib/supabase.ts` — JWT for auth on thread bank calls.
- `ApiClient` class at `frontend/lib/apiClient.ts:129` — use for backend API calls (key fetch, thread persistence). Add `getUserApiKey()`.
- `useHarperProvider()` at `ProviderDropdown.tsx:20` — extend to include DeepSeek option.
- `STORAGE_KEY` pattern at `ProviderDropdown.tsx:18` — follow for new `fintheon:deepseek-key-status` localStorage cache.
- `ApiTab` component at `frontend/components/settings/ApiTab.tsx:20` — add DeepSeek section following Rettiwt's add/remove key pattern.
- `HermesAdminTab` at `frontend/components/settings/HermesAdminTab.tsx:30` — add provider selector + warning banner.
- `SettingsPage` at `mobile/components/settings/SettingsPage.tsx` — existing mobile settings shell.
- `ChatPage` at `mobile/components/chat/ChatPage.tsx:51` — existing mobile chat surface.
- `useAskCAO` at `mobile/hooks/useAskCAO.ts:27` — dispatch hook to update.
- `frontend/lib/services/ai.ts` at line 91 — `getConversation(id)` for thread bank reads.
- Conversation store at `backend-hono/src/services/ai/conversation-store.ts` — thread bank backend (do NOT modify, only consume).

## Implementation Steps

1. **Create `deepseek-sdk.ts`** — the core client library:
   - `fetchDeepSeekKey()` → GET `/api/settings/ai-keys?provider=deepseek` → returns decrypted key or null
   - `fetchOpenCodeGoSettings()` → GET `/api/settings/ai-keys?provider=opencode-go` or equivalent T1 endpoint → returns OC API URL/key if configured
   - `deepseekChatCompletion(messages, options)` → POST `https://api.deepseek.com/v1/chat/completions` with Bearer auth, streaming SSE, model `deepseek-reasoner`
   - `opencodeGoChatCompletion(messages, options)` → POST to the configured OpenCode Go/Hermes API, model `deepseek-reasoner`
   - `streamDeepSeekResponse(response)` → async generator yielding text deltas and tool calls
   - `createDeepSeekTransport()` → returns a Vercel AI SDK-compatible transport object so `useChat` can consume it without changing the component layer
   - `persistUserMessage(convId, content)` → POST to backend for thread bank write
   - `persistAssistantMessage(convId, content)` → POST to backend for thread bank write
   - Export types: `DeepSeekProvider = "deepseek-direct" | "deepseek-oc-api"`, `DeepSeekKeyStatus`

2. **Update `apiClient.ts`** — add `getUserApiKey(provider: string): Promise<string | null>` method that hits `GET /api/settings/ai-keys?provider=deepseek`.

3. **Update `useHermesChat.ts`**:
   - Import `deepseek-sdk`, add `provider: HarperProvider` param
   - When `provider === "deepseek-direct"` and key is available: use `createDeepSeekDirectTransport()` instead of `DefaultChatTransport`
   - When `provider === "deepseek-oc-api"` and OC API settings are available: use `createDeepSeekOcApiTransport()` instead of `DefaultChatTransport`
   - When key is missing: show error "No DeepSeek API key set. Add one in Settings → API."
   - Keep existing backend-proxied transport as fallback for `local`/`nous`/`orouter` providers
   - Add `onFinish` callback to persist assistant messages to thread bank

4. **Update `ProviderDropdown.tsx`**:
   - Add `{ id: "deepseek-direct", label: "DeepSeek", sub: "Direct", icon: Cloud }` provider
   - Add `{ id: "deepseek-oc-api", label: "DeepSeek", sub: "OC API", icon: Server }` provider
   - When user selects DeepSeek Direct but has no key set, show a small inline notice: "Set API key in Settings"
   - When user selects DeepSeek OC API but has no OC API settings set, show a small inline notice: "Configure OpenCode Go API in Settings"
   - Update `HarperProvider` type to include `"deepseek-direct" | "deepseek-oc-api"`
   - Update STORAGE_KEY validation

5. **Update `ApiTab.tsx`**:
   - Add new section "AI Provider API Key" above the X Feed section
   - DeepSeek API key input (password field, placeholder: "sk-...")
   - Add Key button → `POST /api/settings/ai-keys`
   - Masked key display with Remove button → `DELETE /api/settings/ai-keys`
   - Link to DeepSeek platform (platform.deepseek.com/api_keys)
   - Status indicator: "Key set" / "No key configured"

6. **Update `HermesAdminTab.tsx`**:
   - Add "Default Chat Provider" section (above Gateway Connection)
   - Dropdown: DeepSeek (Direct) / DeepSeek (OC API) / OpenRouter Opus / VProxy (Local)
   - Persist to localStorage: `fintheon:default-chat-provider`
   - Yellow warning card (bg-amber-900/20 border-amber-700/30): "All backend processes — brief generation, Arbitrum deliberation, RiskFlow scoring — always run on the server's DeepSeek API. Your chat provider setting only affects your personal CAO conversations."
   - Link: "Manage your API key" → scrolls to ApiTab section

7. **Update mobile `ChatPage.tsx`**:
   - Check for DeepSeek key availability on mount via `fetchDeepSeekKey()`
   - If key available: use `deepseek-sdk` direct path instead of `POST /api/relay/chat`
   - If key not available: keep existing relay bridge path
   - Maintain SSE stream parsing compatibility (text-delta, tool_use events)

8. **Update mobile `useAskCAO.ts`**:
   - If DeepSeek key available: create conversation via direct API, skip relay dispatch
   - If no key: keep existing `POST /api/harper/dispatch` path

9. **Update mobile `SettingsPage.tsx`**:
   - Add "AI Provider" collapsible section with API key input
   - Reuse same key management pattern as desktop ApiTab

10. **Verify Electron compatibility** — the frontend is the same React app. No Electron-specific changes needed for direct API calls (they're just fetch() calls from the renderer).

11. **Add changelog entry** in `src/lib/changelog.ts`.

## Acceptance Criteria

- [ ] User can input a DeepSeek API key in Settings → API on desktop, mobile, and web
- [ ] API key is stored encrypted server-side (via T1's endpoint)
- [ ] Chat with DeepSeek (Direct) selected works directly against `api.deepseek.com` (no Fintheon backend in the AI call path)
- [ ] Chat with DeepSeek (OC API) selected works directly against the OpenCode Go/Hermes API
- [ ] Chat with legacy providers (VProxy, ORouter) still works through backend proxy
- [ ] Conversation history persists to thread bank and hydrates correctly on reload
- [ ] Mobile chat works with direct API when key is set
- [ ] Mobile chat falls back to relay when no key set
- [ ] Herald Admin warning banner displays on web, mobile, and desktop
- [ ] Provider selection in HermesAdminTab persists across sessions and supports `DeepSeek (Direct)` plus `DeepSeek (OC API)`
- [ ] No regressions in existing chat features (tool calls, thinkHarder, Harper Vision context)
- [ ] `deepseek-sdk.ts` is reusable — same code works on desktop, mobile, and Electron without platform-specific branches

## Validation Commands

```bash
# TypeScript check
npx tsc --noEmit --project frontend/tsconfig.json

# Desktop frontend build
cd frontend && rm -rf dist && npx vite build

# Mobile PWA build
cd mobile && rm -rf dist && npx vite build

# Verify SDK imports resolve
npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | grep -i "deepseek"
```

## Commit Format

```
[S58] feat: T2 client-direct DeepSeek SDK + cross-platform chat overhaul
```
