// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Tolerant JSON parser for streamed slot fenced blocks. While Harper is still
// emitting the closing brace, `code` is partial — we return `pending` so the
// slot renders a skeleton instead of crashing.

export type SlotParseResult<T> =
  | { status: "ok"; data: T }
  | { status: "pending" }
  | { status: "error"; reason: string };

export function parseSlotBody<T = unknown>(
  raw: string,
  isIncomplete: boolean,
): SlotParseResult<T> {
  const trimmed = raw.trim();
  if (!trimmed) return { status: "pending" };

  try {
    return { status: "ok", data: JSON.parse(trimmed) as T };
  } catch {
    if (isIncomplete) return { status: "pending" };
    return { status: "error", reason: "Invalid JSON" };
  }
}
