export type AiProviderIssueCode = "ai_credits_exhausted" | "ai_auth_failed";

export interface AiProviderIssue {
  code: AiProviderIssueCode;
  provider: string;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
}

let latestIssue: AiProviderIssue | null = null;

export function isAiCreditError(err: unknown): boolean {
  const message = extractErrorMessage(err).toLowerCase();
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

export function isAiAuthError(err: unknown): boolean {
  const message = extractErrorMessage(err).toLowerCase();
  return /\b401\b/.test(message) || message.includes("invalid api key");
}

export function recordAiProviderFailure(
  provider: string,
  err: unknown,
): AiProviderIssue | null {
  const code = isAiCreditError(err)
    ? "ai_credits_exhausted"
    : isAiAuthError(err)
      ? "ai_auth_failed"
      : null;
  if (!code) return null;

  const now = new Date().toISOString();
  const message = extractErrorMessage(err).slice(0, 240);
  if (latestIssue?.code === code && latestIssue.provider === provider) {
    latestIssue = {
      ...latestIssue,
      message,
      lastSeenAt: now,
      occurrences: latestIssue.occurrences + 1,
    };
    return latestIssue;
  }

  latestIssue = {
    code,
    provider,
    message,
    firstSeenAt: now,
    lastSeenAt: now,
    occurrences: 1,
  };
  return latestIssue;
}

export function getRecentAiProviderIssue(
  maxAgeMs = 10 * 60_000,
): AiProviderIssue | null {
  if (!latestIssue) return null;
  const age = Date.now() - new Date(latestIssue.lastSeenAt).getTime();
  if (!Number.isFinite(age) || age > maxAgeMs) return null;
  return latestIssue;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause ? ` ${extractErrorMessage(err.cause)}` : "";
    return `${err.message}${cause}`;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
