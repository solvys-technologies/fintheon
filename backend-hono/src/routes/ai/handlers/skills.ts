// [claude-code 2026-03-10] Skills endpoint — replaces frontend's hardcoded skillPrefixes.ts
import type { Context } from 'hono'
import { getFeatureFlags } from '../../../config/feature-flags.js'

interface SkillDefinition {
  id: string
  label: string
  description: string
  enabled: boolean
  reason?: string
}

const SKILL_CATALOG: Omit<SkillDefinition, 'enabled' | 'reason'>[] = [
  { id: 'brief', label: 'Brief', description: 'Search the web for instrument info, summarize findings, interpret for your thesis.' },
  { id: 'validate', label: 'Validate', description: 'Risk validation — analyze thesis against narratives, memos, news, and regimes.' },
  { id: 'report', label: 'Report', description: 'Generate an HTML dashboard report with Solvys Gold styling.' },
  { id: 'track', label: 'Track', description: 'Build a new narrative thread with thesis, instruments, catalysts, and timeline.' },
  { id: 'psych_assist', label: 'Psych Assist', description: 'Psychological/performance analysis — behavior patterns, emotional state, coaching.' },
  { id: 'maintenance', label: 'Maintenance', description: 'App maintenance — review changes, update changelog, report status.' },
  { id: 'quick_pulse', label: 'QuickPulse', description: 'Analyze chart/screenshot — bias, confidence, entries, stop, target.' },
  { id: 'narrative', label: 'Narrative', description: 'Analyze NarrativeFlow board — active narratives, catalysts, stale theses.' },
]

/**
 * GET /api/ai/skills
 * Returns skill list with enabled/disabled state from feature flags
 */
export async function handleGetSkills(c: Context) {
  const flags = getFeatureFlags()

  const skills: SkillDefinition[] = SKILL_CATALOG.map(skill => {
    const flag = flags[skill.id]
    return {
      ...skill,
      enabled: flag ? flag.enabled : true,
      reason: flag && !flag.enabled ? flag.reason : undefined,
    }
  })

  return c.json({ skills })
}
