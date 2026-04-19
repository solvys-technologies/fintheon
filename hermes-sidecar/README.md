# hermes-sidecar — NousResearch Hermes Agent as a Python Sidecar

W1b (Claude-03) populates this directory. Placeholder until the sidecar lands.

## What Goes Here

- `pyproject.toml` (managed with `uv`, not pip/venv)
- `config.yaml` — Hermes config: `context.engine: lcm`, preload `hermes-lcm` + `icarus-plugin`
- `entrypoint.py` — FastAPI/uvicorn bootstrap exposing the HTTP contract from `shared/sidecar-contract.ts`
- `Dockerfile` — production container
- `fly.toml` — Fly.io app config (`fintheon-hermes` app, internal networking, no public IP)
- `launchd/io.solvys.fintheon-hermes.plist` — local launchd unit on port 8318
- `plugins/gepa/` — T11 lands the GEPA + DSPy plugin here

## HTTP Contract

- `POST /v1/chat` (SSE stream)
- `POST /v1/context/ingest|view|tools/*`
- `POST /v1/voice/{stt,tts}`
- `POST /v1/skills/invoke` + `GET /v1/skills`
- `POST /v1/routing/select`

## Ports

- Local: **8318** (backend-hono is 8080, news-worker is 8082)
- Prod: internal Fly networking only, no public IP

## Auth

- Internal-only JWT via `INTERNAL_HERMES_JWT` env. backend-hono signs; sidecar verifies.

## Briefs

- [`docs/sprint-briefs/S27-T2-context-sandbox.md`](../docs/sprint-briefs/S27-T2-context-sandbox.md) — §1-3 infra (W1b), §4-6 integration (W2b)
- [`docs/sprint-briefs/S27-T5-agent-voice-briefs.md`](../docs/sprint-briefs/S27-T5-agent-voice-briefs.md) — voice plugin wiring
- [`docs/sprint-briefs/S27-T11-gepa-loop.md`](../docs/sprint-briefs/S27-T11-gepa-loop.md) — GEPA plugin
