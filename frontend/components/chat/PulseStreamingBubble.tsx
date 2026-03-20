import { useRef, useEffect } from 'react';

interface PulseStreamingBubbleProps {
  content: string;
  agentName?: string;
  compact?: boolean;
}

export function PulseStreamingBubble({ content, agentName, compact = false }: PulseStreamingBubbleProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content]);

  return (
    <div className={`flex justify-start ${compact ? '' : 'mb-3'}`}>
      <div
        className={`relative max-w-[85%] rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm ${
          compact ? 'text-[11px]' : 'text-[13px]'
        }`}
        style={{ padding: compact ? '8px 10px' : '12px 16px' }}
      >
        {agentName && (
          <div className="text-[10px] text-[var(--fintheon-accent)] font-medium mb-1">{agentName}</div>
        )}
        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
          {content}
          <span
            className="inline-block w-[2px] ml-0.5 animate-pulse"
            style={{
              height: compact ? '12px' : '14px',
              backgroundColor: 'var(--fintheon-accent)',
              verticalAlign: 'text-bottom',
            }}
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}
