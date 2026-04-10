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
import { collectLineSegments, drawSparseControlPoints, getControlPointBgColor, type HitSegment } from './indicatorInteractionUtils'

// ═══════════════════════════════════════════════════════════════
// Data interface: raw values stored per bar (before offset)
// ═══════════════════════════════════════════════════════════════

interface IchimokuData {
  // Conversion Line (9-period donchian midline)
  tenkan?: number
  // Base Line (26-period donchian midline)
  kijun?: number
  // Leading Span A raw = (tenkan + kijun) / 2
  senkouA?: number
  // Leading Span B raw = 52-period donchian midline
  senkouB?: number
  // Close price (plotted backward)
  chikou?: number
}

// ═══════════════════════════════════════════════════════════════
// ExtendData: visibility/color/style overrides from the UI layer
// ═══════════════════════════════════════════════════════════════

interface IchimokuExtendData {
  // Visibility toggles
  showTenkan?: boolean
  showKijun?: boolean
  showSenkouA?: boolean
  showSenkouB?: boolean
  showChikou?: boolean
  showCloud?: boolean

  // Per-line colors
  tenkanColor?: string
  kijunColor?: string
  senkouAColor?: string
  senkouBColor?: string
  chikouColor?: string

  // Cloud fill colors (10% opacity by default, matching TradingView)
  bullishCloudColor?: string
  bearishCloudColor?: string

  // Per-line widths (default 1)
  tenkanWidth?: number
  kijunWidth?: number
  senkouAWidth?: number
  senkouBWidth?: number
  chikouWidth?: number

  // Global line width fallback
  lineWidth?: number
}

// ═══════════════════════════════════════════════════════════════
// Default colors (matching TradingView exactly)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TENKAN_COLOR = '#2962FF'
const DEFAULT_KIJUN_COLOR = '#B71C1C'
const DEFAULT_SENKOU_A_COLOR = '#A5D6A7'
const DEFAULT_SENKOU_B_COLOR = '#EF9A9A'
const DEFAULT_CHIKOU_COLOR = '#43A047'
// 10% opacity, matching TradingView
const DEFAULT_BULLISH_CLOUD_COLOR = 'rgba(67, 160, 71, 0.1)'
const DEFAULT_BEARISH_CLOUD_COLOR = 'rgba(244, 67, 54, 0.1)'

// ═══════════════════════════════════════════════════════════════
// Donchian midline: (highest high + lowest low) / 2 over N bars
// ═══════════════════════════════════════════════════════════════

function donchian (dataList: KLineData[], endIndex: number, period: number): number {
  const startIdx = Math.max(0, endIndex - period + 1)
  let highestHigh = -Infinity
  let lowestLow = Infinity
  for (let i = startIdx; i <= endIndex; i++) {
    if (dataList[i].high > highestHigh) highestHigh = dataList[i].high
    if (dataList[i].low < lowestLow) lowestLow = dataList[i].low
  }
  return (highestHigh + lowestLow) / 2
}

// ═══════════════════════════════════════════════════════════════
// Helper: draw a polyline from an array of {barIndex, value}
// with an optional bar-index offset (for displaced lines)
// ═══════════════════════════════════════════════════════════════

