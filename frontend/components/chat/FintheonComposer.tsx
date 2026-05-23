// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-04-11] S14-T5: Headline attachment via HeadlinePickerPopover + context injection
// [claude-code 2026-03-22] Track 4: persona pills and split tools replaced by the composer toolbox
// [claude-code 2026-04-21] Post-S35: removed relay dispatch; added Cmd+K palette, ↑↓ history,
//   persona slash commands
// [claude-code 2026-05-06] S60-T3: provider modal and toolbox wired to composer toolbar
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useThread, useThreadRuntime } from "@assistant-ui/react";
import { Plug, ServerCog } from "lucide-react";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { SKILL_PREFIXES } from "../../lib/skillPrefixes";
import { SKILLS } from "../../lib/skills";
import { useVoice } from "../../contexts/VoiceContext";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { useHarperProvider } from "./ProviderDropdown";
import { FintheonProviderModal } from "./FintheonProviderModal";
import { FintheonToolboxModal } from "./FintheonToolboxModal";
import { CommandPalette } from "./CommandPalette";
import { API_BASE_URL } from "./constants";
import type { ReasoningLevel } from "./reasoning";
import {
  formatHeadlineContext,
  type HeadlineChip,
} from "./HeadlinePickerPopover";

/* ------------------------------------------------------------------ */
/*  Persona slash-command map                                         */
/* ------------------------------------------------------------------ */

const PERSONA_COMMANDS: Record<string, string> = {
  oracle: "oracle",
  feucht: "feucht",
  consul: "consul",
  herald: "herald",
  harper: "harper",
};

const PROVIDER_LABELS: Record<string, string> = {
  "deepseek-direct": "DeepSeek",
  "opencode-go": "OpenCode",
};

/* ------------------------------------------------------------------ */
/*  FintheonComposer                                                   */
/* ------------------------------------------------------------------ */

interface FintheonComposerProps {
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  showSkills: boolean;
  onToggleSkills: () => void;
  lastError: string | null;
  disabledSkills?: Record<string, { reason: string }>;
  compact?: boolean;
  /** @deprecated S38-T1: Dispatch removed — kept for backwards compat */
  conversationId?: string;
  /** @deprecated S38-T1: Dispatch removed — kept for backwards compat */
  onConversationGone?: () => void;
  todoSlot?: ReactNode;
  reasoningLevel?: ReasoningLevel;
  onReasoningLevelChange?: (level: ReasoningLevel) => void;
  onQueueMessage?: (text: string) => void;
  queueCount?: number;
  onMessageSubmitted?: () => void;
}

