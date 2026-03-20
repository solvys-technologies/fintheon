// [claude-code 2026-03-13] Hermes migration: OpenClaw -> Hermes imports
// [claude-code 2026-03-11] T2d: refactored sidebar to rounded bubble style + FintheonChatInput
import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useHermesChat } from '../chat/hooks/useHermesChat';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { EmbeddedBrowserFrame } from '../layout/EmbeddedBrowserFrame';
import { toHermesAgentOverride } from '../../lib/hermesAgentRouting';
import { usePersistentHermesConversation } from '../../hooks/usePersistentHermesConversation';
import { FintheonThinkingIndicator } from '../chat/FintheonThinkingIndicator';
import { normalizeChatMessages } from '../../lib/chatMessageNormalizer';
import { useSettings } from '../../contexts/SettingsContext';
import { FintheonChatInput } from '../chat/FintheonChatInput';

export function ResearchDepartment() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thinkHarder, setThinkHarder] = useState(true);
  const { iframeUrls } = useSettings();
  const notionResearchUrl = iframeUrls.research || import.meta.env.VITE_NOTION_RESEARCH_URL || 'https://www.notion.so';

  let activeAgent: { name: string; icon: string } | null = null;
  try {
    const ctx = useFintheonAgents();
    activeAgent = ctx.activeAgent;
  } catch {
    // fallback
  }
  const agent = activeAgent || { name: 'Harper', icon: 'H' };
  const hermesAgentOverride = toHermesAgentOverride((activeAgent as any)?.id);
  const { conversationId, setConversationId } = usePersistentHermesConversation((activeAgent as any)?.id, 'research');
  const { messages, sendMessage, status, stop } = useHermesChat(conversationId, setConversationId as any, hermesAgentOverride);

  const uiMessages = useMemo(() => {
    return normalizeChatMessages(messages as any[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.text,
      reasoning: m.reasoning,
    }));
  }, [messages]);

  const isStreaming = status === 'streaming' || status === 'submitted';
  const latestThinkingContent = useMemo(() => {
    const lastUserIndex = uiMessages.map((m) => m.role).lastIndexOf('user');
    for (let i = uiMessages.length - 1; i >= 0; i--) {
      const message = uiMessages[i];
      if (message.role !== 'assistant') continue;
      if (i < lastUserIndex) return undefined;
      return message.reasoning?.trim() || undefined;
    }
    return undefined;
  }, [uiMessages]);

  const handleSend = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    await sendMessage(
      { text: msg },
      { body: { conversationId, agentOverride: hermesAgentOverride } }
    );
  }, [sendMessage, conversationId, hermesAgentOverride]);

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* Main area: full Notion iframe */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Toggle button when sidebar is closed */}
        {!sidebarOpen && (
          <div className="shrink-0 absolute top-2 right-3 z-10">
            <button
              onClick={() => setSidebarOpen(true)}
              className="backdrop-blur-md bg-black/20 rounded-lg p-1.5 text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors"
              title="Open Research Assistance"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Notion iframe — fills everything from edge to edge */}
        <div className="flex-1 min-h-0 w-full">
          <EmbeddedBrowserFrame
            title="Notion Research Department"
            src={notionResearchUrl}
            className="w-full h-full bg-white"
          />
        </div>
      </div>

      {/* Research Assistance sidebar — collapsible */}
      {sidebarOpen && (
        <div className="w-[340px] shrink-0 border-l border-[var(--fintheon-accent)]/15 bg-[#070704] flex flex-col">
          {/* Sidebar header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-[0.18em] uppercase">
              Research Assistance
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {uiMessages.length ? (
              uiMessages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`group/msg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                        isUser
                          ? 'pulse-user-bubble text-white'
                          : 'bg-[#0f0f0b]/92 border border-white/10 text-zinc-300'
                      }`}
                    >
                      {isUser ? (
                        <div className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</div>
                      ) : (
                        <div className="text-sm prose prose-invert prose-sm max-w-none break-words">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-700 mt-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity tabular-nums">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                <p className="text-sm font-semibold text-white">{agent.name}</p>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-[13px] h-[13px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#D97757' }}
                  >
                    <span style={{ fontSize: '6px', color: 'white', fontWeight: 800, lineHeight: 1 }}>A</span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: '#D97757' }}>Claude Opus 4.6</span>
                </div>
                <span className="text-[10px] text-gray-500 mt-1">
                  Ask about your research, or request a report.
                </span>
              </div>
            )}
            {isStreaming && (
              <FintheonThinkingIndicator
                isThinking
                thinkingContent={latestThinkingContent}
                agentName={agent.name}
              />
            )}
          </div>

          {/* Input — FintheonChatInput */}
          <div className="shrink-0 p-3">
            <FintheonChatInput
              onSend={(msg) => handleSend(msg)}
              onStop={() => stop()}
              isProcessing={isStreaming}
              thinkHarder={thinkHarder}
              setThinkHarder={setThinkHarder}
              placeholder={`Message ${agent.name}...`}
              draftKey="fintheon:draft-research"
            />
          </div>
        </div>
      )}
    </div>
  );
}
