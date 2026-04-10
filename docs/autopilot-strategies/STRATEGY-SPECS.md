# Autopilot Strategy Specifications

This document provides detailed technical specifications for each Autopilot trading strategy. Each strategy is documented with precise entry/exit logic, risk parameters, and implementation details.

---

## MORNING_FLUSH – Autopilot Spec

### 1) Strategy Name

**Morning Flush** - Reversal strategy targeting exhaustion moves in the first 30 minutes after market open.

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100 (NASDAQ-100)
- **Primary Timeframes**: 5-minute and 15-minute bars
- **Secondary Timeframes**: 1-minute for entry precision, daily for HTF context

### 3) Trading Session and Time Filters

- **Primary Window**: 8:00 AM - 10:45 AM EST (first 30 minutes + buffer)
- **Secondary Window**: 11:30 AM - 1:30 PM EST (late morning/early afternoon flush)
- **Market Hours**: Regular trading hours (RTH) only

### 4) Entry Logic

**Long Setup**:

1. **Gap Condition**: Price opens with a gap (typically gap down for long entries)
2. **Exhaustion Detection**:
   - 15-20 minute parabolic move in opposite direction
   - Price makes extreme move away from opening price
   - Volume spike on exhaustion candle
3. **RSI Divergence**:
   - RSI in neutral zone (30-70)
   - Bullish divergence: Price makes lower low, RSI makes higher low
4. **HTF Liquidity Sweep**:
   - Price sweeps previous day's high/low or key HTF level
   - Sweep creates false breakout before reversal
5. **Entry Trigger**:
   - Price closes back above 20 EMA or prior swing high
   - Volume confirmation on reversal candle

**Short Setup**:

1. **Gap Condition**: Price opens with gap up
2. **Exhaustion Detection**: Same as long (15-20min parabolic move up)
3. **RSI Divergence**: Bearish divergence (price higher high, RSI lower high)
4. **HTF Liquidity Sweep**: Sweep of previous day's high or resistance
5. **Entry Trigger**: Price closes below 20 EMA or prior swing low

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below the divergence swing low or HTF liquidity level (whichever is closer)
- **Short**: Above the divergence swing high or HTF liquidity level
- **Default**: ATR-based stop (2x ATR from entry) if no clear structure

**Take Profit**:

- **Primary Target**: 1:2 risk/reward ratio (2R)
- **Secondary Target**: 1:3 risk/reward ratio (3R) - partial exit
- **Time-based Exit**: Flatten position after 1 hour 15 minutes maximum
- **Trailing Stop**: Activate trailing stop after 1R is reached

**Exit Conditions**:

- Time limit reached (1hr 15min)
- Target levels hit
- Stop loss triggered

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.5-1% of account equity (default 1%)
- **Position Sizing**: Based on stop loss distance and account size
- **Max Daily Loss**: 3% of account (after which no new trades)
- **Max Trades Per Day**: 2 trades per symbol
- **Max Concurrent Positions**: 1 position per strategy

### 7) Key Parameters

- **Exhaustion Window**: 15-20 minutes (default 18 minutes)
- **RSI Period**: 14 (default)
- **RSI Neutral Zone**: 30-70 (default)
- **EMA Period**: 20 (default)
- **ATR Multiplier for Stop**: 2.0 (default, range 1.5-3.0)
- **Risk/Reward Minimum**: 1:2 (default)
- **Max Trade Duration**: 75 minutes (1hr 15min)

### 8) Behavioral Notes / Edge Cases

- **Overtrading Risk**: Strategy can trigger multiple times in same session if conditions repeat
- **Gap Size**: Works best with gaps > 0.5% of previous close
- **News Events**: Avoid trading 5 minutes before/after major economic releases
- **Choppy Conditions**: Strategy underperforms in low volatility conditions
- **Assumptions**: US market hours, EST timezone, liquid futures market

---

## LUNCH_FLUSH – Autopilot Spec

### 1) Strategy Name

**Lunch Flush** - Reversal pattern during lunch hours (11:30 AM - 12:30 PM EST).

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 15-minute bars
- **Entry Timeframe**: 5-minute chart for entry on 20 MA

### 3) Trading Session and Time Filters

- **Time Window**: 11:30 AM - 12:30 PM EST
- **Market Hours**: Regular trading hours only
- **Best Performance**: Tuesday-Thursday (avoid Monday/Friday)

