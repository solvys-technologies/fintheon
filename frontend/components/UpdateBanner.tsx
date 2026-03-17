// [claude-code 2026-03-16] Replaced simple banner with modal — electron-updater "Install Now" / "Later"
import { useEffect, useState, useCallback } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import type { UpdateInfo, UpdateProgress } from '../../types/electron';

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

  if (state === 'idle' || dismissed) return null;

  const isVisible = entered;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
        onClick={state === 'available' ? handleLater : undefined}
      />

      {/* Modal */}
      <div
        className="fixed z-[201] transition-all duration-300 ease-out"
        style={{
          top: '50%',
          left: '50%',
          transform: isVisible
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -48%) scale(0.96)',
          opacity: isVisible ? 1 : 0,
          width: '380px',
          borderRadius: '14px',
          border: '1px solid var(--fintheon-accent)',
          backgroundColor: 'var(--fintheon-surface)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '16px 20px 0' }}
        >
          <div className="flex items-center" style={{ gap: '10px' }}>
            <Download size={18} style={{ color: 'var(--fintheon-accent)' }} />
            <span
              className="text-[15px] font-semibold"
              style={{ color: 'var(--fintheon-text)' }}
            >
              Update Available
            </span>
          </div>
          {state === 'available' && (
            <button
              onClick={handleLater}
              className="flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors"
              style={{ width: '24px', height: '24px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px 20px' }}>
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'rgba(156,163,175,0.9)', marginBottom: '16px' }}
          >
            {state === 'available' && (
              <>
                Fintheon <span style={{ color: 'var(--fintheon-accent)', fontWeight: 600 }}>{info?.version}</span> is
                ready. Restart the app to install the latest improvements.
              </>
            )}
            {state === 'downloading' && (
              <>Downloading update{progress ? ` — ${progress.percent}%` : '...'}</>
            )}
            {state === 'ready' && (
              <>Update downloaded. Click Install Now to restart and apply.</>
            )}
          </p>

          {/* Progress bar (downloading) */}
          {state === 'downloading' && progress && (
            <div
              style={{
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'rgba(199,159,74,0.15)',
                marginBottom: '16px',
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
          <div className="flex items-center justify-end" style={{ gap: '10px' }}>
            {state === 'available' && (
              <button
                onClick={handleLater}
                className="text-[12px] font-medium transition-colors"
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  color: 'rgba(156,163,175,0.8)',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(156,163,175,0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(156,163,175,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(156,163,175,0.2)';
                }}
              >
                Later
              </button>
            )}
            <button
              onClick={handleInstall}
              disabled={state === 'downloading'}
              className="text-[12px] font-semibold transition-all flex items-center"
              style={{
                padding: '7px 20px',
                borderRadius: '8px',
                gap: '6px',
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
              {state === 'downloading' && <Loader2 size={12} className="animate-spin" />}
              {state === 'available' && 'Install Now'}
              {state === 'downloading' && 'Downloading...'}
              {state === 'ready' && 'Install Now'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
