// [claude-code 2026-04-25] S42-T6: Mobile equivalent of the web "Ask about this"
//   affordance. Routes through the existing harper-prefill + tab-change pattern
//   that NotificationDrawer / NotificationCard already use, so the chat tab
//   opens with the surface payload pre-populated.
import { MessageSquare } from "lucide-react";

export interface AskAboutThisProps {
  surface: string;
  payload: Record<string, unknown>;
  label?: string;
  className?: string;
  size?: number;
}

function formatPrompt(
  surface: string,
  payload: Record<string, unknown>,
  label?: string,
): string {
  const head = label
    ? `Tell me about this ${label}`
    : `Tell me about this ${surface.replace(/_/g, " ")}`;
  let body = "";
  try {
    body = JSON.stringify(payload, null, 2);
  } catch {
    body = String(payload);
  }
  return `${head}\n\n[Context surface=${surface}]\n${body}`;
}

export function AskAboutThis({
  surface,
  payload,
  label,
  className,
  size = 14,
}: AskAboutThisProps) {
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem("fintheon:current-surface", surface);
    } catch {
      /* no-op */
    }
    const prompt = formatPrompt(surface, payload, label);
    window.dispatchEvent(
      new CustomEvent("fintheon:harper-prefill", { detail: { prompt } }),
    );
    window.dispatchEvent(
      new CustomEvent("fintheon:tab-change", { detail: { index: 2 } }),
    );
    window.dispatchEvent(
      new CustomEvent("fintheon:open-chat-with-context", {
        detail: { surface, payload, label },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label ? `Ask about ${label}` : "Ask about this"}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 14,
        height: size + 14,
        borderRadius: 8,
        border: "1px solid var(--accent, #c79f4a)",
        background: "transparent",
        color: "var(--accent, #c79f4a)",
        WebkitTapHighlightColor: "transparent",
        flexShrink: 0,
      }}
    >
      <MessageSquare size={size} strokeWidth={2} />
    </button>
  );
}
