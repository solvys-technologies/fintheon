// [claude-code 2026-03-14] Pompa Mode utility — sound playback, themed messages

type SoundName = 'glass-clink' | 'coin-clink' | 'bell-toll' | 'colosseum-cheers' | 'roman-march';

const STORAGE_KEY = 'fintheon:pompa-mode';

export function isPompaEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setPompaEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {}
}

export function playSound(name: SoundName): void {
  if (!isPompaEnabled()) return;
  try {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {}
}

export function getPompaEmptyState(): string {
  return isPompaEnabled() ? 'The arena is empty.' : 'No data available.';
}

export function getPompaSuccessMessage(): string {
  return isPompaEnabled() ? 'It is decreed.' : 'Success.';
}

export function getPompaErrorMessage(): string {
  return isPompaEnabled() ? "The road is blocked. There's been an error." : 'An error occurred.';
}
