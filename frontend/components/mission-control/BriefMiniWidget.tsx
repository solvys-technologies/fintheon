// [claude-code 2026-03-11] Mini Brief widget for Mission Control — compact daily brief view
// [claude-code 2026-03-12] Made scrollable, removed line-clamp, renders markdown-style formatting for MDB/TOTT reports
import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Sparkles } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import { useSettings } from '../../contexts/SettingsContext';
import { AutoRefreshToggle } from '../ui/AutoRefreshToggle';

/** Simple markdown-ish renderer for brief text — bolds, bullets, headers */
function BriefContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Bold header lines: **Text:** or **Text**
        if (trimmed.startsWith('**') && trimmed.includes(':**')) {
          const [header, ...rest] = trimmed.split(':**');
          const headerText = header.replace(/\*\*/g, '');
          const body = rest.join(':**').replace(/\*\*/g, '');
          return (
            <div key={i}>
              <span className="text-[10px] font-bold text-[var(--fintheon-accent)]">{headerText}:</span>
              {body && <span className="text-[10px] text-zinc-400 ml-1">{body}</span>}
            </div>
          );
        }

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-[10px] text-[var(--fintheon-accent)]/60 shrink-0">-</span>
              <span className="text-[10px] leading-relaxed text-zinc-400">{renderInlineBold(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered items
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="text-[10px] text-zinc-600 shrink-0">{match[1]}.</span>
                <span className="text-[10px] leading-relaxed text-zinc-400">{renderInlineBold(match[2])}</span>
              </div>
            );
          }
        }

        // Regular text
        return (
          <p key={i} className="text-[10px] leading-relaxed text-zinc-400">
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/** Render inline **bold** text */
function renderInlineBold(text: string): (string | React.ReactElement)[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="font-semibold text-zinc-300">{part}</span>
      : part
  );
}

function briefTypeToLabel(bt: string): string {
  switch (bt) {
    case 'MDB': return 'Morning Brief';
    case 'ADB': return 'Afternoon Brief';
    case 'PMDB': return 'Post-Market Brief';
    case 'TOTT': return 'Tale of the Tape';
    default: return 'Latest Brief';
  }
}

export function BriefMiniWidget() {
  const backend = useBackend();
  const { autoRefresh } = useSettings();
  const [briefText, setBriefText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const getBriefLabel = () => {
    const now = new Date();
    const day = now.getDay();
    const h = now.getHours();
    const t = h * 60 + now.getMinutes();
    // TOTT: Sunday >= 17:00 through Monday < 07:00
    if ((day === 0 && t >= 17 * 60) || (day === 1 && h < 7)) return 'The Weekly Tribune';
    // PMDB stays active overnight until MDB fires at 6:30 AM
    if (t < 6 * 60 + 30) return 'Post-Market Brief';
    if (t >= 17 * 60 + 30) return 'Post-Market Brief';
    if (t >= 11 * 60) return 'Afternoon Brief';
    return 'Morning Brief';
  };

  const [label, setLabel] = useState(getBriefLabel);

  const fetchBrief = useCallback(async () => {
    try {
      const res = await backend.notion.getMdbBrief();
      setBriefText(res.items[0]?.detail ?? '');
      if (res.briefType) setLabel(briefTypeToLabel(res.briefType));
      else setLabel(getBriefLabel());
    } catch {
      // silent
    } finally {
      setLoaded(true);
    }
  }, [backend]);

  useEffect(() => {
    fetchBrief();
    const interval = setInterval(() => {
      if (!autoRefresh) return;
      fetchBrief();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchBrief, autoRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await backend.notion.getMdbBrief();
      setBriefText(res.items[0]?.detail ?? '');
      if (res.briefType) setLabel(briefTypeToLabel(res.briefType));
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Trigger AI generation of the current brief type
      window.dispatchEvent(new CustomEvent('fintheon:open-chat-skill', {
        detail: {
          skillId: label.includes('Morning') ? 'mdb_report' : label.includes('Tale') ? 'tott' : 'brief',
          prompt: label.includes('Morning')
            ? "Run the MDB report for today's session"
            : label.includes('Tale')
              ? 'Give me the Tale of the Tape weekly summary'
              : `Generate the ${label} — only new market-moving headlines since the last brief`,
        },
      }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '120px', resize: 'vertical', overflow: 'auto' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="AI Generate brief"
          >
            <Sparkles className={`w-2.5 h-2.5 ${generating ? 'animate-pulse' : ''}`} />
          </button>
          <AutoRefreshToggle size="xs" />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="Refresh brief"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable brief content — no line clamp */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pr-1">
        {!loaded ? (
          <div className="text-[10px] text-zinc-600 py-2">Loading brief...</div>
        ) : briefText ? (
          <div className="pl-2">
            <BriefContent text={briefText} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="text-[10px] text-zinc-600">No brief available</div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-semibold text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Generate {label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
