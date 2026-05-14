# Agent Orchestration & Coordination

You are part of a multi-agent system designed for complex development workflows.

## The Agent Roster

| Agent             | Role            | Specialty                                         |
| ----------------- | --------------- | ------------------------------------------------- |
| **Harper-Hermes** | CAO             | Strategy, coordination, OpenClaw gateway          |
| **Oracle**        | Analyst         | Market analysis, IV scoring, trade signals        |
| **Feucht**        | Risk Officer    | Risk management, position sizing, drawdown limits |
| **Consul**        | Compliance & QA | Validation, testing, compliance checks            |
| **Herald**        | Communications  | Alerts, notifications, report generation          |
| **Claude Code**   | Engineer        | Feature development, debugging, architecture      |

## Coordination Protocol: "Harper orchestrates, Oracle analyzes, Feucht guards, Consul validates, Herald communicates"

### Situational Handoffs

- **Strategy/Priorities**: Escalate to **Harper-Hermes**.
- **Trading Logic**: Redirect to **Oracle**.
- **Risk Limits**: Redirect to **Feucht**.
- **Validation**: Always involve **Consul** before merging or deploying.
- **Alerts/Reports**: Hand off to **Herald**.
- **Debugging**: Hand off to **Claude Code**.

### Handoff Format

When delegating or handing off:

1. Update `.cursor/handoff-log.md` (if used).
2. Use the following syntax in chat:
   `[HANDOFF] -> @AgentName: [Reason] | Context: [Relevant Files]`

## Claude Peers Cross-Agent Protocol

Claude Peers is development-only coordination for engineering agents working in
the repo. It is not a Fintheon runtime product surface, frontend panel, or
production backend chat protocol.

### Peer Discovery

- Runtime peer registration may still support Team, desks, voice, and
  RiskFlow worker coordination.
- Development handoffs should use repository files, Linear issues, MCP tools,
  or the local Claude Peers workflow if it is configured on the developer
  machine.
- Do not add app-facing Peer Chat panels, chat routes, or product UI for
  agent-to-agent messaging.

### Development Handoff Shape

When handing work to another development agent, keep the payload in the repo or
the task tracker so it is reviewable:

- Task summary and acceptance criteria
- Current branch and relevant commits
- `@` file references for touched or required files
- Validation commands and their results
- Any blockers or decisions needed from TP

## Shared Context Management

- Use `.cursor/shared-context.md` for persistent state between chats.
- Use `.cursor/agent-status.md` for long-running tasks.

## Peer Handoff Logging

When executing a cross-instance handoff, log the event in `.cursor/handoff-log.md`:

```
[v.5.12.1] | From: Claude Code | To: [Other Agent] | Task: Repo handoff
Status: Completed
Notes: files: @sprint-md/S65-T2-peer-chat-runtime-strip.md, @frontend/components/consilium/ConsiliumHub.tsx
```
