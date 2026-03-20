import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Paperclip, Image, FileText, Link2, AlertTriangle, TrendingUp, History, X, Pin, Archive, Edit2, MoreVertical, ChevronDown } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useBackend } from "../lib/backend";
import { healingBowlPlayer } from "../utils/healingBowlSounds";
import { useSettings } from "../contexts/SettingsContext";
import { usePsych } from "../contexts/PsychContext";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface TiltWarning {
  detected: boolean;
  score?: number;
  message?: string;
}

const SUGGESTION_CHIPS = [
  { label: "Run the NTN report", prompt: "Run the NTN report" },
  { label: "Give me the Tale of the Tape (Weekly Summary)", prompt: "Give me the Tale of the Tape (Weekly Summary)" },
  { label: "Let's do a psych eval", prompt: "Let's do a psych eval" },
  { label: "How's my ER this week?", prompt: "How's my ER this week?" },
  { label: "Update my Blindspots", prompt: "Update my Blindspots" },
];

// AI Model Configuration with reasoning level categories
// Grok 4.1 is primary for chat (fast + real-time), Llama fallback
const AI_MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', level: 'Complex Reasoning', description: 'Best for deep analysis' },
  { id: 'grok-4.1', name: 'Grok 4.1', level: 'Fast Reasoning', description: 'X.AI - Speed optimized, real-time' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet', level: 'Moderate Reasoning', description: 'Balanced performance' },
  { id: 'openrouter-opus', name: 'Claude Opus 4.6', level: 'Default', description: 'OpenRouter (Nous subscription)' },
] as const;

const THINKING_TERMS = [
  "finagling",
  "polagaling",
  "doodling",
  "tinkering",
  "pondering",
  "mulling",
  "ruminating",
  "contemplating",
  "considering",
  "weighing",
  "deliberating",
  "reflecting",
  "analyzing",
  "assessing",
  "evaluating",
  "bullish momentum",
  "uptrend confirmation",
  "breakout potential",
  "accumulation phase",
  "support holding",
  "resistance breaking",
  "volume expansion",
  "liquidity building",
  "risk-on sentiment",
  "fundamental strength",
  "earnings beat",
  "guidance raise",
  "positive catalyst",
  "momentum building",
];

interface ConversationSession {
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
  staleAt?: string | null;
}

