// [claude-code 2026-03-11] Track 7B: Upgraded ER context — VAD trigger, Whisper-on-demand (no browser Speech API), escalating interventions
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useBackend } from '../lib/backend';

export type ERState = 'steadfast' | 'poised' | 'tilted';

// Escalating intervention levels
export type InterventionLevel = 'none' | 'visual' | 'voice' | 'lockout';

interface ERSnapshot {
  score: number;
  state: ERState;
  timestamp: Date;
  audioLevels?: { avg: number; peak: number };
  keywords?: string[];
}

interface OvertradingStatus {
  isOvertrading: boolean;
  tradesInWindow: number;
  warning?: string;
}

interface SentimentResult {
  sentiment: number;
  confidence: number;
  keywords: string[];
  tiltIndicators: string[];
  summary: string;
}

interface ERContextValue {
  // State
  isMonitoring: boolean;
  erScore: number;
  resonanceState: ERState;
  sessionId: number | null;
  overtradingStatus: OvertradingStatus | null;

  // Audio
  analyser: AnalyserNode | null;

  // Session metrics
  timeInTiltSeconds: number;
  infractionCount: number;
  maxTiltScore: number;
  sessionStartTime: number | null;
  recentInfraction: boolean;
  lastInfractionAt: number | null;

  // 7B: Intervention state
  interventionLevel: InterventionLevel;
  isLockedOut: boolean;
  lastSentiment: SentimentResult | null;
  vadActive: boolean;

  // Actions
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  updateScore: (delta: number) => void;
  addInfraction: (keywords: string[]) => void;
  clearRecentInfraction: () => void;
  dismissLockout: () => void;

  // Snapshots
  getRecentSnapshots: () => ERSnapshot[];
}

const ERContext = createContext<ERContextValue | null>(null);

export function useER() {
  const context = useContext(ERContext);
  if (!context) {
    throw new Error('useER must be used within an ERProvider');
  }
  return context;
}

// Safe hook that doesn't throw - returns null if not in provider
export function useERSafe() {
  return useContext(ERContext);
}

interface ERProviderProps {
  children: React.ReactNode;
}

// VAD config
const VAD_ENERGY_THRESHOLD = 0.08; // RMS energy threshold for speech detection
const VAD_SILENCE_DURATION_MS = 1500; // ms of silence before stopping recording
const VAD_MIN_SPEECH_MS = 500; // minimum speech duration to trigger Whisper
const VAD_CHECK_INTERVAL_MS = 100; // how often to check audio levels
const SENTIMENT_COOLDOWN_MS = 10_000; // don't send sentiment requests more than once per 10s

function computeInterventionLevel(score: number): InterventionLevel {
  if (score <= -5) return 'lockout';
  if (score <= -3) return 'voice';
  if (score <= -1) return 'visual';
  return 'none';
}

