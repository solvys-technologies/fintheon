// [claude-code 2026-03-11] T3c: QuickPulse prefix updated for auto-screenshot via Playwright
export const SKILL_PREFIXES: Record<string, string> = {
  brief: '[SKILL:BRIEF] Search the web for the latest information about the instrument mentioned, summarize findings, and interpret what it means for the user\'s position or thesis. Check active trading regimes for timing context. Be concise and actionable.',
  validate: '[SKILL:VALIDATE] Act as Herald (risk validation). Analyze the validity of the user\'s thesis against: (1) current research narratives we\'re tracking, (2) memos we\'ve published, (3) current news via web search, (4) check active trading regimes for timing context. Assess market risk and provide a confidence-weighted verdict.',
  report: '[SKILL:REPORT] Generate an HTML dashboard report. Use the Solvys Gold palette (#D4AF37 accent, #050402 bg, #f0ead6 text). The report should be self-contained HTML with <!-- PULSE_REPORT --> as the first comment. Include inline CSS. Make it visually polished.',
  track: '[SKILL:TRACK] Start building a new narrative thread. Identify the key thesis, relevant instruments, catalysts, and timeline. Format as a structured narrative entry suitable for a sprint board.',
  psych_assist: '[SKILL:PSYCH] Run psychological/performance analysis. Evaluate trading behavior patterns, emotional state indicators, decision quality, and provide actionable coaching. Be empathetic but direct.',
  maintenance: '[SKILL:MAINTENANCE] Perform app maintenance. Review recent changes, update changelog, and report status. Format updates as structured status messages.',
  quick_pulse: '[SKILL:QUICKPULSE] Take a screenshot of the current Pulse dashboard using Playwright, then analyze the chart. Provide: Bias (Bullish/Bearish/Neutral), Confidence %, Rationale, Entry 1, Entry 2, Stop Loss, Target. If Playwright screenshot fails, ask the user for a screenshot. Be concise and actionable like a SnapTrader.',
  narrative: '[SKILL:NARRATIVE] Analyze the current NarrativeFlow board state. Identify active narratives, recent catalysts, and suggest new connections or flag stale theses. Provide structured output for narrative health assessment.',
};
