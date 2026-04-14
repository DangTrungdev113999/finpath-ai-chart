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

import { formatValue } from '../../common/utils/format'

import type { IndicatorFigure, IndicatorTemplate } from '../../component/Indicator'
import { collectLineSegments, drawSparseControlPoints, getControlPointBgColor, type HitSegment } from './indicatorInteractionUtils'

/**
 * Finpath - Moving Average Convergence Divergence (FP-MACD).
 *
 * 1:1 port of the legacy TradingView PineJS study `FP-MACD@tv-basicstudies-1`
 * (see finpath-web/docs/ai-chart/finpath-macd/exploration/LEGACY-LOGIC.ts).
 *
 * Differences from standard MACD indicator:
 * - calcParams tuple order is [slow, fast, signal, method] (NOT [fast, slow, signal]).
 * - Histogram split into 4 mutually-exclusive bars (dương tăng / âm giảm / dương giảm / âm tăng).
 * - Histogram uses `macd - signal` directly (NO ×2 multiplier like standard klinecharts MACD).
 * - Buy/Sell crossover markers drawn as circles (filtered by MACD sign).
 * - Signal MA method can be either 'EMA' (default) or 'SMA'.
 *
 * Live-bar handling: none — klinecharts re-invokes calc() with the full dataList
 * on every tick. All running state (prevMACD, prevSignal, etc.) is closure-local
 * to the single calc() call, so the legacy two-branch confirmed/live split is
 * structurally unnecessary here.
 */

// calcParams tuple — order matches legacy in_0..in_3:
//   [slow,   fast,   signal, method]
//   in_0=26, in_1=12, in_2=9, in_3='EMA'
type FPMACDParam = number | 'EMA' | 'SMA'

interface FPMACDResult {
  // plot_0 — MACD line
  macd?: number
  // plot_1 — Signal line
  signal?: number
  // plot_2 — positive & rising
  histPosRising?: number
  // plot_3 — negative & deepening
  histNegDeepening?: number
  // plot_4 — positive & falling
  histPosFalling?: number
  // plot_5 — negative & lightening
  histNegLightening?: number
  // plot_6 — undefined when no signal
  sellMarker?: number
  // plot_7 — undefined when no signal
  buyMarker?: number
}

// Default palette — BRD §3.2
const FP_MACD_DEFAULTS = {
  macdColor: '#68C296',
  signalColor: '#D94040',
  histPosRisingColor: '#008000',
  histNegDeepeningColor: '#FF0000',
  histPosFallingColor: '#80FF00',
  histNegLighteningColor: '#FF8080',
  sellColor: '#FF0000',
  buyColor: '#00FF00'
} as const

const MARKER_RADIUS = 4

/**
 * Recursive EMA with seed — matches legacy helper `t(e, t, n, r)`.
 * @param values  source series (length may exceed `period`)
 * @param period  smoothing window
 * @param seed    seed value (previous EMA, or priceClose[1] / macdArray[0] on warm-up)
 * @param init    true → iterate full array from index 1 (cold-start);
 *                false → single-step update using last value only
 */
function ema (values: number[], period: number, seed: number, init: boolean): number {
  const k = 2 / (period + 1)
  let out = seed
  if (init) {
    for (let i = 1; i < values.length; i++) {
      out = values[i] * k + out * (1 - k)
    }
  } else {
    out = values[values.length - 1] * k + seed * (1 - k)
  }
  return out
}

/**
 * Trailing simple moving average over last `period` elements.
 * Matches legacy helper `n(e, t)` — when values.length < period, averages available.
 */
function sma (values: number[], period: number): number {
  const n = Math.min(values.length, period)
  let sum = 0
  for (let i = values.length - n; i < values.length; i++) {
    sum += values[i]
  }
  return sum / n
}

