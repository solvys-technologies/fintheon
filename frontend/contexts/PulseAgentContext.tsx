import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'offline';

export interface PulseAgent {
  id: string;
  name: string;
  nickname: string | null;
  sector: string;
  description: string;
  status: AgentStatus;
  model: string; // default model (read-only for users)
  icon: string; // single initial letter or emoji
  greeting: string | null;
  instructions_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Default agent roster — 6 Fintheon analysts                            */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();

export const PULSE_AGENTS: PulseAgent[] = [
  {
    id: 'harper',
    name: 'Harper',
    nickname: null,
    sector: 'Chief Analyst',
    description: 'Executive strategy and oversight',
    status: 'working',
    model: 'anthropic/claude-opus-4-6',
    icon: 'H',
    greeting: 'Harper here. What needs my attention?',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'oracle',
    name: 'Oracle',
    nickname: 'Consul',
    sector: 'Market Intelligence',
    description: 'Consul — market intelligence and macro reads',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'O',
    greeting: 'Oracle online. Scanning the macro landscape.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'feucht',
    name: 'Feucht',
    nickname: null,
    sector: 'Volatility',
    description: 'IV scoring and volatility analysis',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'F',
    greeting: 'Feucht here. Volatility surface loaded.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    nickname: 'Censori',
    sector: 'Compliance',
    description: 'Censori — compliance and moral oversight',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'S',
    greeting: 'Sentinel active. Monitoring risk parameters.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'charles',
    name: 'Oracle',
    nickname: 'The Pattern Diviner',
    sector: 'Quantitative',
    description: 'Oracle — quantitative pattern diviner',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'C',
    greeting: 'Oracle standing by. What patterns should we analyze?',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'horace',
    name: 'Horace',
    nickname: 'Herald',
    sector: 'Portfolio',
    description: 'Herald — portfolio communications and allocations',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'Ho',
    greeting: 'Horace here. What allocations need review?',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
];

/** Flat array of agent names for mention detection, boardroom routing, etc. */
export const KNOWN_AGENTS: string[] = PULSE_AGENTS.map((a) => a.name);

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface PulseAgentContextValue {
  agents: PulseAgent[];
  activeAgent: PulseAgent | null;
  setActiveAgent: (agent: PulseAgent | null) => void;
  setAgents: (agents: PulseAgent[]) => void;
  updateAgent: (id: string, updates: Partial<PulseAgent>) => void;
  createAgent: (name: string, sector: string) => PulseAgent;
  deleteAgent: (id: string) => void;
}

const PulseAgentContext = createContext<PulseAgentContextValue>({
  agents: [],
  activeAgent: null,
  setActiveAgent: () => {},
  setAgents: () => {},
  updateAgent: () => {},
  createAgent: () => ({}) as PulseAgent,
  deleteAgent: () => {},
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function PulseAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<PulseAgent[]>(PULSE_AGENTS);
  const [activeAgent, setActiveAgent] = useState<PulseAgent | null>(PULSE_AGENTS[0] || null);

  const updateAgent = useCallback((id: string, updates: Partial<PulseAgent>) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates, updated_at: now() } : a)),
    );
  }, []);

  const createAgent = useCallback((name: string, sector: string): PulseAgent => {
    const ts = now();
    const newAgent: PulseAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      nickname: null,
      sector,
      description: '',
      status: 'idle',
      model: 'anthropic/claude-opus-4-6',
      icon: name.charAt(0).toUpperCase(),
      greeting: null,
      instructions_doc_id: null,
      created_at: ts,
      updated_at: ts,
    };
    setAgents((prev) => [...prev, newAgent]);
    return newAgent;
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <PulseAgentContext.Provider
      value={{ agents, activeAgent, setActiveAgent, setAgents, updateAgent, createAgent, deleteAgent }}
    >
      {children}
    </PulseAgentContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const usePulseAgents = () => useContext(PulseAgentContext);
