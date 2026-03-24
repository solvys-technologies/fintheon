// [claude-code 2026-03-20] Rewrote modal → bottom-left toast with Install Now / Later / Don't show again
import { useEffect, useState, useCallback } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import type { UpdateInfo, UpdateProgress } from '../types/electron';

const SUPPRESS_KEY = 'fintheon-update-suppressed';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready';

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
      setState('available');
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
    if (state === 'available') {
      setState('downloading');
      window.electron?.downloadUpdate();
    } else if (state === 'ready') {
      window.electron?.installUpdate();
    }
  }, [state]);

  const handleLater = useCallback(() => {
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

  return (
    <div
      className="fixed z-[150] transition-all duration-300 ease-out"
      style={{
        bottom: '24px',
        left: '24px',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        width: '340px',
        borderRadius: '12px',
        border: '1px solid var(--fintheon-accent)',
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
          <Download size={14} style={{ color: 'var(--fintheon-accent)' }} />
          <span
            className="text-[13px] font-semibold"
            style={{ color: 'var(--fintheon-text)' }}
          >
            Fintheon{' '}
            <span style={{ color: 'var(--fintheon-accent)' }}>
              {info?.version ? `v${info.version}` : ''}
            </span>{' '}
            available
          </span>
        </div>
        {state === 'available' && (
          <button
            onClick={handleLater}
            className="flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors"
            style={{ width: '22px', height: '22px' }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '8px 14px 12px' }}>
        {state === 'downloading' && (
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: 'rgba(156,163,175,0.8)', marginBottom: '8px' }}
          >
            Downloading{progress ? ` — ${progress.percent}%` : '...'}
          </p>
        )}
        {state === 'ready' && (
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: 'rgba(156,163,175,0.8)', marginBottom: '8px' }}
          >
            Ready to install. Restart to apply.
          </p>
        )}

        {/* Progress bar */}
        {state === 'downloading' && progress && (
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
                width: `${progress.percent}%`,
                borderRadius: '2px',
                backgroundColor: 'var(--fintheon-accent)',
                transition: 'width 300ms ease',
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          {state === 'available' && (
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
          )}
          {state !== 'available' && <span />}

          <div className="flex items-center" style={{ gap: '8px' }}>
            {state === 'available' && (
              <button
                onClick={handleLater}
                className="text-[11px] font-medium transition-colors"
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  color: 'rgba(156,163,175,0.7)',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(156,163,175,0.15)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(156,163,175,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(156,163,175,0.15)';
                }}
              >
                Later
              </button>
            )}
            <button
              onClick={handleInstall}
              disabled={state === 'downloading'}
              className="text-[11px] font-semibold transition-all flex items-center"
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                gap: '5px',
                color: '#050402',
                backgroundColor: 'var(--fintheon-accent)',
                opacity: state === 'downloading' ? 0.6 : 1,
                cursor: state === 'downloading' ? 'wait' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (state !== 'downloading') {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              {state === 'downloading' && <Loader2 size={11} className="animate-spin" />}
              {state === 'available' && 'Install Now'}
              {state === 'downloading' && 'Downloading...'}
              {state === 'ready' && 'Install Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
