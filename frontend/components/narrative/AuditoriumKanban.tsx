// [claude-code 2026-03-23] Auditorium kanban — dashboard-grade timeline strips
import type { MiroFishRiskCategory, MiroFishGeneratedEvent } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, RISK_CATEGORY_COLORS } from '../../types/mirofish';

interface CatalystInput {
  id: string;
  title: string;
  date: string;
  sentiment: string;
  severity: string;
  category?: string;
  narrativeIds?: string[];
}

interface AuditoriumKanbanProps {
  catalysts: CatalystInput[];
  generatedEvents: MiroFishGeneratedEvent[];
  expanded?: boolean;
}

const CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

const CATEGORY_MAP: Record<string, MiroFishRiskCategory> = {
  geopolitical: 'geopolitical',
  'supply-chain': 'geopolitical',
  political: 'political',
  monetary: 'monetary-policy',
  macroeconomic: 'monetary-policy',
  'monetary-policy': 'monetary-policy',
  earnings: 'earnings-corporate',
  'earnings-corporate': 'earnings-corporate',
  'market-structure': 'market-structure',
  'black-swan': 'black-swan',
};

interface KanbanCard {
  id: string;
  title: string;
  date: string;
  isAi: boolean;
  impactColor: string;
  impactScore: number;
  description?: string;
}

function getImpactColor(score: number): string {
  if (score >= 7) return '#EF4444';
  if (score >= 5) return '#F59E0B';
  return '#34D399';
}

function severityToScore(sev: string): number {
  if (sev === 'critical' || sev === 'high') return 8;
  if (sev === 'medium') return 5;
  return 3;
}

export function AuditoriumKanban({ catalysts, generatedEvents, expanded }: AuditoriumKanbanProps) {
  const lanes = new Map<MiroFishRiskCategory, KanbanCard[]>();
  for (const cat of CATEGORIES) lanes.set(cat, []);

  for (const c of catalysts) {
    const riskCat = CATEGORY_MAP[c.category ?? ''] ?? 'geopolitical';
    const score = severityToScore(c.severity);
    lanes.get(riskCat)!.push({
      id: c.id,
      title: c.title,
      date: c.date,
      isAi: false,
      impactColor: getImpactColor(score),
      impactScore: score,
    });
  }

  for (const e of generatedEvents) {
    const cards = lanes.get(e.category);
    if (cards) {
      cards.push({
        id: e.id,
        title: e.title,
        date: e.date,
        isAi: true,
        impactColor: getImpactColor(e.impactScore),
        impactScore: e.impactScore,
        description: e.description,
      });
    }
  }

  for (const cards of lanes.values()) {
    cards.sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map(cat => {
        const cards = lanes.get(cat)!;
        const color = RISK_CATEGORY_COLORS[cat];

        return (
          <div
            key={cat}
            className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-surface)]/20 p-3"
          >
            {/* Lane header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{ color }}
              >
                {RISK_CATEGORY_LABELS[cat]}
              </span>
              <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/30">
                {cards.length} event{cards.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Cards */}
            {cards.length === 0 ? (
              <span className="text-[10px] text-[var(--fintheon-muted)]/30 italic pl-4">
                No upcoming events
              </span>
            ) : (
              <div className={`flex gap-2 ${expanded ? 'flex-wrap' : 'overflow-x-auto scrollbar-thin'}`}>
                {cards.map(card => (
                  <div
                    key={card.id}
                    className={`shrink-0 flex flex-col gap-1 rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-bg)]/60 ${
                      expanded ? 'p-3 w-[220px]' : 'px-3 py-2 max-w-[200px]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Impact indicator */}
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: card.impactColor }}
                      />
                      <span className="text-[10px] text-[var(--fintheon-text)] truncate leading-tight font-medium">
                        {card.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pl-4">
                      <span className="text-[9px] text-[var(--fintheon-muted)]/50 font-mono">
                        {card.date.slice(5)}
                      </span>
                      <span
                        className="text-[8px] font-mono font-bold"
                        style={{ color: card.impactColor }}
                      >
                        IV {card.impactScore.toFixed(0)}
                      </span>
                      {card.isAi && (
                        <span className="text-[7px] font-bold px-1 rounded bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]">
                          AI
                        </span>
                      )}
                    </div>

                    {expanded && card.description && (
                      <p className="text-[9px] text-[var(--fintheon-muted)]/40 pl-4 line-clamp-2">
                        {card.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
