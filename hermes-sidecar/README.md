# hermes-sidecar — NousResearch Hermes Agent as a Python Sidecar

S27-T2 W1b landed the scaffold. Boots FastAPI on port **8318** with the HTTP contract defined in [`shared/sidecar-contract.ts`](../shared/sidecar-contract.ts).

## Layout

```
hermes-sidecar/
├── pyproject.toml              # uv-managed Python deps
├── config.yaml                 # runtime config (context engine, routing, plugins)
├── entrypoint.py               # uvicorn boot
├── Dockerfile                  # prod container (multi-stage uv)
├── fly.toml                    # Fly.io app `fintheon-hermes`, internal networking only
├── hermes_sidecar/
│   ├── app.py                  # FastAPI routes (mirrors §2 of the T2 brief)
│   ├── auth.py                 # INTERNAL_HERMES_JWT verification
│   ├── config.py               # yaml loader
│   ├── models.py               # Pydantic mirrors of shared/sidecar-contract.ts
│   └── runtime.py              # Adapter over hermes-agent + hermes-lcm; stub fallback
└── launchd/
    └── io.solvys.fintheon-hermes.plist
```

## Ports

- **Local**: 8318 (backend-hono is 8080; news-worker is 8082)
- **Prod**: Fly internal networking only, no public IP — reachable from the `fintheon` app at `fintheon-hermes.internal:8318` via 6PN.

## Local boot

```bash
cd hermes-sidecar
uv sync
export INTERNAL_HERMES_JWT=$(openssl rand -hex 32)   # or HERMES_AUTH_DISABLED=1 for scratchpad
uv run python entrypoint.py
```

launchd:
```bash
ln -s "$PWD/launchd/io.solvys.fintheon-hermes.plist" ~/Library/LaunchAgents/io.solvys.fintheon-hermes.plist
launchctl load -w ~/Library/LaunchAgents/io.solvys.fintheon-hermes.plist
curl http://localhost:8318/healthz
```

## HTTP Contract (see S27-T2 §2 for canonical reference)

| Method | Path | Notes |
| --- | --- | --- |
| GET  | `/healthz` | Public. Returns version + plugins loaded. |
| POST | `/v1/chat` | SSE stream. JWT required. |
| POST | `/v1/context/ingest` | JWT required. Returns 204. |
| GET/POST | `/v1/context/view` | JWT required. |
| POST | `/v1/context/tools/:tool` | `lcm_grep`, `lcm_describe`, `lcm_expand`, etc. |
| POST | `/v1/voice/{stt,tts}` | Returns 501 until Claude-08 (W2c) lands T5. |
| GET  | `/v1/skills` | Returns registry from `config.yaml` (T10 populates). |
| POST | `/v1/skills/invoke` | Returns 501 until Claude-10 (W2e) lands T10. |
| POST | `/v1/routing/select` | JWT required. Reads `config.yaml` routing map. |

## Upstream runtime

`hermes_sidecar/runtime.py` tries `hermes_agent`, `hermes.agent`, then `hermes` via importlib. If none resolve (e.g. scaffold smoke before the wheel builds), it falls back to a stub that still satisfies the contract so `/healthz` and `/v1/chat` remain green. Claude-07 (W2b) wires real Hermes calls once the image build resolves the git-dependency wheels.

## Rollback

Set `HERMES_SIDECAR_ENABLED=false` in backend-hono env. `sidecarClient` short-circuits; legacy `hermes-handler.ts` path serves traffic. See `backend-hono/src/services/ai/sidecar-client.ts` for the gate.

## Briefs

- [`docs/sprint-briefs/S27-T2-context-sandbox.md`](../docs/sprint-briefs/S27-T2-context-sandbox.md) — §1-3 infra (W1b, this directory), §4-6 integration (W2b)
- [`docs/sprint-briefs/S27-T5-agent-voice-briefs.md`](../docs/sprint-briefs/S27-T5-agent-voice-briefs.md) — voice plugin (W2c)
- [`docs/sprint-briefs/S27-T11-gepa-loop.md`](../docs/sprint-briefs/S27-T11-gepa-loop.md) — GEPA plugin (W2e)
