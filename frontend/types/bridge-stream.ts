// [claude-code 2026-04-26] S45.5/F7: stability review. The chat stream wire
// format lives in backend-hono/src/services/strands/stream-adapter.ts as
// `UIEvent` (uses `type:` discriminator). This file is the *frontend-side*
// activity-rail accumulator contract (uses `kind:` discriminator) — distinct
// shape, distinct purpose. assistant-ui/react owns the SSE parse on the wire
// side, so there is no manual `schema.parse()` to wrap with safeParse here;
// the v5.29.2 / v5.29.4 hotfixes settled the nesting of `data:` payloads in
// stream-adapter and the contract has held since. If a future surface needs
// runtime validation of UIEvent, mirror the type into a Zod schema and import
// it on both sides from a shared lib/contracts/ module.
// [claude-code 2026-04-25] S42-T3: BridgeStreamEvent type stubs.
// T1 extends these with payload shapes; this file defines the contract the
// AgentActivityRail consumes today. When T1 lands, extend the discriminated
// union here — consumers degrade gracefully when fields are absent.

export type ToolCallStatus = "pending" | "running" | "complete" | "error";

export interface ToolCallEvent {
  kind: "tool_call";
  id: string;
  name: string;
  status: ToolCallStatus;
  /** 0..1 progress for the segmented status pill. */
  progress?: number;
  /** Optional human-readable detail line (e.g. SQL fragment, URL). */
  detail?: string;
  /** Wall-clock when the call started. */
  startedAt?: string;
  /** Wall-clock when the call completed (any status that isn't pending/running). */
  completedAt?: string;
}

export interface CitationEvent {
  kind: "citation";
  /** Numeric id matching `[N]` markers in the assistant text. */
  id: number;
  /** Human label for the source (e.g. "Bloomberg", "10-K, page 14"). */
  source: string;
  /** Optional URL the chip should resolve to in the artifact pane. */
  url?: string;
  /** Optional excerpt / quoted span. */
  excerpt?: string;
}

export interface ThinkingEvent {
  kind: "thinking";
  id: string;
  /** First-line summary of the thought (always shown). */
  summary: string;
  /** Full thought body (revealed on expand). */
  body?: string;
  /** When the thought was emitted. */
  at?: string;
}

export interface CompleteEvent {
  kind: "complete";
  agent?: string;
  /** ISO timestamp the assistant turn finished. */
  generatedAt?: string;
  /** End-to-end latency in milliseconds. */
  latencyMs?: number;
  /** Distinct citation count surfaced for this turn. */
  sourceCount?: number;
  /** Optional model identifier (e.g. "claude-opus-4-7"). */
  model?: string;
}

export type BridgeStreamEvent =
  | ToolCallEvent
  | CitationEvent
  | ThinkingEvent
  | CompleteEvent;

export interface MessageActivity {
  toolCalls: ToolCallEvent[];
  citations: CitationEvent[];
  thoughts: ThinkingEvent[];
  complete?: CompleteEvent;
}

export const emptyMessageActivity = (): MessageActivity => ({
  toolCalls: [],
  citations: [],
  thoughts: [],
});

/** Fold a single bridge event into a message-activity accumulator. */
export function reduceBridgeEvent(
  acc: MessageActivity,
  event: BridgeStreamEvent,
): MessageActivity {
  switch (event.kind) {
    case "tool_call": {
      const idx = acc.toolCalls.findIndex((t) => t.id === event.id);
      const next = [...acc.toolCalls];
      if (idx >= 0) next[idx] = { ...next[idx], ...event };
      else next.push(event);
      return { ...acc, toolCalls: next };
    }
    case "citation": {
      if (acc.citations.some((c) => c.id === event.id)) return acc;
      return { ...acc, citations: [...acc.citations, event] };
    }
    case "thinking": {
      const idx = acc.thoughts.findIndex((t) => t.id === event.id);
      const next = [...acc.thoughts];
      if (idx >= 0) next[idx] = { ...next[idx], ...event };
      else next.push(event);
      return { ...acc, thoughts: next };
    }
    case "complete":
      return { ...acc, complete: event };
  }
}
