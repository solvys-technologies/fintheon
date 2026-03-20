/** Shared Kanban section title — matches ExecutiveDashboard aesthetic */

interface KanbanTitleProps {
  title: string;
  tag?: string;
  tone?: 'gold' | 'violet' | 'cyan' | 'emerald';
  headerRight?: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<KanbanTitleProps['tone']>, string> = {
  gold: 'text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30',
  violet: 'text-[#a5b4fc] border-[#6366f1]/30',
  cyan: 'text-[#67e8f9] border-[#06b6d4]/30',
  emerald: 'text-emerald-300 border-emerald-500/30',
};

export function KanbanTitle({
  title,
  tag,
  tone = 'gold',
  headerRight,
}: KanbanTitleProps) {
  return (
    <div className="flex items-center justify-between px-1 py-1">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-[0.2em] uppercase">{title}</h2>
        {tag ? (
          <span
            className={`text-[9px] tracking-[0.22em] uppercase border rounded-full px-2 py-0.5 ${TONE_CLASSES[tone]}`}
          >
            {tag}
          </span>
        ) : null}
      </div>
      {headerRight}
    </div>
  );
}
