// [claude-code 2026-03-10] T3: MCP Connector Popup — toggle active MCP servers per session
import { X, Plug2, AlertTriangle } from 'lucide-react';
import type { McpServerConfig, McpServerId } from '../../types/mcp';

export interface McpConnectorPopupProps {
  open: boolean;
  servers: McpServerConfig[];
  activeIds: McpServerId[];
  onToggle: (id: McpServerId, enabled: boolean) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<McpServerConfig['category'], string> = {
  data: 'Data',
  search: 'Search',
  browser: 'Browser',
  productivity: 'Productivity',
  social: 'Social',
};

const CATEGORY_ORDER: McpServerConfig['category'][] = ['data', 'search', 'social', 'browser', 'productivity'];

function StatusDot({ server }: { server: McpServerConfig }) {
  if (!server.installed) {
    return <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 flex-shrink-0" title="Not installed" />;
  }
  if (server.requiresApiKey && !server.hasApiKey) {
    return <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/80 flex-shrink-0" title="API key required" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 flex-shrink-0" title="Ready" />;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[var(--fintheon-accent)]' : 'bg-white/10'}`}
    >
      <span
        className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function McpConnectorPopup({ open, servers, activeIds, onToggle, onClose }: McpConnectorPopupProps) {
  const activeCount = activeIds.length;
  const totalCount = servers.length;

  // Group by category, preserve CATEGORY_ORDER
  const grouped = CATEGORY_ORDER.reduce<Record<string, McpServerConfig[]>>((acc, cat) => {
    const items = servers.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-[var(--fintheon-accent)]/20 transition-all duration-200"
      style={{
        maxHeight: open ? '440px' : '0px',
        opacity: open ? 1 : 0,
        marginBottom: open ? '8px' : '0px',
        backgroundColor: '#0a0805',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-1.5">
          <Plug2 size={12} className="text-[var(--fintheon-accent)]/70" />
          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Connectors</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Scrollable server list */}
      <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
        {servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-500">
            <Plug2 size={20} className="text-gray-600" />
            <p className="text-[12px]">No connectors configured.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              {/* Category header */}
              <div className="px-3 pt-2.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fintheon-accent)]/40">
                  {CATEGORY_LABELS[category as McpServerConfig['category']]}
                </span>
              </div>

              {/* Server cards */}
              {items.map((server) => {
                const isActive = activeIds.includes(server.id);
                const canToggle = server.installed;

                return (
                  <div
                    key={server.id}
                    className="flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.025] transition-colors"
                  >
                    {/* Status dot */}
                    <div className="mt-1.5">
                      <StatusDot server={server} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[12px] font-semibold text-[var(--fintheon-text)] truncate">{server.name}</span>
                        {server.toolCount !== undefined && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium flex-shrink-0">
                            {server.toolCount} tools
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-tight truncate">{server.description}</p>
                      {server.requiresApiKey && !server.hasApiKey && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle size={9} className="text-yellow-500/70" />
                          <span className="text-[10px] text-yellow-500/70">API key required</span>
                        </div>
                      )}
                    </div>

                    {/* Toggle */}
                    <div className="mt-1 flex-shrink-0">
                      <Toggle
                        checked={isActive && canToggle}
                        onChange={(v) => onToggle(server.id, v)}
                        disabled={!canToggle}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {servers.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-between">
          <span className="text-[10px] text-gray-600">
            {activeCount} of {totalCount} active
          </span>
          {activeCount === 0 && (
            <span className="text-[10px] text-yellow-500/60">No connectors active — tools unavailable</span>
          )}
        </div>
      )}
    </div>
  );
}
