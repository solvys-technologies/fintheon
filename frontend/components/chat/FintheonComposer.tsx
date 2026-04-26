// [claude-code 2026-04-25] S42-T2: wrap return in <ComposerPrimitive.Root> (assistant-ui),
// add slash-command persona override (/oracle /feucht /consul /herald → strip prefix +
// dispatch fintheon:persona-override for one turn), add @TICKER inline injection (regex
// strip + headline-style context attachment), expose onQueueRequested for queue-while-
// streaming. All toolbar slots (Tools, MCP, Persona, Provider, Relay, Attach, Headline)
// preserved verbatim — wrap is additive, not a rewrite.
// [claude-code 2026-04-18] S21-T1 polish: guard isDispatchedHere against undefined-on-both-sides
// false positives (after 404-clear of stale convo, both conversationId and dispatchedConversationId
// can briefly be undefined → banner would linger). Also added a "dispatching" title for the relay
// button so the spinner state doesn't keep the stale "send this conversation" tooltip.
// [claude-code 2026-04-18] S21-T1: Relay dispatch button + disconnect + mirror banner plumbed
// into the composer's left action cluster (was in ChatHeader's clipboard-copy flow).
// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-04-11] S14-T5: Headline attachment via HeadlinePickerPopover + context injection
// [claude-code 2026-03-22] Track 4: persona pills → PersonaDropdown, Plug2+Wrench → ToolsDropdown
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ComposerPrimitive,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
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
  /**
   * Optional: eject the cached conversation id when relay dispatch returns
   * not_found. Self-heal for the hydration/dispatch ownership mismatch —
   * legacy anon convos that hydrate via the anon fallback will 404 on dispatch,
   * and without this prop the user stays stuck with a broken relay button.
   */
  onConversationGone?: () => void;
  /**
   * S42-T2: when set and assistant is currently streaming, the composer pushes the
   * outgoing message into the parent's queue instead of calling runtime.append.
   * Returns true if queued (so we still clear the textarea / draft).
   */
  onQueueWhileStreaming?: (text: string, images?: string[]) => boolean;
  /** Last 10 user-message texts — drives PromptBox ↑↓ history recall. */
  historyMessages?: string[];
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
  onConversationGone,
  onQueueWhileStreaming,
  historyMessages,
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
  // [claude-code 2026-04-18] Fix: don't gate on isMobileReachable. /api/relay/health.connected
  // on the LOCAL backend means "something is WS-connected to this local backend", not "mobile
  // is online" — that flag is always false on desktop and was making the button permanently
  // un-clickable. Dispatch is fire-and-forget via web-push; the push succeeds (pushedTo:0 if
  // no subscriptions) and the user can open mobile to pick up.
  const relay = useRelayDispatch();
  // Guard against undefined-on-both-sides: if conversationId got cleared (e.g. 404-on-hydrate
  // nuked the stale cache) relay.dispatchedConversationId can also be null/undefined briefly,
  // and strict equality would resolve true → banner hangs around for one render. Require both
  // sides to be truthy before claiming "dispatched here".
  const isDispatchedHere = Boolean(
    relay.isDispatched &&
    conversationId &&
    relay.dispatchedConversationId &&
    relay.dispatchedConversationId === conversationId,
  );
  const relayDisabled =
    relay.isDispatching ||
    !conversationId ||
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
        // Self-heal: a "not_found" dispatch means the backend doesn't recognize
        // this convo under the current user's sub — most commonly a legacy anon
        // convo missed by the 2026-04-18 migration. Evicting the cached id lets
        // the user start a fresh convo and unblocks the button. The backend also
        // auto-reassigns on next hydration, so sending a message will usually
        // just work; this is defense-in-depth for older builds.
        if (
          err instanceof Error &&
          /not_found|Conversation not found/i.test(err.message) &&
          onConversationGone
        ) {
          onConversationGone();
        }
      }
    }
  }, [conversationId, isDispatchedHere, relay, onConversationGone]);

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

  // [claude-code 2026-04-25] S42-T7 mount-perf: deferred to idle so it can't
  // contend with first paint of the composer. The disabled-skills map is only
  // consulted by the skills picker, which is hidden by default — fetching at
  // mount was pure mount-cost for zero immediate benefit. We also force-fetch
  // the first time the picker opens, so users who open it in the first ~50ms
  // still see fresh data.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
    };
    const idle =
      (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (typeof idle === "function") {
      idleHandle = idle(() => void run(), { timeout: 1500 });
    } else {
      timeoutHandle = setTimeout(() => void run(), 200);
    }
    return () => {
      cancelled = true;
      if (
        idleHandle !== undefined &&
        typeof (window as unknown as { cancelIdleCallback?: (h: number) => void })
          .cancelIdleCallback === "function"
      ) {
        (window as unknown as { cancelIdleCallback: (h: number) => void })
          .cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  // Force-fetch on first picker open in case the idle tick hasn't fired yet.
  const skillsFreshRef = useRef(false);
  useEffect(() => {
    if (!showSkills || skillsFreshRef.current) return;
    skillsFreshRef.current = true;
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
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSkills]);

  const mergedDisabledSkills = { ...apiDisabledSkills, ...propDisabledSkills };

  const handleSend = useCallback(
    (msg: string, images?: string[]) => {
      let working = msg;

      // S42-T2: slash-command persona override — strip prefix, dispatch
      // fintheon:persona-override which ChatInterface listens for and routes the
      // turn through the named persona before restoring the prior agent.
      const slashMatch = working.match(/^\/(oracle|feucht|consul|herald)\s+/i);
      if (slashMatch) {
        const personaId = slashMatch[1].toLowerCase() as
          | "oracle"
          | "feucht"
          | "consul"
          | "herald";
        const stripped = working.slice(slashMatch[0].length);
        try {
          window.dispatchEvent(
            new CustomEvent("fintheon:persona-override", {
              detail: { personaId, text: stripped, images },
            }),
          );
        } catch (err) {
          console.error("[FintheonComposer] persona-override dispatch failed:", err);
        }
        // Override path consumes the message — clear active skill, leave chips for
        // ChatInterface to inject when it actually appends.
        onSelectSkill(null);
        return;
      }

      // S42-T2: @TICKER injection — strip the inline mention and attach as a
      // ticker-context block (mirrors the headline-context shape so the assistant
      // sees a uniform "Context attached" footer).
      const tickerMatches = Array.from(working.matchAll(/@([A-Z]{1,5})\b/g));
      const tickers = Array.from(new Set(tickerMatches.map((m) => m[1])));
      if (tickers.length > 0) {
        working = working.replace(/@([A-Z]{1,5})\b/g, "").replace(/\s{2,}/g, " ").trim();
      }

      let finalText = working;
      if (activeSkill && SKILL_PREFIXES[activeSkill]) {
        finalText = SKILL_PREFIXES[activeSkill] + "\n\n" + working;
      }
      // Inject attached headline context
      if (headlineChips.length > 0) {
        finalText += formatHeadlineContext(headlineChips);
        setHeadlineChips([]);
      }
      // Append ticker context block (uniform with headline footer)
      if (tickers.length > 0) {
        finalText += `\n\n---\nTickers attached: ${tickers.map((t) => `$${t}`).join(", ")}`;
      }

      // S42-T2: queue while streaming — defer to parent if streaming and a queue
      // handler is wired. PromptBox already cleared its textarea; we just don't
      // call runtime.append here.
      if (isRunning && onQueueWhileStreaming) {
        const queued = onQueueWhileStreaming(finalText, images);
        if (queued) {
          onSelectSkill(null);
          return;
        }
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
      isRunning,
      onQueueWhileStreaming,
    ],
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
    if (relay.isDispatching) return "Relay — dispatching to mobile…";
    if (isDispatchedHere) return `Disconnect — resume on desktop`;
    if (!conversationId) return "Relay — send a message first";
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

  // S42-T2: <ComposerPrimitive.Root> wraps the existing PromptBox so assistant-ui
  // recognizes the composer as a first-class primitive (enables future hookups
  // like ComposerPrimitive.If). Form submission is a no-op here — PromptBox
  // owns its own send via the circular ArrowUp button (memory: send-button
  // style is locked). asChild forwards the form element onto PromptBox's outer
  // container so we don't add an extra DOM node.
  return (
    <ComposerPrimitive.Root onSubmit={(e) => e.preventDefault()}>
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
        historyMessages={historyMessages}
      />
    </ComposerPrimitive.Root>
  );
}
