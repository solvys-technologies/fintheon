// [claude-code 2026-03-20] ConsiliumHub — unified Auditorium + AgentChattr with 4 sub-tabs
import { useState, useCallback } from 'react';
import { MessageSquare, LineChart, Clock, Trophy } from 'lucide-react';
import { AgentChattr } from './AgentChattr';
import { DevelopmentsTimeline } from './DevelopmentsTimeline';
import { AgentScorecard } from './AgentScorecard';
import { Auditorium } from '../narrative/Auditorium';
import type { AuditoriumData } from '../../types/mirofish';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type ConsiliumTab = 'chat' | 'predictions' | 'timeline' | 'scorecards';

const TABS: { id: ConsiliumTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'predictions', label: 'Predictions', icon: LineChart },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'scorecards', label: 'Scorecards', icon: Trophy },
];

export function ConsiliumHub() {
  const [activeTab, setActiveTab] = useState<ConsiliumTab>('chat');
  const [mirofishData, setMirofishData] = useState<AuditoriumData | null>(null);

  const handleRunMiroFish = useCallback(async () => {
    setMirofishData(prev => prev
      ? { ...prev, status: 'running' }
      : { simulationId: '', status: 'running', compositeIV: 0, confidence: 0, regimeShiftProbability: 0, categoryScores: [], timeSeries: [], generatedEvents: [], scenarios: [] }
    );

    try {
      const simRes = await fetch(`${API_BASE}/api/mirofish/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrativeState: { lanes: [], catalysts: [], ropes: [] } }),
      });

      if (!simRes.ok) throw new Error(`Simulation failed: ${simRes.status}`);
      const { simulationId } = await simRes.json();

      const reportRes = await fetch(`${API_BASE}/api/mirofish/report/${simulationId}`);
      if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`);
      const report = await reportRes.json();

      setMirofishData({
        simulationId,
        status: 'complete',
        compositeIV: report.nextSessionScore ?? 5,
        confidence: report.confidence ?? 0.5,
        regimeShiftProbability: report.regimeShiftProbability ?? 0.1,
        categoryScores: report.categoryScores ?? [],
        timeSeries: report.timeSeries ?? [],
        generatedEvents: report.generatedEvents ?? [],
        scenarios: report.scenarios ?? [],
      });
    } catch (err) {
      console.error('[MiroFish] Run failed:', err);
      setMirofishData(prev => prev
        ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
        : null
      );
    }
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#050402]">
      {/* Header + sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-[#c79f4a]/15 px-4">
        <h2 className="mr-3 py-3 text-sm font-medium uppercase tracking-[0.2em] text-[#c79f4a]">
          Consilium
        </h2>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 rounded-t px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === id
                ? 'bg-[#D4AF37] text-black'
                : 'text-[#D4AF37]/60 hover:bg-[#D4AF37]/10'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && <AgentChattr />}
        {activeTab === 'predictions' && (
          <div className="h-full [&>div]:w-full [&>div]:border-l-0">
            <Auditorium
              data={mirofishData}
              onRun={handleRunMiroFish}
              catalysts={[]}
            />
          </div>
        )}
        {activeTab === 'timeline' && <DevelopmentsTimeline />}
        {activeTab === 'scorecards' && <AgentScorecard />}
      </div>
    </div>
  );
}
