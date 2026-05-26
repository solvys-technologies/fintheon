// [claude-code 2026-03-22] Source of Truth fusion — skill instruction blocks (moved from agent-instructions.ts)
// [claude-code 2026-05-12] Added MACROCHAIN — PIC Macro Chain methodology, ever-rotating via shared memory

/**
 * Skill instruction blocks — appended when [SKILL:*] is detected in message
 */
export const SKILL_INSTRUCTIONS: Record<string, string> = {
  BRIEF: `\n\n[Skill: Brief]\nSearch for the latest information about the instrument mentioned. Summarize findings and interpret implications for the user's position or thesis. Check active trading regimes for timing context. Be concise and actionable.`,
  VALIDATE: `\n\n[Skill: Validate]\nAct as Herald (risk validation). Analyze thesis validity against: (1) current research narratives, (2) published memos, (3) current news, (4) active trading regimes. Provide a confidence-weighted verdict.`,
  REPORT: `\n\n[Skill: Report]\nGenerate an HTML dashboard report using the Solvys Gold palette (#D4AF37 accent, #050402 bg, #f0ead6 text). Self-contained HTML with <!-- FINTHEON_REPORT --> as first comment. Include inline CSS.`,
  TRACK: `\n\n[Skill: Track]\nBuild a new narrative thread. Identify key thesis, relevant instruments, catalysts, and timeline. Format as a structured narrative entry.`,
  PSYCH: `\n\n[Skill: Psych Assist]\nRun psychological/performance analysis. Evaluate trading behavior against the 14 Commandments. Detect tilt triggers (funded creep, revenge trading, skipped routine). Provide actionable coaching — empathetic but direct. Reference specific commandments when violations are detected.`,
  MAINTENANCE: `\n\n[Skill: Maintenance]\nPerform app maintenance. Review recent changes, update changelog, report status as structured messages.`,
  QUICKFINTHEON: `\n\n[Skill: QuickFintheon]\nAnalyze the provided chart/screenshot. Provide: Bias, Confidence %, Rationale, Entry 1, Entry 2, Stop Loss, Target. Reference IPEC phase and 1000-tick synchronicity. Be concise like a SnapTrader.`,
  NARRATIVE: `\n\n[Skill: Narrative]\nAnalyze current NarrativeFlow board state. Identify active narratives in the data cycle (PMI>PPI>CPI>PCE>GDP), recent catalysts, suggest new connections or flag stale theses. Apply third-order thinking.`,
  NARRATIVEFLOW_RESEARCH: `\n\n[Skill: NarrativeFlow Research]\nRun the futures-desk research workflow: form a watchlist-bound thesis, review attached RiskFlow catalysts, find confirmation and contradiction evidence, translate external drivers into watched-symbol impact, and produce catalysts to watch going forward. Do not produce trade analysis outside the TradingView watchlist.`,
  // [claude-code 2026-03-23] Browser Use Phase 2
  CHARTLEVELS: `\n\n[Skill: Chart Levels]\nDraw horizontal price lines on the TopStep X chart via Browser Use CLI. Extract entry, stop loss, and take profit levels from the current trade proposal or user message. Call POST /api/proposals/chart with { ticker, direction, entry, stopLoss, takeProfit }. Lines are drawn as colored horizontal rays: entry (green #22c55e), stop (red #ef4444), target (blue #3b82f6). Confirm back to the user with the plotted levels. Respects blackout period (8:30a-12p EST). If the user provides a ticker and levels, format the API call. If a recent proposal exists, use its levels automatically.`,
  // [claude-code 2026-05-12] PIC Macro Chain — proprietary economic print forecasting methodology
  MACROCHAIN: `\n\n[Skill: Macro Chain — PIC Economic Print Forecasting]
Apply the Priced In Capital Macro Chain methodology to forecast the next economic print. The chain is: PMI → PPI → PCE → CPI (extends to GDP, NFP).

WEIGHTING MODEL (ever-rotating via damped learning rate α=0.3):
- Energy passthrough (25%): WTI 4-week average vs prior survey period. Gasoline above $4/gal adds 10-15bps to headline.
- PPI stickiness / input costs (30%): NFIB input cost subcomponents >40% for 4+ consecutive months means PPI passthrough is still baking in. The lag window closes at ~4 months.
- Shelter repricing (20%): 4.5-5% annualized until rate relief materializes. Do not forecast improvement without cuts.
- Sell-side tells (15%): BofA rate cut forecast shifts are highest-weight. Bessent Treasury vocabulary == 2021 echo (transient).
- Supply chain velocity (10%): Urals premiums, Brent-WTI spread, Indian refiner margin compression.

RULES:
1. Pull NFIB input cost subcomponents first — they lead PPI by 6-8 weeks
2. Check WTI 4-week average vs prior survey period for energy passthrough magnitude
3. Read BofA rate cut forecasts — they front-run the data
4. Cross-check Bessent/White House vocabulary against 2021 "transient" patterns
5. Compare PIC estimate vs consensus; identify deviation driver (composition > headline)
6. After print lands: compute delta, damped-update weights (α=0.3), store via shared memory
7. Second order: ask what the composition says about structural vs. transitory stickiness`,
};

export const DEEP_ANALYSIS_BLOCK = `\n\n[Deep Analysis Mode]
You have been asked to think harder. Apply rigorous analytical reasoning:
- Consider multiple perspectives and counter-arguments
- Cite specific data points, levels, or probabilities where relevant
- Flag assumptions and uncertainty ranges
- Provide structured output with clear sections
- If research context is provided, synthesize it into your analysis
- Apply third-order thinking: What does the crowd think? What does the crowd NOT see?`;
