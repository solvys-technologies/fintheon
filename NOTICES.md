# NOTICES

Fintheon is built on top of open-source software. This file credits the
projects whose code, architectures, or ideas materially shaped what ships
in this repository. Inclusion here is an attribution, not a license
grant; see each project's own license for terms of use.

## Runtime / UI

- **React**, **Vite**, **Tailwind CSS** — frontend toolchain.
- **Hono** — backend HTTP framework (`backend-hono/`).
- **Electron** — desktop shell (`electron/`).
- **shadcn/ui**, **Radix UI**, **Lucide**, **Framer Motion** — component
  primitives, icons, and animation used across the frontend.
- **Supabase** (Postgres + PostgREST + RLS) — primary data layer.
- **node-cron** — in-process scheduling for RiskFlow, Arbitrum, and
  dispatch workers.
- **Ollama** — local self-hosting path for Arbitrum seat models.

## Language models

- **Qwen team (Alibaba)** — Qwen 3 and Qwen 2.5 family models power
  every Arbitrum deliberation seat (Lead, Forecaster, Risk, Quant, Bear).
- **Anthropic** — Claude Opus is the default model behind the CAO
  (harper-cao) chat path.

## Research + architectural inspiration

- **Together AI, "Mixture-of-Agents"** — the 2-layer MoA distillation
  pattern used per Arbitrum seat is a direct implementation of the MoA
  approach introduced in that paper.
- **Nous Research, Hermes series** — Hermes (Fintheon's internal AI
  gateway / sub-agent runner) is named in reference to the Hermes model
  family and shares the "tool-using assistant" spirit; the runtime is an
  independent Fintheon implementation.
- **aaronjmars/MiroShark** — the original swarm-deliberation prototype
  that ArbitrumChamber and the (now retired) MiroShark engine were modeled on.
  The S35 Arbitrum engine replaces MiroShark's persona-sim approach with
  a 5-seat weighted deliberation, but the ArbitrumChamber surface concept
  carries forward.
- **TradingAgents (multi-agent stock trading framework, academic)** —
  the "structured roles + dissent surfacing" framing behind Arbitrum's
  seat layout.

## Contact

Questions about attribution or license compatibility:
**legal@pricedinresearch.io** (or open an issue).

Last reviewed: 2026-04-24.
