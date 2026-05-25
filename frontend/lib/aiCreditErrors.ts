export const AI_CREDITS_EXHAUSTED = "ai_credits_exhausted";

export function isAiCreditsExhausted(input: unknown): boolean {
  const message = extractMessage(input).toLowerCase();
  return (
    /\b402\b/.test(message) ||
    message.includes("insufficient balance") ||
    message.includes("insufficient credits") ||
    message.includes("out of credits") ||
    message.includes("quota exhausted") ||
    message.includes("payment required") ||
    message.includes("billing")
  );
}

export function extractAiErrorMessage(input: unknown): string {
  return extractMessage(input).slice(0, 240);
}

function extractMessage(input: unknown): string {
  if (input instanceof Error) return input.message;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
