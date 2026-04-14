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

import type { KLineData } from '../../common/Data'
import type { IndicatorTemplate } from '../../component/Indicator'
import type { IndicatorPolygonStyle } from '../../common/Styles'

/**
 * One row of computed indicator output, per bar.
 * Stored in indicator.result; consumed by figure styles + postDraw + tooltip.
 */
interface SqzMomData {
  /** Linear-regression endpoint of (close - mid). undefined during warmup. */
  val?: number
  /** BB fully inside KC — squeeze active (compression). */
  sqzOn?: boolean
  /** BB fully outside KC — squeeze released. */
  sqzOff?: boolean
  /** Neither sqzOn nor sqzOff (transitional). */
  noSqz?: boolean
  /**
   * Pre-computed histogram color slot index
   * (0=risingPositive, 1=fallingPositive, 2=fallingNegative, 3=risingNegative).
   */
  histSlot?: 0 | 1 | 2 | 3
  /** Pre-computed marker color slot index (0=noSqz, 1=sqzOn, 2=sqzOff). */
  markerSlot?: 0 | 1 | 2
}

type SqzCalcParam = number | boolean

/** Fallback histogram colors when user has not overridden styles.bars[*]. */
const FALLBACK_HIST_COLORS: readonly string[] = [
  '#00FF00', // 0 risingPositive (lime)
  '#008000', // 1 fallingPositive (green)
  '#FF0000', // 2 fallingNegative (red)
  '#800000' // 3 risingNegative (maroon)
]

/** Fallback marker colors when user has not overridden styles.circles[*]. */
const FALLBACK_MARKER_COLORS: readonly string[] = [
  '#0000FF', // 0 noSqz (blue)
  '#000000', // 1 sqzOn (black)
  '#808080' // 2 sqzOff (gray)
]

/** Half-arm length (px) for the synthesized zero-line cross marker. */
const MARKER_ARM = 3

/**
 * Population stdev of close[endIdx - length + 1 .. endIdx] around `mean`.
 * Mirrors `getBollMd` in bollingerBands.ts (divides by N, not N-1) — Pine `stdev()` is also population.
 */
function stdevPopulation (
  dataList: KLineData[],
  endIdx: number,
  length: number,
  mean: number
): number {
  let sum = 0
  for (let j = endIdx - length + 1; j <= endIdx; j++) {
    const d = dataList[j].close - mean
    sum += d * d
  }
  return Math.sqrt(Math.abs(sum) / length)
}

/**
 * Closed-form OLS linreg endpoint — equivalent to Pine `linreg(source, length, 0)`.
 *
 * Pine convention: x = 0 for OLDEST bar in the window, x = n - 1 for NEWEST.
 * Evaluates the fitted line at x = n - 1 (the most recent point).
 *
 * For SQZMOM:
 *   y_k = dataList[endIdx - (n - 1) + k].close - midAtCurrentBar
 *
 * Sanity: linreg([1,2,3,4,5], 5) → 5.
 */
function linregEndpoint (
  dataList: KLineData[],
  endIdx: number,
  length: number,
  midAtCurrentBar: number
): number {
  const n = length
  const xBar = (n - 1) / 2

  // Pass 1: y mean
  let ySum = 0
  for (let k = 0; k < n; k++) {
    const close = dataList[endIdx - (n - 1) + k].close
    ySum += (close - midAtCurrentBar)
  }
  const yBar = ySum / n

  // Pass 2: numerator & denominator
  let sxy = 0
  let sxx = 0
  for (let k = 0; k < n; k++) {
    const close = dataList[endIdx - (n - 1) + k].close
    const y = (close - midAtCurrentBar) - yBar
    const x = k - xBar
    sxy += x * y
    sxx += x * x
  }

  // sxx = n*(n^2 - 1)/12 — zero only for n === 1 (degenerate).
  if (sxx === 0) return ySum
  const slope = sxy / sxx
  const intercept = yBar - slope * xBar
  return intercept + slope * (n - 1)
}

