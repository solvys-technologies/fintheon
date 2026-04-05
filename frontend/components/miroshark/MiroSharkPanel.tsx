// [claude-code 2026-04-05] Fixed 404: added API_BASE to all fetch calls (was using relative URLs)
// [claude-code 2026-03-16] MiroShark simulation side panel — status, controls, prediction results
import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { MiroSharkPrediction } from './MiroSharkPrediction';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type SimStatus = 'idle' | 'running' | 'complete' | 'error';

interface Prediction {
  simulationId: string;
  nextSessionScore: number;
  confidence: number;
  regimeShiftProbability: number;
  scenarios: Array<{ label: string; probability: number; projectedScore: number }>;
  source: 'miroshark' | 'heuristic';
  generatedAt: string;
}

interface MiroSharkPanelProps {
  onRunSimulation: () => Promise<string | null>;
  onOpenInject: () => void;
}

export function MiroSharkPanel({ onRunSimulation, onOpenInject }: MiroSharkPanelProps) {
  const [status, setStatus] = useState<SimStatus>('idle');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setStatus('running');
    setError(null);
    try {
      const id = await onRunSimulation();
      if (!id) {
        setStatus('error');
        setError('Failed to start simulation');
        return;
      }
      setSimId(id);
      // Poll for completion
      const poll = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/miroshark/status/${id}`);
          const data = await res.json();
          if (data.status === 'complete') {
            const reportRes = await fetch(`${API_BASE}/api/miroshark/report/${id}`);
            const report = await reportRes.json();
            setPrediction(report);
            setStatus('complete');
          } else if (data.status === 'error') {
            setStatus('error');
            setError(data.error ?? 'Simulation failed');
          } else {
            setTimeout(poll, 2000);
          }
        } catch {
          setStatus('error');
          setError('Lost connection to MiroShark');
        }
      };
      setTimeout(poll, 1000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [onRunSimulation]);

  const statusIcon = {
    idle: null,
    running: <Loader2 className="w-3 h-3 animate-spin text-[var(--fintheon-accent)]" />,
    complete: <CheckCircle className="w-3 h-3 text-emerald-400" />,
    error: <AlertCircle className="w-3 h-3 text-red-400" />,
  }[status];

  return (
    <div
      className="w-72 border-l flex flex-col"
      style={{
        backgroundColor: 'rgba(10, 10, 0, 0.6)',
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: 'var(--fintheon-accent)' }} />
          <span className="text-xs font-semibold text-[var(--fintheon-text)]">MiroShark</span>
          {statusIcon}
        </div>
        <button
          onClick={handleRun}
          disabled={status === 'running'}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
            transition-colors duration-150 disabled:opacity-40"
          style={{
            backgroundColor: 'rgba(212, 175, 55, 0.15)',
            color: 'var(--fintheon-accent)',
          }}
        >
          <Play className="w-2.5 h-2.5" />
          {status === 'running' ? 'Running…' : 'Simulate'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {status === 'idle' && (
          <p className="text-[11px] text-gray-500 text-center py-6">
            Run a simulation to generate predictions from your narrative state.
          </p>
        )}

        {status === 'running' && (
          <div className="text-center py-6 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--fintheon-accent)' }} />
            <p className="text-[11px] text-gray-400">Agents deliberating…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {prediction && prediction.scenarios.map((scenario, i) => (
          <MiroSharkPrediction
            key={i}
            label={scenario.label}
            probability={scenario.probability}
            projectedScore={scenario.projectedScore}
            isTop={i === 0}
          />
        ))}

        {prediction && (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Next session</span>
              <span className="text-[var(--fintheon-accent)] font-medium">
                {prediction.nextSessionScore.toFixed(1)}/10
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Confidence</span>
              <span className="text-gray-300">{(prediction.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Regime shift</span>
              <span className={prediction.regimeShiftProbability > 0.3 ? 'text-red-400' : 'text-gray-300'}>
                {(prediction.regimeShiftProbability * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer — inject button */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button
          onClick={onOpenInject}
          disabled={status !== 'running' && status !== 'complete'}
          className="w-full px-2 py-1.5 rounded text-[10px] font-medium
            border transition-colors disabled:opacity-30"
          style={{
            borderColor: 'rgba(212, 175, 55, 0.2)',
            color: 'var(--fintheon-accent)',
          }}
        >
          God&apos;s Eye View — Inject Variable
        </button>
      </div>
    </div>
  );
}
