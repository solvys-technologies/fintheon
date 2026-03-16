// [claude-code 2026-03-15] Track 2: PsychAssist hardening — barrel re-export preserving all import paths
// Implementation split into frontend/contexts/er/{er-types.ts, er-vad.ts, ERProvider.tsx}

export type { ERState, InterventionLevel, ERSnapshot, OvertradingStatus, SentimentResult, ERContextValue } from './er/er-types';
export { AGGRESSIVE_KEYWORDS, computeInterventionLevel } from './er/er-types';
export { ERProvider, useER, useERSafe } from './er/ERProvider';
