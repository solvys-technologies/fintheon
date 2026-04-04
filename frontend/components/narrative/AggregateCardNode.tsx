import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ivHeatColor } from '../../types/miroshark';
import {
  SEVERITY_COLORS,
  deriveCyclicality,
  deriveIvScore,
  formatDateShort,
} from '../../lib/narrative-territory-layout';
import type { CatalystCard } from '../../lib/narrative-types';

export interface AggregateCardNodeData {
  label: string;
  cards: CatalystCard[];
  narrativeColor: string;
  expanded: boolean;
  groupId: string;
  onToggle?: (id: string) => void;
  siblingIndex?: number;
  siblingCount?: number;
}

function sentimentDisplay(card: CatalystCard): 'bullish' | 'bearish' | 'neutral' {
  const rawSentiment = ((card as { sentiment?: string }).sentiment ?? '').toLowerCase();
  if (rawSentiment === 'bullish') return 'bullish';
  if (rawSentiment === 'bearish') return 'bearish';
  return 'neutral';
}

export const AggregateCardNode = memo(function AggregateCardNode({
  data,
}: NodeProps & { data: AggregateCardNodeData }) {
  const { label, cards, narrativeColor, expanded, onToggle, groupId, siblingIndex, siblingCount } = data;

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [cards],
  );

  const dateRange =
    sortedCards.length > 0
      ? `${formatDateShort(sortedCards[0].date)} — ${formatDateShort(sortedCards[sortedCards.length - 1].date)}`
      : '';

  const maxSeverity: 'high' | 'medium' | 'low' = cards.some((card) => card.severity === 'high')
    ? 'high'
    : cards.some((card) => card.severity === 'medium')
      ? 'medium'
      : 'low';

  const severityColor = SEVERITY_COLORS[maxSeverity];

  const avgIv = useMemo(() => {
    if (cards.length === 0) return 0;
    const total = cards.reduce((sum, card) => sum + deriveIvScore(card), 0);
    return total / cards.length;
  }, [cards]);

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.(groupId);
      }}
      style={{
        minWidth: expanded ? 360 : 260,
        maxWidth: expanded ? 440 : 300,
        borderRadius: 8,
        border: `1.5px solid ${severityColor}30`,
        background: 'color-mix(in srgb, #0a0a00 92%, transparent)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        boxShadow: `0 4px 24px ${narrativeColor}08`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />

      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 3,
            height: 36,
            borderRadius: 2,
            overflow: 'hidden',
            flexShrink: 0,
            background: `linear-gradient(to top, ${narrativeColor}20, ${narrativeColor}, ${narrativeColor}20)`,
            backgroundSize: '100% 200%',
            animation: 'fuse-shimmer 2s ease-in-out infinite',
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--fintheon-text)',
              fontFamily: 'var(--font-heading)',
              lineHeight: '1.3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: narrativeColor,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {cards.length} items
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--fintheon-muted)',
                fontFamily: 'var(--font-mono)',
                opacity: 0.6,
              }}
            >
              {dateRange}
            </span>
            {siblingCount != null && siblingCount > 1 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: narrativeColor,
                  fontFamily: 'var(--font-mono)',
                  background: `${narrativeColor}12`,
                  padding: '1px 5px',
                  borderRadius: 3,
                  opacity: 0.8,
                }}
              >
                {(siblingIndex ?? 0) + 1}/{siblingCount}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: ivHeatColor(avgIv),
              fontFamily: 'var(--font-mono)',
              lineHeight: 1,
            }}
          >
            {avgIv.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 7,
              color: 'var(--fintheon-muted)',
              fontFamily: 'var(--font-mono)',
              opacity: 0.5,
              marginTop: 1,
            }}
          >
            IV
          </span>
        </div>

        <span
          style={{
            fontSize: 10,
            color: 'var(--fintheon-muted)',
            opacity: 0.4,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <div
          className="aggregate-card-scroll"
          onWheel={(e) => e.stopPropagation()}
          style={{ padding: '0 10px 12px', maxHeight: 400, overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedCards.map((card, index) => {
              const cardSeverityColor = SEVERITY_COLORS[card.severity ?? 'low'];
              const sentiment = sentimentDisplay(card);
              const sentimentColor =
                sentiment === 'bullish'
                  ? 'var(--fintheon-bullish)'
                  : sentiment === 'bearish'
                    ? 'var(--fintheon-bearish)'
                    : 'var(--fintheon-muted)';
              const cardIv = deriveIvScore(card);
              const cyclicality = deriveCyclicality(card);
              const cyclical = cyclicality === 'cyclical';

              return (
                <div
                  key={card.id}
                  style={{
                    borderRadius: 6,
                    border: `2px solid ${cardSeverityColor}60`,
                    background: `${cardSeverityColor}06`,
                    padding: '8px 10px',
                    animation: `card-enter 0.2s ease-out ${index * 30}ms both`,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--fintheon-text)',
                        fontFamily: 'var(--font-body)',
                        lineHeight: '1.3',
                        flex: 1,
                      }}
                    >
                      {card.title}
                    </span>

                    <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0, color: sentimentColor }}>
                      {sentiment === 'bullish' ? '▲' : sentiment === 'bearish' ? '▼' : '—'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: ivHeatColor(cardIv),
                        fontFamily: 'var(--font-mono)',
                        background: `${ivHeatColor(cardIv)}12`,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      IV {cardIv.toFixed(1)}
                    </span>

                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: sentimentColor,
                        background:
                          sentiment === 'bullish'
                            ? '#34D39912'
                            : sentiment === 'bearish'
                              ? '#EF444412'
                              : '#6B728012',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {sentiment}
                    </span>

                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: cyclical ? '#3B82F6' : '#EC4899',
                        background: cyclical ? '#3B82F612' : '#EC489912',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {cyclicality}
                    </span>

                    <span
                      style={{
                        fontSize: 9,
                        color: 'var(--fintheon-muted)',
                        fontFamily: 'var(--font-mono)',
                        opacity: 0.6,
                        marginLeft: 'auto',
                      }}
                    >
                      {formatDateShort(card.date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
