// [claude-code 2026-04-11] S14-T8: CAO name synced from SettingsContext on load
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSettings } from "./SettingsContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgentStatus = "idle" | "working" | "blocked" | "offline";

export interface FintheonAgent {
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

export const FINTHEON_AGENTS: FintheonAgent[] = [
  {
    id: "harper",
    name: "Harper",
    nickname: null,
    sector: "CAO",
    description: "Chief Analyst Officer — executive strategy and oversight",
    status: "working",
    model: "anthropic/claude-opus-4-6",
    icon: "H",
    greeting: "Harper online. What needs my attention?",
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "oracle",
    name: "Oracle",
    nickname: null,
    sector: "All-Seer",
    description:
      "Merged PMA — prediction markets, macro reads, and execution oversight",
    status: "idle",
    model: "anthropic/claude-opus-4-6",
    icon: "O",
    greeting: "Oracle online. All-seeing analysis engaged.",
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "feucht",
    name: "Feucht",
    nickname: null,
    sector: "Futures, Execution & Risk",
    description:
      "Futures desk, IV/volatility, risk management, scheduled tasks",
    status: "idle",
    model: "anthropic/claude-opus-4-6",
    icon: "F",
    greeting: "Feucht here. Volatility surface and risk parameters loaded.",
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "consul",
    name: "Consul",
    nickname: null,
    sector: "Fundamentals",
    description: "Mega-caps desk — fundamentals analysis",
    status: "idle",
    model: "anthropic/claude-opus-4-6",
    icon: "C",
    greeting: "Consul standing by. Fundamentals desk ready.",
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "herald",
    name: "Herald",
    nickname: null,
    sector: "News & Sentiment",
    description: "News sentiment and social signals",
    status: "idle",
    model: "anthropic/claude-opus-4-6",
    icon: "He",
    greeting: "Herald here. Reading the room.",
    instructions_doc_id: null,
    created_at: now(),
    updated_at: now(),
  },
];

/** Flat array of agent names for mention detection, boardroom routing, etc. */
export const KNOWN_AGENTS: string[] = FINTHEON_AGENTS.map((a) => a.name);

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface FintheonAgentContextValue {
  agents: FintheonAgent[];
  activeAgent: FintheonAgent | null;
  setActiveAgent: (agent: FintheonAgent | null) => void;
  setAgents: (agents: FintheonAgent[]) => void;
  updateAgent: (id: string, updates: Partial<FintheonAgent>) => void;
  createAgent: (name: string, sector: string) => FintheonAgent;
  deleteAgent: (id: string) => void;
}

const FintheonAgentContext = createContext<FintheonAgentContextValue>({
  agents: [],
  activeAgent: null,
  setActiveAgent: () => {},
  setAgents: () => {},
  updateAgent: () => {},
  createAgent: () => ({}) as FintheonAgent,
  deleteAgent: () => {},
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function FintheonAgentProvider({ children }: { children: ReactNode }) {
  const { caoName } = useSettings();
  const [agents, setAgents] = useState<FintheonAgent[]>(FINTHEON_AGENTS);
  const [activeAgent, setActiveAgent] = useState<FintheonAgent | null>(
    FINTHEON_AGENTS[0] || null,
  );

  // Sync persisted CAO name into agent roster when settings load
  useEffect(() => {
    if (caoName && caoName !== "Harper") {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === "harper" ? { ...a, name: caoName, updated_at: now() } : a,
        ),
      );
      setActiveAgent((prev) =>
        prev?.id === "harper"
          ? { ...prev, name: caoName, updated_at: now() }
          : prev,
      );
    }
  }, [caoName]);

  const updateAgent = useCallback(
    (id: string, updates: Partial<FintheonAgent>) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, ...updates, updated_at: now() } : a,
        ),
      );
    },
    [],
  );

  const createAgent = useCallback(
    (name: string, sector: string): FintheonAgent => {
      const ts = now();
      const newAgent: FintheonAgent = {
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        nickname: null,
        sector,
        description: "",
        status: "idle",
        model: "anthropic/claude-opus-4-6",
        icon: name.charAt(0).toUpperCase(),
        greeting: null,
        instructions_doc_id: null,
        created_at: ts,
        updated_at: ts,
      };
      setAgents((prev) => [...prev, newAgent]);
      return newAgent;
    },
    [],
  );

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <FintheonAgentContext.Provider
      value={{
        agents,
        activeAgent,
        setActiveAgent,
        setAgents,
        updateAgent,
        createAgent,
        deleteAgent,
      }}
    >
      {children}
    </FintheonAgentContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useFintheonAgents = () => useContext(FintheonAgentContext);
