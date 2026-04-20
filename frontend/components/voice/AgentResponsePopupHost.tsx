// [claude-code 2026-04-20] S21-T3: App-wide host for the agent-response popup.
// Mounts once in MainLayout; listens to the `fintheon:agent-response` event
// dispatched by useOmiSession so any of the three triggers renders through
// a single component instance.
import { useEffect, useState } from "react";
import {
  AgentResponsePopup,
  type AgentResponseAgent,
} from "./AgentResponsePopup";
import type { AgentResponseEventDetail } from "../../hooks/useOmiSession";

interface HostState {
  open: boolean;
  agent: AgentResponseAgent;
  isSpeaking: boolean;
  preamble?: string;
  streamedText?: string;
  amplitudes?: number[];
}

export function AgentResponsePopupHost() {
  const [state, setState] = useState<HostState>({
    open: false,
    agent: "coach",
    isSpeaking: false,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AgentResponseEventDetail>).detail;
      if (!detail) return;
      setState((prev) => ({
        ...prev,
        open: detail.open,
        agent: detail.agent,
        isSpeaking: detail.isSpeaking,
        preamble: detail.preamble ?? prev.preamble,
        streamedText: detail.streamedText ?? prev.streamedText,
      }));
    };
    window.addEventListener(
      "fintheon:agent-response",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "fintheon:agent-response",
        handler as EventListener,
      );
    };
  }, []);

  return (
    <AgentResponsePopup
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      agent={state.agent}
      isSpeaking={state.isSpeaking}
      preamble={state.preamble}
      streamedText={state.streamedText}
      amplitudes={state.amplitudes}
    />
  );
}
