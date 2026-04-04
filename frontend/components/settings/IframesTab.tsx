// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — iFrames settings tab
import React from 'react';

interface IframesTabProps {
  iframeUrls: { boardroom: string; research: string };
  setIframeUrls: (urls: { boardroom: string; research: string }) => void;
  defaultLayout: string;
  setDefaultLayout: (layout: any) => void;
  defaultPlatform: string;
  setDefaultPlatform: (platform: any) => void;
}

export function IframesTab({
  iframeUrls, setIframeUrls,
  defaultLayout, setDefaultLayout,
  defaultPlatform, setDefaultPlatform,
}: IframesTabProps) {
  return (
    <>
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
