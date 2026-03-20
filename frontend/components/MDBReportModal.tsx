import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useBackend } from "../lib/backend";

const BULLISH_THINKING_TERMS = [
  "accumulating...",
  "analyzing alpha...",
  "calculating beta...",
  "evaluating momentum...",
  "reviewing confluence...",
  "checking volume...",
  "assessing liquidity...",
  "measuring sentiment...",
  "tracking volatility...",
  "gauging strength...",
  "identifying support...",
  "finding resistance...",
  "analyzing flow...",
  "reading tape...",
  "weighing risk...",
];

interface MDBReportModalProps {
  onClose: () => void;
}

export function MDBReportModal({ onClose }: MDBReportModalProps) {
  const backend = useBackend();
  const [isLoading, setIsLoading] = useState(true);
  const [thinkingText, setThinkingText] = useState(BULLISH_THINKING_TERMS[0]);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 1300);
  };

  // Animate thinking text
  useEffect(() => {
    if (!isLoading) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      setThinkingText(BULLISH_THINKING_TERMS[currentIndex]);
      currentIndex = (currentIndex + 1) % BULLISH_THINKING_TERMS.length;
    }, 800);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Fetch MDB report on mount
  useEffect(() => {
    const fetchReport = async () => {
      try {
        // Use the dedicated MDB report endpoint (with persistence)
        const response = await backend.ai.generateMDBReport();
        setReport(response.report.content);
        // Note: Report is now persisted to database automatically
      } catch (err) {
        console.error("Failed to fetch MDB report:", err);
        setError("Failed to generate report. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg shadow-[0_0_24px_rgba(255,192,56,0.2)] w-full max-w-3xl max-h-[80vh] flex flex-col ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[var(--fintheon-accent)]">MDB Report</h2>
            <span className="text-xs text-zinc-500">Morning Daily Brief</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-900 rounded transition-lush"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              {/* Claude logo SVG */}
              <svg className="w-12 h-12 text-[var(--fintheon-accent)] mb-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.7 9.7c-.4-.4-1-.4-1.4 0l-4.3 4.3-4.3-4.3c-.4-.4-1-.4-1.4 0-.4.4-.4 1 0 1.4l5 5c.2.2.4.3.7.3.3 0 .5-.1.7-.3l5-5c.4-.4.4-1 0-1.4z"/>
              </svg>
              <p className="text-sm text-[var(--fintheon-accent)] font-medium mb-2">Claude is thinking</p>
              <p className="text-sm text-zinc-500 italic animate-pulse">{thinkingText}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-500 text-center">
                <p className="text-sm font-medium mb-2">{error}</p>
                <button
                  onClick={handleClose}
                  className="text-xs text-zinc-400 hover:text-zinc-300 underline transition-lush"
                >
                  Close and try again
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-4">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{report}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-900">
          <span className="text-xs text-zinc-600">
            Report saved and available in history
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-[var(--fintheon-accent)] hover:bg-[#FFD060] text-black rounded-lg text-sm font-medium transition-lush"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
