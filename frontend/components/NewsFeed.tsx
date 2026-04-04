import { useEffect, useState, useRef, useCallback } from "react";
import { useBackend } from "../lib/backend";
import { useSettings } from "../contexts/SettingsContext";
import type { RiskFlowItem } from "../types/api";
import { Diff, AlertTriangle, Info } from "lucide-react";
import { Button } from "./ui/Button";
import { useRiskFlowSSE } from "../hooks/useRiskFlow";

export default function NewsFeed() {
  const backend = useBackend();
  const { selectedSymbol } = useSettings();
  const [riskflow, setRiskflow] = useState<RiskFlowItem[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevSymbolRef = useRef<string | null>(null);

  const availableSymbols = ['MNQ', 'ES', 'NQ', 'YM', 'RTY', 'Polymarket'];

  // Extract base symbol from contract name (e.g., "/MNQ" -> "MNQ")
  const getBaseSymbol = (symbol: string) => {
    return symbol.replace(/^\//, '').replace(/[A-Z]\d{2}$/, '');
  };

  // Auto-fetch on startup and when instrument changes
  useEffect(() => {
    const currentSymbol = getBaseSymbol(selectedSymbol.symbol);

    // Check if symbol changed (clear and re-fetch)
    if (prevSymbolRef.current !== null && prevSymbolRef.current !== currentSymbol) {
      setRiskflow([]); // Clear existing items on instrument change
    }

    prevSymbolRef.current = currentSymbol;
    loadRiskFlow(currentSymbol);

    // Set up 15s polling
    const interval = setInterval(() => {
      loadRiskFlow(currentSymbol);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedSymbol.symbol]);

  const handleBreakingNews = useCallback((item: RiskFlowItem) => {
    setRiskflow((prev) => [item, ...prev].slice(0, 15));
  }, []);

  useRiskFlowSSE(handleBreakingNews);

  const loadRiskFlow = async (symbol?: string) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Fetch 15 items relevant to the user's selected instrument
      const data = await backend.riskflow.list({
        limit: 15,
        instrument: symbol ? `/${symbol}` : undefined, // Match RiskFlowContext format
      });
      setRiskflow(data.items);
    } catch (error: any) {
      console.warn('Failed to load RiskFlow:', error);
      if (error.code === "not_found" || error.code === "unauthenticated") {
        try {
          await backend.riskflow.seed();
          const newData = await backend.riskflow.list({ limit: 15 });
          setRiskflow(newData.items);
        } catch (seedError) {
          console.warn('Failed to seed RiskFlow:', seedError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "high":
        return <AlertTriangle className="w-4 h-4 text-[#FF4040]" />;
      case "medium":
        return <Diff className="w-4 h-4 text-[var(--fintheon-accent)]" />;
      default:
        return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-[#FF4040] bg-[#FF4040]/10";
      case "medium":
        return "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10";
      default:
        return "text-zinc-500 bg-zinc-900/50";
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const filteredRiskFlow = selectedSymbols.length > 0
    ? riskflow.filter(item =>
      selectedSymbols.some(symbol => {
        if (symbol === 'Polymarket') {
          return item.source === 'Polymarket';
        }
        return item.title.toLowerCase().includes(symbol.toLowerCase()) ||
          item.content?.toLowerCase().includes(symbol.toLowerCase())
      })
    )
    : riskflow;

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-zinc-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 mr-2">Filter by Symbol:</span>
            {availableSymbols.map(symbol => (
              <Button
                key={symbol}
                variant={selectedSymbols.includes(symbol) ? 'primary' : 'secondary'}
                onClick={() => toggleSymbol(symbol)}
                className="text-xs px-3 py-1"
              >
                /{symbol}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredRiskFlow.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--fintheon-surface)] border border-zinc-900 rounded-lg p-4 hover:border-zinc-800 transition-colors"
            >
              <div className="flex items-start gap-3">
                {getImpactIcon(item.impact || 'low')}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-white leading-tight hover:underline hover:text-blue-400 transition-colors"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <h3 className="text-sm font-medium text-white leading-tight">{item.title}</h3>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        (item.ivScore || 0) >= 7 ? 'text-red-400 bg-red-500/10' :
                        (item.ivScore || 0) >= 4 ? 'text-yellow-400 bg-yellow-500/10' :
                        'text-emerald-400 bg-emerald-500/10'
                      }`}>
                        IV {(item.ivScore || 0).toFixed(1)}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${getImpactColor(item.impact || 'low')}`}>
                        {item.impact || 'low'}
                      </span>
                    </div>
                  </div>

                  {item.content && (
                    <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{item.content}</p>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-zinc-600 mt-2">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-400 border border-zinc-800">
                      {item.source}
                    </span>
                    {item.category && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--fintheon-accent)]/60">{item.category}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formatDate(item.publishedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
