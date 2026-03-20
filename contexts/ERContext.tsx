import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useBackend } from '../lib/backend';

export type ERState = 'stable' | 'neutral' | 'tilt';

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
  
  // Actions
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  updateScore: (delta: number) => void;
  addInfraction: (keywords: string[]) => void;
  
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

export function ERProvider({ children }: ERProviderProps) {
  const backend = useBackend();
  
  // Core state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [erScore, setErScore] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [overtradingStatus, setOvertradingStatus] = useState<OvertradingStatus | null>(null);
  
  // Refs for non-reactive state
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const timeInTiltRef = useRef<number>(0);
  const infractionCountRef = useRef<number>(0);
  const maxTiltScoreRef = useRef<number>(0);
  const maxTiltTimeRef = useRef<Date | null>(null);
  const lastTiltStartRef = useRef<number | null>(null);
  const isInTiltRef = useRef<boolean>(false);
  const detectedKeywordsRef = useRef<string[]>([]);
  const snapshotsRef = useRef<ERSnapshot[]>([]);
  
  // Intervals
  const scoreIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const overtradingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Regression tracking
  const regressionStartScoreRef = useRef<number>(0);
  const regressionStartTimeRef = useRef<number | null>(null);
  const regressionTargetTimeRef = useRef<number | null>(null);

  // Computed state
  const resonanceState: ERState = erScore > 0.5 ? 'stable' : erScore < -0.5 ? 'tilt' : 'neutral';

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
          
          // Load session ID if exists
          const savedSessionId = localStorage.getItem('psychassist_session_id');
          if (savedSessionId) {
            const parsed = parseInt(savedSessionId, 10);
            if (!isNaN(parsed)) {
              setSessionId(parsed);
            }
          }
          
          // Load snapshots
          const savedSnapshots = localStorage.getItem('psychassist_snapshots');
          if (savedSnapshots) {
            try {
              snapshotsRef.current = JSON.parse(savedSnapshots);
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        console.debug('localStorage not available:', e);
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
    } catch (e) {
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
    
    setErScore(prev => {
      const newScore = Math.max(-10, prev - 1.0);
      
      // Track max tilt
      if (newScore < maxTiltScoreRef.current) {
        maxTiltScoreRef.current = newScore;
        maxTiltTimeRef.current = new Date();
      }
      
      // Start tilt tracking if entering tilt
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

  const startMonitoring = useCallback(async () => {
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
      setErScore(0);
      persistScore(0);

      // Create session in backend FIRST (so we have session ID for snapshots)
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
        } catch (e) {
          console.debug('Failed to persist session ID:', e);
        }
      } catch (err) {
        console.error('Failed to create ER session:', err);
        // Continue without session - snapshots won't be saved but monitoring will work
      }

      // Start speech recognition
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
            addInfraction(detectedWords);
          }
        };

        recognition.onerror = (event: any) => {
          console.debug('Speech recognition error:', event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsMonitoring(true);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
      throw err;
    }
  }, [backend, addInfraction, persistScore]);

  const stopMonitoring = useCallback(async () => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      recognitionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
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
    
    // Add any remaining tilt time
    if (isInTiltRef.current && lastTiltStartRef.current) {
      timeInTiltRef.current += Math.floor((sessionEndTime - lastTiltStartRef.current) / 1000);
    }

    // Save final session data to backend
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

    // Update localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('psychassist_active', 'false');
      }
    } catch (e) {
      // Ignore errors
    }

    setAnalyser(null);
    setIsMonitoring(false);
    setOvertradingStatus(null);
  }, [backend, sessionId, erScore]);

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
        
        // Check if entering/exiting tilt state
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
          
          // Start regression
          const absCurrentScore = Math.abs(prev);
          const regressionTimeMinutes = (absCurrentScore / 9.9) * 10;
          const regressionTimeMs = regressionTimeMinutes * 60 * 1000;
          
          regressionStartScoreRef.current = prev;
          regressionStartTimeRef.current = now;
          regressionTargetTimeRef.current = now + regressionTimeMs;
        }
        
        // Track max tilt
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
      const currentState: ERState = erScore > 0.5 ? 'stable' : erScore < -0.5 ? 'tilt' : 'neutral';
      
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

        // Store snapshot locally
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
        } catch (e) {
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

    // Check immediately
    checkOvertrading();

    overtradingIntervalRef.current = setInterval(checkOvertrading, 30000);

    return () => {
      if (overtradingIntervalRef.current) {
        clearInterval(overtradingIntervalRef.current);
      }
    };
  }, [isMonitoring, backend, updateScore]);

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
    startMonitoring,
    stopMonitoring,
    updateScore,
    addInfraction,
    getRecentSnapshots,
  };

  return (
    <ERContext.Provider value={value}>
      {children}
    </ERContext.Provider>
  );
}
