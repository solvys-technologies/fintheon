export type FintheonAgentId = string;

/**
 * Map Fintheon UI agents to Hermes agent roles.
 * We keep this intentionally string-based to avoid importing backend types.
 */
export function toHermesAgentOverride(
  fintheonAgentId: FintheonAgentId | undefined | null,
): string | undefined {
  if (!fintheonAgentId) return undefined;

  // [claude-code 2026-03-16] Agent roster v7.9: 5-agent mapping
  switch (fintheonAgentId) {
    case "harper":
      return "harper-cao";
    case "oracle":
      return "pma-merged";
    case "feucht":
      return "futures-desk";
    case "consul":
      return "fundamentals-desk";
    case "herald":
      return "herald";
    default:
      return undefined;
  }
}

export function hermesConversationStorageKey(
  fintheonAgentId: FintheonAgentId | undefined | null,
  surfaceId?: string,
): string {
  const agent = fintheonAgentId ?? "default";

  return surfaceId
    ? `fintheon:hermes-conversation:${surfaceId}:${agent}`
    : `fintheon:hermes-conversation:${agent}`;
}
