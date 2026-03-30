import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { InterventionMessage } from '../lib/services';
import { KNOWN_AGENTS, useFintheonAgents } from '../contexts/FintheonAgentContext';
import { FintheonChatInput } from './chat/FintheonChatInput';

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseMention(text: string): { agent: string; body: string } | null {
  const match = text.match(/^@(\w+)\s+([\s\S]+)/);
  if (!match) return null;
  const [, raw, body] = match;
  const agent = KNOWN_AGENTS.find((a) => a.toLowerCase() === raw.toLowerCase());
  return agent ? { agent, body: body.trim() } : null;
}

interface InterventionSidebarProps {
  messages: InterventionMessage[];
  sending: boolean;
  onSend: (message: string) => Promise<void>;
  onMention?: (message: string, agent: string) => Promise<void>;
  active: boolean;
}

export function InterventionSidebar({ messages, sending, onSend, onMention, active }: InterventionSidebarProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [thinkHarder, setThinkHarder] = useState(false);
  const { activeAgent } = useFintheonAgents();

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    try {
      const mention = parseMention(trimmed);
      if (mention && onMention) {
        // @mention detected — route to boardroom thread targeting the specific agent
        await onMention(mention.body, mention.agent);
      } else if (activeAgent && activeAgent.name !== 'Harper' && onMention) {
        // Agent selector is set to a non-Harper agent — route as a mention to the boardroom
        await onMention(trimmed, activeAgent.name);
      } else {
        // Default: route to intervention (Harper)
        await onSend(trimmed);
      }
    } catch {
      // error handled upstream
    }
  }, [sending, onSend, onMention, activeAgent]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#070704]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            <p className="text-sm font-semibold text-white">{activeAgent?.name || 'Harper'}</p>
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center"
              >
                <svg width="13" height="13" viewBox="0 0 60 60" fill="none"><path d="M37.4 10.2L32.2 24.5H21.8L16.6 10.2C15.5 7.2 17.6 4 20.7 4h18.6c3.1 0 5.2 3.2 4.1 6.2zM21.8 24.5L9.2 56.5c-1 2.6-4.4 3-5.8.8L0 52l21.8-27.5zm16.4 0L50.8 56.5c1 2.6 4.4 3 5.8.8L60 52 38.2 24.5z" fill="#D97757"/></svg>
              </div>
              <span className="text-[11px] font-medium" style={{ color: '#D97757' }}>Claude Opus 4.6</span>
            </div>
            <span className="text-[10px] text-gray-500 mt-1">
              Pick an agent below, or type @AgentName
            </span>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.sender === 'User';
            return (
              <div key={m.id} className={`group/msg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    isUser
                      ? 'fintheon-user-bubble text-white'
                      : 'bg-[#0f0f0b]/92 border border-white/10 text-zinc-300'
                  }`}
                >
                  <div className="text-sm prose prose-invert prose-sm max-w-none break-words">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-700 mt-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity tabular-nums">
                  {formatTimestamp(m.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — FintheonChatInput with agent selector */}
      <div className="p-3">
        <FintheonChatInput
          onSend={(msg) => handleSend(msg)}
          isProcessing={sending}
          thinkHarder={thinkHarder}
          setThinkHarder={setThinkHarder}
          placeholder={
            activeAgent && activeAgent.name !== 'Harper'
              ? `Call ${activeAgent.name} to the floor...`
              : 'Message Harper...'
          }
          draftKey="fintheon:draft-intervention"
        />
      </div>
    </div>
  );
}
