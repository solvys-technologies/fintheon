// @ts-nocheck
//@version=2
// Priced In Research — Suite 2: Reversal RSI + HTF Patterns (MMT Port)

indicator("Reversal RSI (Priced In)", false)

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HTF Candlestick Patterns Settings
// ═══════════════════════════════════════════════════════════════════════════════
input.section("1. HTF Patterns & Filtering")
const htfTF = input.timeframe("High Timeframe", "15m", { key: "htfTF" })
const pLookback = input.int("Pattern Extremity Lookback", 20, { min: 1, key: "pLookback" })
const pinSens = input.float("Pin Bar Sensitivity", 0.65, { min: 0.1, max: 0.9, key: "pinSens" })
const showEngulfing = input.bool("Engulfing", true, { key: "showEng" })
const showHammer = input.bool("Hammer", true, { key: "showHam", sameLine: true })
const showStar = input.bool("Shooting Star", true, { key: "showStar", sameLine: true })
const showLabels = input.bool("Show Labels", true, { key: "showLbl" })
const bullEngCol = input.color("Bull Engulfing", "#089981", { key: "bullEngCol" })
const bearEngCol = input.color("Bear Engulfing", "#f23645", { key: "bearEngCol", sameLine: true })
const bullPinCol = input.color("Hammer", "#089981", { key: "bullPinCol" })
const bearPinCol = input.color("Shooting Star", "#f23645", { key: "bearPinCol", sameLine: true })

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RSI Divergence Settings
// ═══════════════════════════════════════════════════════════════════════════════
input.section("2. RSI Divergence")
const showDiv = input.bool("Show RSI Divergences", true, { key: "showDiv" })
const rsiLen = input.int("RSI Length", 14, { min: 1, key: "rsiLen" })
const lbR = input.int("Pivot Right Lookback", 5, { key: "lbR" })
const lbL = input.int("Pivot Left Lookback", 5, { key: "lbL" })
const bullDivCol = input.color("Bullish Div", "#089981", { key: "bullDivCol" })
const bearDivCol = input.color("Bearish Div", "#f23645", { key: "bearDivCol", sameLine: true })

// ═══════════════════════════════════════════════════════════════════════════════
// Subscriptions
// ═══════════════════════════════════════════════════════════════════════════════
const src = subscribe(data.OHLCV)

// HTF candle data for pattern detection
const htf = subscribe(data.OHLCV, { timeframe: htfTF })
const htfO = htf.calc(s => s.open())
const htfH = htf.calc(s => s.high())
const htfL = htf.calc(s => s.low())
const htfC = htf.calc(s => s.close())
// Previous HTF candle for engulfing
const htfPO = htf.calc(s => s.open(1))
const htfPC = htf.calc(s => s.close(1))

// ═══════════════════════════════════════════════════════════════════════════════
// Persistent State
// ═══════════════════════════════════════════════════════════════════════════════
// RSI divergence pivot tracking
const plPrice = Series("plPrice")
const plRsi = Series("plRsi")
const plIdx = Series("plIdx")
const phPrice = Series("phPrice")
const phRsi = Series("phRsi")
const phIdx = Series("phIdx")

// HTF bar tracking
const htfNewBar = Series("htfNewBar")

