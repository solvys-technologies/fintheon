// [claude-code 2026-03-06] Tool call/result part renderer with per-tool formatting
import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, AlertCircle, Loader2, Copy, Clock } from 'lucide-react';
import type { ToolInvocationPart, ToolResultPart } from '../types';

interface ToolCallPartProps {
  part: ToolInvocationPart;
  result?: ToolResultPart;
}

const TOOL_COLORS: Record<string, string> = {
  web_search: '#A78BFA',
  market_scanner: 'var(--fintheon-accent)',
  research: '#60A5FA',
  code_exec: '#34D399',
  browser: '#F59E0B',
  bash: '#34D399',
  read: '#60A5FA',
  edit: '#F59E0B',
  grep: '#A78BFA',
  glob: '#A78BFA',
  default: '#9CA3AF',
};

function getToolColor(name: string): string {
  const lower = name.toLowerCase();
  return TOOL_COLORS[lower] || TOOL_COLORS.default;
}

function StatusIcon({ state }: { state: ToolInvocationPart['state'] }) {
  switch (state) {
    case 'pending':
    case 'running':
      return <Loader2 size={13} className="animate-spin text-zinc-400 flex-shrink-0" />;
    case 'done':
      return <Check size={13} className="text-green-500 flex-shrink-0" />;
    case 'error':
      return <AlertCircle size={13} className="text-red-500 flex-shrink-0" />;
  }
}

function BashBlock({ part, result }: ToolCallPartProps) {
  const [copied, setCopied] = useState(false);
  const output = result?.output || '';
  const color = getToolColor('bash');

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-[var(--fintheon-surface)] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <StatusIcon state={part.state} />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          Bash
        </span>
        {part.args?.command && (
          <span className="text-[10px] text-zinc-600 font-mono truncate max-w-[200px]">
            {part.args.command}
          </span>
        )}
        <span className="flex-1" />
        {result?.durationMs != null && (
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock size={9} />
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        <button
          onClick={handleCopy}
          className="text-gray-600 hover:text-white transition-colors"
          title="Copy output"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      </div>
      {output && (
        <pre className="text-xs text-green-400/80 p-3 font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
          {output}
        </pre>
      )}
      {result?.exitCode != null && result.exitCode !== 0 && (
        <div className="text-[10px] text-red-400 px-3 py-1.5 border-t border-zinc-800">
          Exit code: {result.exitCode}
        </div>
      )}
    </div>
  );
}

function ReadBlock({ part, result }: ToolCallPartProps) {
  const [expanded, setExpanded] = useState(false);
  const output = result?.output || '';
  const filePath = part.args?.file_path || part.args?.path || 'file';
  const color = getToolColor('read');

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden" style={{ backgroundColor: '#0b0b08' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <StatusIcon state={part.state} />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          Read
        </span>
        <span className="text-xs text-zinc-500 font-mono truncate">{filePath}</span>
        <span className="flex-1" />
        {expanded ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>
      {expanded && output && (
        <div className="border-t border-zinc-800">
          <pre className="text-[11px] text-zinc-400 p-3 font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

function EditBlock({ part, result }: ToolCallPartProps) {
  const [expanded, setExpanded] = useState(false);
  const output = result?.output || '';
  const filePath = part.args?.file_path || part.args?.path || 'file';
  const color = getToolColor('edit');
  const lines = output.split('\n');

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden" style={{ backgroundColor: '#0b0b08' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <StatusIcon state={part.state} />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          Edit
        </span>
        <span className="text-xs text-zinc-500 font-mono truncate">{filePath}</span>
        <span className="flex-1" />
        {expanded ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>
      {expanded && output && (
        <div className="border-t border-zinc-800 p-3 font-mono text-[11px] overflow-x-auto max-h-[200px] overflow-y-auto">
          {lines.map((line, i) => {
            if (line.startsWith('+')) {
              return <div key={i} className="bg-green-500/10 text-green-400">{line}</div>;
            }
            if (line.startsWith('-')) {
              return <div key={i} className="bg-red-500/10 text-red-400">{line}</div>;
            }
            return <div key={i} className="text-zinc-500">{line}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function SearchBlock({ part, result }: ToolCallPartProps) {
  const output = result?.output || '';
  const toolName = part.toolName.charAt(0).toUpperCase() + part.toolName.slice(1).toLowerCase();
  const color = getToolColor(part.toolName);
  const lines = output.split('\n').filter(Boolean);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden" style={{ backgroundColor: '#0b0b08' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <StatusIcon state={part.state} />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {toolName}
        </span>
        <span className="text-[10px] text-zinc-600">
          {lines.length} result{lines.length !== 1 ? 's' : ''}
        </span>
      </div>
      {lines.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-400 max-h-[150px] overflow-y-auto">
          {lines.slice(0, 20).map((line, i) => (
            <div key={i} className="truncate">{line}</div>
          ))}
          {lines.length > 20 && (
            <div className="text-zinc-600 mt-1">... and {lines.length - 20} more</div>
          )}
        </div>
      )}
    </div>
  );
}

function DefaultBlock({ part, result }: ToolCallPartProps) {
  const [expanded, setExpanded] = useState(false);
  const output = result?.output || '';
  const color = getToolColor(part.toolName);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden" style={{ backgroundColor: '#0b0b08' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <StatusIcon state={part.state} />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {part.toolName}
        </span>
        <span className="flex-1" />
        {result?.durationMs != null && (
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock size={9} />
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {expanded ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>
      {expanded && output && (
        <div className="border-t border-zinc-800">
          <pre className="text-[11px] text-zinc-400 p-3 font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ToolCallPartRenderer({ part, result }: ToolCallPartProps) {
  const lower = part.toolName.toLowerCase();

  if (lower === 'bash') return <BashBlock part={part} result={result} />;
  if (lower === 'read') return <ReadBlock part={part} result={result} />;
  if (lower === 'edit') return <EditBlock part={part} result={result} />;
  if (lower === 'grep' || lower === 'glob') return <SearchBlock part={part} result={result} />;

  return <DefaultBlock part={part} result={result} />;
}
