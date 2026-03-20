/**
 * Chat Types
 * Type definitions for chat interface
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface TiltWarning {
  detected: boolean;
  score?: number;
  message?: string;
}

// Part-aware message types (21st SDK pattern)
export interface TextPart { type: 'text'; text: string }
export interface ReasoningPart { type: 'reasoning'; text: string }
export interface ToolInvocationPart {
  type: 'tool-invocation'; toolName: string; args: Record<string, any>;
  state: 'pending' | 'running' | 'done' | 'error'; id: string;
}
export interface ToolResultPart {
  type: 'tool-result'; toolInvocationId: string; output: string;
  exitCode?: number; durationMs?: number;
}
export type MessagePart = TextPart | ReasoningPart | ToolInvocationPart | ToolResultPart;
export interface ChatMessage {
  id: string; role: 'user' | 'assistant'; parts: MessagePart[];
  createdAt: Date; cancelled?: boolean;
}

export interface ConversationSession {
  conversationId: string;
  updatedAt: Date;
  messageCount: number;
  preview: string;
  erStatus?: "Stable" | "Tilt" | "Neutral";
  pnl?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  customName?: string;
  isStale?: boolean; // Stale after 24 hours
}
