//@version=2
// Priced In Research — Suite 1: Liquidity Swings + Volume Delta Candles + EMA Cross (MMT Port)

indicator("Liquidity + Delta Overlay (Priced In)", true)

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Liquidity Swings Settings
// ═══════════════════════════════════════════════════════════════════════════════
input.section("1. Liquidity Swings")
const lengthLS = input.int("Pivot Lookback", 14, { min: 1, max: 50 })
const areaMode = input.select("Swing Area", 0, { selectables: ["Wick Extremity", "Full Range"], key: "areaLS" })
const filterMode = input.select("Filter By", 0, { selectables: ["Count", "Volume"], key: "filterLS" })
const filterValue = input.float("Filter Threshold", 0, { min: 0, key: "filterValLS" })
const showTop = input.bool("Swing High", true, { key: "showTop" })
const topCss = input.color("High Color", "#f23645", { key: "topCss", sameLine: true })
const topAreaCss = input.color("High Area", "#f2364580", { key: "topAreaCss", sameLine: true })
const showBtm = input.bool("Swing Low", true, { key: "showBtm" })
const btmCss = input.color("Low Color", "#089981", { key: "btmCss", sameLine: true })
const btmAreaCss = input.color("Low Area", "#00808080", { key: "btmAreaCss", sameLine: true })

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Volume Delta Candles Settings
// ═══════════════════════════════════════════════════════════════════════════════
input.section("2. Volume Delta Candles")
const showVD = input.bool("Show Delta Candles", true, { key: "showVD" })
const colUpVD = input.color("Up", "#089981", { key: "colUpVD" })
const colUpNeg = input.color("Up Neg Delta", "#f23645", { key: "colUpNeg", sameLine: true })
const colDnVD = input.color("Down", "#f23645", { key: "colDnVD" })
const colDnPos = input.color("Down Pos Delta", "#089981", { key: "colDnPos", sameLine: true })
const vdDisplay = input.select("Display", 1, { selectables: ["half bar", "full bar"], key: "vdDisplay" })
const showDotVD = input.bool("Max Volume Price Point", false, { key: "showDotVD" })

// ═══════════════════════════════════════════════════════════════════════════════
// 3. EMA Cross Settings
// ═══════════════════════════════════════════════════════════════════════════════
input.section("3. EMA Cross")
const useHTF = input.bool("Use Custom Timeframe", false, { key: "useHTF" })
const htfTF = input.timeframe("EMA Timeframe", "1h", { key: "htfTF" })
const lenFast = input.int("Fast EMA", 20, { min: 1, key: "lenFast" })
const lenSlow = input.int("Slow EMA", 100, { min: 1, key: "lenSlow" })
const showEMA = input.bool("Show EMA Lines", true, { key: "showEMA" })
const colFast = input.color("Fast Color", "#ffffff", { key: "colFast" })
const colSlow = input.color("Slow Color", "#5b9cf6", { key: "colSlow" })
const showSignals = input.bool("Show Cross + Retest Signals", true, { key: "showSignals" })

// ═══════════════════════════════════════════════════════════════════════════════
// Subscriptions
// ═══════════════════════════════════════════════════════════════════════════════
const src = subscribe(data.OHLCV)

// HTF subscription for EMA (only used if useHTF is checked)
const htfSrc = subscribe(data.OHLCV, { timeframe: htfTF })
const htfFastEma = htfSrc.calc(s => ta.ema(s.close(), lenFast))
const htfSlowEma = htfSrc.calc(s => ta.ema(s.close(), lenSlow))

// ═══════════════════════════════════════════════════════════════════════════════
// Persistent State (Series)
// ═══════════════════════════════════════════════════════════════════════════════
const phTop = Series("phTop")
const phBtm = Series("phBtm")
const phCrossed = Series("phCrossed")
const phX1 = Series("phX1")
const phCount = Series("phCount")
const phVol = Series("phVol")

