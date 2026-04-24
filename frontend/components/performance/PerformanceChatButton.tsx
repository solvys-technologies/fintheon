// [claude-code 2026-04-20] S21-T2: Performance-tab header chat button.
// Third of three Omi voice triggers (the other two being PsychAssist activation
// and the general Voice Assistant button). Rendered by TopHeader ONLY when
// activeTab === "performance".
import { MessageSquare } from "lucide-react";
import { useHarperVoiceSession } from "../../hooks/useHarperVoiceSession";

export function PerformanceChatButton() {
  const { session, starting, start, stop } = useHarperVoiceSession();
  const active =
    session?.status === "active" && session.trigger === "performance_chat";

  const handleClick = () => {
    if (active) {
      void stop();
    } else {
      void start("performance_chat");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={starting}
      className="rounded-full flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        background: active ? "var(--fintheon-accent)" : "#070704",
        border: "1.5px solid var(--fintheon-accent)",
        cursor: starting ? "wait" : "pointer",
      }}
      title={active ? "End coach session" : "Ask the Coach"}
      aria-label={active ? "End coach session" : "Ask the Coach"}
    >
      <MessageSquare
        className="w-3 h-3"
        style={{
          color: active ? "#050402" : "var(--fintheon-accent)",
        }}
      />
    </button>
  );
}
