// [claude-code 2026-03-06] Scrollable message list — extracted from ChatInterface
import { useRef, useEffect } from 'react';
import type { ChatMessage } from './types';
import { ChatGreeting } from './ChatGreeting';
import { ChatMessageBubble } from './ChatMessageBubble';
import { PulseThinkingIndicator } from './PulseThinkingIndicator';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  latestThinkingContent?: string;
  agentName?: string;
  showGreeting: boolean;
  onSend: (msg: string) => void;
  onCheckpoint: (messageId: string, content: string) => void;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function ChatMessageList({
  messages,
  isLoading,
  latestThinkingContent,
  agentName,
  showGreeting,
  onSend,
  onCheckpoint,
  messageRefs,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-6 pb-8">
      <div className="max-w-3xl mx-auto space-y-4 mb-8">
        {showGreeting && messages.length === 0 && (
          <ChatGreeting onSend={onSend} isLoading={isLoading} />
        )}

        {messages.map((message, idx) => {
          const isLastAssistant =
            message.role === 'assistant' && idx === messages.length - 1;
          return (
            <ChatMessageBubble
              key={message.id}
              ref={(el) => { messageRefs.current[message.id] = el; }}
              message={message}
              isStreaming={isLastAssistant && isLoading}
              onCheckpoint={onCheckpoint}
            />
          );
        })}

        {(isLoading || !!latestThinkingContent) && (
          <div className="flex justify-start items-center">
            <PulseThinkingIndicator
              isThinking
              thinkingContent={latestThinkingContent}
              agentName={agentName}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
