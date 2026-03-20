import { useState, useEffect } from 'react';
import { FeedItem as FeedItemType, IVIndicator } from '../../types/feed';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import type { RiskFlowAlert } from '../../lib/riskflow-feed';
import { FeedItem } from './FeedItem';
import { MoveLeft, MoveRight, GripVertical, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PanelPosition } from '../layout/DraggablePanel';

// Track last seen alert ID to count unread (per session)
let lastSeenAlertId: string | null = null;

function alertToFeedItem(alert: RiskFlowAlert): FeedItemType {
  const ivValue = alert.severity === 'high' ? 7 : alert.severity === 'medium' ? 5 : 3;
  const iv: IVIndicator = {
    value: ivValue,
    type: 'Neutral',
    classification: 'Neutral',
  };
  return {
    id: alert.id,
    time: new Date(alert.publishedAt),
    text: alert.headline,
    source: alert.source,
    type: 'news',
    iv,
  };
}

interface MinimalFeedSectionProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  position?: PanelPosition;
  onPositionChange?: (position: PanelPosition) => void;
  onHide?: () => void;
}

export function MinimalFeedSection({
  collapsed = false,
  onToggleCollapse,
  position = 'right',
  onPositionChange,
  onHide
}: MinimalFeedSectionProps) {
  const { alerts, markAllSeen } = useRiskFlow();
  const [unreadCount, setUnreadCount] = useState(0);

  const feedItems = alerts.slice(0, 50).map(alertToFeedItem);

  // Mark as read when panel is opened
  useEffect(() => {
    if (!collapsed && alerts.length > 0) {
      lastSeenAlertId = alerts[0].id;
      setUnreadCount(0);
      markAllSeen(alerts.slice(0, 50).map((a) => a.id));
    }
  }, [collapsed, alerts, markAllSeen]);

  // Compute unread count (items newer than last seen)
  useEffect(() => {
    if (alerts.length === 0) {
      setUnreadCount(0);
      return;
    }
    const latestId = alerts[0].id;
    if (lastSeenAlertId === null) {
      lastSeenAlertId = latestId;
      setUnreadCount(0);
    } else {
      const idx = alerts.findIndex((a) => a.id === lastSeenAlertId);
      setUnreadCount(idx < 0 ? alerts.length : idx);
    }
  }, [alerts]);

  if (collapsed) {
    return (
      <div className="h-full flex items-center justify-center p-4 relative bg-[var(--fintheon-surface)]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="text-xs text-[var(--fintheon-accent)]/60">RiskFlow</div>
            {unreadCount > 0 && (
              <div className="backdrop-blur-sm bg-[var(--fintheon-accent)]/20 border border-[var(--fintheon-accent)]/40 rounded px-1.5 py-0.5">
                <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">{unreadCount}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">{feedItems.length} items</div>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="absolute top-2 right-2 p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[var(--fintheon-accent)]" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/20">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--fintheon-accent)]">RiskFlow</h2>
          {unreadCount > 0 && (
            <div className="backdrop-blur-sm bg-[var(--fintheon-accent)]/20 border border-[var(--fintheon-accent)]/40 rounded px-1.5 py-0.5">
              <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">{unreadCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onPositionChange && (
            <>
              {position === 'right' && (
                <button
                  onClick={() => onPositionChange('left')}
                  className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
                  title="Move Left"
                >
                  <MoveLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {position === 'left' && (
                <button
                  onClick={() => onPositionChange('right')}
                  className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
                  title="Move Right"
                >
                  <MoveRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onPositionChange('floating')}
                className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
                title="Float"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
              title="Hide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--fintheon-accent)]" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {feedItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-xs">
            <p>No news items available</p>
          </div>
        ) : (
          feedItems.map(item => (
            <FeedItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
