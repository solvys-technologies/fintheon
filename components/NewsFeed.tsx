import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { NewsItem } from "~backend/news/list";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Button } from "./ui/Button";
import { IVScoreCard } from "./IVScoreCard";

export default function NewsFeed() {
  const backend = useBackend();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  
  const availableSymbols = ['MNQ', 'ES', 'NQ', 'YM', 'RTY'];
  
  useEffect(() => {
    loadNews();
    const interval = setInterval(() => {
      loadNews();
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const loadNews = async () => {
    try {
      const data = await backend.news.list({ limit: 20 });
      setNews(data.items);
    } catch (error: any) {
      console.error('Failed to load news:', error);
      if (error.code === "not_found" || error.code === "unauthenticated") {
        try {
          await backend.news.seed();
          const newData = await backend.news.list({ limit: 20 });
          setNews(newData.items);
        } catch (seedError) {
          console.error('Failed to seed news:', seedError);
        }
      }
    }
  };
  
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "high":
        return <AlertTriangle className="w-4 h-4 text-[#FF4040]" />;
      case "medium":
        return <TrendingUp className="w-4 h-4 text-[#D4AF37]" />;
      default:
        return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };
  
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-[#FF4040] bg-[#FF4040]/10";
      case "medium":
        return "text-[#D4AF37] bg-[#D4AF37]/10";
      default:
        return "text-zinc-500 bg-zinc-900/50";
    }
  };
  
  const formatDate = (date: Date) => {
    const d = new Date(date);
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
  
  const filteredNews = selectedSymbols.length > 0
    ? news.filter(item => 
        selectedSymbols.some(symbol => 
          item.title.toLowerCase().includes(symbol.toLowerCase()) ||
          item.content?.toLowerCase().includes(symbol.toLowerCase())
        )
      )
    : news;

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
        {filteredNews.map((item) => (
          <div
            key={item.id}
            className="bg-[#0a0a00] border border-zinc-900 rounded-lg p-4 hover:border-zinc-800 transition-colors"
          >
            <div className="flex items-start gap-3">
              {getImpactIcon(item.impact)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-medium text-white leading-tight">{item.title}</h3>
                  <div className="flex items-center gap-2">
                    <IVScoreCard score={item.ivScore} />
                    <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${getImpactColor(item.impact)}`}>
                      {item.impact}
                    </span>
                  </div>
                </div>
                
                {item.content && (
                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{item.content}</p>
                )}
                
                <div className="flex items-center gap-3 text-[9px] text-zinc-600">
                  <span className="text-[#D4AF37]/60">{item.category}</span>
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
