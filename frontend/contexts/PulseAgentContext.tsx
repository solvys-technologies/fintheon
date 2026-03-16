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
/*  Default agent roster — 5 Fintheon analysts (v7.9)                   */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();

export const PULSE_AGENTS: PulseAgent[] = [
  {
    id: 'harper-hermes',
    name: 'Harper-Hermes',
    nickname: null,
    sector: 'CAO',
    description: 'Chief Analyst Officer — executive strategy and oversight',
    status: 'working',
    model: 'anthropic/claude-opus-4-6',
    icon: 'H',
    greeting: 'Harper-Hermes online. What needs my attention?',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'oracle',
    name: 'Oracle',
    nickname: null,
    sector: 'All-Seer',
    description: 'Merged PMA — prediction markets, macro reads, and execution oversight',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'O',
    greeting: 'Oracle online. All-seeing analysis engaged.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'feucht',
    name: 'Feucht',
    nickname: null,
    sector: 'Futures, Execution & Risk',
    description: 'Futures desk, IV/volatility, risk management, scheduled tasks',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'F',
    greeting: 'Feucht here. Volatility surface and risk parameters loaded.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'consul',
    name: 'Consul',
    nickname: null,
    sector: 'Fundamentals',
    description: 'Mega-caps desk — fundamentals analysis',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'C',
    greeting: 'Consul standing by. Fundamentals desk ready.',
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'herald',
    name: 'Herald',
    nickname: null,
    sector: 'News & Sentiment',
    description: 'News sentiment and social signals',
    status: 'idle',
    model: 'anthropic/claude-opus-4-6',
    icon: 'He',
    greeting: 'Herald here. Reading the room.',
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
