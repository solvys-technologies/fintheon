// [claude-code 2026-03-19] Individual message bubble for Consilium agent discussion panel — onClick + special prefix rendering
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
  onClick?: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ConsiliumMessage({ message, onClick }: ConsiliumMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const isHuddle = message.content.startsWith('[HUDDLE TRIGGERED]');
  const isBriefing = message.content.startsWith('[PRE-MARKET BRIEF]') || message.content.startsWith('[POST-MARKET BRIEF]');
  const isStandup = message.content.startsWith('[STANDUP]');

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="rounded-full border border-[#c79f4a]/10 bg-[#c79f4a]/5 px-4 py-1.5">
          <span className="text-xs text-[#c79f4a]/50">{message.content}</span>
        </div>
      </div>
    );
  }

  const borderClass = isHuddle
    ? 'border-[#c79f4a]/40'
    : isUser
      ? 'border-[#c79f4a]/30'
      : 'border-[#c79f4a]/15';

  const maxWidth = isBriefing ? 'max-w-[90%]' : 'max-w-[75%]';

  return (
    <div
      className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-[#c79f4a]/[0.03] cursor-pointer ${isUser ? 'flex-row-reverse' : ''}`}
      onClick={onClick}
    >
      {!isUser && <AgentBadge agent={message.agent} size="sm" />}
      <div className={`flex ${maxWidth} flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {isHuddle && (
          <span className="rounded-full border border-[#c79f4a]/30 bg-[#c79f4a]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c79f4a]">
            Huddle
          </span>
        )}
        {isBriefing && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-400/80">
            {message.content.startsWith('[PRE-MARKET') ? 'Pre-Market Brief' : 'Post-Market Brief'}
          </span>
        )}
        <div
          className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${borderClass} ${
            isUser
              ? 'bg-[#c79f4a]/10 text-[#f0ead6]'
              : 'bg-[#050402] text-[#f0ead6]/90'
          }`}
        >
          <p className={`whitespace-pre-wrap break-words ${isStandup ? 'italic' : ''}`}>{message.content}</p>
        </div>
        <span className="px-1 text-[10px] text-[#f0ead6]/25 opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
