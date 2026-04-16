# Sprint Brief: S22-T1 — Fluxer Bot Integration

## Context

PIC agents (Harper, Oracle, Feucht, Consul, Herald) need to converse autonomously in a dedicated Fluxer channel — the "Dream Room." Currently the dream system uses a custom Supabase table + REST endpoints. This track replaces that with real Fluxer API integration so agents are actual participants in the Fluxer server, visible to humans, and persistent in Fluxer's own storage.

**Key discovery: Fluxer's Slack-compatible webhook endpoint supports per-message `username` and `icon_url` overrides.** This means ONE webhook can impersonate all 5 agents — no need for 5 separate bot accounts.

## Fluxer API Reference

- **Base URL:** `https://api.fluxer.app/v1`
- **Auth:** `Authorization: Bot <token>`
- **Send message:** `POST /channels/{channel_id}/messages` — body: `{ content, embeds?, nonce?, flags? }`
- **Create webhook:** `POST /channels/{channel_id}/webhooks` — body: `{ name, avatar? }`
- **Execute webhook (Slack-compat):** `POST /webhooks/{webhook_id}/{token}/slack` — body: `{ text, username?, icon_url? }`
- **List webhooks:** `GET /channels/{channel_id}/webhooks`
- **Rate limits:** 429 with `retry_after` field

## Branch Target

`s20-agent-swarm-platform-ops` (current working branch)

## Env Vars Required

```bash
# Bot token — created in Fluxer User Settings > Applications
FLUXER_BOT_TOKEN=<token>

# Dream Room channel ID (create #dream-room in the PIC Fluxer server)
FLUXER_DREAM_CHANNEL_ID=<snowflake>

# Webhook URL (created via API or Fluxer server settings)
# Format: https://api.fluxer.app/v1/webhooks/{id}/{token}
FLUXER_DREAM_WEBHOOK_URL=<url>
```

## Scope — Included

### Backend (new service + route rewrite)

- [ ] `backend-hono/src/services/fluxer/client.ts` — Fluxer HTTP client
  - `sendMessage(channelId, content, embeds?)` — Bot token auth
  - `executeWebhook(webhookUrl, { text, username, icon_url })` — Slack-compat endpoint
  - Rate limit handling (429 + `retry_after`)
  - Retry with exponential backoff (max 3)

- [ ] `backend-hono/src/services/fluxer/agent-identities.ts` — Agent display config
  - Map each `HermesAgentId` to `{ displayName, avatarUrl, color }`
  - Avatar URLs hosted on fluxerstatic.com or your own CDN
  - Dream mode formatting (prefix/suffix per mode)

- [ ] `backend-hono/src/routes/agent-bus/dreams.ts` — Rewrite existing
  - `GET /api/agent-bus/dreams` — Proxy to Fluxer `GET /channels/{channelId}/messages` (map to DreamEntry shape)
  - `POST /api/agent-bus/dreams/trigger` — Execute dream cycle via Fluxer webhook
  - Remove Supabase persistence (Fluxer is source of truth)
  - Keep in-memory fallback for when Fluxer env vars are missing

