// [claude-code 2026-03-27] S2-T4: Added Upload Context button + modal for bulk FJ ingest
// [claude-code 2026-03-24] Persistence refactor: Run → Update button label when data exists
// [claude-code 2026-03-23] Persistent Sanctum header — presets, run button, status, rolling period
// [claude-code 2026-03-25] Theme-sensitive fonts — use var(--font-heading) and var(--font-body)
import { useState, useCallback } from 'react';
import { Zap, Loader2, Upload, X } from 'lucide-react';
import type { SanctumPreset } from '../../types/mirofish';
import { SanctumPresets } from './SanctumPresets';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface SanctumHeaderProps {
  preset: SanctumPreset;
  onPresetChange: (p: SanctumPreset) => void;
  onRun: () => void;
  isLoading: boolean;
  status: 'idle' | 'running' | 'complete' | 'error';
  hasData: boolean;
  rollingDays: 7 | 14 | 30;
  onRollingChange: (d: 7 | 14 | 30) => void;
}

const ROLLING_OPTIONS = [7, 14, 30] as const;

export function SanctumHeader({
  preset, onPresetChange, onRun, isLoading, status, hasData, rollingDays, onRollingChange,
}: SanctumHeaderProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/10">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold text-[var(--fintheon-accent)]/70 uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            MiroFish
          </span>
          {status === 'complete' && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-low)]/10 text-[var(--fintheon-low)] font-bold" style={{ fontFamily: 'var(--font-body)' }}>
              LIVE
            </span>
          )}
          {status === 'error' && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-severe)]/10 text-[var(--fintheon-severe)] font-bold" style={{ fontFamily: 'var(--font-body)' }}>
              ERROR
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <SanctumPresets active={preset} onChange={onPresetChange} />

          <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
            {ROLLING_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => onRollingChange(d)}
                className={`px-2 py-1 text-[10px] transition-colors ${
                  rollingDays === d
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8'
                    : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-colors border border-[var(--fintheon-border)]/20 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/5"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Context
          </button>

          <button
            onClick={onRun}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-colors border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isLoading ? 'Updating...' : (hasData ? 'Update' : 'Run MiroFish')}
          </button>
        </div>
      </div>

      {uploadOpen && <UploadContextModal onClose={() => setUploadOpen(false)} />}
    </>
  );
}

// ─── Upload Context Modal ───────────────────────────────────────

function UploadContextModal({ onClose }: { onClose: () => void }) {
  const [rawText, setRawText] = useState('');
  const [instrument, setInstrument] = useState('/ES');
  const [phase, setPhase] = useState<'input' | 'preview' | 'done'>('input');
  const [preview, setPreview] = useState<{ total: number; parsed: number; skipped: number } | null>(null);
  const [result, setResult] = useState<{ stored: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleParse = useCallback(async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/calibration/bulk-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, instrument }),
      });
      const data = await res.json();
      setPreview({ total: data.total, parsed: data.parsed?.length ?? 0, skipped: data.skipped });
      setPhase('preview');
    } catch (err: any) {
      setError(err?.message || 'Parse failed');
    } finally {
      setLoading(false);
    }
  }, [rawText, instrument]);

  const handleIngest = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Bulk ingest (parse + store)
      const ingestRes = await fetch(`${API_BASE}/api/calibration/bulk-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, instrument }),
      });
      const ingestData = await ingestRes.json();

      // Upload to MiroFish context
      if (ingestData.parsed > 0) {
        // Re-parse to get items for context upload
        const parseRes = await fetch(`${API_BASE}/api/calibration/bulk-parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText, instrument }),
        });
        const parseData = await parseRes.json();
        await fetch(`${API_BASE}/api/calibration/upload-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: parseData.parsed }),
        });
      }

      setResult({ stored: ingestData.stored ?? 0 });
      setPhase('done');
    } catch (err: any) {
      setError(err?.message || 'Ingest failed');
    } finally {
      setLoading(false);
    }
  }, [rawText, instrument]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full max-h-[70vh] flex flex-col rounded-xl shadow-[0_0_40px_rgba(199,159,74,0.15)]"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid color-mix(in srgb, var(--fintheon-border) 30%, transparent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/20">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-bold text-[var(--fintheon-accent)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Upload Context
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-900 rounded transition-all">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {phase === 'input' && (
            <>
              <label className="text-[10px] text-[var(--fintheon-muted)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-body)' }}>
                Paste raw Financial Juice posts
              </label>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste FJ headlines here... One per line or separated by blank lines."
                rows={10}
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] placeholder:text-[var(--fintheon-muted)]/40 focus:outline-none focus:border-[var(--fintheon-accent)]/40 resize-y"
                style={{ fontFamily: 'var(--font-body)' }}
              />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-[var(--fintheon-muted)]" style={{ fontFamily: 'var(--font-body)' }}>Instrument</label>
                <select
                  value={instrument}
                  onChange={e => setInstrument(e.target.value)}
                  className="rounded px-2 py-1 text-[10px] bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="/ES">/ES</option>
                  <option value="/NQ">/NQ</option>
                  <option value="/YM">/YM</option>
                  <option value="/RTY">/RTY</option>
                </select>
              </div>
            </>
          )}

          {phase === 'preview' && preview && (
            <div className="flex flex-col gap-2 py-4">
              <p className="text-xs text-[var(--fintheon-text)]" style={{ fontFamily: 'var(--font-body)' }}>
                <span className="font-bold text-[var(--fintheon-accent)]">{preview.parsed}</span> headlines parsed from{' '}
                <span className="font-bold">{preview.total}</span> chunks
                {preview.skipped > 0 && (
                  <span className="text-[var(--fintheon-muted)]"> ({preview.skipped} skipped)</span>
                )}
              </p>
              <p className="text-[10px] text-[var(--fintheon-muted)]" style={{ fontFamily: 'var(--font-body)' }}>
                Items will be stored in calibration_observations and fed to MiroFish context.
              </p>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="flex flex-col items-center gap-2 py-8">
              <span className="text-2xl">&#10003;</span>
              <p className="text-xs text-[var(--fintheon-text)] font-bold" style={{ fontFamily: 'var(--font-body)' }}>
                {result.stored} observations stored + MiroFish context updated
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--fintheon-border)]/20">
          {phase === 'input' && (
            <button
              onClick={handleParse}
              disabled={loading || !rawText.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[var(--fintheon-accent)] hover:brightness-110 text-black disabled:opacity-30"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {loading ? 'Parsing...' : 'Parse Preview'}
            </button>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={() => setPhase('input')}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Back
              </button>
              <button
                onClick={handleIngest}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[var(--fintheon-accent)] hover:brightness-110 text-black disabled:opacity-30"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {loading ? 'Ingesting...' : 'Ingest'}
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[var(--fintheon-accent)] hover:brightness-110 text-black"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
