export function cleanArbitrumDigestText(text: string): string {
  return text
    .replace(
      /^\s*\*\*Chamber reads\s+\d+(?:\.\d+)?%\*\*\s+on:\s+[^\n]*(?:\n|$)/gim,
      "",
    )
    .replace(
      /^[-*]\s+\*\*[^*]+\*\*[^:\n]*:\s+.*unavailable this round.*(?:\n|$)/gim,
      "",
    )
    .replace(/^[-*]\s+model-unavailable\s*$/gim, "")
    .replace(
      /\s*,?\s*conf\s+\d+(?:\.\d+)?%?(?:\s*(?:\/|out of)\s*\d+(?:\.\d+)?%?)?/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function isArbitrumDigestDegraded(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("chamber unavailable") ||
    normalized.includes("chamber produced no seat reads")
  );
}