export function FintheonComposer({
  thinkHarder,
  setThinkHarder,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  lastError,
  disabledSkills: propDisabledSkills,
  compact,
  conversationId: _conversationId,
  onConversationGone: _onConversationGone,
  todoSlot,
  reasoningLevel,
  onReasoningLevelChange,
  onQueueMessage,
  queueCount = 0,
  onMessageSubmitted,
}: FintheonComposerProps) {
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const messages = useThread((t) => t.messages);
  const [apiDisabledSkills, setApiDisabledSkills] = useState<
    Record<string, { reason: string }>
  >({});
  const voice = useVoice();
  const { activeAgent, agents, setActiveAgent } = useFintheonAgents();
  const { alerts } = useRiskFlow();
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const { provider, setProvider } = useHarperProvider();
  const [headlineChips, setHeadlineChips] = useState<HeadlineChip[]>([]);

  // ── Modal state (S60-T3) ──────────────────────────────────────────────
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showToolboxModal, setShowToolboxModal] = useState(false);

  // ── Command palette (Cmd+K) ────────────────────────────────────────────
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Message history navigation (↑↓) ──────────────────────────────────
  const historyIndexRef = useRef(-1);
  const [recallText, setRecallText] = useState<string | null>(null);

  const getUserMessages = useCallback(() => {
    return messages.filter((m: any) => m.role === "user");
  }, [messages]);

  const handleHistoryUp = useCallback(() => {
    const userMsgs = getUserMessages();
    if (userMsgs.length === 0) return;
    const nextIdx =
      historyIndexRef.current < userMsgs.length - 1
        ? historyIndexRef.current + 1
        : historyIndexRef.current;
    historyIndexRef.current = nextIdx;
    const msg = userMsgs[userMsgs.length - 1 - nextIdx];
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("")
          : "";
    setRecallText(text);
  }, [getUserMessages]);

  const handleHistoryDown = useCallback(() => {
    const userMsgs = getUserMessages();
    if (historyIndexRef.current <= 0) {
      historyIndexRef.current = -1;
      setRecallText("");
      return;
    }
    historyIndexRef.current -= 1;
    const msg = userMsgs[userMsgs.length - 1 - historyIndexRef.current];
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("")
          : "";
    setRecallText(text);
  }, [getUserMessages]);

  const handleHistoryEscape = useCallback(() => {
    historyIndexRef.current = -1;
    setRecallText("");
  }, []);

  // Reset history index when new messages arrive
  useEffect(() => {
    historyIndexRef.current = -1;
  }, [messages.length]);

  // ── Headline attachment ───────────────────────────────────────────────
  const handleHeadlineToggle = useCallback((chip: HeadlineChip) => {
    setHeadlineChips((prev) => {
      const exists = prev.find((c) => c.id === chip.id);
      if (exists) return prev.filter((c) => c.id !== chip.id);
      return [...prev, chip];
    });
  }, []);

  const handleHeadlineClear = useCallback(() => {
    setHeadlineChips([]);
  }, []);

  // ── Fetch skills from backend ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ai/skills`);
        if (!res.ok) return;
        const data = await res.json();
        const disabled: Record<string, { reason: string }> = {};
        for (const skill of data.skills ?? []) {
          if (!skill.enabled) {
            disabled[skill.id] = { reason: skill.reason ?? "Disabled" };
          }
        }
        if (!cancelled) setApiDisabledSkills(disabled);
      } catch {
        // Skills endpoint not available — use prop defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedDisabledSkills = { ...apiDisabledSkills, ...propDisabledSkills };

  // ── Send handler (with persona slash-command detection) ────────────────
  const handleSend = useCallback(
    (msg: string, images?: string[]) => {
      let finalText = msg;

      // Detect persona slash commands (set persona for next turn only)
      const personaMatch = msg.match(/^\/(\w+)/);
      if (personaMatch && PERSONA_COMMANDS[personaMatch[1]]) {
        const personaId = PERSONA_COMMANDS[personaMatch[1]];
        const agent = agents.find((a) => a.id === personaId);
        if (agent) {
          setActiveAgent(agent);
        }
        // Strip the slash command from the message
        finalText = msg.replace(/^\/\w+\s*/, "");
        if (!finalText.trim() && images?.length === 0) {
          // Pure persona switch — don't send an empty message
          onSelectSkill(null);
          return;
        }
      }

      // Detect /stop
      if (msg.trim() === "/stop") {
        runtime.cancelRun();
        onSelectSkill(null);
        return;
      }

      if (activeSkill && SKILL_PREFIXES[activeSkill]) {
        finalText = SKILL_PREFIXES[activeSkill] + "\n\n" + finalText;
      }
      // Inject attached headline context
      if (headlineChips.length > 0) {
        finalText += formatHeadlineContext(headlineChips);
        setHeadlineChips([]);
      }
      // Auto-activate MCP servers required by the active skill
      if (activeSkill) {
        const skillDef = SKILLS.find((s) => s.id === activeSkill);
        if (skillDef?.mcpServers?.length) {
          try {
            const current: string[] = JSON.parse(
              localStorage.getItem("fintheon:mcp-active-connectors") ?? "[]",
            );
            const merged = [...new Set([...current, ...skillDef.mcpServers])];
            localStorage.setItem(
              "fintheon:mcp-active-connectors",
              JSON.stringify(merged),
            );
          } catch {
            /* ignore */
          }
        }
      }

      if (isRunning && onQueueMessage) {
        onQueueMessage(finalText);
        onMessageSubmitted?.();
        onSelectSkill(null);
        return;
      }

      const content: Array<{ type: string; text?: string; image?: string }> = [
        { type: "text", text: finalText },
      ];
      if (images?.length) {
        images.forEach((img) => content.push({ type: "image", image: img }));
      }

      try {
        onMessageSubmitted?.();
        runtime.append({ role: "user", content: content as any });
        onSelectSkill(null);
      } catch (err) {
        console.error("[FintheonComposer] Failed to append message:", err);
      }
    },
    [
      runtime,
      activeSkill,
      onSelectSkill,
      headlineChips,
      agents,
      setActiveAgent,
      isRunning,
      onQueueMessage,
      onMessageSubmitted,
    ],
  );

  const handleStop = useCallback(() => {
    runtime.cancelRun();
  }, [runtime]);

  // ── Toolbar slots (S60-T3: modal triggers) ──────────────────────────────
  const currentProvider = PROVIDER_LABELS[provider] ?? "Provider";
  const providerEl = (
    <button
      onClick={() => setShowProviderModal(true)}
      className={`flex items-center gap-1.5 rounded-lg transition-colors hover:bg-[var(--fintheon-accent)]/10 ${
        compact ? "px-1.5" : "px-2"
      }`}
      style={{
        color: "#f0ead6",
        height: "28px",
      }}
      title={`Provider: ${currentProvider}`}
    >
      <ServerCog size={14} className="text-[var(--fintheon-accent)]/70" />
      {!compact && (
        <span
          style={{
            fontSize: "11px",
            color: "rgba(240, 234, 214, 0.8)",
          }}
        >
          {currentProvider}
        </span>
      )}
    </button>
  );
  // Persona selector removed from the composer; slash commands still work.
  const personaEl = undefined;

  // Unified Skills + Connectors trigger
  const activeMcpCount = activeIds.length;
  const toolboxEl = compact ? undefined : (
    <button
      onClick={() => setShowToolboxModal((open) => !open)}
      className="relative flex items-center justify-center rounded-lg transition-colors text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
      style={{ width: "32px", height: "32px" }}
      title="Skills and connectors"
    >
      <Plug size={14} />
      {(activeMcpCount > 0 || activeSkill) && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--fintheon-accent)]" />
      )}
    </button>
  );

  const estimatedTokens = Math.ceil(
    messages
      .map((m: any) => {
        const parts = m.parts ?? m.content ?? [];
        if (typeof parts === "string") return parts;
        if (!Array.isArray(parts)) return "";
        return parts
          .filter((part: any) => part.type === "text" && part.text)
          .map((part: any) => part.text)
          .join("\n");
      })
      .join("\n").length / 4,
  );
  const activeSkillLabel =
    SKILLS.find((skill) => skill.id === activeSkill)?.label ?? null;

  return (
    <>
      {/* Command palette (Cmd+K) */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onSelectSkill={onSelectSkill}
          onStop={handleStop}
          agents={agents}
          onSwitchAgent={(agent) => setActiveAgent(agent)}
        />
      )}

      <FintheonToolboxModal
        open={showToolboxModal}
        onClose={() => setShowToolboxModal(false)}
        skills={SKILLS}
        activeSkill={activeSkill}
        onSelectSkill={onSelectSkill}
        disabledSkills={mergedDisabledSkills}
        servers={servers}
        activeIds={activeIds}
        onToggleConnector={toggleConnector}
      />

      <PromptBox
        onSend={handleSend}
        onStop={handleStop}
        isProcessing={isRunning}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        reasoningLevel={reasoningLevel}
        onReasoningLevelChange={onReasoningLevelChange}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={onSelectSkill}
        showSkills={showSkills}
        onToggleSkills={onToggleSkills}
        disabledSkills={mergedDisabledSkills}
        compact={compact}
        voiceEnabled={voice.enabled}
        voiceState={voice.runtimeState}
        onToggleVoice={voice.toggleEnabled}
        providerSlot={providerEl}
        personaSlot={personaEl}
        mcpSlot={toolboxEl}
        toolboxOpen={showToolboxModal}
        onInputActivity={() => setShowToolboxModal(false)}
        todoSlot={todoSlot}
        queueCount={queueCount}
        contextStats={{
          messageCount: messages.length,
          estimatedTokens,
          connectorCount: activeIds.length,
          activeSkillLabel,
        }}
        recallText={recallText}
        onRecallConsumed={() => setRecallText(null)}
        onHistoryUp={handleHistoryUp}
        onHistoryDown={handleHistoryDown}
        onHistoryEscape={handleHistoryEscape}
        headlineAlerts={alerts}
        headlineChips={headlineChips}
        onHeadlineToggle={handleHeadlineToggle}
        onHeadlineClear={handleHeadlineClear}
      />

      {/* S60-T3: Modal ecosystem */}
      <FintheonProviderModal
        open={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        provider={provider}
        onChange={setProvider}
      />
    </>
  );
}
