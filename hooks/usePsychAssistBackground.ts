import { useEffect, useRef, useState } from 'react';
import { useBackend } from '../lib/backend';

interface PsychAssistSnapshot {
  score: number;
  state: 'stable' | 'tilt' | 'neutral';
  timestamp: Date;
  audioLevels?: { avg: number; peak: number };
  keywords?: string[];
}

/**
 * @deprecated Use ERContext instead for persistent PsychAssist monitoring.
 * This hook is kept for backwards compatibility but should not be used in new code.
 * 
 * Background service for persistent PsychAssist data recording
 * This hook ensures PsychAssist data is recorded continuously across all layouts
 * and persists even when components unmount
 */
export function usePsychAssistBackground() {
  const backend = useBackend();
  const [isActive, setIsActive] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const sessionIdRef = useRef<number | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const detectedKeywordsRef = useRef<string[]>([]);

  // Load persisted session ID from localStorage (safe, non-blocking)
  useEffect(() => {
    // Use setTimeout to ensure this runs after initial render
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedSessionId = localStorage.getItem('psychassist_session_id');
          if (savedSessionId) {
            const parsed = parseInt(savedSessionId, 10);
            if (!isNaN(parsed)) {
              sessionIdRef.current = parsed;
            }
          }

          // Load persisted score
          const savedScore = localStorage.getItem('psychassist_current_score');
          if (savedScore) {
            const parsed = parseFloat(savedScore);
            if (!isNaN(parsed) && isFinite(parsed)) {
              setCurrentScore(parsed);
            }
          }

          // Check if monitoring was active
          const wasActive = localStorage.getItem('psychassist_active') === 'true';
          if (wasActive) {
            startBackgroundMonitoring().catch(err => {
              console.debug('Failed to start background monitoring:', err);
            });
          }
        }
      } catch (e) {
        // Silently ignore localStorage errors - app should work without persistence
        console.debug('localStorage not available:', e);
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  const startBackgroundMonitoring = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyserNode);

      audioContextRef.current = ctx;
      analyserRef.current = analyserNode;
      setIsActive(true);
      
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('psychassist_active', 'true');
        }
      } catch (e) {
        console.debug('Failed to persist monitoring state:', e);
      }

      // Create or resume session
      if (!sessionIdRef.current) {
        try {
          const saveResult = await backend.er.saveSession({
            finalScore: currentScore,
            timeInTiltSeconds: 0,
            infractionCount: 0,
            sessionDurationSeconds: 0,
          });
          sessionIdRef.current = saveResult.sessionId;
          
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('psychassist_session_id', saveResult.sessionId.toString());
            }
          } catch (e) {
            console.debug('Failed to persist session ID:', e);
          }
        } catch (err) {
          console.error('Failed to create ER session:', err);
        }
      }

      // Start speech recognition for keyword detection
      if ('webkitSpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');

          const aggressiveWords = ['fuck', 'shit', 'damn', 'stupid', 'idiot', 'hate'];
          const detectedWords = aggressiveWords.filter(word =>
            transcript.toLowerCase().includes(word)
          );

          if (detectedWords.length > 0) {
            detectedKeywordsRef.current.push(...detectedWords);
            detectedKeywordsRef.current = [...new Set(detectedKeywordsRef.current)];
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      // Start periodic snapshot recording
      snapshotIntervalRef.current = setInterval(async () => {
        if (!sessionIdRef.current || !analyserRef.current) return;

        const currentState = currentScore > 0.5 ? 'stable' : currentScore < -0.5 ? 'tilt' : 'neutral';

        // Get audio levels
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        const peak = Math.max(...Array.from(dataArray)) / 255;
        const audioLevelsJson = JSON.stringify({ avg, peak });

        try {
          await backend.er.saveSnapshot({
            sessionId: sessionIdRef.current,
            score: currentScore,
            state: currentState,
            audioLevels: audioLevelsJson,
            keywords: detectedKeywordsRef.current.length > 0 ? detectedKeywordsRef.current : undefined,
          });

          // Persist to localStorage for cross-layout access
          const snapshot: PsychAssistSnapshot = {
            score: currentScore,
            state: currentState,
            timestamp: new Date(),
            audioLevels: { avg, peak },
            keywords: detectedKeywordsRef.current.length > 0 ? detectedKeywordsRef.current : undefined,
          };

          // Store last 10 snapshots (safe, non-blocking)
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              const existingSnapshots = JSON.parse(
                localStorage.getItem('psychassist_snapshots') || '[]'
              ) as PsychAssistSnapshot[];
              const updatedSnapshots = [snapshot, ...existingSnapshots].slice(0, 10);
              localStorage.setItem('psychassist_snapshots', JSON.stringify(updatedSnapshots));
            }
          } catch (e) {
            console.debug('Failed to persist snapshots:', e);
          }
        } catch (err) {
          console.error('Failed to save background ER snapshot:', err);
        }
      }, 5000); // Every 5 seconds
    } catch (err) {
      console.error('Failed to start background monitoring:', err);
    }
  };

  const stopBackgroundMonitoring = async () => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      recognitionRef.current = null;
    }

    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        // Ignore errors
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsActive(false);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('psychassist_active', 'false');
      }
    } catch (e) {
      console.debug('Failed to persist monitoring state:', e);
    }
  };

  const updateScore = (newScore: number) => {
    setCurrentScore(newScore);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('psychassist_current_score', newScore.toString());
      }
    } catch (e) {
      console.debug('Failed to persist score:', e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundMonitoring();
    };
  }, []);

  return {
    isActive,
    currentScore,
    startBackgroundMonitoring,
    stopBackgroundMonitoring,
    updateScore,
    getSnapshots: (): PsychAssistSnapshot[] => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return JSON.parse(localStorage.getItem('psychassist_snapshots') || '[]');
        }
      } catch (e) {
        console.debug('Failed to load snapshots:', e);
      }
      return [];
    },
  };
}
