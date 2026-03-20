// [claude-code 2026-03-09] Added 'error' to VoiceRuntimeState/VoiceOrbState, added error orb color, added MicPermissionState
export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'infraction' | 'error';

export type VoiceRuntimeState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type MicPermissionState = 'granted' | 'denied' | 'prompt';

export const VOICE_ORB_COLORS = {
  idle: 'var(--fintheon-accent)',
  listening: '#22c55e',
  thinking: 'var(--fintheon-accent)',
  speaking: '#d4c9a8',
  infraction: '#ef4444',
  error: '#ef4444',
} as const;

export function resolveVoiceOrbState(runtimeState: VoiceRuntimeState, hasRecentInfraction: boolean): VoiceOrbState {
  if (hasRecentInfraction) return 'infraction';
  if (runtimeState === 'error') return 'error';
  if (runtimeState === 'thinking') return 'thinking';
  if (runtimeState === 'speaking') return 'speaking';
  if (runtimeState === 'listening') return 'listening';
  return 'idle';
}

export function getVoiceOrbColor(state: VoiceOrbState): string {
  return VOICE_ORB_COLORS[state];
}
