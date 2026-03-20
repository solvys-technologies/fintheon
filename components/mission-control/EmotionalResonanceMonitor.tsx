import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertTriangle, TrendingUp } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { Button } from '../ui/Button';
import { StopMonitoringModal } from './StopMonitoringModal';
import { useBackend } from '../../lib/backend';

interface EmotionalResonanceMonitorProps {
  onERScoreChange?: (score: number) => void;
}

export function EmotionalResonanceMonitor({ onERScoreChange }: EmotionalResonanceMonitorProps) {
  const backend = useBackend();
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [erScore, setErScore] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [overtradingStatus, setOvertradingStatus] = useState<{
    isOvertrading: boolean;
    tradesInWindow: number;
    warning?: string;
  } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Session tracking
  const sessionStartTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const timeInTiltRef = useRef<number>(0);
  const infractionCountRef = useRef<number>(0);
  const maxTiltScoreRef = useRef<number>(0);
  const maxTiltTimeRef = useRef<Date | null>(null);
  const lastTiltStartRef = useRef<number | null>(null);
  const isInTiltRef = useRef<boolean>(false);
  const detectedKeywordsRef = useRef<string[]>([]);
  
  // Regression tracking
  const regressionStartScoreRef = useRef<number>(0);
  const regressionStartTimeRef = useRef<number | null>(null);
  const regressionTargetTimeRef = useRef<number | null>(null);

  const resonanceState = erScore > 0.5 ? 'Stable' : erScore < -0.5 ? 'Tilt' : 'Neutral';
  const stateColor = {
    Stable: 'text-emerald-400',
    Tilt: 'text-red-500',
    Neutral: 'text-gray-400',
  };

  // Safe localStorage helper
  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return localStorage.getItem(key);
        }
      } catch (e) {
        console.debug('localStorage read error:', e);
      }
      return null;
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, value);
        }
      } catch (e) {
        console.debug('localStorage write error:', e);
      }
    }
  };

  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyserNode);
      
      setAudioContext(ctx);
      setAnalyser(analyserNode);
      setIsMonitoring(true);
      
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
      setErScore(0);

      // Create session in backend FIRST (so we have session ID for snapshots)
      try {
        const saveResult = await backend.er.saveSession({
          finalScore: 0,
          timeInTiltSeconds: 0,
          infractionCount: 0,
          sessionDurationSeconds: 0,
        });
        sessionIdRef.current = saveResult.sessionId;
        safeLocalStorage.setItem('psychassist_session_id', saveResult.sessionId.toString());
        safeLocalStorage.setItem('psychassist_active', 'true');
      } catch (err) {
        console.error('Failed to create ER session:', err);
        // Continue without session - monitoring will still work locally
      }

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
          const hasAggression = detectedWords.length > 0;

          if (hasAggression) {
            detectedKeywordsRef.current.push(...detectedWords);
            detectedKeywordsRef.current = [...new Set(detectedKeywordsRef.current)];
            
            infractionCountRef.current += 1;
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
              
              safeLocalStorage.setItem('psychassist_current_score', newScore.toString());
              
              if (onERScoreChange) {
                onERScoreChange(newScore);
              }
              return newScore;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.debug('Speech recognition error:', event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (err) {
      console.error('Failed to start monitoring:', err);
    }
  };

  const stopMonitoring = async () => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Calculate final session metrics
    const sessionEndTime = Date.now();
    const sessionStartTime = sessionStartTimeRef.current || sessionEndTime;
    const sessionDurationSeconds = Math.floor((sessionEndTime - sessionStartTime) / 1000);
    
    // Add any remaining tilt time
    if (isInTiltRef.current && lastTiltStartRef.current) {
      timeInTiltRef.current += Math.floor((sessionEndTime - lastTiltStartRef.current) / 1000);
    }
    
    // Save session data to backend
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

    safeLocalStorage.setItem('psychassist_active', 'false');
    sessionIdRef.current = null;
    
    setAudioContext(null);
    setAnalyser(null);
    setIsMonitoring(false);
    setShowStopModal(false);
  };

  const handleStopClick = () => {
    setShowStopModal(true);
  };

  // Restore persisted score on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = safeLocalStorage.getItem('psychassist_current_score');
      if (saved) {
        const savedScore = parseFloat(saved);
        if (!isNaN(savedScore) && isFinite(savedScore)) {
          setErScore(savedScore);
          if (onERScoreChange) {
            onERScoreChange(savedScore);
          }
        }
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      // Score update interval
      const scoreInterval = setInterval(() => {
        setErScore(prev => {
          const now = Date.now();
          
          // Handle regression to neutral
          if (regressionStartTimeRef.current && regressionTargetTimeRef.current) {
            const elapsed = (now - regressionStartTimeRef.current) / 1000;
            const totalRegressionTime = (regressionTargetTimeRef.current - regressionStartTimeRef.current) / 1000;
            
            if (elapsed >= totalRegressionTime) {
              regressionStartTimeRef.current = null;
              regressionTargetTimeRef.current = null;
              safeLocalStorage.setItem('psychassist_current_score', '0');
              if (onERScoreChange) {
                onERScoreChange(0);
              }
              return 0;
            } else {
              const progress = elapsed / totalRegressionTime;
              const regressedScore = regressionStartScoreRef.current * (1 - progress);
              safeLocalStorage.setItem('psychassist_current_score', regressedScore.toString());
              if (onERScoreChange) {
                onERScoreChange(regressedScore);
              }
              return regressedScore;
            }
          }
          
          // Normal drift
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
          safeLocalStorage.setItem('psychassist_current_score', clampedScore.toString());
          
          if (onERScoreChange) {
            onERScoreChange(clampedScore);
          }
          return clampedScore;
        });
      }, 1000);

      // Snapshot interval
      const snapshotInterval = setInterval(async () => {
        if (!sessionIdRef.current) return;

        const currentScore = erScore;
        const currentState = currentScore > 0.5 ? 'stable' : currentScore < -0.5 ? 'tilt' : 'neutral';
        
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
            sessionId: sessionIdRef.current,
            score: currentScore,
            state: currentState,
            audioLevels: audioLevelsJson,
            keywords: detectedKeywordsRef.current.length > 0 ? detectedKeywordsRef.current : undefined,
          });
        } catch (err) {
          console.debug('Failed to save ER snapshot:', err);
        }
      }, 5000);

      // Overtrading check interval
      const overtradingInterval = setInterval(async () => {
        try {
          const status = await backend.er.checkOvertrading({ windowMinutes: 15, threshold: 5 });
          setOvertradingStatus({
            isOvertrading: status.isOvertrading,
            tradesInWindow: status.tradesInWindow,
            warning: status.warning,
          });

          if (status.isOvertrading) {
            setErScore(prev => {
              const newScore = Math.max(-10, prev - 0.5);
              safeLocalStorage.setItem('psychassist_current_score', newScore.toString());
              if (onERScoreChange) {
                onERScoreChange(newScore);
              }
              return newScore;
            });
          }
        } catch (err) {
          console.debug('Failed to check overtrading:', err);
        }
      }, 30000);

      return () => {
        clearInterval(scoreInterval);
        clearInterval(snapshotInterval);
        clearInterval(overtradingInterval);
      };
    } else {
      regressionStartTimeRef.current = null;
      regressionTargetTimeRef.current = null;
    }
  }, [isMonitoring, onERScoreChange, erScore, analyser, backend]);

  return (
    <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-[#D4AF37]">PsychAssist</h3>
        {isMonitoring ? (
          <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
        ) : (
          <MicOff className="w-3 h-3 text-gray-500" />
        )}
      </div>

      <div className="space-y-1.5">
        <div className="relative h-16 bg-black/50 rounded border border-[#D4AF37]/10 overflow-hidden">
          <div className="absolute inset-0 scanline-overlay" />
          {isMonitoring && analyser ? (
            <WaveformCanvas analyser={analyser} tiltMode={resonanceState === 'Tilt'} />
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-gray-500">
              Monitoring Inactive
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-400">ER Score:</span>
          <span className={`font-semibold ${stateColor[resonanceState]}`}>
            {erScore.toFixed(1)} / {resonanceState}
          </span>
        </div>

        {resonanceState === 'Tilt' && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 rounded p-1.5">
            <AlertTriangle className="w-3 h-3" />
            <span>Emotional Tilt Detected</span>
          </div>
        )}

        {overtradingStatus?.isOvertrading && (
          <div className="flex items-center gap-1.5 text-[10px] text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded p-1.5">
            <TrendingUp className="w-3 h-3" />
            <span>Overtrading: {overtradingStatus.tradesInWindow} trades in 15min</span>
          </div>
        )}

        <div className="flex gap-2">
          {!isMonitoring ? (
            <Button
              variant="primary"
              onClick={startMonitoring}
              className="flex-1 text-[11px] py-1"
            >
              Begin Session
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={handleStopClick}
              className="flex-1 text-[11px] py-1"
            >
              Stop Session
            </Button>
          )}
        </div>
      </div>

      {showStopModal && (
        <StopMonitoringModal
          onConfirm={stopMonitoring}
          onCancel={() => setShowStopModal(false)}
        />
      )}
    </div>
  );
}
