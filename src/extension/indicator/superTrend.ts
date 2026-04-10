/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { KLineData } from '../../common/Data'
import type { IndicatorTemplate } from '../../component/Indicator'

// ═══════════════════════════════════════════════════════════════
// Data interface: per-bar calc output
// ═══════════════════════════════════════════════════════════════

interface SuperTrendData {
  // Up band value (only when trend == 1)
  up?: number
  // Down band value (only when trend == -1)
  dn?: number
  // 1 = bullish, -1 = bearish
  trend: number
  buySignal: boolean
  sellSignal: boolean
  // (O+H+L+C)/4 fill anchor
  ohlc4: number
  // Ratcheted up band (always computed, for tooltip)
  rawUp: number
  // Ratcheted dn band (always computed, for tooltip)
  rawDn: number
}

// ═══════════════════════════════════════════════════════════════
// ExtendData: settings from UI
// ═══════════════════════════════════════════════════════════════

type SuperTrendSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4'

interface SuperTrendExtendData {
  source?: SuperTrendSource
  changeATR?: boolean
  showSignals?: boolean
  highlighting?: boolean

  showUpTrend?: boolean
  showDownTrend?: boolean
  upTrendColor?: string
  downTrendColor?: string
  lineWidth?: number

  showUpTrendBegins?: boolean
  showDownTrendBegins?: boolean
  showBuyLabel?: boolean
  showSellLabel?: boolean
  upTrendBeginsColor?: string
  downTrendBeginsColor?: string
  buyLabelColor?: string
  sellLabelColor?: string

  upTrendFillColor?: string
  downTrendFillColor?: string
}

// ═══════════════════════════════════════════════════════════════
// Default colors
// ═══════════════════════════════════════════════════════════════

const DEFAULT_UP_TREND_COLOR = '#26A69A'
const DEFAULT_DOWN_TREND_COLOR = '#EF5350'
const DEFAULT_UP_FILL_COLOR = 'rgba(38, 166, 154, 0.1)'
const DEFAULT_DN_FILL_COLOR = 'rgba(239, 83, 80, 0.1)'
const DEFAULT_LINE_WIDTH = 2

// ═══════════════════════════════════════════════════════════════
// Source price resolution
// ═══════════════════════════════════════════════════════════════

function getSourcePrice (data: KLineData, source: SuperTrendSource): number {
  switch (source) {
    case 'open': return data.open
    case 'high': return data.high
    case 'low': return data.low
    case 'close': return data.close
    case 'hl2': return (data.high + data.low) / 2
    case 'hlc3': return (data.high + data.low + data.close) / 3
    case 'ohlc4': return (data.open + data.high + data.low + data.close) / 4
    case 'hlcc4': return (data.high + data.low + data.close + data.close) / 4
  }
}

// ═══════════════════════════════════════════════════════════════
// Step-line (linebr) drawing helper
// Draws horizontal at current y, then vertical to next y.
// Breaks when value transitions to/from undefined.
// ═══════════════════════════════════════════════════════════════

