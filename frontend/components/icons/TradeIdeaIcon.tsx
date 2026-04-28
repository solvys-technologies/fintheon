// [claude-code 2026-04-28] T6: Trade idea icon — replaces the banned emoji in source badges.
//   Minimal light-bulb outline in Solvys line style.
export function TradeIdeaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Trade idea"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.9.27-1.48.27-2.18A5.18 5.18 0 0 0 12 6.5a5.18 5.18 0 0 0-3.36 5.32c0 .7.09 1.28.27 2.18" />
      <path d="M12 2v1" />
      <path d="M4.22 5.22l.71.71" />
      <path d="M1 12h1" />
      <path d="M19.78 5.22l-.71.71" />
      <path d="M23 12h-1" />
    </svg>
  );
}
