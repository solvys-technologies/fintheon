# Pulse Executive (Local) — Runbook

This machine’s local Pulse instance is branded as **Pulse Executive**.

## Services and ports (local)

- **Pulse frontend (Vite):** auto-picks a port (currently `http://localhost:7778/` if 7777 is taken)
- **Pulse backend (Hono):** `http://localhost:8080`
- **Agent chatroom backend:** `http://localhost:8090` (WebSocket at `ws://localhost:8090/chat`)
- **Clawdbot/OpenClaw gateway:** `http://localhost:18789` (OpenAI-compatible under `/v1/*`)

## Start order

1. Start the Clawdbot/OpenClaw gateway (must expose `/v1/chat/completions`).
2. Start Pulse backend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/pulse/backend-hono"
npm run dev
```

3. Start Pulse frontend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/pulse/frontend"
npm run dev
```

4. Start chatroom backend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/chatroom-backend"
npm run dev
```

## Branding

- Local instance name is controlled by `/Users/tifos/Desktop/Priced In Capital/pulse/.env.local`:
  - `VITE_PULSE_INSTANCE_NAME="Pulse Executive"`

