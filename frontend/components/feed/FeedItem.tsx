import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FeedItem as FeedItemType } from '../../types/feed';
import { decodeHtmlEntities } from '../../lib/html-entities';

interface FeedItemProps {
  item: FeedItemType;
}

export function FeedItem({ item }: FeedItemProps) {
  // Safety check: ensure iv exists and value is a number
  const ivValue = item?.iv?.value != null 
    ? (typeof item.iv.value === 'number' ? item.iv.value : Number(item.iv.value) || 0)
    : 0;
  const ivType = item?.iv?.type || 'Neutral';
  const ivClassification = item?.iv?.classification || 'Neutral';

  const ivColor = {
    Bullish: 'text-emerald-400',
    Bearish: 'text-red-500',
    Neutral: 'text-gray-400',
  };

  const IVIcon = {
    Bullish: TrendingUp,
    Bearish: TrendingDown,
    Neutral: Minus,
  };

  const Icon = IVIcon[ivType];

  const displayText = decodeHtmlEntities(item.text);

  return (
    <div className="bg-[var(--fintheon-surface)] border-l-2 border-l-[var(--fintheon-accent)]/30 p-3 rounded hover:bg-[var(--fintheon-surface)]/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">
              {item.time.toLocaleTimeString()}
            </span>
            <span className="text-xs text-[var(--fintheon-accent)]">{item.source}</span>
            {item.type === 'alert' && (
              <span className="text-xs text-red-400">
                ALERT
              </span>
            )}
          </div>
          <p className="text-sm text-gray-200">{displayText}</p>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-[80px]">
          <div className={`flex items-center gap-1 ${ivColor[ivType]}`}>
            <Icon className="w-3 h-3" />
            <span className="text-xs font-semibold">
              IV {ivValue > 0 ? '+' : ''}
              {ivValue.toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-gray-500">{ivClassification}</span>
        </div>
      </div>
    </div>
  );
}
