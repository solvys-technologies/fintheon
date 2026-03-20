# PULSE Detailed Execution Plan (Based on Latest Desktop Codebase)


## Non-Negotiable Scope & UI Directives (Chief Override)

- **Pulse-only scope**: All implementation in this plan targets **Pulse** exclusively. **Do not implement anything in ClawSpace** (deprecated).
- **UI source standard**: Any new or updated chat UI elements/components must be sourced from **21st.dev** patterns/components first, then adapted to Pulse.
- **No blank assistant bubble while thinking**: When the agent is working/thinking and not yet streaming tokens, do **not** render an empty assistant message bubble. Only render assistant bubble once stream/output begins.
- **Sticky bottom chat behavior**: Chat view must stay pinned to the bottom during active conversation/streaming (with robust auto-scroll + bottom-lock behavior) unless the user intentionally scrolls up.


**Date:** 2026-03-09  
**Source Codebase:** `~/Desktop/Codebases/pulse`  
**Observed Branch/Head:** `v7.7.7` @ `ca3dce6`  
**Current Reality:** repo has active uncommitted frontend/backend/chat/runtime changes + new untracked integration/docs files.

---

## 1) Must-Have (Stability + Trading-Safe Operations)

### 1.1 Repo Hygiene + Change Isolation
- Create a clean implementation branch from current `v7.7.7` state.
- Group current modified files into explicit workstreams:
  - Chat runtime/routing (`frontend/components/chat/*`, `useOpenClaw*`)
  - Layout/shell updates (`NavSidebar`, `TopHeader`, `SectionBreadcrumb`)
  - Backend config/database and package drift (`backend-hono/*`)
  - Quant/rithmic docs and gateway artifacts (`docs/quantconnect`, `rithmic-gateway`, `quantconnect`)
- Convert each workstream into reviewable commits with clear intent boundaries.

### 1.2 Frontend/Backend Contract Alignment
- Build endpoint contract matrix:
  - Frontend API calls (chat, boardroom, riskflow, agents)
  - Backend route coverage in `backend-hono`
- Mark each endpoint status: `implemented`, `stubbed`, `mismatch`, `deprecated`.
- Close top-priority mismatches that block chat + executive workflow.

### 1.3 Chat Reliability Hardening
- Validate routing chain for AskHarper/OpenClaw path:
  - session start
  - thread persistence
  - message send/receive
  - completion event propagation
- Add failure-state UI for:
  - gateway down
  - timeout
  - malformed response
  - partial stream
- Ensure user-facing errors are actionable and non-silent.

### 1.4 Trading Blackout Protection (Operational Rule)
- Introduce a hard operational policy in workflow docs/runtime behavior:
  - **No non-urgent Pulse engineering execution during 08:30–11:00 EST** unless explicitly instructed by Chief.
- Add this rule as a top-level “execution gate” in planning docs and daily ops checklist.
- Add a pre-run checklist item: “Are we inside blackout window?”

---

## 2) Nice-to-Have (Speed + Maintainability)

### 2.1 Type Safety + Lint/Build Gate
- Enforce `npm run typecheck` success for:
  - `frontend`
  - `backend-hono`
- Add CI gate for typecheck + build before merge.

### 2.2 Config + Env Normalization
- Consolidate env references (`.env`, `.env.local.db`, backend env usage).
- Document required variables by environment:
  - local dev
  - staging
  - production
- Remove config ambiguity between OpenClaw runtime and app runtime.

### 2.3 Component Refactor Queue (Chat Stack)
- Rationalize overlap among:
  - `PulseChatInput.tsx`
  - `PulseComposer.tsx`
  - `ChatInputArea.tsx`
- Standardize a single state contract for:
  - draft text
  - submit lock
  - streaming state
  - retry action

---

## 3) Stretch (Execution Quality + Future Scale)

### 3.1 Feature Flags for Risky Integrations
- Gate QuantConnect/Rithmic and new runtime paths behind environment feature flags.
- Allow safe progressive enablement per environment.

### 3.2 Observability
- Add structured logs for:
  - chat request lifecycle
  - backend route errors
  - gateway completion latency
- Create a debug panel or internal log surface for fast triage.

### 3.3 Release Playbook
- Define versioned release checklist:
  - preflight (build/typecheck/env)
  - smoke tests (chat + boardroom + riskflow)
  - rollback path

---

## 4) Swarm Task Map (for Parallel Agent Execution)

- **1A — Repo Triage:** classify modified/untracked files and commit strategy.
- **1B — API Contract Audit:** frontend/backend endpoint parity matrix.
- **1C — Chat Runtime Hardening:** routing, session continuity, completion handling.
- **2A — Type/Build Gate:** scripts + CI checks.
- **2B — Env/Config Cleanup:** normalize and document env strategy.
- **3A — Observability:** structured logs + error visibility improvements.

---

## 5) Acceptance Criteria

- Chat path works reliably across new/existing threads.
- No silent failures in frontend chat UX.
- Frontend/backend contract mismatches documented and prioritized.
- Typecheck/build pass for both frontend + backend.
- Blackout policy is explicit and applied in execution decisions.

---

## 6) Immediate Next Move

1. Freeze work that is not tied to active trading outcomes during 08:30–11:00 EST.  
2. Complete `1A` triage and produce commit map.  
3. Execute `1B` parity audit to remove hidden integration debt.  
4. Land `1C` reliability fixes before any new feature expansion.

---

## 7) Notes Snapshot from Current Repo Scan

- Current head: `ca3dce6` on `v7.7.7`
- Active modified files across frontend and backend indicate in-flight runtime/chat integration work.
- Untracked additions suggest QuantConnect/Rithmic expansion and new chat components not yet stabilized in main flow.

This plan is designed to stabilize first, then accelerate safely.
