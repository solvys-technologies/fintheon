// [claude-code 2026-03-29] Bottom-right update toast — auto-downloads in background, Install Now restarts
import { useEffect, useState, useCallback } from 'react';
import { Download, X, Loader2, RotateCw } from 'lucide-react';
import type { UpdateInfo, UpdateProgress } from '../types/electron';

const SUPPRESS_KEY = 'fintheon-update-suppressed';

type UpdateState = 'idle' | 'downloading' | 'ready';

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = window.electron;
    if (!el?.onUpdateAvailable) return;

    el.onUpdateAvailable((updateInfo) => {
      // If user suppressed this version, skip
      const suppressed = localStorage.getItem(SUPPRESS_KEY);
      if (suppressed === updateInfo.version) return;

      setInfo(updateInfo);
      // autoDownload is on — go straight to downloading state
      setState('downloading');
      setDismissed(false);
    });

    el.onUpdateProgress((p) => {
      setProgress(p);
    });

    el.onUpdateDownloaded(() => {
      setState('ready');
    });

    return () => {
      el.onUpdateAvailable(null);
      el.onUpdateProgress(null);
      el.onUpdateDownloaded(null);
    };
  }, []);

  // Enter animation
  useEffect(() => {
    if (state !== 'idle' && !dismissed) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
  }, [state, dismissed]);

  const handleInstall = useCallback(() => {
    window.electron?.installUpdate();
  }, []);

  const handleDismiss = useCallback(() => {
    setEntered(false);
    setTimeout(() => setDismissed(true), 300);
  }, []);

  const handleSuppress = useCallback(() => {
    if (info?.version) {
      localStorage.setItem(SUPPRESS_KEY, info.version);
    }
    setEntered(false);
    setTimeout(() => setDismissed(true), 300);
  }, [info]);

  if (state === 'idle' || dismissed) return null;

  const isVisible = entered;
  const isReady = state === 'ready';

  return (
    <div
      className="fixed z-[150] transition-all duration-300 ease-out"
      style={{
        bottom: '24px',
        right: '24px',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        width: '320px',
        borderRadius: '12px',
        border: `1px solid ${isReady ? 'var(--fintheon-accent)' : 'rgba(199,159,74,0.3)'}`,
        backgroundColor: 'var(--fintheon-surface)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 14px 0' }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          {isReady ? (
            <RotateCw size={14} style={{ color: 'var(--fintheon-accent)' }} />
          ) : (
            <Download size={14} style={{ color: 'var(--fintheon-accent)', opacity: 0.6 }} />
          )}
          <span
            className="text-[13px] font-semibold"
            style={{ color: 'var(--fintheon-text)' }}
          >
            {isReady ? 'Update ready' : 'Updating'}
            {info?.version && (
              <span style={{ color: 'var(--fintheon-accent)', marginLeft: '4px' }}>
                v{info.version}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors"
          style={{ width: '22px', height: '22px' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 14px 12px' }}>
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: 'rgba(156,163,175,0.8)', marginBottom: '8px' }}
        >
          {isReady
            ? 'Ready to install. A quick restart will apply the update.'
            : `Downloading in the background${progress ? ` — ${progress.percent}%` : '...'}`}
        </p>

        {/* Progress bar — only during download */}
        {state === 'downloading' && (
          <div
            style={{
              height: '3px',
              borderRadius: '2px',
              backgroundColor: 'rgba(199,159,74,0.15)',
              marginBottom: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress?.percent ?? 0}%`,
                borderRadius: '2px',
                backgroundColor: 'var(--fintheon-accent)',
                transition: 'width 300ms ease',
              }}
            />
          </div>
        )}

        {/* Actions — right-aligned */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSuppress}
            className="text-[10px] transition-colors"
            style={{ color: 'rgba(156,163,175,0.5)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(156,163,175,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(156,163,175,0.5)';
            }}
          >
            Don't show again
          </button>

          <button
            onClick={isReady ? handleInstall : undefined}
            disabled={!isReady}
            className="text-[11px] font-semibold transition-all flex items-center"
            style={{
              padding: '5px 14px',
              borderRadius: '6px',
              gap: '5px',
              color: isReady ? '#050402' : 'rgba(156,163,175,0.5)',
              backgroundColor: isReady ? 'var(--fintheon-accent)' : 'rgba(199,159,74,0.15)',
              cursor: isReady ? 'pointer' : 'default',
            }}
            onMouseEnter={(e) => {
              if (isReady) e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            {state === 'downloading' && <Loader2 size={11} className="animate-spin" />}
            {state === 'downloading' && 'Downloading...'}
            {isReady && 'Install Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