const plTop = Series("plTop")
const plBtm = Series("plBtm")
const plCrossed = Series("plCrossed")
const plX1 = Series("plX1")
const plCount = Series("plCount")
const plVol = Series("plVol")

const pendingBull = Series("pendingBull")
const pendingBear = Series("pendingBear")

// ═══════════════════════════════════════════════════════════════════════════════
// onBar — Main Logic
// ═══════════════════════════════════════════════════════════════════════════════
function onBar(index) {
  const o = src.open()
  const h = src.high()
  const l = src.low()
  const c = src.close()
  const v = src.volume()
  const bv = src.buyVolume()
  const sv = src.sellVolume()
  const bi = barIndex()

  // ─────────────────────────────────────────────────────────────────────────
  // LIQUIDITY SWINGS
  // ─────────────────────────────────────────────────────────────────────────
  if (showTop || showBtm) {
    const ph = ta.pivothigh(src.high(), lengthLS, lengthLS)
    const pl = ta.pivotlow(src.low(), lengthLS, lengthLS)

    // Pivot High (Swing High)
    if (showTop) {
      if (!na(ph)) {
        const pivotH = src.high(lengthLS)
        const pivotBody = areaMode === "Wick Extremity"
          ? math.max(src.close(lengthLS), src.open(lengthLS))
          : src.low(lengthLS)

        phTop[0] = pivotH
        phBtm[0] = pivotBody
        phX1[0] = bi - lengthLS
        phCrossed[0] = 0
        phCount[0] = 0
        phVol[0] = 0

        // Draw swing zone
        Box(`sh_zone_${bi}`, {
          x1: bi - lengthLS, y1: pivotH,
          x2: bi, y2: pivotBody,
          color: topAreaCss, borderColor: color.transparent
        })
      } else {
        phTop[0] = nz(phTop[0], phTop(1))
        phBtm[0] = nz(phBtm[0], phBtm(1))
        phX1[0] = nz(phX1[0], phX1(1))
        phCrossed[0] = nz(phCrossed[0], phCrossed(1))
        phCount[0] = nz(phCount[0], phCount(1))
        phVol[0] = nz(phVol[0], phVol(1))

        // Count touches
        if (l < phTop[0] && h > phBtm[0]) {
          phCount[0] = phCount[0] + 1
          phVol[0] = phVol[0] + v
        }

        // Check for sweep
        if (c > phTop[0] && phCrossed[0] === 0) {
          phCrossed[0] = 1
        }
      }

      // Draw level line if filter passes
      const phTarget = filterMode === "Count" ? phCount[0] : phVol[0]
      if (phTarget > filterValue && phCrossed[0] === 0) {
        Line(`sh_lvl_${nz(phX1[0], bi)}`, {
          x1: nz(phX1[0], bi), y1: phTop[0],
          x2: bi + 3, y2: phTop[0],
          color: topCss, width: 1
        })
      }
    }

    // Pivot Low (Swing Low)
    if (showBtm) {
      if (!na(pl)) {
        const pivotL = src.low(lengthLS)
        const pivotBody = areaMode === "Wick Extremity"
          ? math.min(src.close(lengthLS), src.open(lengthLS))
          : src.high(lengthLS)

        plTop[0] = pivotBody
        plBtm[0] = pivotL
        plX1[0] = bi - lengthLS
        plCrossed[0] = 0
        plCount[0] = 0
        plVol[0] = 0

        Box(`sl_zone_${bi}`, {
          x1: bi - lengthLS, y1: pivotBody,
          x2: bi, y2: pivotL,
          color: btmAreaCss, borderColor: color.transparent
        })
      } else {
        plTop[0] = nz(plTop[0], plTop(1))
        plBtm[0] = nz(plBtm[0], plBtm(1))
        plX1[0] = nz(plX1[0], plX1(1))
        plCrossed[0] = nz(plCrossed[0], plCrossed(1))
        plCount[0] = nz(plCount[0], plCount(1))
        plVol[0] = nz(plVol[0], plVol(1))

        if (l < plTop[0] && h > plBtm[0]) {
          plCount[0] = plCount[0] + 1
          plVol[0] = plVol[0] + v
        }

        if (c < plBtm[0] && plCrossed[0] === 0) {
          plCrossed[0] = 1
        }
      }

      const plTarget = filterMode === "Count" ? plCount[0] : plVol[0]
      if (plTarget > filterValue && plCrossed[0] === 0) {
        Line(`sl_lvl_${nz(plX1[0], bi)}`, {
          x1: nz(plX1[0], bi), y1: plBtm[0],
          x2: bi + 3, y2: plBtm[0],
          color: btmCss, width: 1
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VOLUME DELTA CANDLES
  // ─────────────────────────────────────────────────────────────────────────
  if (showVD) {
    const delta = bv - sv
    const normDelta = v !== 0 ? delta / v : 0
    const posVD = normDelta >= 0
    const absOC = math.abs(o - c)
    const minOC = math.min(o, c)
    const maxOC = math.max(o, c)
    const avgOC = (o + c) / 2

    let valueVD, baseVD
    if (vdDisplay === "half bar") {
      valueVD = avgOC + normDelta * absOC / 2
      baseVD = avgOC
    } else {
      valueVD = posVD ? minOC + math.abs(normDelta) * absOC : maxOC - math.abs(normDelta) * absOC
      baseVD = posVD ? minOC : maxOC
    }

    // Delta fill candle
    const cssD = normDelta > 0
      ? (c > o ? colUpVD : colDnPos)
      : (c < o ? colDnVD : colUpNeg)
    const cssDTransp = color.transp(cssD, 50)

    plotCandle("Delta", baseVD, baseVD, valueVD, valueVD, { bodyColor: cssDTransp, wickColor: color.transparent, borderColor: color.transparent })

    // Outline candle
    const cssOutline = c > o ? colUpVD : (c < o ? colDnVD : color.white)
    plotCandle("Price", o, h, l, c, { bodyColor: color.transparent, wickColor: cssOutline, borderColor: cssOutline })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMA CROSS + RETEST
  // ─────────────────────────────────────────────────────────────────────────
  let fEMA, sEMA
  if (useHTF) {
    fEMA = htfFastEma()
    sEMA = htfSlowEma()
  } else {
    fEMA = ta.ema(c, lenFast)
    sEMA = ta.ema(c, lenSlow)
  }

  if (showEMA) {
    plot("Fast EMA", fEMA, { color: colFast, width: 1 })
    plot("Slow EMA", sEMA, { color: colSlow, width: 2 })
  }

  if (showSignals && !na(fEMA) && !na(sEMA)) {
    // Track cross state
    if (context.isFirst) {
      pendingBull[0] = 0
      pendingBear[0] = 0
    } else {
      pendingBull[0] = nz(pendingBull(1), 0)
      pendingBear[0] = nz(pendingBear(1), 0)
    }

    if (ta.crossover(fEMA, sEMA)) {
      pendingBull[0] = 1
      pendingBear[0] = 0
    }
    if (ta.crossunder(fEMA, sEMA)) {
      pendingBear[0] = 1
      pendingBull[0] = 0
    }

    // Retest detection
    const bullRetest = pendingBull[0] === 1 && l <= fEMA && c > sEMA
    const bearRetest = pendingBear[0] === 1 && h >= fEMA && c < sEMA

    if (bullRetest) {
      plotMarker("Bull Retest", l, { color: colUpVD, marker: shape.up, size: 10 })
      Label(`br_${bi}`, { x: bi, y: l, text: "Retest", color: colUpVD, size: size.xs })
      pendingBull[0] = 0
    }

    if (bearRetest) {
      plotMarker("Bear Retest", h, { color: colDnVD, marker: shape.down, size: 10 })
      Label(`brr_${bi}`, { x: bi, y: h, text: "Retest", color: colDnVD, size: size.xs })
      pendingBear[0] = 0
    }
  }
}
