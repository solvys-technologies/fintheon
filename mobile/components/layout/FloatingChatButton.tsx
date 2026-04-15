// [claude-code 2026-04-15] S18: Floating chat FAB — accent circle, bottom-right
import { MessageSquare } from "lucide-react";

interface FloatingChatButtonProps {
  onTap: () => void;
}

export function FloatingChatButton({ onTap }: FloatingChatButtonProps) {
  return (
    <button
      onClick={() => {
        navigator.vibrate?.(10);
        onTap();
      }}
      aria-label="Open chat"
      style={{
        position: "fixed",
        bottom: "calc(24px + env(safe-area-inset-bottom))",
        right: 20,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--accent)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 30,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <MessageSquare size={24} color="var(--black, #000)" />
    </button>
  );
}