### 4) Entry Logic

**Long Setup**:

1. **Overbought Condition**: Price extended above VWAP/EMAs from early session
2. **RSI Divergence**:
   - RSI makes lower high compared to early session high
   - Price makes higher high (bearish divergence)
3. **Exhaustion**:
   - 15-20 minute move in one direction
   - Volume decreasing on continuation
4. **Entry Trigger**:
   - Price retraces to 20 MA on 5-minute chart
   - Bullish reversal candle at MA
   - Volume confirmation

**Short Setup**:

1. **Oversold Condition**: Price extended below VWAP/EMAs
2. **RSI Divergence**: Bullish divergence (price lower low, RSI higher low)
3. **Exhaustion**: 15-20min move down with decreasing volume
4. **Entry Trigger**: Price bounces to 20 MA, bearish reversal candle

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below the exhaustion swing low or 20 MA break
- **Short**: Above the exhaustion swing high or 20 MA break
- **Default**: 1.5x ATR from entry

**Take Profit**:

- **Primary Target**: 1:2 risk/reward
- **Time-based Exit**: Flatten by 1:00 PM EST (before power hour)
- **Trailing Stop**: After 1R reached

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.5-1% of account
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 1 trade per symbol (lunch window only)

### 7) Key Parameters

- **Time Window Start**: 11:30 AM EST
- **Time Window End**: 12:30 PM EST
- **Exhaustion Window**: 15-20 minutes
- **MA Period**: 20 (5-minute chart)
- **RSI Period**: 14
- **ATR Multiplier**: 1.5 (default)

### 8) Behavioral Notes / Edge Cases

- **Low Volume**: Strategy requires sufficient volume (avoid low-volume days)
- **Early Exit**: Always exit before 1:00 PM to avoid power hour conflicts
- **Monday/Friday**: Reduced effectiveness due to lower participation

---

## POWER_HOUR_FLUSH – Autopilot Spec

### 1) Strategy Name

**Power Hour Flush** - Reversal pattern in the final hour before market close (3:00-4:00 PM EST).

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 15-minute bars
- **Entry Timeframe**: 1-minute for precision

### 3) Trading Session and Time Filters

- **Time Window**: 3:00 PM - 4:00 PM EST (final hour)
- **Market Hours**: Regular trading hours only
- **Exit Requirement**: Must flatten before 4:00 PM EST market close

### 4) Entry Logic

**Long Setup**:

1. **Reversal into Close**: Price extended down during afternoon, showing exhaustion
2. **Volume Confirmation**: Volume increasing on reversal attempt
3. **Exhaustion Pattern**: 15-20 minute move down with decreasing momentum
4. **Entry Trigger**:
   - Bullish reversal candle
   - Price reclaims key level (VWAP, 20 EMA, or prior support)
   - Volume spike on reversal

**Short Setup**:

1. **Reversal into Close**: Price extended up, showing exhaustion
2. **Volume Confirmation**: Volume on reversal
3. **Exhaustion Pattern**: 15-20min move up losing momentum
4. **Entry Trigger**: Bearish reversal, price breaks below key level

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below exhaustion low or key support break
- **Short**: Above exhaustion high or key resistance break
- **Tight Stops**: Use 1.5x ATR due to time constraint

**Take Profit**:

- **Primary Target**: 1:2 risk/reward (quick scalp)
- **Time-based Exit**: **MANDATORY** - Flatten all positions by 3:55 PM EST
- **No Overnight**: Strategy never holds overnight positions

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.5-0.75% (reduced due to time constraint)
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 1 trade per symbol (power hour only)

### 7) Key Parameters

- **Time Window Start**: 3:00 PM EST
- **Time Window End**: 3:55 PM EST (5min buffer before close)
- **Exhaustion Window**: 15-20 minutes
- **ATR Multiplier**: 1.5 (tighter stops)
- **Max Trade Duration**: 55 minutes (until 3:55 PM)

### 8) Behavioral Notes / Edge Cases

- **Time Critical**: Must exit before market close - no exceptions
- **Volume Required**: Needs sufficient volume (avoid low-volume Fridays)
- **News Risk**: Avoid trading during FOMC announcements or major news
- **Overtrading**: Only one trade per day in this window

---

## VIX_FIX_22 – Autopilot Spec

### 1) Strategy Name

