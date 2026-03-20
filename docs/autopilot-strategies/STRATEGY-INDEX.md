# Autopilot Strategy Index

This document catalogs all trading strategies implemented in the Pulse Autopilot system.

## Overview

The Autopilot system uses an AI-powered multi-agent pipeline to generate trading proposals. Strategies are matched by the Trader Agent based on market conditions, technical analysis, and sentiment data. All strategies focus on NASDAQ-100 (NAS100) for intraday trading.

## Strategy Catalog

### 1. MORNING_FLUSH
- **Strategy ID**: `MORNING_FLUSH`
- **Display Name**: Morning Flush
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Both (long and short)
- **Intent**: Reversal strategy targeting exhaustion moves in the first 30 minutes after market open
- **Key Conditions**:
  - Time windows: 8:00-9:20 AM EST, 11:30 AM-1:30 PM EST
  - Exhaustion detection (15-20min parabolic move)
  - RSI divergence in neutral zone
  - HTF liquidity level sweep
- **Risk Controls**: Max trade duration 1hr 15min, stop loss at technical levels

### 2. LUNCH_FLUSH
- **Strategy ID**: `LUNCH_FLUSH`
- **Display Name**: Lunch Flush
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Both (reversal)
- **Intent**: Reversal pattern during lunch hours
- **Key Conditions**:
  - Time window: 11:30 AM-12:30 PM EST
  - Overbought/oversold conditions
  - RSI divergence from early session
  - Exhaustion after 15-20min move
- **Risk Controls**: Entry on 20 MA (5-minute chart), standard risk management

### 3. POWER_HOUR_FLUSH
- **Strategy ID**: `POWER_HOUR_FLUSH`
- **Display Name**: Power Hour Flush
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Both (reversal into close)
- **Intent**: Reversal pattern in the final hour before market close
- **Key Conditions**:
  - Time window: 3:00-4:00 PM EST
  - Reversal into close
  - Exhaustion patterns
  - Volume confirmation
- **Risk Controls**: Time-based exit before market close

### 4. VIX_FIX_22
- **Strategy ID**: `VIX_FIX_22`
- **Display Name**: 22 VIX Fix
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Long only
- **Intent**: Mean reversion bounce during high volatility panic scenarios
- **Key Conditions**:
  - **Manual Enablement Required** - Strategy disabled by default, must be manually enabled when panic conditions observed
  - Large drop in NAS100 (>2% or >50 points within 2 hours)
  - High volatility (ATR > 1.5x average)
  - Bounce exhaustion detection
  - ATR-based volatility measurement (no VIX data required)
- **Risk Controls**: Price recovery exit logic, reduced position size in high volatility (ATR > 2x average)

### 5. FORTY_FORTY_CLUB
- **Strategy ID**: `FORTY_FORTY_CLUB`
- **Display Name**: 40/40 Club
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 10-minute bars
- **Direction**: Both (breakout)
- **Intent**: Opening range breakout with retracement entry
- **Key Conditions**:
  - Opening range break detection (5/10 min candles)
  - Volume surge confirmation (breakout must have volume)
  - 40-point range + 40% retracement entry
  - EMA cross/retest/fakeout detection
  - Antilag confirmation required
- **Risk Controls**: Stop loss 5pts outside range, target 40pts or 3RR (whichever closer)

### 6. MOMENTUM
- **Strategy ID**: `MOMENTUM`
- **Display Name**: Momentum
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Both (trend continuation)
- **Intent**: Strong trend continuation with volume confirmation
- **Key Conditions**:
  - Strong trend identification
  - Volume confirmation (above average)
  - EMA alignment
  - Breakout confirmation
- **Risk Controls**: Trailing stops, volume-based position sizing

### 7. CHARGED_RIPPERS
- **Strategy ID**: `CHARGED_RIPPERS`
- **Display Name**: Charged Rippers (Print Charged Ripper)
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute bars
- **Direction**: Both (bounce/reversal)
- **Intent**: Oversold bounce with high short interest, triggered by hot economic prints
- **Key Conditions**:
  - Hot economic print detection
  - Fibonacci retracement levels
  - EMA confluence at Fib levels
  - Antilag confirmation
  - Entry on 21 MA (5-minute chart)
- **Risk Controls**: Fib-based stops, antilag-validated entries only

### 8. MEAN_REVERSION
- **Strategy ID**: `MEAN_REVERSION`
- **Display Name**: Mean Reversion
- **Instruments**: NAS100
- **Primary Timeframes**: 5-minute, 15-minute bars
- **Direction**: Both (reversion to mean)
- **Intent**: Extended moves back to VWAP/EMAs
- **Key Conditions**:
  - Extended move away from VWAP or key EMAs
  - Price stretched beyond normal range
  - Reversion signal (RSI extremes, exhaustion)
- **Risk Controls**: VWAP/EMA-based stops, mean reversion targets

## Shared Components

### Antilag Detection
Several strategies require **antilag confirmation**:
- **FORTY_FORTY_CLUB**: Required
- **CHARGED_RIPPERS**: Required

**Antilag Logic**:
- Approximates tick surge using volume surge + price velocity on 5-minute bars
- Volume surge: Volume > 1.5x average in recent bars
- Price velocity: Price change > 0.3% in recent bars
- Price synchronization: Correlation >0.8 between primary and secondary instruments
- Price trajectory synchronization within 90 seconds

### Risk Management (Global)
All strategies enforce:
- **Max risk per trade**: 1% of account
- **Min risk/reward**: 1.5:1 (base hits), 1:3+ (home runs)
- **Max daily drawdown**: 3% of account
- **High Volatility**: If ATR > 2x average ATR, position size reduced by 50%
- **Max position size**: 5% of account per trade
- **Confidence threshold**: <60% confidence = no trade

## Strategy Priority

When multiple strategies match conditions, priority order:
1. FORTY_FORTY_CLUB (highest)
2. MORNING_FLUSH
3. VIX_FIX_22
4. LUNCH_FLUSH / POWER_HOUR_FLUSH
5. CHARGED_RIPPERS (lowest)

## Notes

- **DISCRETIONARY** is not a real strategy but a fallback when no named strategy matches
- Strategies are AI-matched by the Trader Agent based on market conditions
- All strategies focus on intraday trading (no overnight positions)
- Time windows are in EST/EDT (US market hours)
