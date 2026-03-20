/**
 * Healing Bowl Sound System with Reverb
 * Plays calming sounds when tilt infractions are detected
 */

export type HealingBowlSound =
  | "calm-1"
  | "calm-2"
  | "calm-3"
  | "shock-1"
  | "shock-2";

export interface HealingBowlSoundOption {
  id: HealingBowlSound;
  name: string;
  type: "calm" | "shock";
  description: string;
}

export const HEALING_BOWL_SOUNDS: HealingBowlSoundOption[] = [
  {
    id: "calm-1",
    name: "Tibetan Bowl (Deep)",
    type: "calm",
    description: "Low-frequency singing bowl with long sustain",
  },
  {
    id: "calm-2",
    name: "Crystal Bowl (Pure)",
    type: "calm",
    description: "Clear crystal bowl with pure tone",
  },
  {
    id: "calm-3",
    name: "Rain Stick (Flowing)",
    type: "calm",
    description: "Gentle rain stick for deep relaxation",
  },
  {
    id: "shock-1",
    name: "Gong Strike (Wake)",
    type: "shock",
    description: "Sharp gong strike to break patterns",
  },
  {
    id: "shock-2",
    name: "Bell Chime (Alert)",
    type: "shock",
    description: "High-frequency bell for immediate attention",
  },
];

export class HealingBowlPlayer {
  private audioContext: AudioContext | null = null;
  private reverbNode: ConvolverNode | null = null;
  private currentSound: HealingBowlSound = "calm-1";

  constructor() {
    if (typeof window !== "undefined" && "AudioContext" in window) {
      this.audioContext = new AudioContext();
      this.initializeReverb();
    }
  }

  /**
   * Initialize reverb effect using convolution
   * Creates a realistic reverb tail for relaxing atmosphere
   */
  private async initializeReverb() {
    if (!this.audioContext) return;

    try {
      this.reverbNode = this.audioContext.createConvolver();

      // Create impulse response for reverb (simulates a large space)
      const reverbTime = 3.0; // 3 seconds of reverb tail
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * reverbTime;
      const impulse = this.audioContext.createBuffer(
        2,
        length,
        sampleRate
      );

      // Fill impulse response with decaying noise
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          // Exponential decay for natural reverb
          const decay = Math.exp(-i / (sampleRate * 0.8));
          channelData[i] = (Math.random() * 2 - 1) * decay;
        }
      }

      this.reverbNode.buffer = impulse;
    } catch (error) {
      console.error("Failed to initialize reverb:", error);
    }
  }

  /**
   * Set the current healing bowl sound
   */
  setSound(sound: HealingBowlSound) {
    this.currentSound = sound;
  }

  /**
   * Get current sound setting
   */
  getSound(): HealingBowlSound {
    return this.currentSound;
  }

  /**
   * Play the healing bowl sound with reverb
   */
  async play(soundId?: HealingBowlSound) {
    const sound = soundId || this.currentSound;

    if (!this.audioContext || !this.reverbNode) {
      console.warn("Audio context not available");
      return;
    }

    try {
      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Generate healing bowl tone based on sound type
      const soundOption = HEALING_BOWL_SOUNDS.find((s) => s.id === sound);
      if (!soundOption) return;

      if (soundOption.type === "calm") {
        await this.playCalmTone(sound);
      } else {
        await this.playShockTone(sound);
      }
    } catch (error) {
      console.error("Failed to play healing bowl sound:", error);
    }
  }

  /**
   * Play calm healing bowl tones
   */
  private async playCalmTone(sound: HealingBowlSound) {
    if (!this.audioContext || !this.reverbNode) return;

    const now = this.audioContext.currentTime;

    // Different frequencies for each calm sound
    const frequencies = {
      "calm-1": [110, 220, 330], // Deep A2
      "calm-2": [261.63, 523.25, 784.88], // Crystal C4
      "calm-3": [174.61, 349.23, 523.85], // Rain F3
    };

    const freqs = frequencies[sound as keyof typeof frequencies];
    const duration = 4.0; // 4 seconds

    // Create oscillators for each harmonic
    freqs.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      // Sine wave for pure tones
      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      // Volume envelope (attack-sustain-release)
      const volume = 0.2 / (index + 1); // Harmonics get quieter
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.1); // Attack
      gainNode.gain.setValueAtTime(volume, now + 3.0); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release

      // Connect through reverb
      oscillator.connect(gainNode);
      gainNode.connect(this.reverbNode!);
      this.reverbNode!.connect(this.audioContext!.destination);

      // Also connect dry signal (50% wet/dry mix)
      gainNode.connect(this.audioContext!.destination);

      oscillator.start(now);
      oscillator.stop(now + duration);
    });
  }

  /**
   * Play shocking wake-up tones
   */
  private async playShockTone(sound: HealingBowlSound) {
    if (!this.audioContext || !this.reverbNode) return;

    const now = this.audioContext.currentTime;

    // Different characteristics for shock sounds
    const config = {
      "shock-1": {
        // Gong - low frequency sweep
        startFreq: 80,
        endFreq: 120,
        duration: 2.0,
        type: "triangle" as OscillatorType,
      },
      "shock-2": {
        // Bell - high frequency with decay
        startFreq: 1200,
        endFreq: 1000,
        duration: 1.5,
        type: "sine" as OscillatorType,
      },
    };

    const soundConfig = config[sound as keyof typeof config];
    if (!soundConfig) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = soundConfig.type;
    oscillator.frequency.setValueAtTime(soundConfig.startFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      soundConfig.endFreq,
      now + soundConfig.duration
    );

    // Sharp attack, quick decay
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.01); // Very fast attack
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      now + soundConfig.duration
    );

    // Connect through reverb (more wet for shock sounds)
    oscillator.connect(gainNode);
    gainNode.connect(this.reverbNode!);
    this.reverbNode!.connect(this.audioContext!.destination);

    oscillator.start(now);
    oscillator.stop(now + soundConfig.duration);
  }

  /**
   * Preview a sound (for settings)
   */
  async preview(sound: HealingBowlSound) {
    await this.play(sound);
  }
}

// Singleton instance
export const healingBowlPlayer = new HealingBowlPlayer();
