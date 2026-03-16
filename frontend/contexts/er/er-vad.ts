// [claude-code 2026-03-15] Track 2: PsychAssist hardening — VAD/Whisper/mic logic extracted as useERVad() hook
import { useState, useRef, useCallback } from 'react';
import type { SentimentResult } from './er-types';
import {
  VAD_ENERGY_THRESHOLD,
  VAD_SILENCE_DURATION_MS,
  VAD_MIN_SPEECH_MS,
  VAD_CHECK_INTERVAL_MS,
  SENTIMENT_COOLDOWN_MS,
} from './er-types';

interface UseERVadDeps {
  backend: any;
  erScoreRef: React.MutableRefObject<number>;
  updateScore: (delta: number) => void;
  addInfraction: (keywords: string[]) => void;
}

export function useERVad({ backend, erScoreRef, updateScore, addInfraction }: UseERVadDeps) {
  const [vadActive, setVadActive] = useState(false);
  const [lastSentiment, setLastSentiment] = useState<SentimentResult | null>(null);

  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isSpeakingRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastSentimentRequestRef = useRef<number>(0);

  const startVAD = useCallback((analyserNode: AnalyserNode, stream: MediaStream) => {
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    const startRecording = () => {
      if (mediaRecorderRef.current?.state === 'recording') return;
      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } catch {
        try {
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          recorder.start(250);
          mediaRecorderRef.current = recorder;
        } catch {
          console.debug('[VAD] MediaRecorder not available');
        }
      }
    };

    const stopRecordingAndAnalyze = async () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') return;

      return new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          const chunks = recordedChunksRef.current;
          recordedChunksRef.current = [];
          mediaRecorderRef.current = null;

          if (chunks.length === 0) { resolve(); return; }

          const now = Date.now();
          if (now - lastSentimentRequestRef.current < SENTIMENT_COOLDOWN_MS) {
            resolve();
            return;
          }
          lastSentimentRequestRef.current = now;

          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              if (!base64) { resolve(); return; }

              try {
                const result = await backend.voice.analyzeSentiment({
                  audioBase64: base64,
                  mimeType: recorder.mimeType || 'audio/webm',
                  context: `Current ER score: ${erScoreRef.current.toFixed(1)}, monitoring active`,
                });

                setLastSentiment(result);

                if (result.sentiment < -0.3 && result.confidence > 0.4) {
                  const penalty = Math.abs(result.sentiment) * result.confidence;
                  updateScore(-penalty);
                  if (result.keywords.length > 0) {
                    addInfraction(result.keywords);
                  }
                } else if (result.sentiment > 0.3 && result.confidence > 0.5) {
                  updateScore(result.sentiment * 0.2);
                }
              } catch (err) {
                console.debug('[VAD] Sentiment analysis failed:', err);
              }
              resolve();
            };
            reader.readAsDataURL(blob);
          } catch {
            resolve();
          }
        };
        recorder.stop();
      });
    };

    vadIntervalRef.current = setInterval(() => {
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = dataArray[i] / 255;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const now = Date.now();

      if (rms >= VAD_ENERGY_THRESHOLD) {
        silenceStartRef.current = null;
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          speechStartRef.current = now;
          setVadActive(true);
          startRecording();
        }
      } else {
        if (isSpeakingRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current >= VAD_SILENCE_DURATION_MS) {
            isSpeakingRef.current = false;
            setVadActive(false);
            const speechDuration = speechStartRef.current ? now - speechStartRef.current : 0;
            speechStartRef.current = null;
            silenceStartRef.current = null;

            if (speechDuration >= VAD_MIN_SPEECH_MS) {
              stopRecordingAndAnalyze();
            } else {
              if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];
              }
            }
          }
        }
      }
    }, VAD_CHECK_INTERVAL_MS);
  }, [backend, updateScore, addInfraction, erScoreRef]);

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    isSpeakingRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;
    setVadActive(false);
  }, []);

  const resetSentimentTimestamp = useCallback(() => {
    lastSentimentRequestRef.current = 0;
  }, []);

  return {
    vadActive,
    lastSentiment,
    setLastSentiment,
    startVAD,
    stopVAD,
    resetSentimentTimestamp,
  };
}
