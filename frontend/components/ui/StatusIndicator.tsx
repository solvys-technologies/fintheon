// [claude-code 2026-03-22] Reusable status dot indicator for the footer toolbar

type StatusLevel = 'ok' | 'degraded' | 'error' | 'unknown';

const STATUS_COLORS: Record<StatusLevel, string> = {
  ok: 'bg-emerald-400',
  degraded: 'bg-yellow-400 animate-pulse',
  error: 'bg-red-400',
  unknown: 'bg-zinc-600',
};

const STATUS_TEXT_COLORS: Record<StatusLevel, string> = {
  ok: 'text-emerald-400/60',
  degraded: 'text-yellow-400/60',
  error: 'text-red-400/60',
  unknown: 'text-zinc-600',
};

interface StatusIndicatorProps {
  label: string;
  status: StatusLevel;
  detail?: string;
}

export function StatusIndicator({ label, status, detail }: StatusIndicatorProps) {
  const tooltip = detail ? `${label}: ${detail}` : `${label}: ${status}`;

  return (
    <span className="flex items-center gap-1 text-[10px]" title={tooltip}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status]}`} />
      <span className={STATUS_TEXT_COLORS[status]}>{label}</span>
    </span>
  );
}