function drawStepLineBr (
  ctx: CanvasRenderingContext2D,
  result: SuperTrendData[],
  from: number,
  to: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number },
  key: 'up' | 'dn',
  color: string,
  lineWidth: number
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'
  ctx.setLineDash([])
  ctx.beginPath()

  let started = false
  let prevY = 0

  for (let i = from; i < to && i < result.length; i++) {
    const val = result[i][key]
    if (val == null) {
      // Break the line
      if (started) {
        ctx.stroke()
        ctx.beginPath()
        started = false
      }
      continue
    }

    const x = xAxis.convertToPixel(i)
    const y = yAxis.convertToPixel(val)

    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      // Step-line: horizontal to current x at previous y, then vertical
      ctx.lineTo(x, prevY)
      ctx.lineTo(x, y)
    }

    prevY = y
  }

  if (started) {
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════
// Fill region rendering
// Fills between ohlc4 and the active trend line, with step-line
// polygon shape. Segments at trend flips.
// ═══════════════════════════════════════════════════════════════

function drawSuperTrendFill (
  ctx: CanvasRenderingContext2D,
  result: SuperTrendData[],
  from: number,
  to: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number },
  ext: SuperTrendExtendData
): void {
  const upFillColor = ext.upTrendFillColor ?? DEFAULT_UP_FILL_COLOR
  const dnFillColor = ext.downTrendFillColor ?? DEFAULT_DN_FILL_COLOR

  // Collect segments grouped by trend
  let segTrend = 0
  let trendLinePoints: Array<{ x: number; y: number }> = []
  let ohlc4Points: Array<{ x: number; y: number }> = []

  const flushSegment = (): void => {
    if (trendLinePoints.length < 2) {
      trendLinePoints = []
      ohlc4Points = []
      return
    }

    ctx.fillStyle = segTrend === 1 ? upFillColor : dnFillColor
    ctx.beginPath()

    // Trace trend line forward (step-line shape)
    ctx.moveTo(trendLinePoints[0].x, trendLinePoints[0].y)
    for (let j = 1; j < trendLinePoints.length; j++) {
      // Step: horizontal to current x at previous y, then vertical
      ctx.lineTo(trendLinePoints[j].x, trendLinePoints[j - 1].y)
      ctx.lineTo(trendLinePoints[j].x, trendLinePoints[j].y)
    }

    // Trace ohlc4 backward (straight lines between points)
    for (let j = ohlc4Points.length - 1; j >= 0; j--) {
      ctx.lineTo(ohlc4Points[j].x, ohlc4Points[j].y)
    }

    ctx.closePath()
    ctx.fill()

    trendLinePoints = []
    ohlc4Points = []
  }

  for (let i = from; i < to && i < result.length; i++) {
    const item = result[i]
    const trendVal = item.trend === 1 ? item.up : item.dn
    if (trendVal == null) {
      flushSegment()
      continue
    }

    const x = xAxis.convertToPixel(i)
    const trendY = yAxis.convertToPixel(trendVal)
    const ohlc4Y = yAxis.convertToPixel(item.ohlc4)

    if (trendLinePoints.length === 0) {
      // Start new segment
      segTrend = item.trend
      trendLinePoints.push({ x, y: trendY })
      ohlc4Points.push({ x, y: ohlc4Y })
    } else if (item.trend !== segTrend) {
      // Trend flip: include this point in both segments for continuity
      trendLinePoints.push({ x, y: trendY })
      ohlc4Points.push({ x, y: ohlc4Y })
      flushSegment()
      // Start new segment from this point
      segTrend = item.trend
      trendLinePoints.push({ x, y: trendY })
      ohlc4Points.push({ x, y: ohlc4Y })
    } else {
      trendLinePoints.push({ x, y: trendY })
      ohlc4Points.push({ x, y: ohlc4Y })
    }
  }

  flushSegment()
}

// ═══════════════════════════════════════════════════════════════
// Signal markers: circles at reversal bars + Buy/Sell labels
// ═══════════════════════════════════════════════════════════════

