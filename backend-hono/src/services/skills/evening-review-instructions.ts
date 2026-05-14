// [claude-code 2026-05-13] T4: Harper evening review skill — triggered by [SKILL:EVENING_REVIEW]
// Injected into Harper's chat pipeline by the CAO evening review cron.
// Harper reads these instructions and executes the review workflow autonomously.

/**
 * Instructions injected into Harper's context when the [SKILL:EVENING_REVIEW]
 * tag appears in her chat pipeline.
 *
 * Harper MUST read and follow these instructions to perform the 5PM ET review.
 */
export const EVENING_REVIEW_SKILL_INSTRUCTIONS = `
## [SKILL:EVENING_REVIEW] — CAO Evening Review Protocol

You have been triggered by the 5PM ET evening review scheduler (Sun-Thu).
Perform the following steps IN ORDER:

### Step 1 — Check Economic Calendar
Query the economic_events table for any new items added since the last day-plan generation for today and tomorrow.
Focus on:
- Newly scheduled prints (forecasts changed, dates shifted)
- Events with iv_score >= 4 that fall outside existing windows
- Any event that could produce a 15-45min volatility window

### Step 2 — Check WH Pool Call
Search the RiskFlow feed for recent WH Pool Call items (risk_type="pool-call" or headline contains "Pool Call").
Look for unscheduled announcements, cancellations, or breaking news that could move markets.

### Step 3 — Check Fed / Bessent / Trump Speech Schedule
Query the fiscal_speakers or economic_events table for speeches or scheduled remarks.
- New additions since last check are candidates for day-plan windows
- Late-added Fed speakers = potential hawk/dove surprises
- Bessent/Trump tariff or trade remarks = event-driven vol

### Step 4 — Scan Cross-Border Macro
Check for overnight / Asia-Pacific / European macro data with USD sensitivity:
- AU: CPI, Employment, RBA decisions
- NZ: CPI, Employment, RBNZ decisions
- JP: CPI, Tankan, BoJ decisions
- KR: CPI, Exports, BoK decisions
- CN: CPI, PMI, PBoC decisions
- EU: CPI, GDP, ECB decisions
- UK: CPI, Employment, BoE decisions

Any of these can move USD pairs and create afterhours US equity windows.

### Step 5 — Compose Update Payload
For each new event that outdoes existing day-plan windows, prepare a window update:
\`\`\`json
{
  "windows": [
    {
      "windowIndex": <auto>,
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "eventName": "Event description",
      "catalystDetail": "Why this matters for NQ/ES/YM",
      "expectedMovePct": <estimated implied move>
    }
  ],
  "reason": "CAO evening review — <brief explanation>"
}
\`\`\`

### Step 6 — POST Update
Call the endpoint:
\`\`\`
POST /api/day-plan/cao-evening-review
Body: { windows: TradingWindowUpdate[], reason: string }
\`\`\`

### Step 7 — Propose in Chat
Format the response as a chat message proposing the changes:
- "Evening Review — [date]: [N] new window(s) identified"
- For each window: start-end times, catalyst, direction bias, estimated vol
- Ask TP to approve or modify via chat

### Constraints
- Do NOT auto-execute day-plan changes. TP must approve via chat.
- Do NOT remove or modify existing windows — only ADD new ones.
- If no new events found, report "No new windows identified."
- Asian session windows (19:00-20:00 ET) are preferred for AU/NZ/JP/KR catalysts.
`;