**22 VIX Fix** - Mean reversion long strategy for high volatility panic scenarios. **Manual enablement required** - strategy is disabled by default and must be manually enabled when panic conditions are observed.

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 15-minute bars
- **Volatility Proxy**: ATR-based volatility measurement (no VIX data required)

### 3) Trading Session and Time Filters

- **Time Window**: Any time during RTH when manually enabled
- **Market Hours**: Regular trading hours
- **Manual Enablement**: Strategy requires manual activation when panic conditions are observed

### 4) Entry Logic

**Long Setup Only** (strategy is long-only):

1. **Manual Enablement**: Strategy must be manually enabled (`strategy_enabled = True`) when panic conditions are observed
2. **Panic Drop Detection**:
   - NAS100 has dropped significantly (track in strategy state)
   - Drop threshold: >2% or >50 points within last 2 hours (configurable)
   - Drop occurred within last 2 hours (check price vs price 2 hours ago)
   - User has not already taken a trade on this move (track in state)
3. **Volatility Confirmation**:
   - ATR is elevated (ATR > 1.5x average ATR over last 20 bars)
   - High volatility indicates panic conditions
4. **Bounce Exhaustion**:
   - Initial bounce from panic low shows exhaustion
   - Price retraces but holds above prior panic low
   - Volume decreasing on retracement
   - RSI shows oversold recovery (RSI was <30, now rising)
5. **Entry Trigger**:
   - Price bounces from retracement low
   - Bullish reversal candle
   - Volume confirmation (volume above average)
   - ATR begins to decrease (volatility normalizing)

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below the panic low (the lowest point during panic drop)
- **Default**: 2x ATR if no clear panic low
- **Volatility Stop**: If ATR spikes above 2.5x average (extreme volatility), reduce position or exit

**Take Profit**:

- **Primary Target**: 1:2 risk/reward
- **Price Recovery Exit**:
  - Exit when price recovers to pre-panic level or key resistance
  - Volatility normalization indicates market stabilization
- **Volatility Normalization**: Exit when ATR drops below 1.2x average (volatility normalizing)
- **Trailing Stop**: After 1R reached, trail stop at 1R

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.5-1% of account
- **High Volatility Adjustment**: If ATR > 2x average ATR, reduce position size by 50%
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 2 trades (to avoid overexposure to volatility)

### 7) Key Parameters

- **Strategy Enabled**: False (default) - must be manually set to True
- **Drop Threshold Percent**: 2.0% (minimum price drop % to trigger, range 2-5%)
- **Drop Threshold Points**: 50.0 (alternative drop threshold in points, range 50-100)
- **ATR Volatility Threshold**: 1.5x average (ATR multiplier for volatility confirmation)
- **ATR Extreme Threshold**: 2.5x average (ATR multiplier for extreme volatility exit)
- **ATR Normalization Threshold**: 1.2x average (ATR multiplier for volatility normalization exit)
- **ATR Multiplier**: 2.0 (default for stops)
- **RSI Oversold**: 30 (default)
- **Price Recovery Threshold**: 50% recovery from panic low (configurable)

### 8) Behavioral Notes / Edge Cases

- **Manual Enablement Required**: Strategy is disabled by default - must be manually enabled when panic conditions are observed
- **When to Enable**: Enable manually when you observe:
  - Large market drops (>2% or >50 points)
  - High volatility (ATR elevated)
  - News-driven panic
  - Market-wide selloffs
- **ATR-Based Volatility**: Use ATR as proxy for VIX (elevated ATR = high volatility/panic)
- **Not for Beginners**: High volatility strategy, requires experience
- **Large Moves**: Can see 50+ point moves in NAS100 during panic drops
- **False Signals**: Panic drops can continue - wait for bounce exhaustion confirmation
- **Price Recovery**: Monitor price recovery from panic low as exit signal

---

## FORTY_FORTY_CLUB – Autopilot Spec

### 1) Strategy Name

**40/40 Club** - Opening range breakout with retracement entry (bread & butter strategy).

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 10-minute bars for opening range
- **Entry Timeframe**: 5-minute for precision

### 3) Trading Session and Time Filters

- **Time Window**: 9:30 AM - 11:00 AM EST (opening range + breakout window)
- **Market Hours**: Regular trading hours
- **Opening Range**: First 5-10 minutes after market open (9:30 AM)