const figures: Array<IndicatorFigure<FPMACDResult>> = [
  // plot_0 — MACD line  (#68C296)
  {
    key: 'macd',
    title: 'MACD: ',
    type: 'line',
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'lines[0].color',
        FP_MACD_DEFAULTS.macdColor
      ) as string
      return { color, size: 1 }
    }
  },

  // plot_1 — Signal line  (#D94040)
  {
    key: 'signal',
    title: 'Tín hiệu: ',
    type: 'line',
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'lines[1].color',
        FP_MACD_DEFAULTS.signalColor
      ) as string
      return { color, size: 1 }
    }
  },

  // plot_2 — Histogram positive & rising  (#008000)
  {
    key: 'histPosRising',
    title: 'Biểu đồ tần suất dương tăng: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'bars[0].upColor',
        FP_MACD_DEFAULTS.histPosRisingColor
      ) as string
      return { style: 'fill', color, borderColor: color }
    }
  },

  // plot_3 — Histogram negative & deepening  (#FF0000)
  {
    key: 'histNegDeepening',
    title: 'Biểu đồ tần suất âm giảm: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'bars[1].downColor',
        FP_MACD_DEFAULTS.histNegDeepeningColor
      ) as string
      return { style: 'fill', color, borderColor: color }
    }
  },

  // plot_4 — Histogram positive & falling  (#80FF00)
  {
    key: 'histPosFalling',
    title: 'Biểu đồ tần suất dương giảm: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'bars[2].upColor',
        FP_MACD_DEFAULTS.histPosFallingColor
      ) as string
      return { style: 'fill', color, borderColor: color }
    }
  },

  // plot_5 — Histogram negative & lightening  (#FF8080)
  {
    key: 'histNegLightening',
    title: 'Biểu đồ tần suất âm tăng: ',
    type: 'bar',
    baseValue: 0,
    styles: ({ indicator }) => {
      const color = formatValue(
        indicator.styles, 'bars[3].downColor',
        FP_MACD_DEFAULTS.histNegLighteningColor
      ) as string
      return { style: 'fill', color, borderColor: color }
    }
  }

  // plot_6 (sellMarker) and plot_7 (buyMarker) are rendered in `postDraw`
  // instead of as figures — so they draw AFTER all line segments and are
  // not covered by the next bar's MACD/Signal segment. Data fields remain
  // in result[] for the React tooltip loader to read.
]

