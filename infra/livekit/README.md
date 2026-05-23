# Fintheon LiveKit

Self-hosted ProxVoice signaling/RTC layer for Fintheon.

## Deploy

```bash
cd infra/livekit
flyctl apps create fintheon-livekit
flyctl secrets set LIVEKIT_API_KEY=<key> LIVEKIT_API_SECRET=<secret>
flyctl deploy --config fly.toml
```

The container startup script maps those Fly secrets into `LIVEKIT_KEYS`, which
is the LiveKit server key map used for JWT validation.

Set the same secrets in `backend-hono/.env`:

```bash
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_URL=wss://fintheon-livekit.fly.dev
```
