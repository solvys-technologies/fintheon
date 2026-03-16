// [claude-code 2026-03-15] Track 1: Voice skill router — detects skill intents + due diligence from transcripts
import { handleHermesChat } from './hermes-handler.js';
import type { HermesMessage } from './hermes-handler.js';

// ─── Skill Definitions ──────────────────────────────────────────────────────────

export type VoiceSkillTag =
  | 'brief'
  | 'validate'
  | 'report'
  | 'track'
  | 'psych_assist'
  | 'quick_pulse';

interface SkillDefinition {
  tag: VoiceSkillTag;
  keywords: string[];
  description: string;
}

const SKILL_DEFINITIONS: SkillDefinition[] = [
  { tag: 'brief',        keywords: ['brief', 'search', 'news', 'summarize', 'web'],                  description: 'Morning brief / news search' },
  { tag: 'validate',     keywords: ['validate', 'risk', 'check', 'verify'],                          description: 'Trade validation & risk check' },
  { tag: 'report',       keywords: ['report', 'dashboard'],                                          description: 'Generate report / dashboard' },
  { tag: 'track',        keywords: ['track', 'narrative', 'thread', 'thesis'],                        description: 'Narrative tracking & thesis' },
  { tag: 'psych_assist', keywords: ['psych', 'mental', 'tilt', 'emotion', 'performance'],             description: 'Psychological assistance' },
  { tag: 'quick_pulse',  keywords: ['chart', 'screenshot', 'snap'],                                  description: 'Quick chart / screenshot pulse' },
];

// ─── Due Diligence Patterns ──────────────────────────────────────────────────────

const DUE_DILIGENCE_PATTERNS = [
  /\bdue\s+diligence\b/i,
  /\bthink\s+harder\b/i,
  /\bdeep\s+dive\b/i,
  /\bdig\s+deeper\b/i,
];

// ─── Detection Functions ─────────────────────────────────────────────────────────

/**
 * Scan transcript for skill keywords. Returns the first matching skill tag or null.
 */
export function detectSkillFromTranscript(transcript: string): VoiceSkillTag | null {
  const lower = transcript.toLowerCase();
  for (const skill of SKILL_DEFINITIONS) {
    for (const kw of skill.keywords) {
      if (lower.includes(kw)) {
        return skill.tag;
      }
    }
  }
  return null;
}

/**
 * Returns true if the transcript contains due-diligence / think-harder patterns.
 */
export function detectDueDiligence(transcript: string): boolean {
  return DUE_DILIGENCE_PATTERNS.some((p) => p.test(transcript));
}

// ─── Skill Execution ─────────────────────────────────────────────────────────────

interface ExecuteVoiceSkillOpts {
  transcript: string;
  skillTag: VoiceSkillTag;
  thinkHarder: boolean;
  conversationId?: string;
  history?: HermesMessage[];
}

/**
 * Route a voice transcript through Hermes with skill-aware system prompt augmentation.
 */
export async function executeVoiceSkill(opts: ExecuteVoiceSkillOpts) {
  const { transcript, skillTag, thinkHarder, conversationId, history } = opts;

  const skillMeta = SKILL_DEFINITIONS.find((s) => s.tag === skillTag);
  const skillLabel = skillMeta ? skillMeta.description : skillTag;

  // Prefix the message with a skill hint so the agent can tailor its response
  const augmentedMessage = `[Voice Skill: ${skillLabel}] ${transcript}`;

  console.log(
    `[VoiceSkillRouter] Routing skill=${skillTag} thinkHarder=${thinkHarder} transcript="${transcript.slice(0, 60)}..."`
  );

  const response = await handleHermesChat({
    message: augmentedMessage,
    conversationId,
    history,
    agentOverride: skillTag === 'psych_assist' ? 'harper-cao' : undefined,
    thinkHarder,
  });

  return {
    ...response,
    skillTag,
    thinkHarder,
  };
}

/**
 * Convenience: detect skill + due diligence in one pass.
 */
export function analyzeTranscript(transcript: string) {
  return {
    skillTag: detectSkillFromTranscript(transcript),
    thinkHarder: detectDueDiligence(transcript),
  };
}
