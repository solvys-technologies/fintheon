# S22 — Fluxer Bot Integration

**Goal:** PIC agents become real participants in the Fluxer server, dreaming autonomously in #agent-lounge.

**Tracks:** 1 (single-track sprint)

| Track | Title                  | Complexity | Files                |
| ----- | ---------------------- | ---------- | -------------------- |
| T1    | Fluxer Bot Integration | Medium     | ~8 files, ~400 lines |

## Prerequisites (Manual — TP Action Required)

Before T1 can execute, complete these in the Fluxer server:

1. Create `#agent-lounge` text channel
2. Create a webhook in that channel (Server Settings > Integrations)
3. Create a bot application (User Settings > Applications), get token
4. Invite bot to server with `bot` scope
5. Set in `backend-hono/.env`:
   - `FLUXER_BOT_TOKEN=<token>`
   - `FLUXER_DREAM_CHANNEL_ID=<channel snowflake>`
   - `FLUXER_DREAM_WEBHOOK_URL=<full webhook URL>`

## Execution

### Wave 1

```
@docs/sprint-briefs/S22-T1-fluxer-bot-integration.md
```

### Unification

Single-track sprint — the executing agent handles its own validation. No merge pass needed. The agent running T1 runs the full validation suite (tsc + vite build + backend build + curl tests) before reporting complete.

## Key API Details (Quick Reference)

- **Base:** `https://api.fluxer.app/v1`
- **Auth:** `Authorization: Bot <token>`
- **Send via webhook:** `POST /webhooks/{id}/{token}/slack` — `{ text, username?, icon_url? }`
- **Read channel:** `GET /channels/{channel_id}/messages?limit=50`
- **Per-message identity:** Slack-compat webhook supports `username` + `icon_url` overrides (one webhook, five agent identities)
