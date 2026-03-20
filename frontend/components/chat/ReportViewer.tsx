// [claude-code 2026-03-06] Report viewer: iframe/popup for agent-generated HTML dashboards
import { X, ExternalLink, Maximize2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

/**
 * Detects whether the given text contains an agent-generated HTML report.
 */
export function isReportHtml(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    trimmed.includes('<!-- PULSE_REPORT -->') || trimmed.includes('<!-- FINTHEON_REPORT -->') ||
    trimmed.startsWith('<!DOCTYPE html>') ||
    trimmed.startsWith('<!doctype html>') ||
    trimmed.startsWith('<html')
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ReportViewerProps {
  html: string;
  onClose: () => void;
  onPopOut?: () => void;
  onExpandPanel?: () => void;
}

export function ReportViewer({ html, onClose, onPopOut, onExpandPanel }: ReportViewerProps) {
  const handlePopOut = () => {
    // Open a new window and safely inject HTML via Blob URL
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after a short delay so the window has time to load
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    onPopOut?.();
  };

  return (
    <div className="rounded-lg border border-[var(--fintheon-accent)]/20 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--fintheon-surface)] border-b border-[var(--fintheon-accent)]/10">
        <span className="text-xs text-[var(--fintheon-accent)] font-semibold">Report</span>
        <span className="flex-1" />
        <button
          onClick={handlePopOut}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Pop out"
        >
          <ExternalLink size={12} />
          <span>Pop Out</span>
        </button>
        {onExpandPanel && (
          <button
            onClick={onExpandPanel}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Expand"
          >
            <Maximize2 size={12} />
            <span>Expand</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center justify-center text-zinc-400 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Iframe */}
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        className="w-full bg-white rounded-b-lg"
        style={{ minHeight: '400px', border: 'none' }}
        title="Fintheon Report"
      />
    </div>
  );
}
