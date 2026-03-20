import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { SystemEvent } from "~backend/events/list";
import { AlertCircle, CheckCircle, Info, XCircle, FileText, Trash2 } from "lucide-react";
import { NTNReportModal } from "./NTNReportModal";

export default function SystemFeed() {
  const backend = useBackend();
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [showNTNModal, setShowNTNModal] = useState(false);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(() => {
      loadEvents();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    try {
      const data = await backend.events.list({ limit: 50 });
      setEvents(data.events);
    } catch (error: any) {
      console.error('Failed to load events:', error);
      if (error.code === "not_found" || error.code === "unauthenticated") {
        try {
          await backend.events.seed();
          const data = await backend.events.list({ limit: 50 });
          setEvents(data.events);
        } catch (seedError) {
          console.error('Failed to seed events:', seedError);
        }
      }
    }
  };

  const handleClear = () => {
    if (confirm("Clear all system feed events?")) {
      setEvents([]);
      // Optionally call backend to clear events permanently
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-[#00FF85]" />;
      case "error":
        return <XCircle className="w-4 h-4 text-[#FF4040]" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-[#D4AF37]" />;
      default:
        return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "trade":
        return "text-[#00FF85]";
      case "alert":
        return "text-[#D4AF37]";
      case "error":
        return "text-[#FF4040]";
      default:
        return "text-zinc-500";
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <>
      {showNTNModal && <NTNReportModal onClose={() => setShowNTNModal(false)} />}

      <div className="h-full flex flex-col">
        {/* Header with CTAs */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900">
          <h2 className="text-lg font-bold text-zinc-300">System Feed</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNTNModal(true)}
              className="px-4 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-medium transition-colors flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              Run NTN Report
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-full text-xs font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Events */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-[#0a0a00] border border-zinc-900 rounded-lg p-4 hover:border-zinc-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {getIcon(event.severity)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h4 className="text-sm font-medium text-white">{event.title}</h4>
                      <span className={`text-[9px] uppercase tracking-wider ${getTypeColor(event.eventType)}`}>
                        {event.eventType}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mb-2">{event.message}</p>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-600 font-mono">{formatTime(event.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
