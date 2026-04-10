// [claude-code 2026-04-05] Strands → cognition-emitter telemetry bridge
// Subscribes to Strands agent hooks and maps events to CognitionStepKind
// so the frontend cognition SSE stream works unchanged.
import {
  type Agent,
  BeforeInvocationEvent,
  AfterInvocationEvent,
  BeforeModelCallEvent,
  AfterModelCallEvent,
  BeforeToolCallEvent,
  AfterToolCallEvent,
} from "@strands-agents/sdk";
import { emitStep, emitEnd } from "../cognition-emitter.js";

/**
 * Instrument a Strands agent so its lifecycle events are emitted
 * as cognition steps for a given requestId.
 *
 * Call this after creating the agent but before invoking it.
 * Returns a cleanup function that removes all hooks.
 */
export function withCognition(agent: Agent, requestId: string): () => void {
  const startTime = Date.now();
  let lastStep = startTime;

  function elapsed(): number {
    const now = Date.now();
    const dur = now - lastStep;
    lastStep = now;
    return dur;
  }

  const cleanups: Array<() => void> = [];

  // Agent invocation start → agent-route
  cleanups.push(
    agent.addHook(BeforeInvocationEvent, () => {
      emitStep(requestId, {
        kind: "agent-route",
        label: `Agent: ${agent.name}`,
        detail: agent.description,
        durationMs: elapsed(),
      });
    }),
  );

  // Model call start → gateway-call
  cleanups.push(
    agent.addHook(BeforeModelCallEvent, () => {
      emitStep(requestId, {
        kind: "gateway-call",
        label: "Model inference",
        durationMs: elapsed(),
      });
    }),
  );

  // Model call end → response-ready
  cleanups.push(
    agent.addHook(AfterModelCallEvent, (ev) => {
      const detail = ev.error ? `Error: ${ev.error.message}` : undefined;
      emitStep(requestId, {
        kind: ev.error ? "error" : "response-ready",
        label: ev.error ? "Model error" : "Model response",
        detail,
        durationMs: elapsed(),
      });
    }),
  );

  // Tool call start → tool-dispatch
  cleanups.push(
    agent.addHook(BeforeToolCallEvent, (ev) => {
      emitStep(requestId, {
        kind: "tool-dispatch",
        label: `Tool: ${ev.toolUse.name}`,
        detail: JSON.stringify(ev.toolUse.input).slice(0, 200),
        durationMs: elapsed(),
      });
    }),
  );

  // Tool call end → tool-dispatch (with result)
  cleanups.push(
    agent.addHook(AfterToolCallEvent, (ev) => {
      const detail = ev.error ? `Error: ${ev.error.message}` : "completed";
      emitStep(requestId, {
        kind: ev.error ? "error" : "tool-dispatch",
        label: `Tool done: ${ev.toolUse.name}`,
        detail,
        durationMs: elapsed(),
      });
    }),
  );

  // Agent invocation end → emitEnd
  cleanups.push(
    agent.addHook(AfterInvocationEvent, () => {
      emitEnd(requestId, Date.now() - startTime);
    }),
  );

  return () => cleanups.forEach((fn) => fn());
}
