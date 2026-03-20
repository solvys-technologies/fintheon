// [claude-code 2026-03-09] Feature flags for skill permissions
// Load from FINTHEON_FEATURE_FLAGS env (JSON) or default (all enabled)

export interface FeatureFlag {
  enabled: boolean
  reason?: string
}

export type FeatureFlags = Record<string, FeatureFlag>

const DEFAULT_FLAGS: FeatureFlags = {
  brief: { enabled: true },
  validate: { enabled: true },
  report: { enabled: true },
  track: { enabled: true },
  psych_assist: { enabled: true },
  maintenance: { enabled: true },
  quick_fintheon: { enabled: true },
  mirofish: { enabled: true },
}

let cachedFlags: FeatureFlags | null = null

export function getFeatureFlags(): FeatureFlags {
  if (cachedFlags) return cachedFlags

  const envFlags = process.env.FINTHEON_FEATURE_FLAGS
  if (envFlags) {
    try {
      const parsed = JSON.parse(envFlags) as FeatureFlags
      cachedFlags = { ...DEFAULT_FLAGS, ...parsed }
    } catch (err) {
      console.error('[FeatureFlags] Failed to parse FINTHEON_FEATURE_FLAGS:', err)
      cachedFlags = DEFAULT_FLAGS
    }
  } else {
    cachedFlags = DEFAULT_FLAGS
  }

  return cachedFlags
}

export function isSkillEnabled(skillId: string): boolean {
  const flags = getFeatureFlags()
  const flag = flags[skillId]
  return flag ? flag.enabled : true
}

export function getSkillDisabledReason(skillId: string): string | undefined {
  const flags = getFeatureFlags()
  const flag = flags[skillId]
  return flag && !flag.enabled ? flag.reason : undefined
}

// Detect skill prefix in message text
const SKILL_PREFIX_PATTERN = /\[SKILL:(\w+)\]/i

export function extractSkillFromMessage(message: string): string | null {
  const match = message.match(SKILL_PREFIX_PATTERN)
  if (!match) return null
  const raw = match[1].toLowerCase()
  // Map skill prefix names to skill IDs
  const map: Record<string, string> = {
    brief: 'brief',
    validate: 'validate',
    report: 'report',
    track: 'track',
    psych: 'psych_assist',
    maintenance: 'maintenance',
    quickfintheon: 'quick_fintheon',
    narrative: 'narrative',
    mirofish: 'mirofish',
  }
  return map[raw] ?? null
}
