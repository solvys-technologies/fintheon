// [claude-code 2026-03-19] Full-width message detail slide-over for Consilium
import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import type { BoardroomMessage } from './ConsiliumMessage';

interface ConsiliumMessageExpandedProps {
  message: BoardroomMessage | null;
  onClose: () => void;
}

const PREFIX_LABELS: Record<string, string> = {
  '[HUDDLE TRIGGERED]': 'HUDDLE',
  '[PRE-MARKET BRIEF]': 'PRE-MARKET BRIEF',
  '[POST-MARKET BRIEF]': 'POST-MARKET BRIEF',
  '[TRADE IDEA]': 'TRADE IDEA',
  '[STANDUP]': 'STANDUP',
};

function detectPrefix(content: string): string | null {
  for (const prefix of Object.keys(PREFIX_LABELS)) {
    if (content.startsWith(prefix)) return prefix;
  }
  return null;
}

function formatFullTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function ConsiliumMessageExpanded({ message, onClose }: ConsiliumMessageExpandedProps) {
  const [copied, setCopied] = useState(false);

  if (!message) return null;

  const prefix = detectPrefix(message.content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 right-0 top-0 flex w-[420px] flex-col border-l border-[#c79f4a]/20 bg-[#050402]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#c79f4a]/15 px-5 py-4">
          <div className="flex flex-col gap-1">
            <AgentBadge agent={message.agent} size="md" />
            <span className="text-[10px] text-[#f0ead6]/30">
              {formatFullTimestamp(message.timestamp)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#f0ead6]/40 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#f0ead6]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {prefix && (
            <span className="mb-3 inline-block rounded-full border border-[#c79f4a]/30 bg-[#c79f4a]/10 px-3 py-1 text-[10px] uppercase tracking-wider text-[#c79f4a]">
              {PREFIX_LABELS[prefix]}
            </span>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f0ead6]/90">
            {message.content}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-[#c79f4a]/15 px-5 py-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-full border border-[#c79f4a]/20 px-4 py-2 text-xs text-[#f0ead6]/60 transition-colors hover:border-[#c79f4a]/40 hover:text-[#f0ead6]"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