/**
 * Squeeze Momentum Indicator (LazyBear) — verbatim Pine port.
 *
 * Pine source: see docs/ai-chart/squeeze-momentum-indicator/exploration/PINE-SCRIPT.pine
 *
 * Two rendering layers in the sub-pane:
 *   1. Histogram bar (figures[0]) — 4-state color via histSlot
 *   2. Zero-line cross markers — synthesized in postDraw, 3-state color via markerSlot
 */
const squeezeMomentum: IndicatorTemplate<SqzMomData, SqzCalcParam> = {
  name: 'SQZMOM',
  shortName: 'SQZMOM_LB',
  series: 'normal',
  // [bbLength, bbMult, kcLength, kcMult, useTrueRange]
  calcParams: [20, 2, 20, 1.5, true],
  precision: 4,
  shouldOhlc: false,
  shouldFormatBigNumber: false,
  figures: [
    {
      key: 'val',
      title: 'SQZMOM: ',
      type: 'bar',
      baseValue: 0,
      styles: ({ data, indicator, defaultStyles }) => {
        const slot = data.current?.histSlot
        if (slot == null) {
          return { color: 'transparent', borderColor: 'transparent' }
        }
        const barStyles = formatValue(
          indicator.styles, 'bars', defaultStyles!.bars
        ) as IndicatorPolygonStyle[]
        const color = (barStyles[slot]?.upColor as string | undefined) ?? FALLBACK_HIST_COLORS[slot]
        return {
          style: 'fill',
          color,
          borderColor: color
        }
      }
    }
  ],
  calc: (dataList, indicator) => {
    // Defensive cast — UI layer may pass numeric strings.
    const params = indicator.calcParams
    const bbLength = Math.max(1, Math.floor(Number(params[0])))
    // bbMult intentionally unread — verbatim Pine quirk; changing breaks 1:1 TV parity.
    // LazyBear's Pine reuses multKC for BOTH the BB deviation AND the KC bandwidth.
    // const bbMult = Number(params[1])
    const kcLength = Math.max(1, Math.floor(Number(params[2])))
    const kcMult = Number(params[3])
    const useTrueRange = Boolean(params[4])

    const n = dataList.length
    const result: SqzMomData[] = new Array<SqzMomData>(n)

    // Precompute range series once, branched on useTrueRange.
    const rangeSeries = new Float64Array(n)
    if (useTrueRange) {
      for (let i = 0; i < n; i++) {
        const k = dataList[i]
        // First-bar TR: prevClose = close → tr = high - low (matches DMI.ts pattern).
        const prevClose = i > 0 ? dataList[i - 1].close : k.close
        const hl = k.high - k.low
        const hcy = Math.abs(k.high - prevClose)
        const lcy = Math.abs(prevClose - k.low)
        rangeSeries[i] = Math.max(hl, hcy, lcy)
      }
    } else {
      for (let i = 0; i < n; i++) {
        const k = dataList[i]
        rangeSeries[i] = k.high - k.low
      }
    }

    // Rolling sums for three SMAs.
    let closeSumBB = 0
    let closeSumKC = 0
    let rangeSumKC = 0

    // First emitted bar index — max of both lookbacks.
    const warmup = Math.max(bbLength, kcLength) - 1

    // Pine nz(val[1]) = 0 on first emitted bar.
    let prevVal = 0

    for (let i = 0; i < n; i++) {
      const k = dataList[i]
      closeSumBB += k.close
      closeSumKC += k.close
      rangeSumKC += rangeSeries[i]

      // Drop bars that fell out of the rolling window.
      if (i >= bbLength) closeSumBB -= dataList[i - bbLength].close
      if (i >= kcLength) {
        closeSumKC -= dataList[i - kcLength].close
        rangeSumKC -= rangeSeries[i - kcLength]
      }

      if (i < warmup) {
        result[i] = {}
        continue
      }

      // ── Bollinger Bands ──────────────────────────────────────────────────
      const basis = closeSumBB / bbLength
      const stdevBB = stdevPopulation(dataList, i, bbLength, basis)
      // LazyBear quirk: BB deviation uses kcMult, NOT bbMult. Verbatim Pine.
      const dev = kcMult * stdevBB
      const upperBB = basis + dev
      const lowerBB = basis - dev

      // ── Keltner Channels ─────────────────────────────────────────────────
      const ma = closeSumKC / kcLength
      const rangema = rangeSumKC / kcLength
      const upperKC = ma + rangema * kcMult
      const lowerKC = ma - rangema * kcMult

      // ── Squeeze states (mutually exclusive) ──────────────────────────────
      const sqzOn = lowerBB > lowerKC && upperBB < upperKC
      const sqzOff = lowerBB < lowerKC && upperBB > upperKC
      const noSqz = !sqzOn && !sqzOff

      // ── Momentum value (linreg endpoint of close - mid over kcLength) ────
      let hh = -Infinity
      let ll = Infinity
      for (let j = i - kcLength + 1; j <= i; j++) {
        if (dataList[j].high > hh) hh = dataList[j].high
        if (dataList[j].low < ll) ll = dataList[j].low
      }
      const mid = ((hh + ll) / 2 + ma) / 2
      const val = linregEndpoint(dataList, i, kcLength, mid)

      // ── Histogram color slot (Pine bcolor, iff tie semantics) ───────────
      // val > 0 AND val > prevVal → slot 0 (lime/rising positive)
      // val > 0 AND val <= prevVal → slot 1 (green/falling positive)  [tie falls here]
      // val <= 0 AND val < prevVal → slot 2 (red/falling negative)
      // val <= 0 AND val >= prevVal → slot 3 (maroon/rising negative) [tie falls here]
      // eslint-disable-next-line @typescript-eslint/init-declarations -- branch assigned below
      let histSlot: 0 | 1 | 2 | 3
      if (val > 0) {
        histSlot = val > prevVal ? 0 : 1
      } else {
        histSlot = val < prevVal ? 2 : 3
      }

      // ── Marker color slot (Pine scolor) ─────────────────────────────────
      const markerSlot: 0 | 1 | 2 = noSqz ? 0 : sqzOn ? 1 : 2

      result[i] = { val, sqzOn, sqzOff, noSqz, histSlot, markerSlot }
      prevVal = val
    }

    return result
  },
  postDraw: ({ ctx, indicator, xAxis, yAxis, chart }) => {
    const result = indicator.result
    if (result.length === 0) return false

    const visibleRange = chart.getVisibleRange()
    const from = visibleRange.from
    const to = visibleRange.to
    if (from >= to) return false

    // Cache y=0 pixel outside the loop.
    const yZero = yAxis.convertToPixel(0)

    // Resolve the 3 marker colors from style overrides → defaults.
    const circleStyles = formatValue(
      indicator.styles, 'circles', []
    ) as Array<{ color?: string, upColor?: string, downColor?: string, noChangeColor?: string }>

    const colorBySlot: [string, string, string] = [
      circleStyles[0]?.noChangeColor ?? FALLBACK_MARKER_COLORS[0],
      circleStyles[1]?.upColor ?? FALLBACK_MARKER_COLORS[1],
      circleStyles[2]?.downColor ?? FALLBACK_MARKER_COLORS[2]
    ]

    ctx.save()
    ctx.lineWidth = 2

    for (let i = from; i < to && i < result.length; i++) {
      const slot = result[i].markerSlot
      if (slot == null) continue
      const x = xAxis.convertToPixel(i)
      ctx.strokeStyle = colorBySlot[slot]
      ctx.beginPath()
      // Horizontal arm
      ctx.moveTo(x - MARKER_ARM, yZero)
      ctx.lineTo(x + MARKER_ARM, yZero)
      // Vertical arm
      ctx.moveTo(x, yZero - MARKER_ARM)
      ctx.lineTo(x, yZero + MARKER_ARM)
      ctx.stroke()
    }
    ctx.restore()

    // Keep native figure rendering (histogram bars) intact.
    return false
  },
  createTooltipDataSource: () => ({
    // Surface layer renders its own React tooltip; suppress canvas tooltip.
    name: '',
    calcParamsText: '',
    features: [],
    legends: []
  })
}

export default squeezeMomentum
