// [claude-code 2026-03-19] Individual message bubble for Consilium agent discussion panel
import { AgentBadge, type BoardroomAgent } from './AgentBadge';

export interface BoardroomMessage {
  id: string;
  agent: BoardroomAgent;
  emoji: string;
  content: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
}

interface ConsiliumMessageProps {
  message: BoardroomMessage;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ConsiliumMessage({ message }: ConsiliumMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="rounded-full border border-[#c79f4a]/10 bg-[#c79f4a]/5 px-4 py-1.5">
          <span className="text-xs text-[#c79f4a]/50">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-[#c79f4a]/[0.03] ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <AgentBadge agent={message.agent} size="sm" />}
      <div className={`flex max-w-[75%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'border-[#c79f4a]/30 bg-[#c79f4a]/10 text-[#f0ead6]'
              : 'border-[#c79f4a]/15 bg-[#050402] text-[#f0ead6]/90'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="px-1 text-[10px] text-[#f0ead6]/25 opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
