// [claude-code 2026-04-10] S9-T4: Extracted message hover actions from FintheonThread
import { type FC, useState, useCallback } from "react";
import { Copy, Check, Bookmark } from "@/components/shared/iso-icons";

interface MessageActionsProps {
  textContent: string;
  messageId?: string;
  onTakeNote?: (id: string, content: string) => void;
}

export const MessageActions: FC<MessageActionsProps> = ({
  textContent,
  messageId,
  onTakeNote,
}) => {
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [textContent]);

  const handleNote = useCallback(() => {
    if (!onTakeNote || !messageId || !textContent) return;
    onTakeNote(messageId, textContent);
    setNoted(true);
    setTimeout(() => setNoted(false), 2000);
  }, [onTakeNote, messageId, textContent]);

  return (
    <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
        title="Copy"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
        {copied ? "Copied" : "Copy"}
      </button>
      {onTakeNote && messageId && textContent && (
        <button
          onClick={handleNote}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Take Note — save to Harper memory"
        >
          <Bookmark size={10} />
          <span className="text-[9px]">{noted ? "Noted" : "Note"}</span>
        </button>
      )}
    </div>
  );
};
