# Shared Context

## Active Focus

- **S63 Dock & Lockout Suite**: COMPLETE — deployed v6.0.28

## Current State

- All builds pass (frontend tsc, backend bun run build, vite build)
- Backend: Fly.io app `fintheon` (fintheon.fly.dev) — launchd-managed locally
- Desktop frontend: Vercel (fintheon-alpha.vercel.app) — auto-deploy
- Mobile PWA: Vercel (fintheon.pricedinresearch.io) — prebuilt deploy
- Electron: CommonJS (.cjs), launchd-managed with dock menu + system notifications
- Lockout system: in-memory trading lockout with poll-based status, custom duration input, desk-plan auto-lock

## Global Environment

- OpenRouter key always set for Harper-CAO; Hermes (Ollama Cloud) for Arbitrum
- No Supabase credentials needed locally (in-memory fallback everywhere)
- BYPASS_AUTH=true for local/Electron dev
- RiskFlow backend polling layers: FinancialJuice RSS primary, X handles secondary (if token set)
