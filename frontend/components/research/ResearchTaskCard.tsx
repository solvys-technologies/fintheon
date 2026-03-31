// [claude-code 2026-03-31] S12-T3: Research task card for kanban board

import { type ResearchTask } from '../../lib/services'

interface ResearchTaskCardProps {
  task: ResearchTask
  onStatusChange: (id: string, status: string) => void
  onExpand: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#888',
  active: '#4a9eff',
  'deep-dive': '#c79f4a',
  complete: '#4ade80',
}

const AGENT_EMOJIS: Record<string, string> = {
  'Harper-Opus': '♛',
  Oracle: '◎',
  Feucht: '⚡',
  Consul: '⚖',
  Herald: '📡',
}

export default function ResearchTaskCard({ task, onStatusChange, onExpand }: ResearchTaskCardProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'complete'

  return (
    <div
      onClick={() => onExpand(task.id)}
      className="group cursor-pointer rounded-xl border border-[var(--fintheon-accent)]/10 p-3 transition-all duration-200 hover:border-[var(--fintheon-accent)]/30"
      style={{ background: '#0a0a08' }}
    >
      {/* Status dot + title */}
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: STATUS_COLORS[task.status] || '#888' }}
        />
        <h4 className="line-clamp-2 text-sm font-semibold text-[var(--fintheon-text)]">
          {task.title}
        </h4>
      </div>

      {/* Narrative tag */}
      {task.narrative && (
        <div className="mt-2 ml-4">
          <span
            className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs"
            style={{
              background: 'rgba(199, 159, 74, 0.12)',
              color: '#c79f4a',
              border: '1px solid rgba(199, 159, 74, 0.2)',
            }}
          >
            {task.narrative}
          </span>
        </div>
      )}

      {/* Agent badge + due date */}
      <div className="mt-2 ml-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.assignedAgent && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--fintheon-text-dim, #999)',
              }}
            >
              <span>{AGENT_EMOJIS[task.assignedAgent] || '●'}</span>
              {task.assignedAgent}
            </span>
          )}
        </div>

        {task.dueDate && (
          <span
            className="text-xs"
            style={{ color: isOverdue ? '#ef4444' : 'var(--fintheon-text-dim, #666)' }}
          >
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Status dropdown (click stops propagation) */}
      <div className="mt-2 ml-4 opacity-0 transition-opacity group-hover:opacity-100">
        <select
          value={task.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            onStatusChange(task.id, e.target.value)
          }}
          className="rounded-md border border-[var(--fintheon-accent)]/20 bg-[#111] px-2 py-0.5 text-xs text-[var(--fintheon-text)]"
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="deep-dive">Deep Dive</option>
          <option value="complete">Complete</option>
        </select>
      </div>
    </div>
  )
}