export default function ChatInterface() {
  const backend = useBackend();
  const { alertConfig } = useSettings();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { orientationRequired, openOrientationModal } = usePsych();
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [thinkingText, setThinkingText] = useState("");
  const [tiltWarning, setTiltWarning] = useState<TiltWarning | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local input state for textarea
  const [input, setInput] = useState("");

  // Model selector state - default to Grok 4.1 for fast reasoning
  const [selectedModel, setSelectedModel] = useState<string>('grok-4.1');
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Admin detection (hidden tier - not visible to regular users)
  const isAdmin = user?.publicMetadata?.role === 'admin';

  // Custom fetch function for useChat with auth
  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = await getToken({ template: 'neon' });
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // If URL is relative, prepend API_BASE_URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add conversationId to body if available
    let body = init?.body;
    if (body && conversationId) {
      try {
        const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
        if (typeof bodyObj === 'object' && bodyObj !== null) {
          bodyObj.conversationId = conversationId;
          body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const response = await fetch(fullUrl, {
      ...init,
      headers: headers as HeadersInit,
      body,
    });

    // Extract conversationId from response headers
    const convId = response.headers.get('X-Conversation-Id');
    if (convId) {
      setConversationId(convId);
    }

    return response;
  }, [getToken, conversationId]);

  // Track loading state manually
  const [isStreaming, setIsStreaming] = useState(false);

  // Use useChat hook for streaming chat (per video best practices)
  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_BASE_URL}/api/ai/chat`,
      fetch: fetchWithAuth,
    }),
    onFinish: (message) => {
      setIsStreaming(false);
      console.log('Message finished:', message);
    },
    onError: (error) => {
      setIsStreaming(false);
      console.error('Chat error:', error);
    },
  });

  const isLoading = isStreaming || status === 'streaming' || status === 'submitted';

  // Convert useChat messages to our Message format for display
  const messages: Message[] = useChatMessages
    .filter((msg) => msg.role !== 'system') // Filter out system messages
    .map((msg) => {
      // Extract text content from parts array
      const textParts = msg.parts
        ?.filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('') || '';

      return {
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: textParts,
        timestamp: new Date(),
      };
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea when input changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Sync input with textarea value for useChat
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = input;
    }
  }, [input]);

  // Sync healing bowl player with user's selected sound
  useEffect(() => {
    healingBowlPlayer.setSound(alertConfig.healingBowlSound);
  }, [alertConfig.healingBowlSound]);

  // Animate thinking text - 2-3 seconds between words for faster feedback
  useEffect(() => {
    if (!isLoading) {
      setThinkingText("");
      return;
    }

    let currentIndex = 0;
    setThinkingText(THINKING_TERMS[0]);
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % THINKING_TERMS.length;
      setThinkingText(THINKING_TERMS[currentIndex]);
    }, 2500); // 2.5 seconds between words

    return () => clearInterval(interval);
  }, [isLoading]);

  // Hide suggestions once user sends a message
  useEffect(() => {
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (hasUserMessages) {
      setShowSuggestions(false);
    }
  }, [messages]);

  // Load conversation history with ER status and P&L
  const loadConversationHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await backend.ai.listConversations();
      // Enrich with ER status and P&L data
      const conversations = Array.isArray(response) ? response : [];
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv: any) => {
          const convDate = new Date(conv.updatedAt);
          const staleAt = (conv as any).staleAt || (conv as any).stale_at || null;
          const isStale = staleAt ? new Date(staleAt).getTime() <= Date.now() : false;

          // Try to get ER status and P&L for this session
          let erStatus: "Stable" | "Tilt" | "Neutral" | undefined;
          let pnl: number | undefined;

          try {
            // Get ER sessions for the day of this conversation
            const erSessions = await backend.er.getERSessions();
            const convDay = new Date(conv.updatedAt).toDateString();
            const sessions = Array.isArray(erSessions) ? erSessions : [];
            const sessionForDay = sessions.find(
              (s: any) => new Date(s.sessionStart).toDateString() === convDay
            );

            if (sessionForDay) {
              erStatus = sessionForDay.finalScore > 0.5 ? "Stable" : sessionForDay.finalScore < -0.5 ? "Tilt" : "Neutral";
            }

            // Get P&L for the day
            const account = await backend.account.get();
            // For now, we'll use daily_pnl as a proxy - in production, you'd want session-specific P&L
            pnl = account.dailyPnl;
          } catch (error) {
            // Silently fail - these are optional enrichments
          }

          return {
            ...conv,
            erStatus,
            pnl,
            isStale,
            staleAt,
            isArchived: false, // Default values - would be loaded from backend
            isPinned: false,
            customName: undefined,
          };
        })
      );
      setConversations(enrichedConversations);
    } catch (error) {
      console.error("Failed to load conversation history:", error);
      setConversations([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleArchiveConversation = (convId: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, isArchived: !c.isArchived } : c
    ));
  };

  const handlePinConversation = (convId: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, isPinned: !c.isPinned } : c
    ));
  };

  const handleRenameConversation = (convId: string, newName: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, customName: newName } : c
    ));
    setEditingConversationId(null);
    setRenameValue("");
  };

  const formatSessionTime = (date: Date) => {
    // Calculate total time PsychAssist was used for the day
    // For now, we'll use a placeholder - in production, calculate from session data
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Load a specific conversation
  const loadConversation = async (convId: string) => {
    // Check if conversation is stale
    const conv = conversations.find(c => c.conversationId === convId);
    if (conv?.isStale) {
      alert("This chat thread has gone stale after 24 hours. You can view it, but cannot send new messages. Start a new chat to continue the conversation.");
      // Still load it for viewing
    }

    setShowHistory(false);
    try {
      const response = await backend.ai.getConversation({ conversationId: convId });
      const staleAt = response.conversation?.staleAt || response.conversation?.stale_at;
      if (staleAt && new Date(staleAt).getTime() <= Date.now()) {
        alert("This chat thread has gone stale after 24 hours. You can view it, but cannot send new messages. Start a new chat to continue the conversation.");
      }
      // Convert backend messages to useChat format
      const loadedMessages = (response.messages || []).map((msg: any, idx: number) => ({
        id: `${convId}-${idx}`,
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setUseChatMessages(loadedMessages);
      setConversationId(convId);
      setShowSuggestions(false);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // Load history when component mounts
  useEffect(() => {
    loadConversationHistory();
  }, []);

  const handleSend = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    if (orientationRequired) {
      openOrientationModal();
      return;
    }

    // Check if current conversation is stale
    if (conversationId) {
      const conv = conversations.find(c => c.conversationId === conversationId);
      if (conv?.isStale) {
        alert("This chat thread has gone stale after 24 hours. Please start a new chat to continue the conversation.");
        return;
      }
    }

    // Hide suggestions when user sends a message
    setShowSuggestions(false);
    setThinkingText(THINKING_TERMS[0]);
    setIsStreaming(true);

    // Send message using useChat's sendMessage
    sendMessage({ text: messageText });

    // Clear input if not a custom message
    if (!customMessage) {
      setInput("");
    }
  };

  const handleCheckTape = async () => {
    setShowSuggestions(false);
    sendMessage({ text: "Check the Tape" });
  };

  const handleDailyRecap = async () => {
    setShowSuggestions(false);
    sendMessage({ text: "Generate daily recap" });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with buttons - invisible/transparent */}
      <div className="bg-transparent">
        <div className="h-14 flex items-center justify-end px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSend("Run the NTN report")}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 disabled:opacity-50 rounded-lg text-[13px] text-zinc-300 hover:text-[#D4AF37] transition-all whitespace-nowrap"
            >
              Run NTN Report
            </button>
            <button
              onClick={() => {
                setUseChatMessages([]);
                setConversationId(undefined);
                setShowSuggestions(true);
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors"
            >
              New Chat
            </button>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  loadConversationHistory();
                }
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>
      </div>

      {orientationRequired && (
        <div className="bg-red-500/10 border-y border-red-500/30 px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <p className="text-sm text-red-200">
            Finish Psych Assist orientation before chatting with Price. This keeps memory aligned with your blind spots.
          </p>
          <button
            onClick={() => openOrientationModal()}
            className="px-3 py-1.5 text-xs font-semibold text-red-200 border border-red-400/50 rounded hover:bg-red-500/20 transition-colors"
          >
            Launch Orientation
          </button>
        </div>
      )}

      {/* Tilt Warning Banner */}
      {tiltWarning?.detected && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-500">
              Emotional Tilt Detected (Score: {((tiltWarning.score ?? 0) * 100).toFixed(0)}%)
            </p>
            <p className="text-xs text-orange-400/80">{tiltWarning.message}</p>
          </div>
        </div>
      )}

      {/* Conversation History Sidebar - Right side panel */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex justify-end">
          <div className="w-80 bg-[#0a0a00] border-l border-[#D4AF37]/20 flex flex-col">
            <div className="h-16 border-b border-[#D4AF37]/20 flex items-center justify-between px-4">
              <h2 className="text-lg font-semibold text-[#D4AF37]">Conversation History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-[#D4AF37]/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#D4AF37]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingHistory ? (
                <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8">No previous conversations</div>
              ) : (
                conversations
                  .sort((a, b) => {
                    // Sort: pinned first, then by date
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  })
                  .filter(c => !c.isArchived)
                  .map((conv) => {
                    const convDate = new Date(conv.updatedAt);
                    const isStale = conv.isStale || false;
                    const erStatus = conv.erStatus || "Neutral";
                    const pnl = conv.pnl || 0;
                    const erColor = erStatus === "Stable" ? "text-emerald-400" : erStatus === "Tilt" ? "text-red-500" : "text-zinc-400";
                    const pnlColor = pnl >= 0 ? "text-emerald-400" : "text-red-500";
                    const isEditing = editingConversationId === conv.conversationId;

                    return (
                      <div
                        key={conv.conversationId}
                        className={`group relative w-full p-3 bg-zinc-900/50 border ${isStale ? "border-zinc-700/50 opacity-60" : "border-zinc-800"
                          } hover:border-[#D4AF37]/40 hover:bg-zinc-900 rounded-lg transition-all ${isStale ? "cursor-not-allowed" : ""}`}
                      >
                        {isStale && (
                          <div className="text-xs text-amber-500 mb-2 font-medium">
                            ⚠️ Chat threads go stale after 24 hours
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="text-xs text-zinc-400 mb-1">
                              {convDate.toLocaleDateString()} {formatSessionTime(convDate)}
                            </div>
                            <div className="flex items-center gap-3 text-xs mb-1">
                              <span className={erColor}>
                                ER: {erStatus}
                              </span>
                              <span className={pnlColor}>
                                P&L: {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                              </span>
                            </div>
                            {conv.customName ? (
                              <div className="text-sm text-zinc-300 font-medium mb-1">{conv.customName}</div>
                            ) : (
                              conv.preview && (
                                <div className="text-sm text-zinc-300 truncate">{conv.preview}...</div>
                              )
                            )}
                            <div className="text-xs text-zinc-500">{conv.messageCount} messages</div>
                          </div>
                          {conv.isPinned && (
                            <Pin className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
                          )}
                        </div>
                        {!isStale && (
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePinConversation(conv.conversationId);
                              }}
                              className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
                              title={conv.isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin className={`w-3.5 h-3.5 ${conv.isPinned ? "text-[#D4AF37] fill-[#D4AF37]" : "text-zinc-400"}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConversationId(conv.conversationId);
                                setRenameValue(conv.customName || "");
                              }}
                              className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveConversation(conv.conversationId);
                              }}
                              className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameConversation(conv.conversationId, renameValue);
                                }
                                if (e.key === "Escape") {
                                  setEditingConversationId(null);
                                  setRenameValue("");
                                }
                              }}
                              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameConversation(conv.conversationId, renameValue)}
                              className="px-2 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded text-xs"
                            >
                              Save
                            </button>
                          </div>
                        )}
                        {!isStale && (
                          <button
                            onClick={() => loadConversation(conv.conversationId)}
                            className="absolute inset-0 w-full h-full opacity-0"
                          />
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-8">
        <div className="max-w-3xl mx-auto space-y-4 mb-8">
          {/* Suggestion Chips - shown in middle when no messages */}
          {showSuggestions && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-[#D4AF37] mb-3">The Name's Price. AI Price.</h3>
                <p className="text-base text-zinc-300 mb-2">
                  I'm Priced In's Risk Event Quant & Psych Specialist.
                </p>
                <p className="text-sm text-zinc-400">
                  Ask me anything about The Tape, The Markets, or yourself; I'm listening.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center w-full max-w-2xl">
                {SUGGESTION_CHIPS.map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(chip.prompt)}
                    disabled={isLoading || orientationRequired}
                    className="px-4 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 disabled:opacity-50 rounded-full text-sm text-zinc-300 hover:text-[#D4AF37] transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-xl p-4 backdrop-blur-md
                  ${message.role === "user"
                    ? "bg-[#D4AF37]/10 border border-[#D4AF37]/20"
                    : "bg-white/5 border border-white/10"
                  }
                `}
              >
                {message.role === "assistant" ? (
                  <div className="text-sm text-zinc-300 mb-2 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        u: ({ children }) => <u className="underline">{children}</u>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 mb-2 whitespace-pre-wrap">{message.content}</p>
                )}
                <span className="text-[9px] text-zinc-600 font-mono">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start items-center gap-3">
              {/* Radar pulsating graphic */}
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37]/40 animate-ping"></div>
                <div className="absolute inset-1 rounded-full border-2 border-[#D4AF37]/60 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-[#D4AF37]/20"></div>
              </div>
              <span className="text-sm text-[#D4AF37] font-medium">{thinkingText}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 pt-6 pb-4 px-4 bg-[#050500]/80 backdrop-blur-md">
        {/* Model Selector - Vercel AI SDK style */}
        <div className="w-full max-w-3xl mx-auto mb-3 flex items-center justify-start">
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-700 hover:border-zinc-600 rounded-lg text-xs text-zinc-400 hover:text-zinc-300 transition-all"
              type="button"
            >
              <span className="font-medium">{AI_MODELS.find(m => m.id === selectedModel)?.name || 'Claude Opus 4'}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-500">{AI_MODELS.find(m => m.id === selectedModel)?.level || 'Complex Reasoning'}</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>

            {showModelSelector && (
              <div className="absolute bottom-full left-0 mb-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl p-2 shadow-xl min-w-[280px] z-20">
                <div className="text-xs text-zinc-500 px-3 py-1.5 font-medium">Select Model</div>
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelSelector(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${selectedModel === model.id
                      ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-zinc-500">{model.description}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${model.level === 'Complex Reasoning' ? 'bg-purple-500/20 text-purple-400' :
                      model.level === 'Moderate Reasoning' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                      {model.level.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-3xl mx-auto flex gap-2 items-end">
          {/* Attachment button - side by side with input, aligned to bottom */}
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="relative flex items-center justify-center w-[42px] h-[42px] flex-shrink-0 hover:bg-white/10 rounded transition-colors z-10 self-end"
            type="button"
          >
            <Paperclip className="w-4 h-4 text-zinc-400 hover:text-[#D4AF37] transition-colors" />

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-xl min-w-[200px] z-10">
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#D4AF37]/10 rounded-lg transition-colors"
                >
                  <Image className="w-4 h-4" />
                  <span>Photo/Video</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#D4AF37]/10 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Document</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#D4AF37]/10 rounded-lg transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  <span>RiskFlow Item</span>
                </button>
              </div>
            )}
          </button>

          {/* Input box - multi-line textarea with paragraph styling */}
          <textarea
            id="chat-message-input"
            name="chat-message"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize textarea - grows on new lines
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Analyze your performance, the news, or the markets…."
            disabled={isLoading || orientationRequired}
            rows={1}
            className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] px-4 py-3 text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-[#D4AF37]/40 focus:shadow-[0_0_12px_rgba(255,192,56,0.1)] disabled:opacity-50 transition-all resize-none overflow-y-auto min-h-[42px] max-h-[200px] leading-relaxed"
          />

          {/* Send button - round with arrow, aligned to bottom */}
          <button
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
            disabled={!input.trim() || isLoading || orientationRequired}
            className="flex items-center justify-center w-[42px] h-[42px] flex-shrink-0 rounded-full bg-[#D4AF37] hover:bg-[#FFD060] disabled:bg-zinc-900 disabled:text-zinc-700 disabled:border disabled:border-zinc-800 transition-all self-end"
            type="button"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