### 4) Entry Logic

**Long Setup**:

1. **Opening Range Break**:
   - Price breaks above opening range high (5 or 10 min range)
   - Breakout must be confirmed with volume surge
2. **40-Point Range**:
   - Opening range is approximately 40 points (adjustable)
   - Range = High - Low of first 5-10 minutes
3. **40% Retracement**:
   - After breakout, price retraces 40% of the range
   - Retracement finds support at EMA or prior level
4. **EMA Cross/Retest**:
   - Price retests 20 EMA or breakout level
   - Fakeout pattern (breaks then retraces, then continues)
5. **Antilag Confirmation** (REQUIRED):
   - Approximate antilag using volume surge + price velocity on 5-minute bars
   - Volume surge: Volume > 1.5x average in recent 5-minute bars (approximating 90-second window)
   - Price velocity: Price change > 0.3% in recent bars
   - Synchronized movement: Volume surge and price velocity occur together
6. **Entry Trigger**:
   - Price bounces from retracement level
   - Bullish reversal candle
   - Antilag signal confirms

**Short Setup**:

1. Opening range break down
2. 40% retracement up
3. EMA retest/fakeout
4. Antilag confirmation (volume surge + price velocity)
5. Bearish reversal candle

### 5) Exit Logic

**Stop Loss**:

- **Long**: 5 points below the opening range low (or retracement low)
- **Short**: 5 points above the opening range high (or retracement high)
- **Default**: 5 points outside the range

**Take Profit**:

- **Primary Target**: 40 points from entry (range size)
- **Alternative Target**: 3x risk/reward ratio (3R)
- **Use Closer**: Take whichever target is closer (40pts or 3R)
- **Trailing Stop**: After 1R reached, trail stop

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.75-1% of account
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 2 trades per symbol
- **Position Sizing**: Based on 5-point stop loss distance

### 7) Key Parameters

- **Opening Range Period**: 5-10 minutes (default 10 minutes)
- **Range Size Target**: 40 points (adjustable 30-50 points)
- **Retracement Percentage**: 40% (default, range 30-50%)
- **Stop Loss Distance**: 5 points outside range (default)
- **Target Distance**: 40 points or 3R (whichever closer)
- **Antilag Window**: 90 seconds (approximated using recent 5-minute bars)
- **Antilag Volume Multiplier**: >1.5x average volume
- **Antilag Price Velocity**: >0.3% price change

### 8) Behavioral Notes / Edge Cases

- **Antilag Required**: Strategy will not trigger without antilag confirmation
- **Volume Confirmation**: Breakout must have volume surge confirmation
- **False Breakouts**: Common - wait for retracement and retest
- **Range Size**: Adjust range size parameter based on market volatility
- **Best Days**: Works best on normal volatility days (not extreme news days)

---

## MOMENTUM – Autopilot Spec

### 1) Strategy Name

**Momentum** - Trend continuation strategy with volume confirmation.

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 15-minute bars
- **Trend Confirmation**: Daily and hourly trends

### 3) Trading Session and Time Filters

- **Time Window**: Any time during RTH
- **Market Hours**: Regular trading hours
- **Best Performance**: Mid-morning to mid-afternoon (10 AM - 2 PM EST)

### 4) Entry Logic

**Long Setup**:

1. **Strong Trend Identification**:
   - Daily trend bullish (price above daily EMAs)
   - Hourly trend bullish (price above hourly EMAs)
   - Price making higher highs and higher lows
2. **Volume Confirmation**:
   - Volume above 20-period average
   - Volume increasing on trend continuation
   - Volume spike on breakout
3. **EMA Alignment**:
   - Price above 20, 50, 100 EMAs
   - EMAs in bullish order (20 > 50 > 100)
4. **Breakout Confirmation**:
   - Price breaks above prior swing high
   - Breakout candle closes near high
   - Volume confirms breakout

**Short Setup**:

1. Strong bearish trend (daily and hourly)
2. Volume confirmation (above average, increasing)
3. EMA alignment (price below EMAs, bearish order)
4. Breakdown confirmation (breaks below swing low)

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below prior swing low or 20 EMA break
- **Short**: Above prior swing high or 20 EMA break
- **ATR-based**: 2x ATR from entry if no clear structure

**Take Profit**:

