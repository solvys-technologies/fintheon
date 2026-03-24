// [claude-code 2026-03-13] T1: visual redesign — elevated cards, 48px avatar, sector pills, model badge
import { useState, useCallback } from 'react';
import { Save, Plus, X, Check, Users } from 'lucide-react';
import { useFintheonAgents, type FintheonAgent } from '../../contexts/FintheonAgentContext';
import { DEFAULT_MODEL_NAME } from '../../lib/FintheonModelCatalog';
import { useToast } from '../../contexts/ToastContext';

/* ------------------------------------------------------------------ */
/*  Draft system — track unsaved edits per agent                       */
/* ------------------------------------------------------------------ */

interface AgentDraft {
  name: string;
  nickname: string;
  description: string;
  sector: string;
  instructions_doc_id: string;
}

function agentToDraft(a: FintheonAgent): AgentDraft {
  return {
    name: a.name,
    nickname: a.nickname || '',
    description: a.description,
    sector: a.sector,
    instructions_doc_id: a.instructions_doc_id || '',
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ClawnalystDesk() {
  const { agents, updateAgent, createAgent, deleteAgent } = useFintheonAgents();
  const { addToast } = useToast();

  // Drafts map: agentId -> AgentDraft
  const [drafts, setDrafts] = useState<Record<string, AgentDraft>>(() => {
    const m: Record<string, AgentDraft> = {};
    agents.forEach((a) => { m[a.id] = agentToDraft(a); });
    return m;
  });

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [newAgentPopup, setNewAgentPopup] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('');

  const getDraft = (id: string): AgentDraft => {
    if (drafts[id]) return drafts[id];
    const a = agents.find((x) => x.id === id);
    return a ? agentToDraft(a) : { name: '', nickname: '', description: '', sector: '', instructions_doc_id: '' };
  };

  const setField = (id: string, field: keyof AgentDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(id), [field]: value },
    }));
  };

  /* Save all agents */
  const saveAll = useCallback(() => {
    agents.forEach((a) => {
      const d = getDraft(a.id);
      updateAgent(a.id, {
        name: d.name,
        nickname: d.nickname || null,
        description: d.description,
        sector: d.sector,
        instructions_doc_id: d.instructions_doc_id || null,
      });
    });
    setSavedIds(new Set(agents.map((a) => a.id)));
    setTimeout(() => setSavedIds(new Set()), 2000);
    addToast('All analysts saved', 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, drafts, updateAgent, addToast]);

  /* Create new agent */
  const handleCreate = () => {
    if (!newName.trim()) return;
    const a = createAgent(newName.trim(), newSector.trim() || 'General');
    setDrafts((prev) => ({ ...prev, [a.id]: agentToDraft(a) }));
    setNewAgentPopup(false);
    setNewName('');
    setNewSector('');
    addToast(`${a.name} added to the desk`, 'success');
  };

  const isDefaultAgent = (id: string) =>
    ['harper-hermes', 'oracle', 'feucht', 'consul', 'herald'].includes(id);

  return (
    <div className="h-full overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          onClick={saveAll}
          title="Save all analysts"
          className="flex items-center justify-center rounded-[8px] border border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)] hover:text-black transition-all duration-200 active:scale-[0.93]"
          style={{ width: '34px', height: '34px', flexShrink: 0 }}
        >
          <Save size={15} />
        </button>
        <button
          onClick={() => { setNewName(''); setNewSector(''); setNewAgentPopup(true); }}
          title="Add new analyst"
          className="flex items-center justify-center rounded-[8px] border border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)] hover:text-black transition-all duration-200 active:scale-[0.93]"
          style={{ width: '34px', height: '34px', flexShrink: 0 }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Harper-Hermes — elevated lead card, centered */}
      {agents.filter((a) => a.id === 'harper-hermes').map((agent) => {
        const draft = getDraft(agent.id);
        const isSaved = savedIds.has(agent.id);
        return (
          <div key={agent.id} className="max-w-xl mx-auto mb-6">
            <AgentCard agent={agent} draft={draft} isSaved={isSaved} getDraft={getDraft} setField={setField} isDefaultAgent={isDefaultAgent} deleteAgent={deleteAgent} addToast={addToast} />
          </div>
        );
      })}

      {/* Remaining agents — 2x2 grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {agents.filter((a) => a.id !== 'harper-hermes').map((agent) => {
          const draft = getDraft(agent.id);
          const isSaved = savedIds.has(agent.id);
          return (
            <AgentCard key={agent.id} agent={agent} draft={draft} isSaved={isSaved} getDraft={getDraft} setField={setField} isDefaultAgent={isDefaultAgent} deleteAgent={deleteAgent} addToast={addToast} />
          );
        })}
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="text-center text-[13px] text-gray-500 py-10">
          No analysts configured. Click the + button to add your first analyst.
        </div>
      )}

      {/* Footer CTA */}
      <div
        className="border border-dashed border-[var(--fintheon-accent)]/20 rounded-lg flex flex-col items-center justify-center mt-4"
        style={{ padding: '24px' }}
      >
        <p className="text-[13px] text-gray-500 mb-2.5">
          Add more analysts to your desk
        </p>
        <button
          onClick={() => { setNewName(''); setNewSector(''); setNewAgentPopup(true); }}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 rounded-md px-3 py-1.5 hover:bg-[var(--fintheon-accent)]/10 transition-colors"
        >
          <Plus size={14} /> New Analyst
        </button>
      </div>

      {/* New Agent Popup */}
      {newAgentPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ padding: '24px' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNewAgentPopup(false)} />
          <div
            className="relative w-full max-w-[380px] rounded-lg bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 overflow-hidden"
            style={{ boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
          >
            <div style={{ padding: '20px 20px 0' }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: '36px', height: '36px', backgroundColor: 'rgba(212,175,55,0.1)' }}
                >
                  <Users size={18} style={{ color: 'var(--fintheon-accent)' }} />
                </div>
                <h3 className="text-[14px] font-semibold text-white">New Analyst</h3>
              </div>
            </div>
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setNewAgentPopup(false); }}
                  className="w-full rounded-md border border-[var(--fintheon-accent)]/20 bg-[#0b0b08] text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/50 px-3 py-2"
                  placeholder="Enter analyst name..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Sector</label>
                <input
                  type="text"
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setNewAgentPopup(false); }}
                  className="w-full rounded-md border border-[var(--fintheon-accent)]/20 bg-[#0b0b08] text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/50 px-3 py-2"
                  placeholder="e.g. Macro Intelligence, Execution"
                />
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-[var(--fintheon-accent)]/15 px-4 py-3 gap-2">
              <button
                onClick={() => setNewAgentPopup(false)}
                className="text-[13px] font-medium rounded-md text-gray-400 hover:bg-[var(--fintheon-accent)]/10 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="text-[13px] font-medium rounded-md text-black bg-[var(--fintheon-accent)] px-4 py-2 transition-colors focus:outline-none disabled:opacity-40 hover:bg-[#C5A030]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent card — extracted to share between lead + grid                 */
/* ------------------------------------------------------------------ */

function AgentCard({
  agent,
  draft,
  isSaved,
  getDraft: _getDraft,
  setField,
  isDefaultAgent,
  deleteAgent,
  addToast,
}: {
  agent: FintheonAgent;
  draft: AgentDraft;
  isSaved: boolean;
  getDraft: (id: string) => AgentDraft;
  setField: (id: string, field: keyof AgentDraft, value: string) => void;
  isDefaultAgent: (id: string) => boolean;
  deleteAgent: (id: string) => void;
  addToast: (msg: string, type: 'success' | 'info') => void;
}) {
  return (
    <div
      className="border border-[var(--fintheon-accent)]/15 hover:border-[var(--fintheon-accent)]/35 bg-[#0b0b08] rounded-lg transition-all duration-200"
      style={{ padding: '20px 22px' }}
    >
      {/* Card header: avatar + name/nickname + sector pill */}
      <div className="flex items-start gap-3.5 mb-4">
        <div
          className="flex items-center justify-center rounded-full bg-[var(--fintheon-accent)]/10 text-xl shrink-0"
          style={{ width: '48px', height: '48px' }}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-white truncate">{agent.name}</span>
            {draft.nickname && (
              <span className="text-[12px] italic text-gray-500 truncate">"{draft.nickname}"</span>
            )}
          </div>
          <span
            className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[180px]"
            style={{ backgroundColor: 'rgba(217,119,6,0.1)', color: '#D97706' }}
          >
            {DEFAULT_MODEL_NAME}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {draft.sector && (
            <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/70 bg-[var(--fintheon-accent)]/5">
              {draft.sector}
            </span>
          )}
          {!isDefaultAgent(agent.id) && (
            <button
              onClick={() => { deleteAgent(agent.id); addToast(`${agent.name} removed`, 'info'); }}
              className="text-gray-600 hover:text-red-400 transition-colors"
              title="Remove analyst"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Card body: editable fields */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Name" value={draft.name} onChange={(v) => setField(agent.id, 'name', v)} placeholder="Analyst name" />
          <Field label="Nickname" value={draft.nickname} onChange={(v) => setField(agent.id, 'nickname', v)} placeholder="e.g. 'The Oracle'" />
        </div>
        <Field label="Sector" value={draft.sector} onChange={(v) => setField(agent.id, 'sector', v)} placeholder="e.g. Macro Intelligence" />
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => setField(agent.id, 'description', e.target.value)}
            className="w-full rounded-md border border-[var(--fintheon-accent)]/15 bg-[#070704] text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/40 px-3 py-2 transition-colors resize-none"
            placeholder="Short description of this analyst's role"
            rows={2}
          />
        </div>
        <Field label="Instructions Doc ID" value={draft.instructions_doc_id} onChange={(v) => setField(agent.id, 'instructions_doc_id', v)} placeholder="Notion page ID (optional)" />
      </div>

      {/* Card footer: save indicator */}
      <div className="flex items-center justify-end mt-3 min-h-[20px]">
        {isSaved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <Check size={11} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable field                                                     */
/* ------------------------------------------------------------------ */

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--fintheon-accent)]/15 bg-[#070704] text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/40 px-3 py-2 transition-colors"
        placeholder={placeholder}
      />
    </div>
  );
}
