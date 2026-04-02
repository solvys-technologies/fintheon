# S11 Sprint 1 — Claude Peers

## Objective
Replace the monolithic Hermes-agent setup with a distributed **Claude Peers** network:
- Supabase-authenticated peer identity per device
- Peer registry + heartbeat presence
- Admin desk assignment workflow
- Boardroom additive evolution (threading, peer attribution, content parts)
- Optional Hermes plugin mode
- Floating group voice widget and peer UI surface

## Implemented Scope
- Backend
  - Added peer types: `backend-hono/src/types/peers.ts`
  - Added peer registry store with in-memory fallback:
    `backend-hono/src/services/peers/peer-registry.ts`
  - Added desk manager with admin guard:
    `backend-hono/src/services/peers/desk-manager.ts`
  - Added voice room service with LiveKit-optional graceful fallback:
    `backend-hono/src/services/peers/voice-room.ts`
  - Added peer routes:
    `backend-hono/src/routes/peers/index.ts`
  - Added auth routes:
    `backend-hono/src/routes/auth/index.ts`
  - Mounted `/api/peers` and `/api/auth` in route aggregation
  - Evolved boardroom DB types/store with nullable additive fields + thread replies
  - Made Hermes init conditional on:
    - `HERMES_ENABLED !== 'false'`
    - `~/.hermes/config.yaml` existence
  - Added heartbeat monitor + boot-time local peer registration in boot pipeline

- Frontend
  - Added peer UI components:
    - `frontend/components/peers/PeerCard.tsx`
    - `frontend/components/peers/PeerCarousel.tsx`
    - `frontend/components/peers/DeskPanel.tsx`
    - `frontend/components/peers/VoiceWidget.tsx`
    - `frontend/components/peers/PeerOnboarding.tsx`
  - Integrated peer strip + onboarding + floating voice widget into `MainLayout`
  - Added `hermesEnabled` and `voiceEnabled` to Settings context + persistence
  - Added UI toggles in Settings under Profile → Peer Runtime
  - Added typed frontend API wrapper for peers in `frontend/lib/services.ts`

- Scripts and Ops
  - Added peer bootstrap script: `scripts/peer-bootstrap.sh`
  - Extended installer/setup scripts:
    - `scripts/install-cli.sh` (`fintheon peers`)
    - `scripts/fintheon-setup.sh` (Phase 10 peer bootstrap prompt)
  - Added migration:
    `supabase/migrations/20260330_claude_peers.sql`

## Notes
- Boardroom schema changes are additive and nullable (zero-format breakage intent).
- Live voice room works in mock mode when LiveKit env vars are not set.
- Peer/desk stores degrade to in-memory mode if DB tables are unavailable.

