// [codex 2026-05-23] Canvas chat now uses the NarrativeFlow domain composer shell.
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useNarrative } from "../../contexts/NarrativeContext";
import { useMessageQueue } from "../chat/hooks/useMessageQueue";
import {
  normalizeReasoningLevel,
  type ReasoningLevel,
} from "../chat/reasoning";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface NarrativeCanvasChatProps {
  pendingChips?: { id: string; title: string }[];
  onClearChip?: (id: string) => void;
  isOpen?: boolean;
  onDismiss?: () => void;
}

export function NarrativeCanvasChat({
  pendingChips = [],
  onClearChip,
  isOpen = false,
  onDismiss,
}: NarrativeCanvasChatProps) {
  const { dispatch } = useNarrative();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseVisible, setResponseVisible] = useState(false);
  const [localChips, setLocalChips] = useState<
    { id: string; title: string; dataUrl?: string }[]
  >([]);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>(() => {
    try {
      return normalizeReasoningLevel(
        localStorage.getItem("fintheon:narrative-reasoning-level"),
      );
    } catch {
      return "standard";
    }
  });

  const attachedHeadlines = useMemo<NarrativeHeadlineOption[]>(
    () =>
      [...pendingChips, ...localChips].map((chip) => ({
        id: chip.id,
        headline: chip.title,
        summary: chip.title,
        source: chip.id.startsWith("img-") ? "pasted-image" : "canvas",
        severity: "medium",
        publishedAt: new Date().toISOString(),
        symbols: [],
        tags: [],
        narrativeThreads: [],
      })),
    [localChips, pendingChips],
  );

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setLoading(true);
      setInput("");
      const chipContext =
        pendingChips.length > 0
          ? `\n\nReferenced cards: ${pendingChips.map((c) => c.title).join(", ")}`
          : "";

      try {
        const res = await fetch(`${API_BASE}/api/narrative/score-riskflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasoningLevel,
            items: [
              {
                id: `user-${Date.now()}`,
                headline: trimmed,
                summary: trimmed + chipContext,
                source: "user",
                severity: "medium",
                tags: [],
                publishedAt: new Date().toISOString(),
              },
            ],
          }),
        });

        if (!res.ok) throw new Error(`Score failed: ${res.status}`);
        const { scored } = await res.json();

        if (scored && scored.length > 0) {
          for (const item of scored) {
            dispatch({
              type: "ADD_CATALYST",
              catalyst: {
                title: item.suggestedTitle || trimmed,
                description: item.suggestedDescription || trimmed,
                date: new Date().toISOString().slice(0, 10),
                sentiment: item.sentiment ?? "bearish",
                severity: item.severity ?? "medium",
                source: "agent",
                narrativeIds: item.tickers ?? [],
                isGhost: false,
                templateType: null,
                position: null,
                tags: item.themes ?? [],
                category: undefined,
                drillDepth: 0,
              },
            });
          }
          setResponse(`Added ${scored.length} event${scored.length === 1 ? "" : "s"} to NarrativeFlow.`);
        } else {
          setResponse("No scoreable events found. Add more market context.");
        }
      } catch (err) {
        console.error("[CanvasChat] Scoring failed:", err);
        dispatch({
          type: "ADD_CATALYST",
          catalyst: {
            title: trimmed,
            description: chipContext || "",
            date: new Date().toISOString().slice(0, 10),
            sentiment: "bearish",
            severity: "medium",
            source: "user",
            narrativeIds: [],
            isGhost: false,
            templateType: null,
            position: null,
            tags: [],
            category: "macroeconomic",
            drillDepth: 0,
          },
        });
        setResponse("Added as user event. Scoring is unavailable.");
      } finally {
        setLoading(false);
        setResponseVisible(true);
        pendingChips.forEach((chip) => onClearChip?.(chip.id));
      }
    },
    [dispatch, loading, onClearChip, pendingChips, reasoningLevel],
  );

  const queue = useMessageQueue({
    isRunning: loading,
    sendNow: submitText,
    storageKey: "fintheon:narrative-canvas-chat-queue",
  });

  useEffect(() => {
    if (!responseVisible) return;
    const timer = setTimeout(() => {
      setResponseVisible(false);
      setResponse(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [responseVisible]);

  function handleReasoningLevelChange(level: ReasoningLevel) {
    setReasoningLevel(level);
    try {
      localStorage.setItem("fintheon:narrative-reasoning-level", level);
    } catch {
      /* ignore */
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      const reader = new FileReader();
      reader.onload = () => {
        setLocalChips((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `image (${Math.round(blob.size / 1024)}KB)`,
            dataUrl: String(reader.result ?? ""),
          },
        ]);
      };
      reader.readAsDataURL(blob);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="narrative-canvas-chat relative flex flex-col items-center">
      {responseVisible && response ? (
        <div className="narrative-canvas-chat__response absolute bottom-full mb-2 flex w-[420px] items-center gap-2 rounded-lg border border-[var(--fintheon-accent)]/15 px-3 py-2">
          <p className="flex-1 text-[11px] leading-relaxed text-[var(--fintheon-text)]">
            {response}
          </p>
          <button
            type="button"
            onClick={() => {
              setResponseVisible(false);
              setResponse(null);
            }}
            className="shrink-0 rounded p-0.5 text-[var(--fintheon-muted)] hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-text)]"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      <NarrativeSensemakingComposer
        mode="overlay"
        query={input}
        attachedHeadlines={attachedHeadlines}
        isSubmitting={loading}
        validationMessage={null}
        minHeadlines={0}
        reasoningLevel={reasoningLevel}
        queue={queue.queue}
        contextStats={{
          messageCount: attachedHeadlines.length,
          estimatedTokens: Math.ceil(
            `${input}\n${attachedHeadlines.map((item) => item.headline).join("\n")}`.length / 4,
          ),
          connectorCount: attachedHeadlines.length,
          activeSkillLabel: "Canvas",
        }}
        onQueryChange={setInput}
        onOpenDrawer={() => onDismiss?.()}
        onRemoveHeadline={(id) => {
          if (id.startsWith("img-")) {
            setLocalChips((prev) => prev.filter((chip) => chip.id !== id));
          } else {
            onClearChip?.(id);
          }
        }}
        onSubmit={() => submitText(input)}
        onQueueMessage={queue.addQueue}
        onEditQueue={queue.editQueue}
        onRemoveQueue={queue.removeQueue}
        onReorderQueue={queue.reorderQueue}
        onSendQueueOne={queue.sendOne}
        onSendQueueAll={queue.sendAll}
        onReasoningLevelChange={handleReasoningLevelChange}
        onPaste={handlePaste}
      />
    </div>
  );
}
