import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
  pnl?: number;
  resonanceState?: 'Stable' | 'Tilt' | 'Neutral';
}

interface ThreadContextType {
  threads: Thread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  createThread: (title: string) => string;
  addMessage: (threadId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateThread: (threadId: string, updates: Partial<Thread>) => void;
  deleteThread: (threadId: string) => void;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = localStorage.getItem('pulse_threads');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const createThread = (title: string): string => {
    const newThread: Thread = {
      id: `thread_${Date.now()}`,
      title,
      createdAt: new Date(),
      messages: [],
      resonanceState: 'Neutral',
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    return newThread.id;
  };

  const addMessage = (threadId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
    };
    setThreads(prev =>
      prev.map(thread =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, newMessage] }
          : thread
      )
    );
  };

  const updateThread = (threadId: string, updates: Partial<Thread>) => {
    setThreads(prev =>
      prev.map(thread => (thread.id === threadId ? { ...thread, ...updates } : thread))
    );
  };

  const deleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(thread => thread.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
  };

  useEffect(() => {
    localStorage.setItem('pulse_threads', JSON.stringify(threads));
  }, [threads]);

  return (
    <ThreadContext.Provider
      value={{
        threads,
        activeThreadId,
        setActiveThreadId,
        createThread,
        addMessage,
        updateThread,
        deleteThread,
      }}
    >
      {children}
    </ThreadContext.Provider>
  );
}

export function useThread() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error('useThread must be used within a ThreadProvider');
  }
  return context;
}
