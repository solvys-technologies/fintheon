// [claude-code 2026-03-13] Hermes migration: renamed from openclawAgentRouting.ts
export type PulseAgentId = string;

/**
 * Map Fintheon UI agents to Hermes agent roles.
 * We keep this intentionally string-based to avoid importing backend types.
 */
export function toHermesAgentOverride(pulseAgentId: PulseAgentId | undefined | null): string | undefined {
  if (!pulseAgentId) return undefined;

  switch (pulseAgentId) {
    case 'harper':
      return 'harper-cao';
    case 'oracle':
      return 'pma-1';
    case 'charles':
      return 'pma-2';
    case 'feucht':
      return 'futures-desk';
    case 'sentinel':
      return 'fundamentals-desk';
    case 'horace':
      return 'harper-cao';
    default:
      return undefined;
  }
}

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation (no context bleed)
// [claude-code 2026-03-13] Hermes migration: localStorage keys migrated from pulse_openclaw_* to pulse_hermes_*
export function hermesConversationStorageKey(
  pulseAgentId: PulseAgentId | undefined | null,
  surfaceId?: string,
): string {
  const agent = pulseAgentId ?? 'default';

  // Backward compat: migrate old openclaw keys to hermes keys
  const oldKey = surfaceId
    ? `pulse_openclaw_conversation:${surfaceId}:${agent}`
    : `pulse_openclaw_conversation:${agent}`;
  const newKey = surfaceId
    ? `pulse_hermes_conversation:${surfaceId}:${agent}`
    : `pulse_hermes_conversation:${agent}`;

  try {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldValue);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // ignore storage errors
  }

  return newKey;
}