- **Primary Target**: 1:2 risk/reward
- **Trailing Stop**:
  - Activate trailing stop after 1R reached
  - Trail at 1R distance
  - Use ATR-based trailing (1.5x ATR)
- **Trend Exhaustion Exit**: Exit when trend shows exhaustion (divergence, volume decrease)

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.75-1% of account
- **Volume-based Sizing**: Increase size if volume is 2x average
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 3 trades per symbol

### 7) Key Parameters

- **EMA Periods**: 20, 50, 100 (default)
- **Volume Average Period**: 20 (default)
- **Volume Multiplier**: 1.5x average (minimum for entry)
- **ATR Multiplier**: 2.0 (default for stops)
- **Trailing Stop ATR**: 1.5x (default)

### 8) Behavioral Notes / Edge Cases

- **Trend Strength**: Only trade strong, clear trends (avoid choppy markets)
- **Volume Critical**: Without volume confirmation, avoid entry
- **False Breakouts**: Common in choppy markets - wait for confirmation
- **Best in Trending Markets**: Underperforms in range-bound conditions

---

## CHARGED_RIPPERS – Autopilot Spec

### 1) Strategy Name

**Charged Rippers** (Print Charged Ripper) - Oversold bounce strategy triggered by hot economic prints.

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute chart for entry and context
- **Economic Data**: Requires economic calendar integration

### 3) Trading Session and Time Filters

- **Time Window**: Around economic releases (8:30 AM, 10:00 AM, 2:00 PM EST typical)
- **Market Hours**: Regular trading hours
- **Release Window**: 5 minutes before to 30 minutes after economic release

### 4) Entry Logic

**Long Setup**:

1. **Hot Economic Print**:
   - Major economic release (NFP, CPI, FOMC, etc.)
   - Print is significantly different from expectations
   - Market reacts strongly (50+ point move in NAS100)
2. **Fibonacci Retracement**:
   - Calculate Fib levels from pre-release high to reaction low
   - Key levels: 38.2%, 50%, 61.8%
3. **EMA Confluence**:
   - 20 EMA or 50 EMA aligns with Fib level
   - Price bounces from confluence zone
4. **Antilag Confirmation** (REQUIRED):
   - Approximate antilag using volume surge + price velocity on 5-minute bars
   - Volume surge: Volume > 1.5x average in last 90 seconds (approximated using recent 5-minute bars)
   - Price velocity: Price change > 0.3% in last 90 seconds
   - Price correlation >0.8 (if multiple instruments available)
5. **Entry Trigger**:
   - Price bounces from Fib/EMA confluence
   - Entry on 21 MA (5-minute chart)
   - Bullish reversal candle
   - Antilag confirms

**Short Setup**:

1. Hot print causes spike up
2. Fib retracement from spike low to reaction high
3. EMA confluence at Fib level
4. Antilag confirmation
5. Entry on 21 MA (5-minute chart), bearish reversal

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below Fib level (38.2% or 50%) or below reaction low
- **Short**: Above Fib level or above reaction high
- **Default**: 1.5x ATR from entry

**Take Profit**:

- **Primary Target**: 1:2 risk/reward
- **Fib Target**: Next Fib level (50% -> 61.8% -> 100%)
- **Time-based Exit**: Exit within 1 hour of entry (volatility decays)

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.5-0.75% (reduced due to volatility)
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 2 trades (economic releases are limited)

### 7) Key Parameters

- **Economic Release Types**: NFP, CPI, FOMC, GDP, Retail Sales (major releases only)
- **Print Threshold**: Move >50 points in NAS100 (adjustable)
- **Fib Levels**: 38.2%, 50%, 61.8% (default)
- **MA Period**: 21 (5-minute chart)
- **Antilag Window**: 90 seconds (approximated using recent 5-minute bars)
- **Antilag Volume Multiplier**: >1.5x average volume
- **Max Trade Duration**: 60 minutes

### 8) Behavioral Notes / Edge Cases

- **Antilag Required**: Strategy will not trigger without antilag
- **Economic Calendar**: Requires integration with economic calendar
- **High Volatility**: Expect large moves and wide stops
- **False Prints**: Some prints cause initial move then reverse - wait for confirmation
- **News Risk**: High risk strategy - only for experienced traders

---

## MEAN_REVERSION – Autopilot Spec

### 1) Strategy Name

**Mean Reversion** - Extended moves back to VWAP/EMAs.

