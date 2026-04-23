// [claude-code 2026-03-10] AI Loader — rotating glow circle + text animation, Solvys Gold palette
// [claude-code 2026-04-19] Internals swapped to HelixVertical Unicode spinner so every importer
//   picks up the Braille-weave aesthetic without a codemod. Text and sizing API preserved.
import { cn } from "../../lib/utils";
import { HelixVertical } from "../icon-bank/UnicodeSpinners";

interface AiLoaderProps {
  text?: string;
  size?: number;
  className?: string;
}

export function AiLoader({
  text = "Thinking...",
  size = 40,
  className,
}: AiLoaderProps) {
  const glyphSize = Math.max(10, Math.round(size * 0.32));
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <HelixVertical size={glyphSize} rows={5} />
      </div>
      {text && (
        <span
          className="text-sm font-medium tracking-[0.2em] uppercase"
          style={{ color: "var(--fintheon-accent)" }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