function drawSignalMarkers (
  ctx: CanvasRenderingContext2D,
  result: SuperTrendData[],
  from: number,
  to: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number },
  ext: SuperTrendExtendData
): void {
  const showUpTrendBegins = ext.showUpTrendBegins ?? true
  const showDownTrendBegins = ext.showDownTrendBegins ?? true
  const showBuyLabel = ext.showBuyLabel ?? true
  const showSellLabel = ext.showSellLabel ?? true

  const upBeginsColor = ext.upTrendBeginsColor ?? DEFAULT_UP_TREND_COLOR
  const dnBeginsColor = ext.downTrendBeginsColor ?? DEFAULT_DOWN_TREND_COLOR
  const buyColor = ext.buyLabelColor ?? DEFAULT_UP_TREND_COLOR
  const sellColor = ext.sellLabelColor ?? DEFAULT_DOWN_TREND_COLOR

  for (let i = from; i < to && i < result.length; i++) {
    const item = result[i]

    if (item.buySignal) {
      const x = xAxis.convertToPixel(i)
      const y = yAxis.convertToPixel(item.rawUp)

      // Circle marker at reversal point
      if (showUpTrendBegins) {
        ctx.fillStyle = upBeginsColor
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Buy label (rectangle with pointed bottom, positioned below the value)
      if (showBuyLabel) {
        const labelText = 'Buy'
        ctx.font = '11px Arial'
        const textWidth = ctx.measureText(labelText).width
        const padding = 4
        const labelW = textWidth + padding * 2
        const labelH = 16
        const arrowH = 5

        // Position: below the trend value
        const labelX = x - labelW / 2
        const labelY = y + 6

        // Draw label body
        ctx.fillStyle = buyColor
        ctx.beginPath()
        ctx.moveTo(labelX, labelY + arrowH)
        ctx.lineTo(labelX + labelW, labelY + arrowH)
        ctx.lineTo(labelX + labelW, labelY + arrowH + labelH)
        ctx.lineTo(labelX, labelY + arrowH + labelH)
        ctx.closePath()
        ctx.fill()

        // Draw arrow pointing up
        ctx.beginPath()
        ctx.moveTo(x - 4, labelY + arrowH)
        ctx.lineTo(x, labelY)
        ctx.lineTo(x + 4, labelY + arrowH)
        ctx.closePath()
        ctx.fill()

        // Draw text
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelText, x, labelY + arrowH + labelH / 2)
      }
    }

    if (item.sellSignal) {
      const x = xAxis.convertToPixel(i)
      const y = yAxis.convertToPixel(item.rawDn)

      // Circle marker at reversal point
      if (showDownTrendBegins) {
        ctx.fillStyle = dnBeginsColor
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sell label (rectangle with pointed top, positioned above the value)
      if (showSellLabel) {
        const labelText = 'Sell'
        ctx.font = '11px Arial'
        const textWidth = ctx.measureText(labelText).width
        const padding = 4
        const labelW = textWidth + padding * 2
        const labelH = 16
        const arrowH = 5

        // Position: above the trend value (pointing down, label above)
        const labelX = x - labelW / 2
        const labelY = y - 6 - arrowH - labelH

        // Draw label body
        ctx.fillStyle = sellColor
        ctx.beginPath()
        ctx.moveTo(labelX, labelY)
        ctx.lineTo(labelX + labelW, labelY)
        ctx.lineTo(labelX + labelW, labelY + labelH)
        ctx.lineTo(labelX, labelY + labelH)
        ctx.closePath()
        ctx.fill()

        // Draw arrow pointing down
        ctx.beginPath()
        ctx.moveTo(x - 4, labelY + labelH)
        ctx.lineTo(x, labelY + labelH + arrowH)
        ctx.lineTo(x + 4, labelY + labelH)
        ctx.closePath()
        ctx.fill()

        // Draw text
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelText, x, labelY + labelH / 2)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Hit segments: collect step-line segments for Event.ts hit testing
// ═══════════════════════════════════════════════════════════════

interface HitSegment {
  x1: number; y1: number; x2: number; y2: number
}

function collectStepLineSegments (
  result: SuperTrendData[],
  from: number,
  to: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number },
  key: 'up' | 'dn'
): HitSegment[] {
  const segments: HitSegment[] = []
  let prevX = 0
  let prevY = 0
  let started = false

  for (let i = from; i < to && i < result.length; i++) {
    const val = result[i][key]
    if (val == null) {
      started = false
      continue
    }
    const x = xAxis.convertToPixel(i)
    const y = yAxis.convertToPixel(val)
    if (!started) {
      started = true
    } else {
      // Horizontal segment: prevX,prevY → x,prevY
      segments.push({ x1: prevX, y1: prevY, x2: x, y2: prevY })
      // Vertical segment: x,prevY → x,y
      if (Math.abs(y - prevY) > 1) {
        segments.push({ x1: x, y1: prevY, x2: x, y2: y })
      }
    }
    prevX = x
    prevY = y
  }
  return segments
}

// ═══════════════════════════════════════════════════════════════
// Control points: small circles at step-line vertices when selected
// Style: similar to trendline but smaller
// ═══════════════════════════════════════════════════════════════

const CP_RADIUS = 3.5
const CP_BORDER = 1.5
const CP_COLOR = '#1592E6'

function drawControlPoints (
  ctx: CanvasRenderingContext2D,
  result: SuperTrendData[],
  from: number,
  to: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number },
  bgColor: string
): void {
  // Collect ONLY vertex positions where the step-line changes value or starts/ends.
  // A vertex = first bar of a segment, last bar before a break, or where value changes.
  const points: Array<{ x: number; y: number }> = []

  // eslint-disable-next-line @typescript-eslint/init-declarations -- intentionally undefined until first value
  let prevUpVal: number | undefined
  // eslint-disable-next-line @typescript-eslint/init-declarations -- intentionally undefined until first value
  let prevDnVal: number | undefined
  let prevUpStarted = false
  let prevDnStarted = false

  for (let i = from; i < to && i < result.length; i++) {
    const item = result[i]

    // Up trend vertices
    if (item.up != null) {
      if (!prevUpStarted || item.up !== prevUpVal) {
        // Value changed or segment started — this is a vertex
        points.push({ x: xAxis.convertToPixel(i), y: yAxis.convertToPixel(item.up) })
      }
      prevUpVal = item.up
      prevUpStarted = true
    } else {
      if (prevUpStarted && i > from) {
        // Segment ended at previous bar — add the last point
        const prev = result[i - 1]
        if (prev.up != null) {
          points.push({ x: xAxis.convertToPixel(i - 1), y: yAxis.convertToPixel(prev.up) })
        }
      }
      prevUpStarted = false
    }

    // Down trend vertices
    if (item.dn != null) {
      if (!prevDnStarted || item.dn !== prevDnVal) {
        points.push({ x: xAxis.convertToPixel(i), y: yAxis.convertToPixel(item.dn) })
      }
      prevDnVal = item.dn
      prevDnStarted = true
    } else {
      if (prevDnStarted && i > from) {
        const prev = result[i - 1]
        if (prev.dn != null) {
          points.push({ x: xAxis.convertToPixel(i - 1), y: yAxis.convertToPixel(prev.dn) })
        }
      }
      prevDnStarted = false
    }
  }

  // Draw each control point
  for (const p of points) {
    // Fill with background color
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.arc(p.x, p.y, CP_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    // Border
    ctx.strokeStyle = CP_COLOR
    ctx.lineWidth = CP_BORDER
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════
// SuperTrend IndicatorTemplate
// ═══════════════════════════════════════════════════════════════

const superTrend: IndicatorTemplate<SuperTrendData, number, SuperTrendExtendData> = {
  name: 'SUPERTREND',
  shortName: 'Supertrend',
  series: 'price',
  precision: 2,
  shouldOhlc: true,
  calcParams: [10, 3],
  figures: [],

  shouldUpdate: (prev, current) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const prevExt = (prev.extendData ?? {}) as SuperTrendExtendData
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const currExt = (current.extendData ?? {}) as SuperTrendExtendData
    // Recalculate when source or ATR method changes
    const needCalc = prevExt.source !== currExt.source || prevExt.changeATR !== currExt.changeATR
    if (needCalc) {
      return { calc: true, draw: true }
    }
    return { calc: false, draw: true }
  },

  // ─── calc(): True Range, ATR, Bands, Trend State Machine ────────────
  calc: (dataList: KLineData[], indicator) => {
    const params = indicator.calcParams
    const atrPeriod = params[0] ?? 10
    const multiplier = params[1] ?? 3

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = (indicator.extendData ?? {}) as SuperTrendExtendData
    const source: SuperTrendSource = ext.source ?? 'hl2'
    const useRMA = ext.changeATR !== false // default true = RMA

    const len = dataList.length
    if (len === 0) return []

    // Pre-compute True Range
    const tr: number[] = []
    for (let i = 0; i < len; i++) {
      const d = dataList[i]
      if (i === 0) {
        tr.push(d.high - d.low)
      } else {
        const prevClose = dataList[i - 1].close
        tr.push(Math.max(
          d.high - d.low,
          Math.abs(d.high - prevClose),
          Math.abs(d.low - prevClose)
        ))
      }
    }

    // Compute ATR
    const atr: number[] = []
    for (let i = 0; i < len; i++) {
      atr.push(0)
    }
    if (useRMA) {
      // RMA-based ATR: seed with SMA, then recursive
      let trSum = 0
      for (let i = 0; i < len; i++) {
        trSum += tr[i]
        if (i < atrPeriod - 1) {
          atr[i] = 0
        } else if (i === atrPeriod - 1) {
          atr[i] = trSum / atrPeriod
        } else {
          atr[i] = (atr[i - 1] * (atrPeriod - 1) + tr[i]) / atrPeriod
        }
      }
    } else {
      // SMA-based ATR: simple moving average of TR
      let trSum = 0
      for (let i = 0; i < len; i++) {
        trSum += tr[i]
        if (i >= atrPeriod) {
          trSum -= tr[i - atrPeriod]
        }
        if (i >= atrPeriod - 1) {
          atr[i] = trSum / atrPeriod
        }
      }
    }

    // Compute bands, ratcheting, and trend state machine
    const result: SuperTrendData[] = []
    const upBand: number[] = []
    const dnBand: number[] = []
    const trends: number[] = []
    for (let i = 0; i < len; i++) {
      upBand.push(0)
      dnBand.push(0)
      trends.push(1)
    }

    for (let i = 0; i < len; i++) {
      const d = dataList[i]
      const ohlc4 = (d.open + d.high + d.low + d.close) / 4

      if (i < atrPeriod - 1) {
        // Warm-up period: no valid ATR
        result.push({
          trend: 1,
          buySignal: false,
          sellSignal: false,
          ohlc4,
          rawUp: 0,
          rawDn: 0
        })
        continue
      }

      const src = getSourcePrice(d, source)
      let up = src - multiplier * atr[i]
      let dn = src + multiplier * atr[i]

      // Band ratcheting
      if (i > 0 && i >= atrPeriod) {
        const prevClose = dataList[i - 1].close
        if (prevClose > upBand[i - 1]) {
          up = Math.max(up, upBand[i - 1])
        }
        if (prevClose < dnBand[i - 1]) {
          dn = Math.min(dn, dnBand[i - 1])
        }
      }

      upBand[i] = up
      dnBand[i] = dn

      // Trend state machine
      // eslint-disable-next-line @typescript-eslint/init-declarations -- assigned conditionally
      let trend: number
      if (i === atrPeriod - 1) {
        trend = 1
      } else {
        const prevTrend = trends[i - 1]
        const close = d.close
        if (prevTrend === -1 && close > dnBand[i - 1]) {
          trend = 1 // Flip bullish
        } else if (prevTrend === 1 && close < upBand[i - 1]) {
          trend = -1 // Flip bearish
        } else {
          trend = prevTrend
        }
      }
      trends[i] = trend

      // Signal detection
      const prevTrend = i > 0 ? trends[i - 1] : 1
      const buySignal = trend === 1 && prevTrend === -1
      const sellSignal = trend === -1 && prevTrend === 1

      result.push({
        up: trend === 1 ? up : undefined,
        dn: trend !== 1 ? dn : undefined,
        trend,
        buySignal,
        sellSignal,
        ohlc4,
        rawUp: up,
        rawDn: dn
      })
    }

    return result
  },

  // ─── draw(): fully custom rendering ─────────────────────────────────────
  draw: ({ ctx, indicator, xAxis, yAxis, chart }) => {
    const result = indicator.result
    if (result.length === 0) return true

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = (indicator.extendData ?? {}) as SuperTrendExtendData
    const visibleRange = chart.getVisibleRange()
    const from = visibleRange.from
    const to = visibleRange.to
    if (from >= to) return true

    ctx.save()

    // 1. Fill regions (lowest z)
    if (ext.highlighting !== false) {
      ctx.globalCompositeOperation = 'source-over'
      drawSuperTrendFill(ctx, result, from, to, xAxis, yAxis, ext)
    }

    // 2. Step lines
    if (ext.showUpTrend !== false) {
      drawStepLineBr(
        ctx, result, from, to, xAxis, yAxis,
        'up', ext.upTrendColor ?? DEFAULT_UP_TREND_COLOR, ext.lineWidth ?? DEFAULT_LINE_WIDTH
      )
    }
    if (ext.showDownTrend !== false) {
      drawStepLineBr(
        ctx, result, from, to, xAxis, yAxis,
        'dn', ext.downTrendColor ?? DEFAULT_DOWN_TREND_COLOR, ext.lineWidth ?? DEFAULT_LINE_WIDTH
      )
    }

    // 3. Signal markers (highest z)
    if (ext.showSignals !== false) {
      drawSignalMarkers(ctx, result, from, to, xAxis, yAxis, ext)
    }

    // 4. Compute hit segments for Event.ts hover/click detection
    const extData = indicator.extendData as Record<string, unknown> | null
    if (extData != null) {
      const segs: HitSegment[] = []
      if (ext.showUpTrend !== false) {
        segs.push(...collectStepLineSegments(result, from, to, xAxis, yAxis, 'up'))
      }
      if (ext.showDownTrend !== false) {
        segs.push(...collectStepLineSegments(result, from, to, xAxis, yAxis, 'dn'))
      }
      extData._hitSegments = segs
    }

    // 5. Draw control points when selected
    if (extData?._selected === true) {
      const bgColor = '#131722' // dark theme background
      drawControlPoints(ctx, result, from, to, xAxis, yAxis, bgColor)
    }

    ctx.restore()
    return true
  }
}

export default superTrend
