// [claude-code 2026-03-14] Refactored to use useERSafe() from ERContext (shared state), local fallback retained
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { useBackend } from '../../lib/backend';
import { useERSafe } from '../../contexts/ERContext';

interface CompactERMonitorProps {
  onERScoreChange?: (score: number) => void;
}

/**
 * Compact landscape-oriented Emotional Resonance Monitor
 * Designed for the tickers-only floating widget
 * Uses shared ERContext when available, falls back to local monitoring
 */
export function CompactERMonitor({ onERScoreChange }: CompactERMonitorProps) {
  const backend = useBackend();
  const erContext = useERSafe();

  // Local state (fallback when not in ERProvider)
  const [localIsMonitoring, setLocalIsMonitoring] = useState(false);
  const [localErScore, setLocalErScore] = useState(0);
  const [localAudioContext, setLocalAudioContext] = useState<AudioContext | null>(null);
  const [localAnalyser, setLocalAnalyser] = useState<AnalyserNode | null>(null);
  const [overtradingPenalty, setOvertradingPenalty] = useState<number>(0.5);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Session tracking (simplified for compact version)
  const sessionStartTimeRef = useRef<number | null>(null);
  const infractionCountRef = useRef<number>(0);

  // Use shared context if available, otherwise local state
  const isMonitoring = erContext?.isMonitoring ?? localIsMonitoring;
  const erScore = erContext?.erScore ?? localErScore;
  const analyser = erContext?.analyser ?? localAnalyser;

  const resonanceState = erScore > 0.5 ? 'Steadfast' : erScore < -0.5 ? 'Tilted' : 'Poised';
  const stateColor = {
    Steadfast: 'text-emerald-400',
    Tilted: 'text-red-500',
    Poised: 'text-gray-400',
  };
  const stateBgColor = {
    Steadfast: 'bg-emerald-400',
    Tilted: 'bg-red-500',
    Poised: 'bg-gray-400',
  };

  const startMonitoring = async () => {
    // Delegate to shared context if available
    if (erContext) {
      await erContext.startMonitoring();
      return;
    }

    // Fallback local monitoring
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

      setLocalAudioContext(ctx);
      setLocalAnalyser(analyserNode);
      setLocalIsMonitoring(true);

      // Reset tracking
      sessionStartTimeRef.current = Date.now();
      infractionCountRef.current = 0;
      setLocalErScore(0);

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
          const hasAggression = aggressiveWords.some(word =>
            transcript.toLowerCase().includes(word)
          );

          if (hasAggression) {
            infractionCountRef.current += 1;
            setLocalErScore(prev => {
              const newScore = Math.max(-10, prev - 1.0);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('psychassist:infraction', {
                    detail: {
                      timestamp: Date.now(),
                      score: newScore,
                    },
                  })
                );
              }
              if (onERScoreChange) {
                onERScoreChange(newScore);
              }
              return newScore;
            });
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (err) {
      console.error('Failed to start monitoring:', err);
    }
  };

  const stopMonitoring = async () => {
    // Delegate to shared context if available
    if (erContext) {
      await erContext.stopMonitoring();
      return;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (localAudioContext) {
      localAudioContext.close();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setLocalAudioContext(null);
    setLocalAnalyser(null);
    setLocalIsMonitoring(false);
  };

  // Natural drift effect (only for local fallback)
  useEffect(() => {
    if (erContext) return; // shared context handles drift
    if (isMonitoring) {
      const interval = setInterval(() => {
        setLocalErScore(prev => {
          const drift = (Math.random() - 0.5) * 0.3;
          const newScore = Math.max(-10, Math.min(10, prev + drift));
          if (onERScoreChange) {
            onERScoreChange(newScore);
          }
          return newScore;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring, onERScoreChange, erContext]);

  // Overtrading check (only for local fallback)
  useEffect(() => {
    if (erContext) return; // shared context handles overtrading
    if (!isMonitoring) return;

    const checkOvertrading = async () => {
      try {
        const status = await backend.er.checkOvertrading({ windowMinutes: 15, threshold: 5 });
        const penalty = typeof status.penalty === 'number' ? status.penalty : 0.5;
        setOvertradingPenalty(penalty);

        if (status.isOvertrading) {
          setLocalErScore((prev) => {
            const next = Math.max(-10, prev - penalty);
            if (onERScoreChange) {
              onERScoreChange(next);
            }
            return next;
          });
        }
      } catch (error) {
        console.debug('Compact ER overtrading check failed:', error);
      }
    };

    void checkOvertrading();
    const interval = setInterval(checkOvertrading, 30000);
    return () => clearInterval(interval);
  }, [backend, isMonitoring, onERScoreChange, erContext]);

  // Propagate score changes to callback
  useEffect(() => {
    onERScoreChange?.(erScore);
  }, [erScore, onERScoreChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('psychassist:score', {
        detail: {
          score: erScore,
          timestamp: Date.now(),
          overtradingPenalty,
        },
      })
    );
  }, [erScore, overtradingPenalty]);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Waveform - Landscape oriented */}
      <div className="relative h-8 flex-1 bg-black/50 rounded border border-[var(--fintheon-accent)]/10 overflow-hidden min-w-[100px]">
        <div className="absolute inset-0 scanline-overlay opacity-50" />
        {isMonitoring && analyser ? (
          <WaveformCanvas analyser={analyser} tiltMode={resonanceState === 'Tilted'} />
        ) : (
          <div className="h-full flex items-center justify-center text-[8px] text-gray-500">
            Inactive
          </div>
        )}
      </div>

      {/* Score & State */}
      <div className="flex items-center gap-1.5">
        {/* Status indicator dot */}
        <div className={`w-2 h-2 rounded-full ${stateBgColor[resonanceState]} ${isMonitoring ? 'animate-pulse' : ''}`} />

        {/* Score */}
        <div className="text-right">
          <div className={`text-xs font-bold ${stateColor[resonanceState]}`}>
            {erScore.toFixed(1)}
          </div>
          <div className={`text-[8px] ${stateColor[resonanceState]}`}>
            {resonanceState}
          </div>
        </div>
      </div>

      {/* Tilt warning */}
      {resonanceState === 'Tilted' && (
        <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse flex-shrink-0" />
      )}

      {/* Mic toggle button */}
      <button
        onClick={isMonitoring ? stopMonitoring : startMonitoring}
        className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
          isMonitoring
            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            : 'bg-zinc-800/50 text-gray-400 hover:bg-zinc-700/50 hover:text-gray-300'
        }`}
        title={isMonitoring ? 'Stop PsychAssist' : 'Start PsychAssist'}
      >
        {isMonitoring ? (
          <Mic className="w-3 h-3" />
        ) : (
          <MicOff className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