export function ERProvider({ children }: ERProviderProps) {
  const backend = useBackend();

  // Core state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [erScore, setErScore] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [overtradingStatus, setOvertradingStatus] = useState<OvertradingStatus | null>(null);
  const [recentInfraction, setRecentInfraction] = useState(false);
  const [lastInfractionAt, setLastInfractionAt] = useState<number | null>(null);

  // 7B: Intervention state
  const [interventionLevel, setInterventionLevel] = useState<InterventionLevel>('none');
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lastSentiment, setLastSentiment] = useState<SentimentResult | null>(null);
  const [vadActive, setVadActive] = useState(false);

  // Refs for non-reactive state
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const timeInTiltRef = useRef<number>(0);
  const infractionCountRef = useRef<number>(0);
  const maxTiltScoreRef = useRef<number>(0);
  const maxTiltTimeRef = useRef<Date | null>(null);
  const lastTiltStartRef = useRef<number | null>(null);
  const isInTiltRef = useRef<boolean>(false);
  const detectedKeywordsRef = useRef<string[]>([]);
  const snapshotsRef = useRef<ERSnapshot[]>([]);
  const infractionHoldTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // VAD refs
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isSpeakingRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastSentimentRequestRef = useRef<number>(0);
  const erScoreRef = useRef(0); // track score in ref for VAD callback

  // Voice intervention refs
  const lastVoiceInterventionRef = useRef<number>(0);
  const voiceInterventionCooldownMs = 60_000; // max once per minute

  // Intervals
  const scoreIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const overtradingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Regression tracking
  const regressionStartScoreRef = useRef<number>(0);
  const regressionStartTimeRef = useRef<number | null>(null);
  const regressionTargetTimeRef = useRef<number | null>(null);

  // Computed state
  const resonanceState: ERState = erScore > 0.5 ? 'steadfast' : erScore < -0.5 ? 'tilted' : 'poised';

  // Keep erScoreRef in sync
  useEffect(() => {
    erScoreRef.current = erScore;
  }, [erScore]);

  // Update intervention level when score changes
  useEffect(() => {
    const newLevel = computeInterventionLevel(erScore);
    setInterventionLevel(newLevel);

    if (newLevel === 'lockout' && !isLockedOut) {
      setIsLockedOut(true);
    }
  }, [erScore, isLockedOut]);

  // Voice intervention effect — trigger TTS when level reaches 'voice'
  useEffect(() => {
    if (!isMonitoring || interventionLevel !== 'voice') return;

    const now = Date.now();
    if (now - lastVoiceInterventionRef.current < voiceInterventionCooldownMs) return;
    lastVoiceInterventionRef.current = now;

    // Fire and forget — speak an intervention
    backend.voice.speak({
      text: `Your emotional resonance score has dropped to ${erScore.toFixed(1)}. I'm detecting signs of tilt. Take a breath. Step away from the screen for 60 seconds. Your edge is your discipline, not this next trade.`,
      mode: 'infraction',
      includeAudio: true,
      agent: 'harper-cao',
    }).then(res => {
      if (res.audioBase64) {
        try {
          const audioBytes = Uint8Array.from(atob(res.audioBase64), c => c.charCodeAt(0));
          const blob = new Blob([audioBytes], { type: res.audioMimeType || 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play().catch(() => {});
          audio.onended = () => URL.revokeObjectURL(url);
        } catch {
          // Audio playback failed silently
        }
      }
    }).catch(err => {
      console.debug('[ER] Voice intervention failed:', err);
    });
  }, [interventionLevel, isMonitoring, erScore, backend]);

  // Load persisted score on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const saved = localStorage.getItem('psychassist_current_score');
          if (saved) {
            const savedScore = parseFloat(saved);
            if (!isNaN(savedScore) && isFinite(savedScore)) {
              setErScore(savedScore);
            }
          }

          const savedSessionId = localStorage.getItem('psychassist_session_id');
          if (savedSessionId) {
            const parsed = parseInt(savedSessionId, 10);
            if (!isNaN(parsed)) {
              setSessionId(parsed);
            }
          }

          const savedSnapshots = localStorage.getItem('psychassist_snapshots');
          if (savedSnapshots) {
            try {
              snapshotsRef.current = JSON.parse(savedSnapshots);
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch {
        // localStorage not available
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Persist score changes
  const persistScore = useCallback((score: number) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('psychassist_current_score', score.toString());
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const updateScore = useCallback((delta: number) => {
    setErScore(prev => {
      const newScore = Math.max(-10, Math.min(10, prev + delta));
      persistScore(newScore);
      return newScore;
    });
  }, [persistScore]);

  const addInfraction = useCallback((keywords: string[]) => {
    detectedKeywordsRef.current.push(...keywords);
    detectedKeywordsRef.current = [...new Set(detectedKeywordsRef.current)];
    infractionCountRef.current += 1;
    const timestamp = Date.now();
    setLastInfractionAt(timestamp);
    setRecentInfraction(true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('psychassist:infraction', {
          detail: { timestamp, keywords },
        })
      );
    }

    if (infractionHoldTimeoutRef.current) {
      clearTimeout(infractionHoldTimeoutRef.current);
    }
    infractionHoldTimeoutRef.current = setTimeout(() => {
      setRecentInfraction(false);
    }, 8000);

    setErScore(prev => {
      const newScore = Math.max(-10, prev - 1.0);

      if (newScore < maxTiltScoreRef.current) {
        maxTiltScoreRef.current = newScore;
        maxTiltTimeRef.current = new Date();
      }

      if (newScore < -0.5 && !isInTiltRef.current) {
        isInTiltRef.current = true;
        lastTiltStartRef.current = Date.now();
        regressionStartTimeRef.current = null;
        regressionTargetTimeRef.current = null;
      }

      persistScore(newScore);
      return newScore;
    });
  }, [persistScore]);

  const clearRecentInfraction = useCallback(() => {
    setRecentInfraction(false);
  }, []);

  const dismissLockout = useCallback(() => {
    setIsLockedOut(false);
  }, []);

  // ---- VAD + Whisper-on-demand ----
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
        recorder.start(250); // collect chunks every 250ms
        mediaRecorderRef.current = recorder;
      } catch {
        // MediaRecorder not supported for this mime, try default
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

                // Apply sentiment to ER score
                if (result.sentiment < -0.3 && result.confidence > 0.4) {
                  const penalty = Math.abs(result.sentiment) * result.confidence;
                  updateScore(-penalty);

                  if (result.keywords.length > 0) {
                    addInfraction(result.keywords);
                  }
                } else if (result.sentiment > 0.3 && result.confidence > 0.5) {
                  // Positive speech slightly helps recovery
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
      // Compute RMS energy
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = dataArray[i] / 255;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const now = Date.now();

      if (rms >= VAD_ENERGY_THRESHOLD) {
        // Speech detected
        silenceStartRef.current = null;
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          speechStartRef.current = now;
          setVadActive(true);
          startRecording();
        }
      } else {
        // Silence
        if (isSpeakingRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current >= VAD_SILENCE_DURATION_MS) {
            // Speech ended
            isSpeakingRef.current = false;
            setVadActive(false);
            const speechDuration = speechStartRef.current ? now - speechStartRef.current : 0;
            speechStartRef.current = null;
            silenceStartRef.current = null;

            if (speechDuration >= VAD_MIN_SPEECH_MS) {
              stopRecordingAndAnalyze();
            } else {
              // Too short — discard
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
  }, [backend, updateScore, addInfraction]);

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

  const startMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext();
      // [claude-code 2026-03-14] Chromium/Electron starts AudioContext SUSPENDED — must resume
      if (ctx.state === 'suspended') await ctx.resume();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyserNode);

      audioContextRef.current = ctx;
      setAnalyser(analyserNode);

      // Reset session tracking
      sessionStartTimeRef.current = Date.now();
      timeInTiltRef.current = 0;
      infractionCountRef.current = 0;
      maxTiltScoreRef.current = 0;
      maxTiltTimeRef.current = null;
      lastTiltStartRef.current = null;
      isInTiltRef.current = false;
      regressionStartScoreRef.current = 0;
      regressionStartTimeRef.current = null;
      regressionTargetTimeRef.current = null;
      detectedKeywordsRef.current = [];
      snapshotsRef.current = [];
      lastSentimentRequestRef.current = 0;
      lastVoiceInterventionRef.current = 0;
      setErScore(0);
      setIsLockedOut(false);
      setLastSentiment(null);
      persistScore(0);

      // Create session in backend
      try {
        const saveResult = await backend.er.saveSession({
          finalScore: 0,
          timeInTiltSeconds: 0,
          infractionCount: 0,
          sessionDurationSeconds: 0,
        });
        setSessionId(saveResult.sessionId);

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('psychassist_session_id', saveResult.sessionId.toString());
            localStorage.setItem('psychassist_active', 'true');
            localStorage.setItem('psychassist_snapshots', '[]');
          }
        } catch {
          // Failed to persist session ID
        }
      } catch (err) {
        console.error('Failed to create ER session:', err);
      }

      // Start VAD (replaces browser Speech API)
      startVAD(analyserNode, stream);

      setIsMonitoring(true);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
      throw err;
    }
  }, [backend, persistScore, startVAD]);

  const stopMonitoring = useCallback(async () => {
    // Stop VAD
    stopVAD();

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // Ignore errors
      }
      audioContextRef.current = null;
    }

    // Clear intervals
    if (scoreIntervalRef.current) {
      clearInterval(scoreIntervalRef.current);
      scoreIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (overtradingIntervalRef.current) {
      clearInterval(overtradingIntervalRef.current);
      overtradingIntervalRef.current = null;
    }

    // Calculate final session metrics
    const sessionEndTime = Date.now();
    const sessionStartTime = sessionStartTimeRef.current || sessionEndTime;
    const sessionDurationSeconds = Math.floor((sessionEndTime - sessionStartTime) / 1000);

    if (isInTiltRef.current && lastTiltStartRef.current) {
      timeInTiltRef.current += Math.floor((sessionEndTime - lastTiltStartRef.current) / 1000);
    }

    if (sessionId) {
      try {
        await backend.er.saveSession({
          finalScore: erScore,
          timeInTiltSeconds: timeInTiltRef.current,
          infractionCount: infractionCountRef.current,
          sessionDurationSeconds: sessionDurationSeconds,
          maxTiltScore: maxTiltScoreRef.current !== 0 ? maxTiltScoreRef.current : undefined,
          maxTiltTime: maxTiltTimeRef.current || undefined,
        });
      } catch (err) {
        console.error('Failed to save ER session:', err);
      }
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('psychassist_active', 'false');
      }
    } catch {
      // Ignore errors
    }

    setAnalyser(null);
    setIsMonitoring(false);
    setOvertradingStatus(null);
  }, [backend, sessionId, erScore, stopVAD]);

  // Score update and regression interval
  useEffect(() => {
    if (!isMonitoring) return;

    scoreIntervalRef.current = setInterval(() => {
      setErScore(prev => {
        const now = Date.now();

        // Handle regression to neutral
        if (regressionStartTimeRef.current && regressionTargetTimeRef.current) {
          const elapsed = (now - regressionStartTimeRef.current) / 1000;
          const totalRegressionTime = (regressionTargetTimeRef.current - regressionStartTimeRef.current) / 1000;

          if (elapsed >= totalRegressionTime) {
            regressionStartTimeRef.current = null;
            regressionTargetTimeRef.current = null;
            persistScore(0);
            return 0;
          } else {
            const progress = elapsed / totalRegressionTime;
            const regressedScore = regressionStartScoreRef.current * (1 - progress);
            persistScore(regressedScore);
            return regressedScore;
          }
        }

        // Normal drift when not regressing
        const drift = (Math.random() - 0.5) * 0.3;
        let newScore = prev + drift;

        const wasInTilt = isInTiltRef.current;
        const isNowInTilt = newScore < -0.5;

        if (isNowInTilt && !wasInTilt) {
          isInTiltRef.current = true;
          lastTiltStartRef.current = now;
          regressionStartTimeRef.current = null;
          regressionTargetTimeRef.current = null;
        } else if (!isNowInTilt && wasInTilt) {
          if (lastTiltStartRef.current) {
            timeInTiltRef.current += Math.floor((now - lastTiltStartRef.current) / 1000);
          }
          isInTiltRef.current = false;
          lastTiltStartRef.current = null;

          const absCurrentScore = Math.abs(prev);
          const regressionTimeMinutes = (absCurrentScore / 9.9) * 10;
          const regressionTimeMs = regressionTimeMinutes * 60 * 1000;

          regressionStartScoreRef.current = prev;
          regressionStartTimeRef.current = now;
          regressionTargetTimeRef.current = now + regressionTimeMs;
        }

        if (newScore < maxTiltScoreRef.current) {
          maxTiltScoreRef.current = newScore;
          maxTiltTimeRef.current = new Date();
        }

        const clampedScore = Math.max(-10, Math.min(10, newScore));
        persistScore(clampedScore);
        return clampedScore;
      });
    }, 1000);

    return () => {
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current);
      }
    };
  }, [isMonitoring, persistScore]);

  // Snapshot interval
  useEffect(() => {
    if (!isMonitoring || !sessionId) return;

    snapshotIntervalRef.current = setInterval(async () => {
      const currentState: ERState = erScore > 0.5 ? 'steadfast' : erScore < -0.5 ? 'tilted' : 'poised';

      let audioLevelsJson: string | undefined;
      if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        const peak = Math.max(...Array.from(dataArray)) / 255;
        audioLevelsJson = JSON.stringify({ avg, peak });
      }

      try {
        await backend.er.saveSnapshot({
          sessionId: sessionId,
          score: erScore,
          state: currentState,
          audioLevels: audioLevelsJson,
          keywords: detectedKeywordsRef.current.length > 0 ? detectedKeywordsRef.current : undefined,
        });

        const snapshot: ERSnapshot = {
          score: erScore,
          state: currentState,
          timestamp: new Date(),
          audioLevels: audioLevelsJson ? JSON.parse(audioLevelsJson) : undefined,
          keywords: detectedKeywordsRef.current.length > 0 ? [...detectedKeywordsRef.current] : undefined,
        };

        snapshotsRef.current = [snapshot, ...snapshotsRef.current].slice(0, 20);

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('psychassist_snapshots', JSON.stringify(snapshotsRef.current.slice(0, 10)));
          }
        } catch {
          // Ignore errors
        }
      } catch (err) {
        console.error('Failed to save ER snapshot:', err);
      }
    }, 5000);

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, [isMonitoring, sessionId, erScore, analyser, backend]);

  // Overtrading check interval
  useEffect(() => {
    if (!isMonitoring) return;

    const checkOvertrading = async () => {
      try {
        const status = await backend.er.checkOvertrading({ windowMinutes: 15, threshold: 5 });
        setOvertradingStatus({
          isOvertrading: status.isOvertrading,
          tradesInWindow: status.tradesInWindow,
          warning: status.warning,
        });

        if (status.isOvertrading) {
          updateScore(-0.5);
        }
      } catch (err) {
        console.error('Failed to check overtrading:', err);
      }
    };

    checkOvertrading();
    overtradingIntervalRef.current = setInterval(checkOvertrading, 30000);

    return () => {
      if (overtradingIntervalRef.current) {
        clearInterval(overtradingIntervalRef.current);
      }
    };
  }, [isMonitoring, backend, updateScore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('psychassist:score', {
        detail: {
          score: erScore,
          timestamp: Date.now(),
        },
      })
    );
  }, [erScore]);

  useEffect(() => {
    return () => {
      if (infractionHoldTimeoutRef.current) {
        clearTimeout(infractionHoldTimeoutRef.current);
      }
    };
  }, []);

  const getRecentSnapshots = useCallback(() => {
    return snapshotsRef.current;
  }, []);

  const value: ERContextValue = {
    isMonitoring,
    erScore,
    resonanceState,
    sessionId,
    overtradingStatus,
    analyser,
    timeInTiltSeconds: timeInTiltRef.current,
    infractionCount: infractionCountRef.current,
    maxTiltScore: maxTiltScoreRef.current,
    sessionStartTime: sessionStartTimeRef.current,
    recentInfraction,
    lastInfractionAt,
    // 7B additions
    interventionLevel,
    isLockedOut,
    lastSentiment,
    vadActive,
    // Actions
    startMonitoring,
    stopMonitoring,
    updateScore,
    addInfraction,
    clearRecentInfraction,
    dismissLockout,
    getRecentSnapshots,
  };

  return (
    <ERContext.Provider value={value}>
      {children}
    </ERContext.Provider>
  );
}
