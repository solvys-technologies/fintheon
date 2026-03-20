// [claude-code 2026-03-16] Global auto-refresh toggle — pill switch next to RefreshCw icons
import { useSettings } from '../../contexts/SettingsContext';

export function AutoRefreshToggle({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const { autoRefresh, setAutoRefresh } = useSettings();

  const h = size === 'xs' ? 'h-3' : 'h-3.5';
  const w = size === 'xs' ? 'w-6' : 'w-7';
  const dot = size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const translate = size === 'xs' ? 'translate-x-3' : 'translate-x-3.5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoRefresh}
      onClick={() => setAutoRefresh(!autoRefresh)}
      className={`relative inline-flex ${h} ${w} items-center rounded-full transition-colors shrink-0 ${
        autoRefresh
          ? 'bg-[var(--fintheon-accent)]/30 border border-[var(--fintheon-accent)]/50'
          : 'bg-zinc-800 border border-zinc-700'
      }`}
      title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
    >
      <span
        className={`inline-block ${dot} rounded-full transition-transform ${
          autoRefresh
            ? `${translate} bg-[var(--fintheon-accent)]`
            : 'translate-x-0.5 bg-zinc-500'
        }`}
      />
    </button>
  );
}
