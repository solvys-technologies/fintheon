const UNUSABLE_BRIEF_PATTERNS = [
  /^api call failed/i,
  /^error:/i,
  /^failed to/i,
  /\binsufficient balance\b/i,
  /\bhttp\s*402\b/i,
  /\bai chain exhausted\b/i,
  /\bproviders? unreachable\b/i,
];

export function isUsableBriefContent(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) return false;
  return !UNUSABLE_BRIEF_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function assertUsableBriefContent(content: string, briefType: string) {
  if (isUsableBriefContent(content)) return;
  throw new Error(`${briefType} generation returned unusable content`);
}
