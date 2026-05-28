interface ComposerSafetyNoticeProps {
  compact?: boolean;
}

export function ComposerSafetyNotice({
  compact = false,
}: ComposerSafetyNoticeProps) {
  return (
    <p
      className={[
        "pointer-events-none mx-auto max-w-[min(100%,42rem)] text-center leading-snug text-[#f0ead6]/45",
        compact ? "mt-1 px-2 text-[10px]" : "mt-2 px-3 text-[11px]",
      ].join(" ")}
    >
      Fintheon AI can make mistakes. Please double-check its responses before
      assuming validation.
    </p>
  );
}