- [ ] `backend-hono/src/services/fluxer/dream-engine.ts` — Dream cycle orchestrator
  - Pick 2-3 agents per cycle
  - Assign dream modes (replay, mutation, extrapolation, etc.)
  - Generate reflection content via LLM call (OpenRouter)
  - Post each reflection to Fluxer via webhook with agent identity
  - Support reply chains (agent B responds to agent A's dream)
  - Respect rate limits between posts (stagger 1-2s)

### Frontend (embed rewrite)

- [ ] `frontend/components/consilium/AgentDreamRoom.tsx` — Replace custom feed with Fluxer embed
  - Electron: `<webview>` pointed at dream channel URL (same pattern as FluxerEmbed)
  - Browser: External link fallback (same pattern as FluxerEmbed)
  - Keep "Induce Dream" button — calls the trigger endpoint
  - Remove all custom feed rendering (Fluxer handles display)

### Env files

- [ ] `backend-hono/.env.example` — Add FLUXER_BOT_TOKEN, FLUXER_DREAM_CHANNEL_ID, FLUXER_DREAM_WEBHOOK_URL
- [ ] `backend-hono/.env` (local) — Add real values once bot is created

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/consilium/FluxerEmbed.tsx` — Already updated, working
- `frontend/components/consilium/FluxerCallWidget.tsx` — Separate concern
- `backend-hono/src/services/agent-bus/bus.ts` — Core pub/sub, no changes needed
- `backend-hono/src/services/agent-bus/dag-scheduler.ts` — DAG system unchanged
- `supabase/migrations/20260416_agent_dreams.sql` — Can deprecate later, don't delete yet

## Known Issues to Preserve

- FluxerEmbed already handles webview/browser split (committed in 847751a)
- FluxerCallWidget wired into TopHeader between nametag and Zap (committed in ddfd527)
- The `useLiveKitRoom` hook is marked for removal but still referenced by CallButton — don't touch

## Implementation Steps

### Step 1: Manual Setup (user action, not code)

1. Create `#dream-room` text channel in Fluxer server
2. Create a webhook in that channel (Server Settings > Integrations > Webhooks)
3. Copy the webhook URL and channel ID
4. Create a bot application (User Settings > Applications) and get bot token
5. Invite bot to server with `bot` scope
6. Set env vars in `backend-hono/.env`

### Step 2: Fluxer HTTP Client

Create `backend-hono/src/services/fluxer/client.ts`:

```typescript
const FLUXER_API = "https://api.fluxer.app/v1";

interface FluxerWebhookPayload {
  text: string;
  username?: string;
  icon_url?: string;
}

async function executeWebhook(
  webhookUrl: string,
  payload: FluxerWebhookPayload,
): Promise<void>;
async function fetchChannelMessages(
  channelId: string,
  limit?: number,
): Promise<FluxerMessage[]>;
```

- Auth: `Authorization: Bot ${FLUXER_BOT_TOKEN}` for channel reads
- Webhook execution is tokenless (token is in the URL)
- Handle 429 with `retry_after` sleep

### Step 3: Agent Identity Map

Create `backend-hono/src/services/fluxer/agent-identities.ts`:

```typescript
const AGENT_IDENTITIES: Record<HermesAgentId, {
  displayName: string;
  avatarUrl: string;
  dreamPrefix: Record<DreamMode, string>;
}> = {
  oracle:  { displayName: "Oracle",  avatarUrl: "...", ... },
  feucht:  { displayName: "Feucht",  avatarUrl: "...", ... },
  consul:  { displayName: "Consul",  avatarUrl: "...", ... },
  herald:  { displayName: "Herald",  avatarUrl: "...", ... },
  harper:  { displayName: "Harper",  avatarUrl: "...", ... },
};
```

### Step 4: Dream Engine

Create `backend-hono/src/services/fluxer/dream-engine.ts`:

1. `triggerDreamCycle()` — main entry point
2. Pick 2-3 random agents
3. For each agent, generate a reflection via OpenRouter LLM call:
   - System prompt: agent's dossier from `agent-instructions/`
   - User prompt: "Reflect on recent market activity. Dream mode: {mode}. Be concise (2-3 sentences)."
4. Post each reflection to Fluxer via webhook with agent identity
5. Optionally: agent B reads agent A's post and replies (threaded conversation)

### Step 5: Rewrite Dream Routes

Update `backend-hono/src/routes/agent-bus/dreams.ts`:

- `GET /dreams` → fetch from Fluxer API, transform to DreamEntry shape
- `POST /dreams/trigger` → call `triggerDreamCycle()`
- Graceful fallback: if FLUXER_DREAM_WEBHOOK_URL is missing, use in-memory placeholder

### Step 6: Simplify Frontend

Replace `AgentDreamRoom.tsx` custom feed with Fluxer channel embed:

```tsx
// Electron: webview of dream channel
// Browser: external link fallback
// Keep "Induce Dream" trigger button above the embed
```

### Step 7: Wire Scheduled Dreams (optional, can defer)

Add a cron/interval in the backend boot sequence that triggers a dream cycle every 2 hours, mirroring Bitterbot's dream cadence.

## Acceptance Criteria

- [ ] Agents post to Fluxer #dream-room with distinct names and avatars
- [ ] "Induce Dream" button triggers a cycle that appears in Fluxer within 5s
- [ ] Dream Room tab in Consilium shows the Fluxer channel (webview in Electron)
- [ ] Works without Fluxer env vars (graceful degradation to placeholder)
- [ ] No regressions in existing Fluxer forum embed
- [ ] Backend builds clean: `cd backend-hono && bun run build`
- [ ] Frontend type-checks: `npx tsc --noEmit --project frontend/tsconfig.json`

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Test dream trigger
curl -X POST http://localhost:8080/api/agent-bus/dreams/trigger

# Test dream fetch
curl http://localhost:8080/api/agent-bus/dreams
```

## Commit Format

```
feat: S22-T1 Fluxer bot integration — agents dream in #dream-room
```
