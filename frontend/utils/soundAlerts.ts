export type AlertType = 'info' | 'warning' | 'success' | 'error' | 'tilt';

const alertFrequencies: Record<AlertType, number[]> = {
  info: [440, 550],
  warning: [600, 500, 600],
  success: [523, 659, 784],
  error: [400, 300, 250],
  tilt: [800, 600, 800, 600],
};

export function playAlertSound(type: AlertType, enabled: boolean = true): void {
  if (!enabled) return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const frequencies = alertFrequencies[type];
    let startTime = audioContext.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);

      startTime += 0.25;
    });
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
}

/**
 * Play iOS-style ping sound for news alerts
 */
export function playIOSPing(enabled: boolean = true): void {
  if (!enabled) return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;

    // iOS ping is a short, high-pitched tone (around 800Hz) with quick decay
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 800;

    // Quick attack and decay (like iOS notification sound)
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.error('Failed to play iOS ping:', error);
  }
}
