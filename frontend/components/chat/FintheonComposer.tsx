// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-04-11] S14-T5: Headline attachment via HeadlinePickerPopover + context injection
// [claude-code 2026-03-22] Track 4: persona pills → PersonaDropdown, Plug2+Wrench → ToolsDropdown
// [claude-code 2026-04-21] Post-S35: removed relay dispatch; added Cmd+K palette, ↑↓ history,
//   persona slash commands, plan mode toggle
import { useEffect, useState, useCallback, useRef } from "react";
import { useThread, useThreadRuntime } from "@assistant-ui/react";
import { ClipboardList } from "lucide-react";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { SKILL_PREFIXES } from "../../lib/skillPrefixes";
import { SKILLS } from "../../lib/skills";
import { useVoice } from "../../contexts/VoiceContext";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { PersonaDropdown } from "./PersonaDropdown";
import { ToolsDropdown } from "./ToolsDropdown";
import { ProviderDropdown, useHarperProvider } from "./ProviderDropdown";
import { CommandPalette } from "./CommandPalette";
import { API_BASE_URL } from "./constants";
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

  // ── Plan mode ──────────────────────────────────────────────────────────
  const [planMode, setPlanMode] = useState(false);
  const [planTodos, setPlanTodos] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);

  const togglePlanMode = useCallback(() => {
    setPlanMode((v) => {
      if (v) {
        // Exiting plan mode — clear todos
        setPlanTodos([]);
      }
      return !v;
    });
  }, []);

  const handlePlanTodoToggle = useCallback((id: string) => {
    setPlanTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const handlePlanComplete = useCallback(() => {
    setPlanMode(false);
    setPlanTodos([]);
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

      // Detect /plan toggle
      if (msg.trim() === "/plan") {
        togglePlanMode();
        onSelectSkill(null);
        return;
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
      const content: Array<{ type: string; text?: string; image?: string }> = [
        { type: "text", text: finalText },
      ];
      if (images?.length) {
        images.forEach((img) => content.push({ type: "image", image: img }));
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

      try {
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
      togglePlanMode,
    ],
  );

  const handleStop = useCallback(() => {
    runtime.cancelRun();
  }, [runtime]);

  // ── Toolbar slots ─────────────────────────────────────────────────────
  const providerEl = (
    <ProviderDropdown
      provider={provider}
      onChange={setProvider}
      compact={compact}
    />
  );
  // Sidebar (compact) routes through CAO only — no persona selector
  const personaEl = compact ? undefined : <PersonaDropdown />;

  const toolsEl = (
    <ToolsDropdown
      skills={SKILLS}
      activeSkill={activeSkill}
      onSelectSkill={onSelectSkill}
      disabledSkills={mergedDisabledSkills}
      servers={servers}
      activeConnectorIds={activeIds}
      onToggleConnector={toggleConnector}
    />
  );

  // ── Plan mode button ──────────────────────────────────────────────────
  const planEl = (
    <button
      onClick={togglePlanMode}
      className={`flex items-center justify-center rounded-lg transition-colors ${
        planMode
          ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 hover:bg-[var(--fintheon-accent)]/20"
          : "text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
      }`}
      style={{ width: "32px", height: "32px" }}
      title={planMode ? "Exit Plan Mode" : "Plan Mode"}
    >
      <ClipboardList size={16} />
    </button>
  );

  // ── Plan mode input (shown above PromptBox when plan mode active) ─────
  const planModeInputEl = planMode ? (
    <div className="mb-3 rounded-lg border border-[var(--fintheon-accent)]/25 bg-[#0d0c09] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
          Plan Mode
        </span>
        <button
          onClick={handlePlanComplete}
          className="text-[11px] font-medium text-[var(--fintheon-accent)] hover:text-[#f0ead6] underline underline-offset-2 transition-colors"
        >
          Complete Plan
        </button>
      </div>
      {/* Inline to-dos */}
      {planTodos.length > 0 ? (
        <ul className="space-y-1 mb-2">
          {planTodos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-2 text-[12px]">
              <button
                onClick={() => handlePlanTodoToggle(todo.id)}
                className={`flex-shrink-0 w-4 h-4 rounded border ${
                  todo.done
                    ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/50"
                    : "border-zinc-600"
                } flex items-center justify-center transition-colors`}
              >
                {todo.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="var(--fintheon-accent)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span
                className={
                  todo.done
                    ? "text-[#f0ead6]/40 line-through"
                    : "text-[#f0ead6]/80"
                }
              >
                {todo.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-zinc-500 italic mb-2">
          No plan steps yet — start typing to build your plan
        </p>
      )}
    </div>
  ) : null;

  return (
    <>
      {/* Command palette (Cmd+K) */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onSelectSkill={onSelectSkill}
          onTogglePlan={togglePlanMode}
          onStop={handleStop}
          agents={agents}
          onSwitchAgent={(agent) => setActiveAgent(agent)}
        />
      )}

      {/* Plan mode input */}
      {planModeInputEl}

      <PromptBox
        onSend={handleSend}
        onStop={handleStop}
        isProcessing={isRunning}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
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
        toolsSlot={toolsEl}
        planSlot={planEl}
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
    </>
  );
}