const finpathMovingAverageConvergenceDivergence: IndicatorTemplate<FPMACDResult, FPMACDParam> = {
  name: 'FP-MACD',
  shortName: 'FP MACD',
  series: 'normal',
  precision: 4,
  shouldOhlc: false,
  shouldFormatBigNumber: false,
  calcParams: [26, 12, 9, 'EMA'],
  figures,

  calc: (dataList, indicator) => {
    const cp = indicator.calcParams
    // Silent clamps — AC-04. DO NOT mutate indicator.calcParams; legend must show
    // the raw user-entered value even when effective period is clamped.
    const slow = Math.max(cp[0] as number, 15)
    const fast = Math.max(cp[1] as number, 5)
    const signal = Math.max(cp[2] as number, 2)
    const method = (cp[3] as 'EMA' | 'SMA')

    // Running state — fresh each call (no cross-call leakage).
    const priceClose: number[] = []
    const macdArray: number[] = []

    // slow-EMA state
    let macdLong = 0
    // fast-EMA state
    let macdShort = 0
    // signal-EMA/SMA state
    let macdSignal = 0
    // -1 sentinel = "not yet initialized"
    let prevMacdLong = -1
    let prevMacdShort = -1
    let prevMacdSignal = -1

    let macd = 0
    let prevMacd = 0
    let prevSignal = 0
    let histogram = 0
    let prevHistogram = Number.NEGATIVE_INFINITY

    const out: FPMACDResult[] = []

    for (let i = 0; i < dataList.length; i++) {
      const close = dataList[i].close
      priceClose.push(close)
      const pcLen = priceClose.length

      // Default bar — warm-up period emits all zeros for histogram buckets
      // so legend shows `0.0000` (NOT `--`) per AC-21.
      // Markers default to undefined → figure pipeline skips them on warm-up.
      const bar: FPMACDResult = {
        macd: 0,
        signal: 0,
        histPosRising: 0,
        histNegDeepening: 0,
        histPosFalling: 0,
        histNegLightening: 0
      }

      // Legacy gates eval on `count > 1` (1-based), i.e. i >= 1 here.
      if (i >= 1) {
        // Fast EMA — legacy: count > a + 1  →  i > fast
        if (i > fast) {
          // cold-start seed / recursive step
          const newShort = prevMacdShort === -1
            ? ema(priceClose, fast, priceClose[1], true)
            : ema(priceClose, fast, macdShort, false)
          prevMacdShort = macdShort
          macdShort = newShort

          // Slow EMA — legacy: count > o + 1  →  i > slow
          if (i > slow) {
            const newLong = prevMacdLong === -1
              ? ema(priceClose, slow, priceClose[1], true)
              : ema(priceClose, slow, macdLong, false)
            prevMacdLong = macdLong
            macdLong = newLong
          } else {
            // Placeholder while slow still warming up — legacy lines:
            //   prevMACDLong = priceClose[h-2];  macdLong = priceClose[h-1]
            prevMacdLong = priceClose[pcLen - 2]
            macdLong = priceClose[pcLen - 1]
          }

          // MACD = fast - slow — snapshot prev BEFORE update (AC-07/08 depend on this).
          prevMacd = macd
          macd = macdShort - macdLong
          macdArray.push(macd)
          const maLen = macdArray.length

          // Signal — legacy: count > o + l + 1  →  i > slow + signal
          if (i > slow + signal) {
            let newSignal = 0
            if (method === 'SMA') {
              newSignal = sma(macdArray, signal)
            } else {
              newSignal = prevMacdSignal === -1
                ? ema(macdArray, signal, macdArray[0], true)
                : ema(macdArray, signal, macdSignal, false)
            }
            // Snapshot prev signal BEFORE overwriting (marker condition reads prevSignal).
            prevSignal = macdSignal
            prevMacdSignal = macdSignal
            macdSignal = newSignal
          } else {
            // Placeholder while signal still warming up.
            prevSignal = maLen >= 2 ? macdArray[maLen - 2] : macdArray[maLen - 1]
            macdSignal = macdArray[maLen - 1]
          }

          // Bound macdArray — legacy: p > o + l → splice(0, 1)
          if (maLen > slow + signal) {
            macdArray.splice(0, 1)
          }
        } else {
          // Fast EMA still warming — legacy fallback.
          macdShort = priceClose[pcLen - 1]
          prevMacdShort = priceClose[pcLen - 2]
          macd = 0
          macdSignal = 0
        }

        // ─── Histogram — legacy step 8 ─────────────────────────────────
        prevHistogram = histogram
        histogram = macd - macdSignal
        // (bar already has all 4 buckets = 0 from the default — we overwrite one)

        if (histogram >= 0) {
          if (histogram >= prevHistogram) {
            // plot_2
            bar.histPosRising = histogram
          } else {
            // plot_4
            bar.histPosFalling = histogram
          }
        } else {
          if (histogram <= prevHistogram) {
            // plot_3
            bar.histNegDeepening = histogram
          } else {
            // plot_5
            bar.histNegLightening = histogram
          }
        }

        // ─── Markers — sell/buy at MACD×Signal crossover ───────────────
        // Place the marker at the intersection point of the two lines,
        // approximated by the midpoint of MACD and Signal at the crossover
        // bar: (macd + signal) / 2.
        // Sell: prev MACD > prev Signal  AND  now MACD < Signal  AND  MACD > 0
        if (prevMacd > prevSignal && macd < macdSignal && macd > 0) {
          bar.sellMarker = (macd + macdSignal) / 2
        }
        // Buy: prev MACD < prev Signal  AND  now MACD > Signal  AND  MACD < 0
        if (prevMacd < prevSignal && macd > macdSignal && macd < 0) {
          bar.buyMarker = (macd + macdSignal) / 2
        }

        bar.macd = macd
        bar.signal = macdSignal

        // Bound priceClose — legacy: count > o+l+1 → splice(0, 1)
        if (i > slow + signal && priceClose.length > slow + signal + 1) {
          priceClose.splice(0, 1)
        }
      }

      out.push(bar)
    }

    return out
  },

  // Populate _hitSegments so Event.ts fires onIndicatorShapeClick and
  // onIndicatorShapeDoubleClick within 6px of MACD or Signal line.
  // We do NOT render — default figure pipeline draws all 8 plots.
  // Return false to keep default figures rendering.
  draw: ({ ctx, chart, indicator, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return false
    const visibleRange = chart.getVisibleRange()
    const from = visibleRange.from
    const to = visibleRange.to
    if (from >= to) return false

    const extData = (indicator.extendData as Record<string, unknown> | null) ?? {}
    if (indicator.extendData == null) {
      ;(indicator as unknown as { extendData: Record<string, unknown> }).extendData = extData
    }

    const resultRec = result as unknown as Array<Record<string, unknown>>
    const segs: HitSegment[] = [
      ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'macd'),
      ...collectLineSegments(resultRec, from, to, xAxis, yAxis, 'signal')
    ]
    extData._hitSegments = segs

    if (extData._selected === true) {
      const cpBg = getControlPointBgColor(chart)
      drawSparseControlPoints(ctx, resultRec, from, to, xAxis, yAxis, ['macd', 'signal'], 0, cpBg)
    }

    return false
  },

  // Render buy/sell crossover markers AFTER figures so they sit on top of
  // the MACD/Signal line segments (the figure pipeline draws segments
  // bar-by-bar — the next bar's segment would otherwise cover a circle
  // drawn on the previous bar).
  postDraw: ({ ctx, indicator, chart, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return false
    const { from, to } = chart.getVisibleRange()
    if (from >= to) return false

    const sellColor = formatValue(
      indicator.styles, 'circles[0].downColor',
      FP_MACD_DEFAULTS.sellColor
    ) as string
    const buyColor = formatValue(
      indicator.styles, 'circles[1].upColor',
      FP_MACD_DEFAULTS.buyColor
    ) as string

    ctx.save()
    for (let i = from; i < to && i < result.length; i++) {
      const bar = result[i]

      if (bar.sellMarker !== undefined) {
        const x = xAxis.convertToPixel(i)
        const y = yAxis.convertToPixel(bar.sellMarker)
        ctx.fillStyle = sellColor
        ctx.beginPath()
        ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
      if (bar.buyMarker !== undefined) {
        const x = xAxis.convertToPixel(i)
        const y = yAxis.convertToPixel(bar.buyMarker)
        ctx.fillStyle = buyColor
        ctx.beginPath()
        ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    return false
  }
}

export default finpathMovingAverageConvergenceDivergence
