// [claude-code 2026-03-16] Auditorium events kanban — 6 swim lanes by risk category
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
}

const CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

/** Map narrative categories to MiroFish risk categories */
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

export function AuditoriumKanban({ catalysts, generatedEvents }: AuditoriumKanbanProps) {
  // Build cards per category
  const lanes = new Map<MiroFishRiskCategory, KanbanCard[]>();
  for (const cat of CATEGORIES) lanes.set(cat, []);

  // Map existing catalysts
  for (const c of catalysts) {
    const riskCat = CATEGORY_MAP[c.category ?? ''] ?? 'geopolitical';
    const cards = lanes.get(riskCat)!;
    cards.push({
      id: c.id,
      title: c.title,
      date: c.date,
      isAi: false,
      impactColor: getImpactColor(severityToScore(c.severity)),
    });
  }

  // Add AI-generated events
  for (const e of generatedEvents) {
    const cards = lanes.get(e.category);
    if (cards) {
      cards.push({
        id: e.id,
        title: e.title,
        date: e.date,
        isAi: true,
        impactColor: getImpactColor(e.impactScore),
      });
    }
  }

  // Sort each lane by date
  for (const cards of lanes.values()) {
    cards.sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <div className="flex flex-col gap-1">
      {CATEGORIES.map(cat => {
        const cards = lanes.get(cat)!;
        return (
          <div key={cat} className="flex items-start gap-2 min-h-[32px]">
            {/* Category label */}
            <div
              className="w-[90px] shrink-0 text-[9px] font-mono py-1 text-right pr-2 truncate"
              style={{ color: RISK_CATEGORY_COLORS[cat] }}
            >
              {RISK_CATEGORY_LABELS[cat]}
            </div>

            {/* Scrollable card strip */}
            <div className="flex-1 overflow-x-auto flex gap-1.5 py-0.5 scrollbar-thin">
              {cards.length === 0 ? (
                <span className="text-[9px] text-[var(--fintheon-muted)]/40 italic py-1">
                  No events
                </span>
              ) : (
                cards.map(card => (
                  <div
                    key={card.id}
                    className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-bg)]/60 max-w-[160px]"
                  >
                    {/* Impact dot */}
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: card.impactColor }}
                    />
                    {/* Title + date */}
                    <div className="min-w-0">
                      <div className="text-[9px] text-[var(--fintheon-text)] truncate leading-tight">
                        {card.title}
                      </div>
                      <div className="text-[8px] text-[var(--fintheon-muted)]/50 font-mono">
                        {card.date.slice(5)}
                      </div>
                    </div>
                    {/* AI badge */}
                    {card.isAi && (
                      <span className="shrink-0 text-[7px] font-bold px-1 rounded bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]">
                        AI
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
