// [claude-code 2026-03-11] Track 7B: Upgraded ER Monitor — escalating interventions (visual ER<-1, voice ER<-3, lockout ER<-5), VAD indicator
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertTriangle, TrendingUp, ShieldAlert, Lock, Volume2 } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { Button } from '../ui/Button';
import { StopMonitoringModal } from './StopMonitoringModal';
import { useBackend } from '../../lib/backend';
import { useERSafe } from '../../contexts/ERContext';
import type { InterventionLevel } from '../../contexts/ERContext';

interface EmotionalResonanceMonitorProps {
  onERScoreChange?: (score: number) => void;
}

function InterventionBanner({ level, score, onDismissLockout }: {
  level: InterventionLevel;
  score: number;
  onDismissLockout: () => void;
}) {
  if (level === 'none') return null;

  const config = {
    visual: {
      icon: AlertTriangle,
      bg: 'bg-orange-500/10 border-orange-500/20',
      text: 'text-orange-400',
      label: 'Tilt Warning',
      message: 'ER score dropping. Check your emotional state.',
    },
    voice: {
      icon: Volume2,
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-400',
      label: 'Voice Intervention',
      message: 'Active tilt detected. Step away from the screen.',
    },
    lockout: {
      icon: Lock,
      bg: 'bg-red-600/20 border-red-600/40',
      text: 'text-red-500',
      label: 'LOCKOUT RECOMMENDED',
      message: `ER at ${score.toFixed(1)}. Trading should stop until you recover.`,
    },
  }[level];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`border rounded p-2 ${config.bg} animate-pulse`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${config.text}`} />
        <span className={`text-[10px] font-bold ${config.text}`}>{config.label}</span>
      </div>
      <p className={`text-[9px] mt-1 ${config.text} opacity-80`}>{config.message}</p>
      {level === 'lockout' && (
        <button
          onClick={onDismissLockout}
          className="mt-1.5 text-[9px] text-[var(--fintheon-muted)] underline hover:text-[var(--fintheon-text)] transition-colors"
        >
          Override the Censor
        </button>
      )}
    </div>
  );
}

export function EmotionalResonanceMonitor({ onERScoreChange }: EmotionalResonanceMonitorProps) {
  const backend = useBackend();
  const erContext = useERSafe();

  // Local state (fallback when not using shared context)
  const [localIsMonitoring, setLocalIsMonitoring] = useState(false);
  const [localErScore, setLocalErScore] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [localAudioContext, setLocalAudioContext] = useState<AudioContext | null>(null);
  const [localAnalyser, setLocalAnalyser] = useState<AnalyserNode | null>(null);
  const [overtradingStatus, setOvertradingStatus] = useState<{
    isOvertrading: boolean;
    tradesInWindow: number;
    warning?: string;
    penalty?: number;
  } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const timeInTiltRef = useRef<number>(0);
  const infractionCountRef = useRef<number>(0);
  const maxTiltScoreRef = useRef<number>(0);
  const maxTiltTimeRef = useRef<Date | null>(null);
  const lastTiltStartRef = useRef<number | null>(null);
  const isInTiltRef = useRef<boolean>(false);

  // Use shared context if available, otherwise local state
  const isMonitoring = erContext?.isMonitoring ?? localIsMonitoring;
  const erScore = erContext?.erScore ?? localErScore;
  const analyser = erContext?.analyser ?? localAnalyser;
  const interventionLevel = erContext?.interventionLevel ?? 'none';
  const isLockedOut = erContext?.isLockedOut ?? false;
  const vadActive = erContext?.vadActive ?? false;
  const lastSentiment = erContext?.lastSentiment ?? null;

  const resonanceState = erScore > 0.5 ? 'Steadfast' : erScore < -0.5 ? 'Tilted' : 'Poised';
  const stateColor = {
    Steadfast: 'text-emerald-400',
    Tilted: 'text-red-500',
    Poised: 'text-gray-400',
  };

  // Border glow based on intervention level
  const borderClass = {
    none: 'border-[var(--fintheon-accent)]/10',
    visual: 'border-orange-500/40',
    voice: 'border-red-500/50',
    lockout: 'border-red-600/70',
  }[interventionLevel];

  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
    },
    setItem: (key: string, value: string): void => {
      try { if (typeof window !== 'undefined') localStorage.setItem(key, value); } catch {}
    }
  };

  const startMonitoring = async () => {
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
      sessionStartTimeRef.current = Date.now();
      timeInTiltRef.current = 0;
      infractionCountRef.current = 0;
      maxTiltScoreRef.current = 0;
      setLocalErScore(0);

      try {
        const saveResult = await backend.er.saveSession({
          finalScore: 0, timeInTiltSeconds: 0, infractionCount: 0, sessionDurationSeconds: 0,
        });
        sessionIdRef.current = saveResult.sessionId;
        safeLocalStorage.setItem('psychassist_session_id', saveResult.sessionId.toString());
        safeLocalStorage.setItem('psychassist_active', 'true');
      } catch (err) {
        console.error('Failed to create ER session:', err);
      }
    } catch (err) {
      console.error('Failed to start monitoring:', err);
    }
  };

  const stopMonitoring = async () => {
    if (erContext) {
      await erContext.stopMonitoring();
      setShowStopModal(false);
      return;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (localAudioContext) {
      try { await localAudioContext.close(); } catch {}
    }
    safeLocalStorage.setItem('psychassist_active', 'false');
    sessionIdRef.current = null;
    setLocalAudioContext(null);
    setLocalAnalyser(null);
    setLocalIsMonitoring(false);
    setShowStopModal(false);
  };

  const handleStopClick = () => setShowStopModal(true);

  const handleDismissLockout = () => {
    if (erContext?.dismissLockout) erContext.dismissLockout();
  };

  // Restore persisted score on mount
  useEffect(() => {
    if (erContext) return; // shared context handles persistence
    const timer = setTimeout(() => {
      const saved = safeLocalStorage.getItem('psychassist_current_score');
      if (saved) {
        const savedScore = parseFloat(saved);
        if (!isNaN(savedScore) && isFinite(savedScore)) {
          setLocalErScore(savedScore);
          onERScoreChange?.(savedScore);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Propagate score changes to callback
  useEffect(() => {
    onERScoreChange?.(erScore);
  }, [erScore, onERScoreChange]);

  // Dispatch score event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('psychassist:score', {
        detail: { score: erScore, timestamp: Date.now() },
      })
    );
  }, [erScore]);

  return (
    <div className={`bg-[var(--fintheon-bg)] p-2.5 border ${borderClass} rounded transition-colors duration-300`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-[var(--fintheon-accent)]">PsychAssist</h3>
          {vadActive && (
            <span className="flex items-center gap-0.5 text-[8px] text-emerald-400 bg-emerald-400/10 rounded px-1 py-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              VAD
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {interventionLevel !== 'none' && (
            <ShieldAlert className={`w-3 h-3 ${
              interventionLevel === 'lockout' ? 'text-red-500 animate-pulse' :
              interventionLevel === 'voice' ? 'text-red-400' : 'text-orange-400'
            }`} />
          )}
          {isMonitoring ? (
            <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
          ) : (
            <MicOff className="w-3 h-3 text-gray-500" />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="relative h-16 bg-black/50 rounded border border-[var(--fintheon-accent)]/10 overflow-hidden">
          <div className="absolute inset-0 scanline-overlay" />
          {isMonitoring && analyser ? (
            <WaveformCanvas analyser={analyser} tiltMode={resonanceState === 'Tilted'} />
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

        {/* Escalating intervention banners */}
        <InterventionBanner
          level={interventionLevel}
          score={erScore}
          onDismissLockout={handleDismissLockout}
        />

        {/* Lockout overlay */}
        {isLockedOut && (
          <div className="bg-red-900/30 border border-red-600/50 rounded p-2.5 text-center">
            <Lock className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <div className="text-[11px] text-red-400 font-bold">TRADING LOCKOUT</div>
            <div className="text-[9px] text-red-400/70 mt-0.5">
              ER below -5. All trading should cease until emotional recovery.
            </div>
            <button
              onClick={handleDismissLockout}
              className="mt-2 text-[9px] px-3 py-1 bg-red-600/20 border border-red-600/30 rounded text-red-400 hover:bg-red-600/30 transition-colors"
            >
              Invoke Imperium
            </button>
          </div>
        )}

        {/* Last sentiment (from Haiku) */}
        {lastSentiment && lastSentiment.tiltIndicators.length > 0 && (
          <div className="text-[9px] text-[var(--fintheon-muted)] bg-black/20 rounded p-1.5">
            <span className="text-[var(--fintheon-accent)]">Haiku:</span> {lastSentiment.summary}
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
              Initialize
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={handleStopClick}
              className="flex-1 text-[11px] py-1"
            >
              Conclude
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
