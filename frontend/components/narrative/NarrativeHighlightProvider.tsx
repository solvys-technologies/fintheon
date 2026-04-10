// [claude-code 2026-03-27] Highlight mode context — manages text selection → branch interaction

import React, { createContext, useContext, useState, useCallback } from "react";

interface HighlightContextValue {
  highlightMode: boolean;
  setHighlightMode: (on: boolean) => void;
  toggleHighlightMode: () => void;
  activeHighlight: { cardId: string; text: string } | null;
  setActiveHighlight: (h: { cardId: string; text: string } | null) => void;
  clearHighlight: () => void;
}

const HighlightCtx = createContext<HighlightContextValue | null>(null);

export function NarrativeHighlightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<{
    cardId: string;
    text: string;
  } | null>(null);

  const toggleHighlightMode = useCallback(() => {
    setHighlightMode((prev) => {
      if (prev) setActiveHighlight(null); // clear on deactivate
      return !prev;
    });
  }, []);

  const clearHighlight = useCallback(() => setActiveHighlight(null), []);

  return (
    <HighlightCtx.Provider
      value={{
        highlightMode,
        setHighlightMode,
        toggleHighlightMode,
        activeHighlight,
        setActiveHighlight,
        clearHighlight,
      }}
    >
      {children}
    </HighlightCtx.Provider>
  );
}

export function useHighlight(): HighlightContextValue {
  const ctx = useContext(HighlightCtx);
  if (!ctx)
    throw new Error(
      "useHighlight must be used within NarrativeHighlightProvider",
    );
  return ctx;
}
