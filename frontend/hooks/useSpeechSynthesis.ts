// [claude-code 2026-04-24] Browser-native TTS via Web Speech API for voice assistant responses.
// Handles text-to-speech with British female voice preference and fallback chain.
// Speech is cancelled when user interrupts or voice is disabled.

import { useCallback, useRef, useEffect } from "react";

interface UseSpeechSynthesisOptions {
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onSpeakError?: (error: Error) => void;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => Promise<void>;
  cancel: () => void;
  isSpeaking: () => boolean;
  isSupported: boolean;
}

export function useSpeechSynthesis({
  onSpeakStart,
  onSpeakEnd,
  onSpeakError,
}: UseSpeechSynthesisOptions = {}): UseSpeechSynthesisReturn {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);

  // Initialize synth once
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current =
        window.speechSynthesis ||
        (window as any).webkitSpeechSynthesis ||
        null;
    }
  }, []);

  const findBritishFemaleVoice = useCallback(
    (): SpeechSynthesisVoice | null => {
      const synth = synthRef.current;
      if (!synth) return null;

      const voices = synth.getVoices();
      if (voices.length === 0) return null;

      // Priority order: British English female > English female > any English > fallback
      const priorityPatterns = [
        { lang: "en-GB", gender: "female" },
        { lang: "en-GB", gender: "" }, // Any GB voice
        { lang: "en-US", gender: "female" },
        { lang: "en", gender: "female" },
        { lang: "en", gender: "" }, // Any English voice
      ];

      for (const pattern of priorityPatterns) {
        const match = voices.find(
          (v) =>
            v.lang.startsWith(pattern.lang) &&
            (pattern.gender === "" || v.name.toLowerCase().includes(pattern.gender)),
        );
        if (match) return match;
      }

      // Fallback to first available voice
      return voices.length > 0 ? voices[0] : null;
    },
    [],
  );

  const speak = useCallback(
    async (text: string): Promise<void> => {
      const synth = synthRef.current;
      if (!synth || !text.trim()) {
        return;
      }

      // Cancel any ongoing speech
      if (isSpeakingRef.current) {
        synth.cancel();
        isSpeakingRef.current = false;
      }

      return new Promise((resolve, reject) => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          const voice = findBritishFemaleVoice();

          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          } else {
            // Fallback: explicitly request en-GB if no voice found
            utterance.lang = "en-GB";
          }

          // TTS settings for clear, measured delivery
          utterance.rate = 1.0; // Normal speech rate
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utteranceRef.current = utterance;
          isSpeakingRef.current = true;

          utterance.onstart = () => {
            onSpeakStart?.();
          };

          utterance.onend = () => {
            isSpeakingRef.current = false;
            onSpeakEnd?.();
            resolve();
          };

          utterance.onerror = (event) => {
            isSpeakingRef.current = false;
            const error = new Error(
              `SpeechSynthesis error: ${event.error}`,
            );
            onSpeakError?.(error);
            reject(error);
          };

          synth.speak(utterance);
        } catch (error) {
          isSpeakingRef.current = false;
          const err = error instanceof Error ? error : new Error(String(error));
          onSpeakError?.(err);
          reject(err);
        }
      });
    },
    [findBritishFemaleVoice, onSpeakStart, onSpeakEnd, onSpeakError],
  );

  const cancel = useCallback((): void => {
    const synth = synthRef.current;
    if (synth) {
      synth.cancel();
      isSpeakingRef.current = false;
    }
  }, []);

  const isSpeaking = useCallback((): boolean => {
    return isSpeakingRef.current;
  }, []);

  const isSupported =
    typeof window !== "undefined" &&
    (!!window.speechSynthesis || !!(window as any).webkitSpeechSynthesis);

  return { speak, cancel, isSpeaking, isSupported };
}