// ═══════════════════════════════════════════════════════════════════════════════
// onBar — Main Logic
// ═══════════════════════════════════════════════════════════════════════════════
function onBar(index) {
  const c = src.close()
  const h = src.high()
  const l = src.low()
  const bi = barIndex()

  // ─────────────────────────────────────────────────────────────────────────
  // RSI CALCULATION & PLOTTING
  // ─────────────────────────────────────────────────────────────────────────
  const rsi = ta.rsi(c, rsiLen)

  // RSI plot with fill
  const rsiSeries = plot("RSI", rsi, {
    color: rsi > 50 ? bullDivCol : bearDivCol,
    width: 2
  })
  const midSeries = plot("Mid", 50, {
    color: color.transp(color.gray, 80),
    style: linestyle.dashed
  })
  fill(midSeries, rsiSeries, {
    topValue: 70,
    bottomValue: 30,
    topColor: color.transp(bearDivCol, 80),
    bottomColor: color.transp(bullDivCol, 80)
  })

  // OB/OS lines
  plot("OB", 70, { color: color.transp(bearDivCol, 50), style: linestyle.dashed, width: 1 })
  plot("OS", 30, { color: color.transp(bullDivCol, 50), style: linestyle.dashed, width: 1 })

  // ─────────────────────────────────────────────────────────────────────────
  // RSI DIVERGENCES
  // ─────────────────────────────────────────────────────────────────────────
  if (showDiv) {
    // Initialize persistent state
    if (context.isFirst) {
      plPrice[0] = na
      plRsi[0] = na
      plIdx[0] = na
      phPrice[0] = na
      phRsi[0] = na
      phIdx[0] = na
    } else {
      plPrice[0] = plPrice[1]
      plRsi[0] = plRsi[1]
      plIdx[0] = plIdx[1]
      phPrice[0] = phPrice[1]
      phRsi[0] = phRsi[1]
      phIdx[0] = phIdx[1]
    }

    const pivotRsiLow = ta.pivotlow(rsi, lbL, lbR)
    const pivotRsiHigh = ta.pivothigh(rsi, lbL, lbR)

    // Bullish Divergence: lower price + higher RSI at pivot low
    if (!na(pivotRsiLow)) {
      const currRsi = rsi
      const currPrice = src.low(lbR)
      const currIdx = bi - lbR

      if (!na(plPrice[0]) && currRsi > plRsi[0] && currPrice < plPrice[0]) {
        // Bullish divergence confirmed
        // Draw on price chart (forceOverlay)
        Line("bdiv_price_" + bi, {
          x1: plIdx[0], y1: plPrice[0],
          x2: currIdx, y2: currPrice,
          color: bullDivCol, width: 2, forceOverlay: true
        })
        Label("bdiv_lbl_" + bi, {
          x: currIdx, y: currPrice,
          text: "Bull Div", color: bullDivCol, size: size.sm,
          forceOverlay: true
        })
        // Draw on RSI pane
        Line("bdiv_rsi_" + bi, {
          x1: plIdx[0], y1: plRsi[0],
          x2: currIdx, y2: currRsi,
          color: bullDivCol, width: 2
        })
        plotMarker("Bull Div Shape", currRsi, { color: bullDivCol, marker: shape.up, size: 8 })
      }

      plPrice[0] = currPrice
      plRsi[0] = currRsi
      plIdx[0] = currIdx
    }

    // Bearish Divergence: higher price + lower RSI at pivot high
    if (!na(pivotRsiHigh)) {
      const currRsi = rsi
      const currPrice = src.high(lbR)
      const currIdx = bi - lbR

      if (!na(phPrice[0]) && currRsi < phRsi[0] && currPrice > phPrice[0]) {
        // Bearish divergence confirmed
        Line("brdiv_price_" + bi, {
          x1: phIdx[0], y1: phPrice[0],
          x2: currIdx, y2: currPrice,
          color: bearDivCol, width: 2, forceOverlay: true
        })
        Label("brdiv_lbl_" + bi, {
          x: currIdx, y: currPrice,
          text: "Bear Div", color: bearDivCol, size: size.sm,
          forceOverlay: true
        })
        Line("brdiv_rsi_" + bi, {
          x1: phIdx[0], y1: phRsi[0],
          x2: currIdx, y2: currRsi,
          color: bearDivCol, width: 2
        })
        plotMarker("Bear Div Shape", currRsi, { color: bearDivCol, marker: shape.down, size: 8 })
      }

      phPrice[0] = currPrice
      phRsi[0] = currRsi
      phIdx[0] = currIdx
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HTF CANDLESTICK PATTERNS
  // ─────────────────────────────────────────────────────────────────────────
  const isNewHTF = timeframe.change(htfTF)

  if (isNewHTF) {
    // Previous HTF candle OHLC (offset 1 = previous completed candle)
    const hO = htfO()
    const hH = htfH()
    const hL = htfL()
    const hC = htfC()
    const hPO = htfPO()
    const hPC = htfPC()

    if (na(hO) || na(hPO)) return

    // Extremity filter: only show patterns at highest/lowest of lookback
    const highestX = ta.highest(src.high(), pLookback)
    const lowestX = ta.lowest(src.low(), pLookback)
    const isExtremityBull = hL <= lowestX
    const isExtremityBear = hH >= highestX

    const candleRange = hH - hL
    if (candleRange <= 0) return

    // Bullish Engulfing
    const isBullEng = showEngulfing && hC > hO && hPC < hPO && hC >= hPO && hO <= hPC
    if (isBullEng && isExtremityBull) {
      Box("beng_" + bi, {
        x1: bi - 1, y1: hH, x2: bi, y2: hL,
        color: color.transp(bullEngCol, 90),
        borderColor: color.transp(bullEngCol, 50),
        forceOverlay: true
      })
      if (showLabels) {
        Label("beng_lbl_" + bi, {
          x: bi, y: hL, text: "Bull Engulfing",
          color: bullEngCol, size: size.sm, forceOverlay: true
        })
      }
    }

    // Bearish Engulfing
    const isBearEng = showEngulfing && hC < hO && hPC > hPO && hC <= hPO && hO >= hPC
    if (isBearEng && isExtremityBear) {
      Box("breng_" + bi, {
        x1: bi - 1, y1: hH, x2: bi, y2: hL,
        color: color.transp(bearEngCol, 90),
        borderColor: color.transp(bearEngCol, 50),
        forceOverlay: true
      })
      if (showLabels) {
        Label("breng_lbl_" + bi, {
          x: bi, y: hH, text: "Bear Engulfing",
          color: bearEngCol, size: size.sm, forceOverlay: true
        })
      }
    }

    // Hammer (bullish pin bar)
    const lowerWick = math.min(hO, hC) - hL
    const isHammer = showHammer && lowerWick > candleRange * pinSens && math.abs(hC - hO) < candleRange * (1 - pinSens)
    if (isHammer && isExtremityBull) {
      Box("ham_" + bi, {
        x1: bi - 1, y1: hH, x2: bi, y2: hL,
        color: color.transp(bullPinCol, 90),
        borderColor: color.transp(bullPinCol, 50),
        forceOverlay: true
      })
      if (showLabels) {
        Label("ham_lbl_" + bi, {
          x: bi, y: hL, text: "Hammer",
          color: bullPinCol, size: size.sm, forceOverlay: true
        })
      }
    }

    // Shooting Star (bearish pin bar)
    const upperWick = hH - math.max(hO, hC)
    const isStar = showStar && upperWick > candleRange * pinSens && math.abs(hC - hO) < candleRange * (1 - pinSens)
    if (isStar && isExtremityBear) {
      Box("star_" + bi, {
        x1: bi - 1, y1: hH, x2: bi, y2: hL,
        color: color.transp(bearPinCol, 90),
        borderColor: color.transp(bearPinCol, 50),
        forceOverlay: true
      })
      if (showLabels) {
        Label("star_lbl_" + bi, {
          x: bi, y: hH, text: "Shooting Star",
          color: bearPinCol, size: size.sm, forceOverlay: true
        })
      }
    }
  }
}