### 2) Instruments and Timeframes

- **Primary Instruments**: NAS100
- **Primary Timeframes**: 5-minute and 15-minute bars
- **VWAP Calculation**: Daily VWAP

### 3) Trading Session and Time Filters

- **Time Window**: Any time during RTH
- **Market Hours**: Regular trading hours
- **Best Performance**: Mid-session (10 AM - 2 PM EST)

### 4) Entry Logic

**Long Setup**:

1. **Extended Move Down**:
   - Price stretched significantly below VWAP or key EMAs (20, 50)
   - Distance: >2x ATR from VWAP/EMA
   - Move occurred over 30+ minutes
2. **Reversion Signal**:
   - RSI oversold (<30) and beginning to turn up
   - Exhaustion pattern (decreasing volume on continuation)
   - Bullish divergence (price lower low, RSI higher low)
3. **Entry Trigger**:
   - Price shows first sign of reversal (bullish candle)
   - Volume increasing on reversal attempt
   - Price begins moving toward VWAP/EMA

**Short Setup**:

1. Extended move up (>2x ATR from VWAP/EMA)
2. RSI overbought (>70) turning down
3. Bearish divergence
4. Bearish reversal candle with volume

### 5) Exit Logic

**Stop Loss**:

- **Long**: Below the extended move low or 2x ATR below entry
- **Short**: Above the extended move high or 2x ATR above entry
- **VWAP Stop**: If price breaks back through VWAP in wrong direction

**Take Profit**:

- **Primary Target**: VWAP or key EMA (20 or 50)
- **Secondary Target**: 1:2 risk/reward if target is closer
- **Trailing Stop**: After price reaches VWAP, trail stop at VWAP

### 6) Risk & Position Sizing

- **Risk Per Trade**: 0.75-1% of account
- **Max Daily Loss**: 3% of account
- **Max Trades Per Day**: 3 trades per symbol

### 7) Key Parameters

- **VWAP Period**: Daily (reset at market open)
- **EMA Periods**: 20, 50 (default)
- **ATR Multiplier**: 2.0 (for extended move definition)
- **RSI Period**: 14 (default)
- **RSI Oversold**: <30 (default)
- **RSI Overbought**: >70 (default)

### 8) Behavioral Notes / Edge Cases

- **Trend Context**: Works best in range-bound or choppy markets
- **Strong Trends**: Avoid in strong trending markets (price can stay extended)
- **VWAP Critical**: VWAP is the primary target - price often respects it
- **False Signals**: Extended moves can continue - wait for exhaustion signals
- **Volume Confirmation**: Required for entry - low volume reversals often fail

---

## Strategy Implementation Notes

### Antilag Detection (For FORTY_FORTY_CLUB and CHARGED_RIPPERS)

**Antilag** is a critical confirmation signal that detects early price movement in correlated instruments. We approximate antilag using 5-minute bars:

1. **Volume Surge Detection** (Tick Surge Approximation):
   - Check volume in recent 5-minute bars (approximating 90-second window)
   - Threshold: Volume > 1.5x average volume in recent bars

2. **Price Velocity Detection**:
   - Calculate price change in recent 5-minute bars
   - Threshold: Price change > 0.3% (indicating rapid movement)

3. **Implementation**:
   - Use 5-minute bars for all antilag approximations
   - Volume surge + price velocity together approximate tick surge
   - Both conditions must occur together for antilag confirmation

### Risk Management (Global)

All strategies enforce these global risk rules:

- **Max Risk Per Trade**: 1% of account equity
- **Min Risk/Reward**: 1.5:1 (base hits), 1:3+ (home runs)
- **Max Daily Drawdown**: 3% of account (hard stop - no new trades after)
- **High Volatility**: If ATR > 2x average ATR, reduce all position sizes by 50%
- **Max Position Size**: 5% of account per trade
- **Confidence Threshold**: <60% confidence = no trade (AI-based strategies)
- **Daily Loss Limit**: After 3% loss, system stops trading for the day

### Time Zone Handling

All time windows are in **EST/EDT** (US Eastern Time):

- Market open: 9:30 AM EST
- Market close: 4:00 PM EST
- Adjust for daylight saving time (EDT in summer)

### Instrument Specifications

- **NAS100**: NASDAQ-100, point value varies by broker (typically $1-20 per point depending on contract size)
