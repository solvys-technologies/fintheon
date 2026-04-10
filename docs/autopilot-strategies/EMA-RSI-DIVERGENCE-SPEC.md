# EMA Divergence 20/100 + RSI 15m – Autopilot Spec

## 1) Strategy Name

**EMA Divergence 20/100 + RSI 15m** - Trend-following strategy using EMA crossovers with RSI divergence confirmation on 15-minute timeframe.

**Short Codename**: `EMA_RSI_DIV_15M`

## 2) Instruments and Timeframes

- **Primary Instruments**: NAS100 (NASDAQ-100)
- **Primary Timeframe**: 15-minute bars
- **Secondary Timeframes**: 5-minute for entry precision, 1-hour for trend context
- **Indicator Timeframe**: All indicators calculated on 15-minute bars

## 3) Trading Session and Time Filters

- **Time Window**: Any time during Regular Trading Hours (RTH)
- **Market Hours**: 9:30 AM - 4:00 PM EST
- **Best Performance**: Mid-morning to mid-afternoon (10:00 AM - 2:00 PM EST)
- **Avoid**: First 15 minutes after open, last 15 minutes before close

## 4) Entry Logic

### Trend Context (Required First)

**Uptrend Definition**:

- 20 EMA > 100 EMA
- Both EMAs sloping upward (price above EMAs)
- EMA separation: Distance between 20 EMA and 100 EMA > 0.5% of current price (to avoid flat/compressed markets)

**Downtrend Definition**:

- 20 EMA < 100 EMA
- Both EMAs sloping downward (price below EMAs)
- EMA separation: Distance between 20 EMA and 100 EMA > 0.5% of current price

**No-Trade Zone**:

- EMAs are tightly compressed (distance < 0.5% of price)
- EMAs are flat (slope < 0.1% per bar)
- Price is choppy between EMAs

### Long Setup

1. **Trend Context**:
   - 20 EMA > 100 EMA (uptrend confirmed)
   - EMAs properly separated (>0.5% distance)
   - Price is above 20 EMA

2. **RSI Bullish Divergence**:
   - Identify last swing low in price (within last 20 bars)
   - Identify previous swing low (before the last one)
   - Price: Higher low (last swing low > previous swing low)
   - RSI: Higher low (RSI at last swing low > RSI at previous swing low)
   - RSI was oversold (<30) or dipped below midline (50) before divergence
   - RSI is now rising from the divergence point

3. **Entry Trigger**:
   - Price closes back above 20 EMA (if it dipped below)
   - OR price closes above prior bar high
   - OR bullish reversal candle forms at 20 EMA support
   - Volume confirmation (volume above 20-period average)

### Short Setup

1. **Trend Context**:
   - 20 EMA < 100 EMA (downtrend confirmed)
   - EMAs properly separated (>0.5% distance)
   - Price is below 20 EMA

2. **RSI Bearish Divergence**:
   - Identify last swing high in price (within last 20 bars)
   - Identify previous swing high (before the last one)
   - Price: Lower high (last swing high < previous swing high)
   - RSI: Lower high (RSI at last swing high < RSI at previous swing high)
   - RSI was overbought (>70) or pushed above midline (50) before divergence
   - RSI is now declining from the divergence point

3. **Entry Trigger**:
   - Price closes back below 20 EMA (if it bounced above)
   - OR price closes below prior bar low
   - OR bearish reversal candle forms at 20 EMA resistance
   - Volume confirmation (volume above 20-period average)

## 5) Exit Logic

### Stop Loss

**Long Positions**:

- **Primary**: Just beyond the divergence swing low (the lower low that created the divergence)
- **Alternative**: 1.5x ATR below entry (if no clear swing low)
- **EMA Stop**: Below 100 EMA (if price breaks below 100 EMA, trend may be reversing)

**Short Positions**:

- **Primary**: Just beyond the divergence swing high (the higher high that created the divergence)
- **Alternative**: 1.5x ATR above entry (if no clear swing high)
- **EMA Stop**: Above 100 EMA (if price breaks above 100 EMA, trend may be reversing)

### Take Profit

**Target Levels**:

- **Primary Target**: 2R (2x risk/reward ratio)
- **Secondary Target**: 3R (3x risk/reward) - partial exit at 2R, trail remaining
- **EMA Target**: Next EMA level (20 EMA for shorts, 100 EMA for longs in strong trends)

**Trailing Stop**:

- **Activation**: After price reaches 1R (1x risk/reward)
- **Trailing Method**: Trail stop at 1R distance from highest/lowest price since entry
- **ATR-based Trailing**: Alternative - trail stop at 1.5x ATR from highest/lowest price
- **EMA Trailing**: In strong trends, trail stop at 20 EMA (longs) or below 20 EMA (shorts)

**Time-based Exit**:

- **Max Trade Duration**: 4 hours (16 bars on 15m timeframe)
- **End of Day**: Flatten all positions 15 minutes before market close (3:45 PM EST)

## 6) Risk & Position Sizing

### Position Sizing

- **Risk Per Trade**: 0.25-0.5% of account equity (default 0.5%)
- **Calculation**: Based on stop loss distance
  - Risk Amount = Account Equity × Risk Percent
  - Position Size = Risk Amount / (Stop Distance × Point Value)
- **Point Value**: Varies by broker (typically $1-20 per point depending on contract size)

### Risk Controls

- **Max Daily Loss**: 1.5-2% of account equity (default 2%)
  - After daily loss limit reached, no new trades allowed
  - Existing positions can be managed but no new entries
- **Max Trades Per Day**: 3 trades per symbol
- **Max Concurrent Positions**: 1 position per symbol (no pyramiding)
- **Max Daily Drawdown**: 3% of account (hard stop - system shutdown)

### Position Size Adjustments

- **High Volatility**: If ATR > 2x average ATR, reduce position size by 50%
- **Low Confidence**: If divergence is weak or EMAs are close, reduce size by 25%
- **VIX > 30**: Reduce all position sizes by 50% (global rule)

## 7) Key Parameters

### Indicator Parameters

- **EMA Fast Length**: 20 (default, range 15-25)
- **EMA Slow Length**: 100 (default, range 80-120)
- **RSI Period**: 14 (default, range 12-16)
- **RSI Oversold Threshold**: 30 (default, range 25-35)
- **RSI Overbought Threshold**: 70 (default, range 65-75)
- **ATR Period**: 14 (default, for stop loss calculation)

### Strategy Parameters

- **EMA Separation Threshold**: 0.5% of price (minimum distance to avoid flat markets)
- **EMA Slope Threshold**: 0.1% per bar (minimum slope to avoid flat EMAs)
- **Divergence Lookback**: 20 bars (default, range 15-30 bars)
- **Volume Average Period**: 20 bars (default)
- **Volume Multiplier**: 1.0x (volume must be at least average)

### Risk Parameters

- **Risk Per Trade**: 0.5% (default, range 0.25-0.5%)
- **Max Daily Loss**: 2% (default, range 1.5-2%)
- **Max Trades Per Day**: 3 (default, range 2-4)
- **ATR Multiplier for Stop**: 1.5 (default, range 1.0-2.0)
- **Risk/Reward Target**: 2R (default, minimum 1.5:1)

### Time Parameters

- **Max Trade Duration**: 4 hours (16 bars on 15m)
- **End of Day Exit**: 15 minutes before close (3:45 PM EST)
- **Avoid First/Last**: 15 minutes after open, 15 minutes before close

## 8) Behavioral Notes / Edge Cases

### When Strategy Overtrades

- **Choppy Markets**: In range-bound markets, EMAs compress and strategy should not trade (no-trade zone)
- **False Divergences**: Weak divergences (small price/RSI differences) can lead to false signals
- **EMA Compression**: When EMAs are within 0.5% of each other, avoid trading (trend unclear)

### When Strategy Undertrades

- **Strong Trends**: In very strong trends, price may not retrace enough to create divergence
- **Low Volatility**: In low volatility periods, divergences may be weak or non-existent
- **News Events**: Strategy may miss entries during high-impact news (price gaps, no retracement)

### Protections in Code

- **EMA Compression Check**: Always verify EMA separation before entry
- **Divergence Strength**: Require minimum RSI difference (e.g., 5 points) between swing points
- **Volume Confirmation**: Require volume above average to avoid low-liquidity false signals
- **Time Filters**: Avoid trading in first/last 15 minutes of session
- **Daily Loss Limit**: Hard stop after 2% daily loss

### Assumptions

- **US Market Hours**: Strategy designed for EST/EDT timezone
- **Liquid Futures**: Requires liquid market (NAS100 is highly liquid)
- **15-Minute Bars**: All logic based on 15-minute bars (not suitable for other timeframes without modification)
- **Trending Markets**: Strategy works best in trending markets, not range-bound

### Edge Cases to Handle

1. **EMA Crossover During Trade**: If EMAs cross during open position, consider exiting (trend reversal)
2. **Multiple Divergences**: If multiple divergences form, use the most recent/strongest
3. **Gap Opens**: If price gaps beyond stop loss on open, use market order to exit immediately
4. **Low Volume**: If volume is below average, avoid entry (weak signal)
5. **News Events**: Pause trading 5 minutes before/after major economic releases

### Performance Expectations

- **Win Rate**: Expected 45-55% (divergence strategies typically <50% win rate)
- **Risk/Reward**: Average 2:1 or better (compensates for lower win rate)
- **Best Conditions**: Trending markets with clear EMA separation
- **Worst Conditions**: Choppy, range-bound markets with compressed EMAs
