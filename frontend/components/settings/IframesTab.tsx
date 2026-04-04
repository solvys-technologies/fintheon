// [claude-code 2026-04-04] T5: Settings iFrame list with persistent proposer default
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — iFrames settings tab
import React, { useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import type { ProposerIframeSource } from '../../contexts/SettingsContext';

interface IframesTabProps {
  iframeUrls: { boardroom: string; research: string };
  setIframeUrls: (urls: { boardroom: string; research: string }) => void;
  defaultLayout: string;
  setDefaultLayout: (layout: any) => void;
  defaultPlatform: string;
  setDefaultPlatform: (platform: any) => void;
  proposerIframeSources: ProposerIframeSource[];
  setProposerIframeSources: (sources: ProposerIframeSource[]) => void;
  proposerDefaultIframe: string;
  setProposerDefaultIframe: (id: string) => void;
}

export function IframesTab({
  iframeUrls, setIframeUrls,
  defaultLayout, setDefaultLayout,
  defaultPlatform, setDefaultPlatform,
  proposerIframeSources, setProposerIframeSources,
  proposerDefaultIframe, setProposerDefaultIframe,
}: IframesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAddCustom = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const id = `custom-${Date.now()}`;
    setProposerIframeSources([
      ...proposerIframeSources,
      { id, label: newLabel.trim(), url: newUrl.trim(), builtin: false },
    ]);
    setNewLabel('');
    setNewUrl('');
    setShowAddForm(false);
  };

  const handleDeleteCustom = (id: string) => {
    const updated = proposerIframeSources.filter(s => s.id !== id);
    setProposerIframeSources(updated);
    // If the deleted source was the default, reset to first available
    if (proposerDefaultIframe === id && updated.length > 0) {
      setProposerDefaultIframe(updated[0].id);
    }
  };

  return (
    <>
      {/* Proposer Default iFrame */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-2">Proposer Default</h3>
        <p className="text-xs text-gray-500 mb-4">Choose which iFrame loads as the default in the Proposals panel. The selected source persists across sessions.</p>

        <div className="space-y-1.5">
          {proposerIframeSources.map((source) => (
            <label
              key={source.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                proposerDefaultIframe === source.id
                  ? 'border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/8'
                  : 'border-zinc-800 hover:border-zinc-700 bg-[var(--fintheon-surface)]'
              }`}
            >
              <input
                type="radio"
                name="proposerDefault"
                value={source.id}
                checked={proposerDefaultIframe === source.id}
                onChange={() => setProposerDefaultIframe(source.id)}
                className="accent-[var(--fintheon-accent)] w-3.5 h-3.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{source.label}</span>
                  {source.builtin && (
                    <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-accent)]/50 font-semibold">Built-in</span>
                  )}
                </div>
                <span className="text-[11px] text-gray-500 truncate block">{source.url}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => { e.preventDefault(); window.open(source.url, '_blank'); }}
                  className="p-1 text-gray-500 hover:text-[var(--fintheon-accent)] transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={13} />
                </button>
                {!source.builtin && (
                  <button
                    onClick={(e) => { e.preventDefault(); handleDeleteCustom(source.id); }}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove custom source"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Add Custom */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--fintheon-accent)]/70 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            <Plus size={14} />
            Add Custom Source
          </button>
        ) : (
          <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-[var(--fintheon-surface)] space-y-2.5">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. My Dashboard)"
              className="w-full bg-[var(--fintheon-bg)] border border-zinc-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
            />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[var(--fintheon-bg)] border border-zinc-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCustom}
                disabled={!newLabel.trim() || !newUrl.trim()}
                className="px-3 py-1.5 text-[12px] font-medium rounded bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewLabel(''); setNewUrl(''); }}
                className="px-3 py-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Browser Defaults */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">Browser Defaults</h3>
        <p className="text-xs text-gray-500 mb-4">Set the default layout and platform when the Browser is opened.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Default Layout</label>
            <select
              value={defaultLayout}
              onChange={(e) => setDefaultLayout(e.target.value as any)}
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            >
              <option value="combined">Castra</option>
              <option value="tickers-only">Zen</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1">Castra = Mission Control + RiskFlow panels. Zen = clean minimal view.</p>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Default Platform</label>
            <select
              value={defaultPlatform}
              onChange={(e) => setDefaultPlatform(e.target.value as any)}
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            >
              <option value="tradesea">TradeSea</option>
              <option value="topstepx">TopStepX</option>
              <option value="mmt">MMT</option>
              <option value="kalshi">Kalshi</option>
              <option value="tradovate">Tradovate</option>
              <option value="research">Research</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1">Which platform loads when you open the Browser.</p>
          </div>
        </div>
      </section>

      {/* iFrame URLs */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">iFrame URLs</h3>
        <p className="text-xs text-gray-500 mb-4">Set embed URLs for integrated views. Leave blank to use defaults from environment variables.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Boardroom URL</label>
            <input
              type="url"
              value={iframeUrls.boardroom}
              onChange={(e) => setIframeUrls({ ...iframeUrls, boardroom: e.target.value })}
              placeholder={import.meta.env.VITE_NOTION_BOARDROOM_URL || 'https://www.notion.so/your-boardroom-page'}
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-gray-600">Embedded in the Board Room tab</p>
              <button
                onClick={() => window.open(iframeUrls.boardroom || import.meta.env.VITE_NOTION_BOARDROOM_URL || '', '_blank')}
                className="text-[11px] font-medium text-[var(--fintheon-accent)] hover:underline"
              >
                Login with Google
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Research URL</label>
            <input
              type="url"
              value={iframeUrls.research}
              onChange={(e) => setIframeUrls({ ...iframeUrls, research: e.target.value })}
              placeholder={import.meta.env.VITE_NOTION_RESEARCH_URL || 'https://www.notion.so/your-research-page'}
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-gray-600">Embedded in the Research tab and preloaded browser</p>
              <button
                onClick={() => window.open(iframeUrls.research || import.meta.env.VITE_NOTION_RESEARCH_URL || '', '_blank')}
                className="text-[11px] font-medium text-[var(--fintheon-accent)] hover:underline"
              >
                Login with Google
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
