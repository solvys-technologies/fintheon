import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { useBackend } from '../../lib/backend';

interface CompactERMonitorProps {
  onERScoreChange?: (score: number) => void;
}

/**
 * Compact landscape-oriented Emotional Resonance Monitor
 * Designed for the tickers-only floating widget
 */
export function CompactERMonitor({ onERScoreChange }: CompactERMonitorProps) {
  const backend = useBackend();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [erScore, setErScore] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Session tracking (simplified for compact version)
  const sessionStartTimeRef = useRef<number | null>(null);
  const infractionCountRef = useRef<number>(0);

  const resonanceState = erScore > 0.5 ? 'Stable' : erScore < -0.5 ? 'Tilt' : 'Neutral';
  const stateColor = {
    Stable: 'text-emerald-400',
    Tilt: 'text-red-500',
    Neutral: 'text-gray-400',
  };
  const stateBgColor = {
    Stable: 'bg-emerald-400',
    Tilt: 'bg-red-500',
    Neutral: 'bg-gray-400',
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
      
      // Reset tracking
      sessionStartTimeRef.current = Date.now();
      infractionCountRef.current = 0;
      setErScore(0);

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
            setErScore(prev => {
              const newScore = Math.max(-10, prev - 1.0);
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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setAudioContext(null);
    setAnalyser(null);
    setIsMonitoring(false);
  };

  // Natural drift effect
  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        setErScore(prev => {
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
  }, [isMonitoring, onERScoreChange]);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Waveform - Landscape oriented */}
      <div className="relative h-8 flex-1 bg-black/50 rounded border border-[#D4AF37]/10 overflow-hidden min-w-[100px]">
        <div className="absolute inset-0 scanline-overlay opacity-50" />
        {isMonitoring && analyser ? (
          <WaveformCanvas analyser={analyser} tiltMode={resonanceState === 'Tilt'} />
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
      {resonanceState === 'Tilt' && (
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