function drawLine (
  ctx: CanvasRenderingContext2D,
  points: Array<{ barIndex: number; value: number }>,
  offset: number,
  color: string,
  lineWidth: number,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number }
): void {
  if (points.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  ctx.beginPath()
  let started = false
  for (const pt of points) {
    const x = xAxis.convertToPixel(pt.barIndex + offset)
    const y = yAxis.convertToPixel(pt.value)
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════
// Cloud fill with crossover-aware segmentation
// ═══════════════════════════════════════════════════════════════

interface CloudPoint {
  barIndex: number
  a: number
  b: number
}

function drawCloudFill (
  ctx: CanvasRenderingContext2D,
  points: CloudPoint[],
  offset: number,
  bullishColor: string,
  bearishColor: string,
  xAxis: { convertToPixel: (v: number) => number },
  yAxis: { convertToPixel: (v: number) => number }
): void {
  if (points.length < 2) return

  // Split at crossovers and fill each segment with the correct color
  let segStart = 0
  for (let i = 1; i < points.length; i++) {
    const prevBullish = points[i - 1].a >= points[i - 1].b
    const currBullish = points[i].a >= points[i].b

    if (prevBullish !== currBullish || i === points.length - 1) {
      // Include the crossover point (or last point) in the current segment
      const segEnd = i
      const segment = points.slice(segStart, segEnd + 1)
      const isBullish = points[segStart].a >= points[segStart].b

      if (segment.length >= 2) {
        ctx.fillStyle = isBullish ? bullishColor : bearishColor
        ctx.beginPath()

        // Trace Senkou A forward
        const x0 = xAxis.convertToPixel(segment[0].barIndex + offset)
        const y0 = yAxis.convertToPixel(segment[0].a)
        ctx.moveTo(x0, y0)
        for (let j = 1; j < segment.length; j++) {
          ctx.lineTo(
            xAxis.convertToPixel(segment[j].barIndex + offset),
            yAxis.convertToPixel(segment[j].a)
          )
        }

        // Trace Senkou B backward to close polygon
        for (let j = segment.length - 1; j >= 0; j--) {
          ctx.lineTo(
            xAxis.convertToPixel(segment[j].barIndex + offset),
            yAxis.convertToPixel(segment[j].b)
          )
        }

        ctx.closePath()
        ctx.fill()
      }

      // Next segment starts at the crossover point
      segStart = i
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Ichimoku Cloud IndicatorTemplate
// ═══════════════════════════════════════════════════════════════

const ichimokuCloud: IndicatorTemplate<IchimokuData, number, IchimokuExtendData> = {
  name: 'IK',
  shortName: 'Ichimoku',
  series: 'price',
  precision: 2,
  shouldOhlc: true,
  // [conversionPeriod, basePeriod, spanBPeriod, displacement]
  calcParams: [9, 26, 52, 26],

  figures: [
    { key: 'tenkan', title: 'T: ', type: 'line' },
    { key: 'kijun', title: 'K: ', type: 'line' },
    { key: 'senkouA', title: 'A: ', type: 'line' },
    { key: 'senkouB', title: 'B: ', type: 'line' },
    { key: 'chikou', title: 'C: ', type: 'line' }
  ],

  // ─── calc(): donchian midline for each component ────────────────────────
  calc: (dataList: KLineData[], indicator) => {
    const params = indicator.calcParams
    const conversionPeriod = params[0] ?? 9
    const basePeriod = params[1] ?? 26
    const spanBPeriod = params[2] ?? 52

    return dataList.map((kLineData, i) => {
      const result: IchimokuData = {}

      // Tenkan-sen: donchian(conversionPeriod)
      result.tenkan = donchian(dataList, i, conversionPeriod)

      // Kijun-sen: donchian(basePeriod)
      result.kijun = donchian(dataList, i, basePeriod)

      // Senkou Span A: (tenkan + kijun) / 2 (raw, before +offset)
      result.senkouA = (result.tenkan + result.kijun) / 2

      // Senkou Span B: donchian(spanBPeriod) (raw, before +offset)
      result.senkouB = donchian(dataList, i, spanBPeriod)

      // Chikou Span: close price (raw, before -offset)
      result.chikou = kLineData.close

      return result
    })
  },

  // ─── draw(): custom rendering with displacement offsets + cloud fill ────
  // Returns true always because ALL lines need offset-aware rendering
  draw: (params) => {
    const { ctx, indicator, xAxis, yAxis, chart } = params
    const result = indicator.result
    if (result.length === 0) return true

    const calcParams = indicator.calcParams
    const displacement = calcParams[3] > 0 ? calcParams[3] : 26
    // +25 for senkou forward, -25 for chikou backward
    const offset = displacement - 1

    // ─── Resolve extendData settings ────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = ((indicator.extendData ?? {}) as IchimokuExtendData)

    const showTenkan = ext.showTenkan ?? true
    const showKijun = ext.showKijun ?? true
    const showSenkouA = ext.showSenkouA ?? true
    const showSenkouB = ext.showSenkouB ?? true
    const showChikou = ext.showChikou ?? true
    const showCloud = ext.showCloud ?? true

    const tenkanColor = ext.tenkanColor ?? DEFAULT_TENKAN_COLOR
    const kijunColor = ext.kijunColor ?? DEFAULT_KIJUN_COLOR
    const senkouAColor = ext.senkouAColor ?? DEFAULT_SENKOU_A_COLOR
    const senkouBColor = ext.senkouBColor ?? DEFAULT_SENKOU_B_COLOR
    const chikouColor = ext.chikouColor ?? DEFAULT_CHIKOU_COLOR
    const bullishCloudColor = ext.bullishCloudColor ?? DEFAULT_BULLISH_CLOUD_COLOR
    const bearishCloudColor = ext.bearishCloudColor ?? DEFAULT_BEARISH_CLOUD_COLOR

    const defaultLw = ext.lineWidth ?? 1
    const tenkanWidth = ext.tenkanWidth ?? defaultLw
    const kijunWidth = ext.kijunWidth ?? defaultLw
    const senkouAWidth = ext.senkouAWidth ?? defaultLw
    const senkouBWidth = ext.senkouBWidth ?? defaultLw
    const chikouWidth = ext.chikouWidth ?? defaultLw

    // ─── Visible range ──────────────────────────────────────────────────
    const visibleRange = chart.getVisibleRange()
    const from = visibleRange.from
    const to = visibleRange.to
    if (from >= to) return true

    // Expand the range to account for displacement offsets:
    // - Senkou lines are drawn at (barIndex + offset), so data from
    //   (visibleFrom - offset) to (visibleTo) may be visible
    // - Chikou is drawn at (barIndex - offset), so data from
    //   (visibleFrom) to (visibleTo + offset) may be visible
    const dataLen = result.length
    const cloudFrom = Math.max(0, from - offset)
    const cloudTo = Math.min(dataLen, to + offset)

    ctx.save()

    // ─── Cloud fill ─────────────────────────────────────────────────────
    if (showCloud) {
      const cloudPoints: CloudPoint[] = []
      for (let i = cloudFrom; i < cloudTo && i < dataLen; i++) {
        const item = result[i]
        if (item.senkouA != null && item.senkouB != null) {
          cloudPoints.push({ barIndex: i, a: item.senkouA, b: item.senkouB })
        }
      }
      if (cloudPoints.length >= 2) {
        ctx.globalCompositeOperation = 'source-over'
        drawCloudFill(ctx, cloudPoints, offset, bullishCloudColor, bearishCloudColor, xAxis, yAxis)
      }
    }

    // ─── Build point arrays for lines ───────────────────────────────────
    const tenkanPoints: Array<{ barIndex: number; value: number }> = []
    const kijunPoints: Array<{ barIndex: number; value: number }> = []
    const senkouAPoints: Array<{ barIndex: number; value: number }> = []
    const senkouBPoints: Array<{ barIndex: number; value: number }> = []
    const chikouPoints: Array<{ barIndex: number; value: number }> = []

    for (let i = cloudFrom; i < cloudTo && i < dataLen; i++) {
      const item = result[i]
      if (showTenkan && item.tenkan != null) {
        tenkanPoints.push({ barIndex: i, value: item.tenkan })
      }
      if (showKijun && item.kijun != null) {
        kijunPoints.push({ barIndex: i, value: item.kijun })
      }
      if (showSenkouA && item.senkouA != null) {
        senkouAPoints.push({ barIndex: i, value: item.senkouA })
      }
      if (showSenkouB && item.senkouB != null) {
        senkouBPoints.push({ barIndex: i, value: item.senkouB })
      }
      if (showChikou && item.chikou != null) {
        chikouPoints.push({ barIndex: i, value: item.chikou })
      }
    }

    // ─── Draw lines ─────────────────────────────────────────────────────
    // Tenkan and Kijun: offset = 0 (drawn at natural bar position)
    drawLine(ctx, tenkanPoints, 0, tenkanColor, tenkanWidth, xAxis, yAxis)
    drawLine(ctx, kijunPoints, 0, kijunColor, kijunWidth, xAxis, yAxis)

    // Senkou A and B: offset = +(displacement - 1) bars forward
    drawLine(ctx, senkouAPoints, offset, senkouAColor, senkouAWidth, xAxis, yAxis)
    drawLine(ctx, senkouBPoints, offset, senkouBColor, senkouBWidth, xAxis, yAxis)

    // Chikou: offset = -(displacement - 1) bars backward
    drawLine(ctx, chikouPoints, -offset, chikouColor, chikouWidth, xAxis, yAxis)

    ctx.restore()

    // Interaction: hit segments + control points
    const extData = indicator.extendData as Record<string, unknown> | null
    if (extData != null) {
      const resultRec = result as unknown as Array<Record<string, unknown>>
      const segs: HitSegment[] = [
        ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'tenkan'),
        ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'kijun'),
        ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'senkouA', offset),
        ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'senkouB', offset),
        ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'chikou', -offset)
      ]
      extData._hitSegments = segs
      if (extData._selected === true) {
        const cpBg = getControlPointBgColor(chart)
        drawSparseControlPoints(ctx, resultRec, from, to, xAxis, yAxis, ['tenkan', 'kijun'], 0, cpBg)
        drawSparseControlPoints(ctx, resultRec, from, to, xAxis, yAxis, ['senkouA', 'senkouB'], offset, cpBg)
        drawSparseControlPoints(ctx, resultRec, from, to, xAxis, yAxis, ['chikou'], -offset, cpBg)
      }
    }

    // Return true: we drew everything, suppress native figures pipeline
    return true
  }
}

export default ichimokuCloud
