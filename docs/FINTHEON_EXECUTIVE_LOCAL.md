# Fintheon Executive (Local) — Runbook

This machine’s local Fintheon instance is branded as **Fintheon Executive**.

## Services and ports (local)

- **Fintheon frontend (Vite):** auto-picks a port (currently `http://localhost:7778/` if 7777 is taken)
- **Fintheon backend (Hono):** `http://localhost:8080`
- **Agent chatroom backend:** `http://localhost:8090` (WebSocket at `ws://localhost:8090/chat`)
- **Hermes/OpenClaw gateway:** `http://localhost:18789` (OpenAI-compatible under `/v1/*`)

## Start order

1. Start the Hermes/OpenClaw gateway (must expose `/v1/chat/completions`).
2. Start Fintheon backend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/fintheon/backend-hono"
npm run dev
```

3. Start Fintheon frontend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/fintheon/frontend"
npm run dev
```

4. Start chatroom backend:

```bash
cd "/Users/tifos/Desktop/Priced In Capital/chatroom-backend"
npm run dev
```

## Branding

- Local instance name is controlled by `/Users/tifos/Desktop/Priced In Capital/fintheon/.env.local`:
  - `VITE_FINTHEON_INSTANCE_NAME="Fintheon Executive"`

