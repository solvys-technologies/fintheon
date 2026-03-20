# Autopilot Strategy Documentation

This directory contains comprehensive documentation for all Autopilot trading strategies.

## Directory Structure

```
autopilot-strategies/
├── README.md                          # This file
├── STRATEGY-INDEX.md                  # Complete catalog of all strategies
├── STRATEGY-SPECS.md                  # Detailed technical specifications
└── EMA-RSI-DIVERGENCE-SPEC.md        # EMA/RSI divergence strategy spec
```

## Quick Start

1. **Browse Strategies**: Start with [STRATEGY-INDEX.md](STRATEGY-INDEX.md) for an overview of all strategies
2. **Read Specs**: See [STRATEGY-SPECS.md](STRATEGY-SPECS.md) for detailed technical specifications

## Strategy Catalog

### Existing Strategies (8)
1. **Morning Flush** - First 30min reversal after gap (VIX > 18 required)
2. **Lunch Flush** - 11:30am-12:30pm reversal pattern
3. **Power Hour Flush** - 3-4pm reversal into close
4. **22 VIX Fix** - Long NAS100 when panic conditions observed (manually enabled)
5. **40/40 Club** - Opening range breakout with retracement (requires antilag)
6. **Momentum** - Strong trend continuation with volume confirmation
7. **Charged Rippers** - Oversold bounce with hot economic prints (requires antilag)
8. **Mean Reversion** - Extended moves back to VWAP/EMAs

### New Strategy
9. **EMA Divergence 20/100 + RSI 15m** - Trend-following with RSI divergence on 15-minute bars

## Execution Venues

Strategies execute through the Autopilot pipeline via the configured PRIMARY_BROKER:
- **Rithmic** — CME Globex futures (ES, NQ, MNQ)
- **ProjectX** — TopStepX simulation
- **Hyperliquid** — Perpetual futures DEX (BTC, ETH, SOL perps)

## Key Concepts

### Antilag Detection
Several strategies (40/40 Club, Charged Rippers) require **antilag confirmation** via volume surge and price velocity detection on 5-minute bars.

### Risk Management
All strategies enforce global risk rules:
- Max 1% risk per trade
- Min 1.5:1 risk/reward
- Max 3% daily drawdown
- VIX > 30: 50% position size reduction

### Time Windows
All time windows are in **EST/EDT** (US Eastern Time):
- Market open: 9:30 AM EST
- Market close: 4:00 PM EST
- Hyperliquid trades 24/7 — RTH gating is bypassed when PRIMARY_BROKER=hyperliquid

## Notes

- Strategies are designed for NASDAQ-100 (NAS100) or equivalent crypto perps
- All strategies use single data feed
- VIX data may not be available — strategies include fallback logic
- Futures strategies are intraday only (no overnight positions)

## Reference

- Pulse Autopilot System: See main repository documentation
- Strategy Implementation: See `backend-hono/src/services/agents/trader-agent.ts`
