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

import type { IndicatorTemplate } from '../../component/Indicator'
import {
  applyIndicatorInteraction,
  getControlPointBgColor
} from './indicatorInteractionUtils'

import type { TLBData, TLBExtendData } from './fpTlb/types'
import {
  FP_TLB_DEFAULT_EXTEND_DATA,
  FP_TLB_DEFAULT_LENGTH,
  FP_TLB_DEFAULT_MULT,
  FP_TLB_INDICATOR_NAME,
  FP_TLB_SHORT_NAME
} from './fpTlb/constants'
import { computeTLB } from './fpTlb/compute'
import { drawTLB } from './fpTlb/render'
import { createTLBTooltip } from './fpTlb/tooltip'

/**
 * Finpath - Trendlines with Breaks (LuxAlgo port).
 *
 * Auto-detects swing pivots and draws down-sloping / up-sloping trend lines
 * anchored at the most recent pivot high / pivot low, plus dashed right-edge
 * projections and "B" breakout labels when price closes across the projected
 * trend line.
 *
 * Implementation notes:
 * - Custom-draw (`draw()` returns `true`) — no figures[] pipeline.
 * - Hybrid settings: `calcParams=[length, mult]` + typed `extendData` for the
 *   remaining 5 inputs. `shouldUpdate` opts into recompute only on
 *   `calcMethod` change (numeric calcParams diff is library-handled).
 * - Backpaint is a render-time shift (not a recompute) — matches Pine
 *   `offset=-length` semantics.
 * - `styles.tooltip.showRule = 'none'` suppresses the canvas tooltip so the
 *   React legend row in finpath-web is the single source of truth.
 * - `extendData._upperPrice` / `_lowerPrice` written after render for the
 *   finpath-web Y-axis label layer (pattern mirrors `FP_VPFR._pocPrice`).
 */
const finpathTrendlinesWithBreaks: IndicatorTemplate<TLBData, number, TLBExtendData> = {
  name: FP_TLB_INDICATOR_NAME,
  shortName: FP_TLB_SHORT_NAME,
  series: 'price',
  precision: 2,
  shouldOhlc: false,
  shouldFormatBigNumber: false,
  calcParams: [FP_TLB_DEFAULT_LENGTH, FP_TLB_DEFAULT_MULT],
  figures: [],

  // Suppress canvas-layer tooltip — React legend row handles display.
  styles: {
    tooltip: {
      showRule: 'none'
    }
  },

  // Recompute vs re-draw gating:
  //   `calcParams` change (length / mult) is auto-handled by library → calc.
  //   Here we only opt into recompute when `calcMethod` changes.
  shouldUpdate: (prev, current) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const prevExt = (prev.extendData ?? {}) as TLBExtendData
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const currExt = (current.extendData ?? {}) as TLBExtendData
    const needCalc = prevExt.calcMethod !== currExt.calcMethod
    if (needCalc) return { calc: true, draw: true }
    return { calc: false, draw: true }
  },

  // Per-bar calculation — see `compute.ts` for the state machine.
  calc: (dataList, indicator) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = (indicator.extendData ?? FP_TLB_DEFAULT_EXTEND_DATA) as TLBExtendData
    const calcParams = indicator.calcParams
    const length = calcParams[0] ?? FP_TLB_DEFAULT_LENGTH
    const mult = calcParams[1] ?? FP_TLB_DEFAULT_MULT
    return computeTLB(dataList, length, mult, ext.calcMethod ?? 'Atr')
  },

  // Fully custom draw — returns true to suppress default figure rendering.
  draw: ({ ctx, indicator, chart, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return true

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = (indicator.extendData ?? FP_TLB_DEFAULT_EXTEND_DATA) as TLBExtendData
    const length = indicator.calcParams[0] ?? FP_TLB_DEFAULT_LENGTH

    const { from, to } = chart.getVisibleRange()
    if (from >= to) return true

    // Single outer save/restore wrapping BOTH drawTLB and the control-point
    // pass — matches SuperTrend's pattern. Closing the save block before
    // applyIndicatorInteraction runs caused the blue circular border on
    // control points to go missing (host ctx state leaked back in between
    // fill() and stroke()).
    ctx.save()
    drawTLB(ctx, result, from, to, xAxis, yAxis, ext, length)

    // Hit-test segments + control points when selected.
    const indexOffset = (ext.backpaint ?? true) ? -length : 0
    applyIndicatorInteraction(
      ctx,
      indicator,
      result as unknown as Array<Record<string, unknown>>,
      from,
      to,
      xAxis,
      yAxis,
      ['upper', 'lower'],
      indexOffset,
      getControlPointBgColor(chart)
    )
    ctx.restore()

    // Expose current values for Y-axis label layer (finpath-web consumer).
    const extData = indicator.extendData as unknown as Record<string, unknown> | null
    if (extData !== null) {
      const lastIdx = result.length - 1
      const last = lastIdx >= 0 ? result[lastIdx] : undefined
      extData._upperPrice = last?.upper
      extData._lowerPrice = last?.lower
    }

    return true
  },

  createTooltipDataSource: createTLBTooltip
}

export default finpathTrendlinesWithBreaks
