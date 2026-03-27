// [claude-code 2026-03-27] S2-T7: Annotatable feed item with comment, flaw tag, suggested score
import { useState, useEffect } from 'react';
import { MessageSquare, Tag, Save, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { RiskFlowAlert } from '../../lib/riskflow-feed';
import type { FlawTag } from '../../../backend-hono/src/types/calibration';
import { SEVERITY_CONFIG } from '../../lib/severity-config';
import { SubScoreBar } from '../feed/SubScoreBar';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

interface AnnotatableItemProps {
  item: RiskFlowAlert;
  onAnnotationSaved?: () => void;
}

const FLAW_OPTIONS: { value: FlawTag; label: string }[] = [
  { value: 'overscored', label: 'Overscored' },
  { value: 'underscored', label: 'Underscored' },
  { value: 'wrong_type', label: 'Wrong Type' },
  { value: 'wrong_sentiment', label: 'Wrong Sentiment' },
  { value: 'missing_context', label: 'Missing Context' },
  { value: 'commentator_misweight', label: 'Commentator Misweight' },
  { value: 'regime_mismatch', label: 'Regime Mismatch' },
];

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export function AnnotatableItem({ item, onAnnotationSaved }: AnnotatableItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [flawTag, setFlawTag] = useState<FlawTag | ''>('');
  const [suggestedScore, setSuggestedScore] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const sev = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.low;
  const sub = item.subScores;

  // IV score from sub-scores or fallback
  const ivScore = sub
    ? (sub.eventWeight + sub.timing + sub.deviation + sub.momentum + sub.vixContext) * (sub.vixMultiplier ?? 1) * (sub.regimeMultiplier ?? 1) * (sub.commentatorMultiplier ?? 1) / 2.8
    : null;
  const ivDisplay = ivScore !== null ? Math.min(10, Math.max(0, ivScore)).toFixed(1) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/calibration/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskflowItemId: item.id,
          comment: comment.trim() || undefined,
          flawTag: flawTag || undefined,
        suggestedScore: suggestedScore ? parseFloat(suggestedScore) : undefined,
        }),
      });
      setSavedMsg('Annotation saved');
      onAnnotationSaved?.();
    } catch (err) {
      console.error('[AnnotatableItem] Save failed:', err);
      setSavedMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Clear success message after 3s
  useEffect(() => {
    if (!savedMsg) return;
    const t = setTimeout(() => setSavedMsg(''), 3000);
    return () => clearTimeout(t);
  }, [savedMsg]);

  return (
    <div className={`rounded border ${sev.border} ${sev.bg} p-2.5 space-y-2`}>
      {/* Header: headline + severity + time */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-[var(--fintheon-text)] leading-snug">
            {item.headline}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[8px] font-bold uppercase tracking-wider ${sev.text}`}>
              {sev.label}
            </span>
            <span className="text-[8px] text-zinc-500 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatTime(item.publishedAt)}
            </span>
            {item.source && (
              <span className="text-[8px] text-zinc-600 uppercase">{item.source}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-0.5 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* IV score bar */}
      {ivDisplay && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-500">IV:</span>
          <span className="text-[10px] font-bold text-[var(--fintheon-accent)] font-mono">{ivDisplay}</span>
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-zinc-800/50 overflow-hidden">
              <div
                className="h-full bg-[var(--fintheon-accent)] rounded-full transition-all"
                style={{ width: `${Math.min(100, (parseFloat(ivDisplay) / 10) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-scores breakdown */}
      {sub && <SubScoreBar subScores={sub} />}

      {/* Points + direction */}
      {(item.pointRange || item.instrument) && (
        <div className="flex items-center gap-2 text-[9px]">
          {item.pointRange && (
            <span className="text-zinc-400 font-mono">\u00b1{item.pointRange} pts</span>
          )}
          {item.instrument && (
            <span className="text-zinc-500">/{item.instrument}</span>
          )}
        </div>
      )}

      {/* Regime + commentator multipliers */}
      {sub && (
        <div className="flex flex-wrap gap-2 text-[8px]">
          {sub.regimeName && sub.regimeMultiplier && (
            <span className="text-cyan-400/70">
              Regime: {sub.regimeName} ({sub.regimeMultiplier}x)
            </span>
          )}
          {sub.speaker && sub.commentatorMultiplier && (
            <span className="text-[var(--fintheon-accent)]/70">
              Speaker: {sub.speaker} ({sub.commentatorMultiplier}x)
            </span>
          )}
        </div>
      )}

      {/* Expanded annotation area */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-zinc-700/50">
          {/* Comment */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <MessageSquare className="w-2.5 h-2.5" />
              Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-[var(--fintheon-text)] resize-y focus:border-[var(--fintheon-accent)]/50 outline-none"
              placeholder="Note about this score..."
            />
          </div>

          {/* Flaw tag dropdown */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[9px] text-zinc-500 shrink-0">
              <Tag className="w-2.5 h-2.5" />
              Flaw:
            </label>
            <select
              value={flawTag}
              onChange={(e) => setFlawTag(e.target.value as FlawTag | '')}
              className="flex-1 bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-400 outline-none focus:border-[var(--fintheon-accent)]/50"
            >
              <option value="">None</option>
              {FLAW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Suggested score */}
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-zinc-500 shrink-0">Suggested:</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={suggestedScore}
              onChange={(e) => setSuggestedScore(e.target.value)}
              className="w-16 bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-[var(--fintheon-text)] font-mono outline-none focus:border-[var(--fintheon-accent)]/50"
              placeholder="0-10"
            />
          </div>

          {/* Save button + status */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (!comment.trim() && !flawTag && !suggestedScore)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" />
              {saving ? 'Saving...' : 'Save Annotation'}
            </button>
            {savedMsg && (
              <span className="text-[9px] text-[var(--fintheon-accent)]/80">{savedMsg}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
