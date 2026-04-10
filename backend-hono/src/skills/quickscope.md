# QuickScope — Visual Chart Analysis + Trade Proposal

## Trigger

User says "quickscope" in Ask Harp chat.

## What it does

### Phase 1: Chart Capture

1. Uses browser-use to open TopStepX iframe (left pane = HTF chart)
2. **READ ONLY** — MUST NOT click any DOM element that could trigger a trade
3. Fullscreen the HTF chart (left pane)
4. Take a screenshot of the current chart state

### Phase 2: Visual Analysis

1. Analyze the screenshot visually (Claude is multimodal)
2. Identify key levels:
   - Support/resistance zones
   - Trend lines and channels
   - Volume profile areas (POC, VAH, VAL)
   - Recent swing highs/lows
3. Combine with RiskFlow data:
   - Latest feed items (macro events, news catalysts)
   - IV scores and options flow
   - Macro regime classification

### Phase 3: Trade Proposal

1. Decide directional bias: **bullish** / **bearish** / **neutral** with confidence %
2. Write a trade proposal with:
   - **Bias**: Long / Short / Flat
   - **Key Levels**: List of identified S/R zones
   - **Entry Zone**: Price range for entry
   - **Stop Zone**: Price level for stop loss
   - **Target Zone**: Price level for take profit
   - **Risk/Reward**: Calculated R:R ratio
   - **Rationale**: 2-3 sentence summary of the technical + macro picture
3. Output the proposal as an artifact block:

```artifact:trade-proposal
{
  "title": "NQ Long — Support Hold at 21,450",
  "bias": "bullish",
  "confidence": 72,
  "instrument": "/NQ",
  "entry": 21460,
  "stop": 21400,
  "target": 21580,
  "riskReward": "2:1",
  "rationale": "Price holding above VAL with bullish divergence on momentum..."
}
```

4. Automatically dispatch the proposal to the Proposals window (ProposalWidget)
5. All in one command — user says "quickscope" and gets a proposal

## Safety Guardrails

### WHITELIST (allowed browser actions)

- `navigate` to TopStepX iframe URL
- `screenshot` current viewport
- `scroll` (vertical only, for chart timeframes)
- `wait` for page load

### BLACKLIST (forbidden actions)

- DO NOT click elements matching: "BUY", "SELL", "MARKET", "LIMIT", "FLATTEN"
- DO NOT click order ticket selectors or any trade execution UI
- DO NOT interact with position size, bracket order, or P&L fields
- DO NOT submit any form that could affect live positions

### Abort Protocol

If accidental click is detected on any blacklisted element:

1. Immediately stop all browser actions
2. Log the incident with full context
3. Return error message: "QuickScope aborted — accidental trade UI interaction detected"
4. DO NOT proceed with analysis

## Fallback Mode

If browser-use can't interact with TopStepX fast enough (>10s timeout):

1. Skip browser interaction entirely
2. Use latest RiskFlow data + cached market levels from backend
3. Generate proposal from data alone (lower confidence, note "no visual confirmation")

## Output Format

The response should include:

1. A brief text summary visible in the chat
2. An `artifact:trade-proposal` JSON block (parsed by artifact-parser.ts)
3. The proposal auto-dispatched to ProposalWidget
