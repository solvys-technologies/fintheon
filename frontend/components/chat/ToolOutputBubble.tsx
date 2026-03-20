import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, AlertCircle, Loader2, Copy, Clock } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ToolStatus = 'running' | 'done' | 'error';

export interface ToolOutputData {
  id: string;
  toolName: string;
  status: ToolStatus;
  output: string;
  exitCode?: number;
  durationMs?: number;
  startedAt: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TOOL_COLORS: Record<string, string> = {
  web_search: '#A78BFA',
  market_scanner: 'var(--fintheon-accent)',
  research: '#60A5FA',
  code_exec: '#34D399',
  browser: '#F59E0B',
  default: '#9CA3AF',
};

function getToolColor(name: string): string {
  return TOOL_COLORS[name] || TOOL_COLORS.default;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ToolOutputBubbleProps {
  tool: ToolOutputData;
}

export function ToolOutputBubble({ tool }: ToolOutputBubbleProps) {
  const [expanded, setExpanded] = useState(tool.status === 'running');
  const [copied, setCopied] = useState(false);
  const color = getToolColor(tool.toolName);

  const StatusIcon = tool.status === 'running' ? Loader2 : tool.status === 'done' ? Check : AlertCircle;
  const statusColor = tool.status === 'running' ? 'var(--fintheon-accent)' : tool.status === 'done' ? '#34D399' : '#EF4444';

  const handleCopy = () => {
    navigator.clipboard.writeText(tool.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{
        borderColor: `${color}20`,
        backgroundColor: '#0b0b08',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        {/* Status icon */}
        <StatusIcon
          size={13}
          className={`flex-shrink-0 ${tool.status === 'running' ? 'animate-spin' : ''}`}
          style={{ color: statusColor }}
        />

        {/* Tool badge */}
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {tool.toolName}
        </span>

        <span className="flex-1" />

        {/* Duration */}
        {tool.durationMs != null && (
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock size={9} />
            {(tool.durationMs / 1000).toFixed(1)}s
          </span>
        )}

        {expanded ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t" style={{ borderColor: `${color}10` }}>
          <div className="relative">
            <pre
              className="text-[11px] text-gray-400 leading-relaxed overflow-x-auto max-h-[200px] overflow-y-auto"
              style={{ padding: '10px 12px' }}
            >
              {tool.output || '(no output)'}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center justify-center rounded text-gray-600 hover:text-white transition-colors"
              style={{ width: '24px', height: '24px', backgroundColor: 'rgba(0,0,0,0.5)' }}
              title="Copy output"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          </div>
          {/* Footer */}
          {tool.exitCode != null && (
            <div
              className="text-[10px] text-gray-600 px-3 py-1.5 border-t"
              style={{ borderColor: `${color}10` }}
            >
              Exit code: {tool.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
