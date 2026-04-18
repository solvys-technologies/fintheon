// [claude-code 2026-04-18] S21-T1: Relay dispatch button + disconnect + mirror banner plumbed
// into the composer's left action cluster (was in ChatHeader's clipboard-copy flow).
// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-04-11] S14-T5: Headline attachment via HeadlinePickerPopover + context injection
// [claude-code 2026-03-22] Track 4: persona pills → PersonaDropdown, Plug2+Wrench → ToolsDropdown
import { useEffect, useState, useCallback } from "react";
import { useThread, useThreadRuntime } from "@assistant-ui/react";
import { Radio, Unplug, Loader2 } from "lucide-react";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { SKILL_PREFIXES } from "../../lib/skillPrefixes";
import { SKILLS } from "../../lib/skills";
import { useVoice } from "../../contexts/VoiceContext";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { useRelayDispatch } from "../../hooks/useRelayDispatch";
import { PersonaDropdown } from "./PersonaDropdown";
import { ToolsDropdown } from "./ToolsDropdown";
import { ProviderDropdown, useHarperProvider } from "./ProviderDropdown";
import { API_BASE_URL } from "./constants";
import {
  formatHeadlineContext,
  type HeadlineChip,
} from "./HeadlinePickerPopover";

/* ------------------------------------------------------------------ */
/*  FintheonComposer                                                      */
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
  /** Current conversation id — required for relay dispatch. */
  conversationId?: string;
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
  conversationId,
}: FintheonComposerProps) {
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const [apiDisabledSkills, setApiDisabledSkills] = useState<
    Record<string, { reason: string }>
  >({});
  const voice = useVoice();
  const { activeAgent } = useFintheonAgents();
  const { alerts } = useRiskFlow();
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const { provider, setProvider } = useHarperProvider();
  const [headlineChips, setHeadlineChips] = useState<HeadlineChip[]>([]);

  // Relay dispatch — disables the composer and shows a banner while active.
  const relay = useRelayDispatch();
  const isDispatchedHere =
    relay.isDispatched && relay.dispatchedConversationId === conversationId;
  const relayDisabled =
    relay.isDispatching ||
    !conversationId ||
    relay.isMobileReachable === false ||
    (relay.isDispatched && !isDispatchedHere); // already dispatched elsewhere

  const handleRelayClick = useCallback(async () => {
    if (!conversationId) return;
    if (isDispatchedHere) {
      await relay.disconnect();
    } else {
      try {
        await relay.dispatch(conversationId);
      } catch (err) {
        console.error("[FintheonComposer] relay dispatch failed:", err);
      }
    }
  }, [conversationId, isDispatchedHere, relay]);

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

  // Fetch skills from backend — merge with prop-level disabled skills
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

  const handleSend = useCallback(
    (msg: string, images?: string[]) => {
      let finalText = msg;
      if (activeSkill && SKILL_PREFIXES[activeSkill]) {
        finalText = SKILL_PREFIXES[activeSkill] + "\n\n" + msg;
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
    [runtime, activeSkill, onSelectSkill, headlineChips],
  );

  const handleStop = useCallback(() => {
    runtime.cancelRun();
  }, [runtime]);

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

  // ── Relay button (leftmost in composer action cluster) ───────────────────────
  const relayTitle = (() => {
    if (isDispatchedHere) return `Disconnect — resume on desktop`;
    if (!conversationId) return "Relay — start a conversation first";
    if (relay.isMobileReachable === false)
      return "Relay — connect Fintheon mobile first";
    if (relay.isDispatched && !isDispatchedHere)
      return "Relay — another conversation is already dispatched";
    return "Relay — send this conversation to your mobile";
  })();

  const relayEl = (
    <button
      onClick={handleRelayClick}
      disabled={relayDisabled}
      className={`flex items-center justify-center rounded-lg transition-colors ${
        isDispatchedHere
          ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 hover:bg-[var(--fintheon-accent)]/20"
          : relayDisabled
            ? "text-zinc-700 cursor-not-allowed"
            : "text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
      }`}
      style={{ width: "32px", height: "32px" }}
      title={relayTitle}
    >
      {relay.isDispatching ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isDispatchedHere ? (
        <Unplug size={16} />
      ) : (
        <Radio size={16} />
      )}
    </button>
  );

  // ── Dispatch banner — shown above input when this convo is dispatched ───────
  const dispatchBannerEl = isDispatchedHere ? (
    <div className="mb-2 rounded-lg border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-accent)]/5 px-3 py-2 text-[12px] text-[var(--fintheon-accent)] flex items-center justify-between">
      <span>
        Chatting on {relay.deviceLabel ?? "your mobile"} — desktop is mirroring
      </span>
      <button
        onClick={() => relay.disconnect()}
        className="text-zinc-400 hover:text-[var(--fintheon-accent)] underline underline-offset-2"
      >
        Disconnect
      </button>
    </div>
  ) : null;

  return (
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
      relaySlot={relayEl}
      dispatchBanner={dispatchBannerEl}
      disabled={isDispatchedHere}
      placeholder={
        isDispatchedHere
          ? `Chatting on ${relay.deviceLabel ?? "mobile"} — click Disconnect to resume here`
          : undefined
      }
      headlineAlerts={alerts}
      headlineChips={headlineChips}
      onHeadlineToggle={handleHeadlineToggle}
      onHeadlineClear={handleHeadlineClear}
    />
  );
}
