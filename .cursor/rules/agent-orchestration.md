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

## Shared Context Management

- Use `.cursor/shared-context.md` for persistent state between chats.
- Use `.cursor/agent-status.md` for long-running tasks.
