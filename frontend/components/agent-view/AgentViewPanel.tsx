// [claude-code 2026-03-22] Source of Truth fusion — Browser Control Phase 1 UI
// Read-only observation panel for TopStep X via Electron WebContentsView
import { useState, useEffect, useCallback } from 'react';
import { Monitor, X, RefreshCw, Camera, Eye, EyeOff } from 'lucide-react';

interface ExtractedData {
  pnl?: string | null;
  balance?: string | null;
  positions?: string | null;
}

interface AgentViewPanelProps {
  defaultUrl?: string;
  onScreenshot?: (dataUrl: string) => void;
}

export function AgentViewPanel({
  defaultUrl = 'https://app.topstepx.com',
  onScreenshot,
}: AgentViewPanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ title: string; url: string } | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [showData, setShowData] = useState(true);

  const api = typeof window !== 'undefined' ? window.electron?.agentView : null;

  const openView = useCallback(async () => {
    if (!api) return;
    const result = await api.create(defaultUrl);
    if (result.ok) setIsActive(true);
  }, [api, defaultUrl]);

  const closeView = useCallback(async () => {
    if (!api) return;
    await api.close();
    setIsActive(false);
    setPageInfo(null);
    setExtractedData({});
  }, [api]);

  const takeScreenshot = useCallback(async () => {
    if (!api) return;
    const dataUrl = await api.screenshot();
    if (dataUrl && onScreenshot) onScreenshot(dataUrl);
  }, [api, onScreenshot]);

  // Poll page info and extracted data when active
  useEffect(() => {
    if (!isActive || !api) return;

    const interval = setInterval(async () => {
      const info = await api.getInfo();
      if (info) setPageInfo(info);

      // Attempt DOM extraction (selectors will vary by platform)
      const batch = await api.readBatch([
        '[data-testid="pnl"]',
        '[data-testid="balance"]',
        '[data-testid="positions"]',
        '.pnl-value',
        '.account-balance',
        '.position-count',
      ]);

      setExtractedData({
        pnl: batch['[data-testid="pnl"]'] ?? batch['.pnl-value'] ?? null,
        balance: batch['[data-testid="balance"]'] ?? batch['.account-balance'] ?? null,
        positions: batch['[data-testid="positions"]'] ?? batch['.position-count'] ?? null,
      });
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [isActive, api]);

  // Not in Electron — don't render
  if (!api) return null;

  return (
    <div className="border-l border-[var(--fintheon-accent)]/10 w-[280px] shrink-0 flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/10 flex items-center gap-2">
        <Monitor size={12} className="text-[var(--fintheon-accent)]" />
        <span className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-wider uppercase flex-1">
          Agent View
        </span>
        {isActive ? (
          <div className="flex items-center gap-1">
            <button onClick={takeScreenshot} className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10" title="Screenshot">
              <Camera size={10} className="text-[var(--fintheon-accent)]/50" />
            </button>
            <button onClick={() => setShowData(prev => !prev)} className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10">
              {showData
                ? <EyeOff size={10} className="text-[var(--fintheon-accent)]/50" />
                : <Eye size={10} className="text-[var(--fintheon-accent)]/50" />
              }
            </button>
            <button onClick={closeView} className="p-1 rounded hover:bg-red-500/10">
              <X size={10} className="text-red-400/50" />
            </button>
          </div>
        ) : (
          <button
            onClick={openView}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/40 transition-colors"
          >
            <RefreshCw size={8} />
            Open TopStep X
          </button>
        )}
      </div>

      {/* Content */}
      {isActive && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Page info */}
          {pageInfo && (
            <div className="space-y-1">
              <span className="text-[8px] font-mono text-[var(--fintheon-accent)]/30 uppercase tracking-wider">Page</span>
              <p className="text-[9px] text-[var(--fintheon-text)]/50 font-mono truncate">{pageInfo.title}</p>
              <p className="text-[7px] text-[var(--fintheon-text)]/25 font-mono truncate">{pageInfo.url}</p>
            </div>
          )}

          {/* Extracted data */}
          {showData && (
            <div className="space-y-2">
              <span className="text-[8px] font-mono text-[var(--fintheon-accent)]/30 uppercase tracking-wider">Extracted Data</span>
              <DataRow label="P&L" value={extractedData.pnl} />
              <DataRow label="Balance" value={extractedData.balance} />
              <DataRow label="Positions" value={extractedData.positions} />
            </div>
          )}

          {/* Status */}
          <div className="pt-2 border-t border-[var(--fintheon-accent)]/10">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
              <span className="text-[8px] font-mono text-[var(--fintheon-text)]/30">
                Read-only observation active
              </span>
            </div>
            <p className="text-[7px] text-[var(--fintheon-text)]/15 font-mono mt-1">
              Phase 1: No interaction. DOM text extraction only.
            </p>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[9px] text-[var(--fintheon-text)]/20 font-mono text-center leading-relaxed">
            Browser Control Phase 1<br />
            Read-only TopStep X observation<br />
            Click "Open" to start
          </p>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[8px] text-[var(--fintheon-text)]/40 font-mono">{label}</span>
      <span className={`text-[9px] font-mono ${
        value ? 'text-[var(--fintheon-text)]/70' : 'text-[var(--fintheon-text)]/15'
      }`}>
        {value ?? '--'}
      </span>
    </div>
  );
}
