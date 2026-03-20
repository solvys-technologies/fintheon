export interface ExtractedChatContent {
  text: string;
  reasoning: string;
}

export function extractChatTextAndReasoning(message: any): ExtractedChatContent {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const textFromParts = parts
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => part?.text ?? '')
    .join('');
  const reasoningFromParts = parts
    .filter((part: any) => part?.type === 'reasoning')
    .map((part: any) => part?.text ?? '')
    .join('');

  const fallbackText = typeof message?.content === 'string'
    ? message.content
    : typeof message?.text === 'string'
      ? message.text
      : '';

  return {
    text: String(textFromParts || fallbackText || ''),
    reasoning: String(reasoningFromParts || ''),
  };
}

// Part-aware normalization (21st SDK pattern)
import type { MessagePart, ChatMessage } from '../components/chat/types';

export function extractMessageParts(msg: any): MessagePart[] {
  const parts: MessagePart[] = [];
  if (msg.parts && Array.isArray(msg.parts)) {
    for (const p of msg.parts) {
      switch (p.type) {
        case 'text':
          if (p.text?.trim()) parts.push({ type: 'text', text: p.text });
          break;
        case 'reasoning':
          if (p.text?.trim()) parts.push({ type: 'reasoning', text: p.text });
          break;
        case 'tool-invocation':
          parts.push({
            type: 'tool-invocation',
            toolName: p.toolName || p.toolCallId || 'unknown',
            args: p.args || {},
            state: p.state || 'done',
            id: p.toolCallId || p.id || crypto.randomUUID(),
          });
          break;
        case 'tool-result':
          parts.push({
            type: 'tool-result',
            toolInvocationId: p.toolCallId || p.id || '',
            output: typeof p.result === 'string' ? p.result : JSON.stringify(p.result ?? ''),
            exitCode: p.exitCode,
            durationMs: p.durationMs,
          });
          break;
      }
    }
  }
  if (parts.length === 0) {
    const text = msg.content || msg.text || '';
    if (text.trim()) parts.push({ type: 'text', text });
  }
  return parts;
}

export function normalizeToParts(messages: any[]): ChatMessage[] {
  return (messages || [])
    .filter((msg: any) => msg.role !== 'system')
    .map((msg: any) => ({
      id: String(msg.id),
      role: msg.role as 'user' | 'assistant',
      parts: extractMessageParts(msg),
      createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      cancelled: Boolean(msg.cancelled),
    }));
}

export function normalizeChatMessages(messages: any[]): Array<{
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning: string;
}> {
  return (messages || [])
    .filter((m: any) => m?.role !== 'system')
    .map((m: any) => {
      const extracted = extractChatTextAndReasoning(m);
      return {
        id: String(m?.id ?? ''),
        role: m?.role === 'user' ? 'user' : 'assistant',
        text: extracted.text,
        reasoning: extracted.reasoning,
      };
    });
}
