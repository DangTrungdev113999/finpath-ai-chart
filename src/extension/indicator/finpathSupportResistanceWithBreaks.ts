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

import type { SRBData, SRBExtendData } from './fpSrb/types'
import {
  FP_SRB_DEFAULT_EXTEND_DATA,
  FP_SRB_DEFAULT_LEFT_BARS,
  FP_SRB_DEFAULT_RIGHT_BARS,
  FP_SRB_DEFAULT_VOLUME_THRESH,
  FP_SRB_INDICATOR_NAME,
  FP_SRB_SHORT_NAME
} from './fpSrb/constants'
import { computeSRB } from './fpSrb/compute'
import { drawSRB } from './fpSrb/render'
import { createSRBTooltip } from './fpSrb/tooltip'

/**
 * Finpath - Support and Resistance Levels with Breaks (LuxAlgo port).
 *
 * Auto-detects pivot highs and pivot lows; draws horizontal step-function
 * resistance / support lines anchored at the most recent confirmed pivot.
 * Each new pivot resets the line with a 1-bar visible gap. When the close
 * crosses through the current level, a break label is plotted at the
 * break bar, classified into 4 types based on volume oscillator strength
 * (vs `volumeThresh`) and candle-body wick shape.
 *
 * Implementation notes:
 * - Custom-draw (`draw()` returns `true`) — no figures[] pipeline.
 * - `calcParams=[leftBars, rightBars, volumeThresh]` + typed `extendData`
 *   for color / visibility / `toggleBreaks` (extendData-only changes
 *   trigger re-draw without recompute).
 * - Backpaint is hardcoded `-(rightBars + 1)` (Pine source has no toggle).
 * - `styles.tooltip.showRule = 'none'` suppresses the canvas tooltip so the
 *   React legend row in finpath-web is the single source of truth.
 * - NO control points / NO hit-testing — lines are computed from pivots,
 *   not user-editable (BRD §2.3, AC-15). Unlike Trendlines, we do NOT
 *   call `applyIndicatorInteraction`.
 * - `extendData._resistancePrice` / `_supportPrice` written after render
 *   for the finpath-web Y-axis label layer (pattern mirrors Trendlines
 *   `_upperPrice` / `_lowerPrice`).
 */
const finpathSupportResistanceWithBreaks: IndicatorTemplate<SRBData, number, SRBExtendData> = {
  name: FP_SRB_INDICATOR_NAME,
  shortName: FP_SRB_SHORT_NAME,
  series: 'price',
  precision: 2,
  shouldOhlc: false,
  shouldFormatBigNumber: false,
  calcParams: [FP_SRB_DEFAULT_LEFT_BARS, FP_SRB_DEFAULT_RIGHT_BARS, FP_SRB_DEFAULT_VOLUME_THRESH],
  figures: [],

  // Suppress canvas-layer tooltip — React legend row handles display.
  styles: {
    tooltip: {
      showRule: 'none'
    }
  },

  // Recompute vs re-draw gating:
  //   `calcParams` change (leftBars / rightBars / volumeThresh) → calc.
  //   All extendData-only changes (colors, visibility flags, toggleBreaks)
  //   → draw-only.
  // Custom shouldUpdate REPLACES library default detection, so calcParams
  // diff must be compared explicitly here.
  shouldUpdate: (prev, current) => {
    const calc = JSON.stringify(prev.calcParams) !== JSON.stringify(current.calcParams)
    return { calc, draw: true }
  },

  // Per-bar calculation — see `compute.ts` for the state machine.
  calc: (dataList, indicator) => {
    const calcParams = indicator.calcParams
    const leftBars = calcParams[0] ?? FP_SRB_DEFAULT_LEFT_BARS
    const rightBars = calcParams[1] ?? FP_SRB_DEFAULT_RIGHT_BARS
    const volumeThresh = calcParams[2] ?? FP_SRB_DEFAULT_VOLUME_THRESH
    return computeSRB(dataList, leftBars, rightBars, volumeThresh)
  },

  // Fully custom draw — returns true to suppress default figure rendering.
  draw: ({ ctx, indicator, chart, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return true

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime
    const ext = (indicator.extendData ?? FP_SRB_DEFAULT_EXTEND_DATA) as SRBExtendData
    const leftBars = indicator.calcParams[0] ?? FP_SRB_DEFAULT_LEFT_BARS
    const rightBars = indicator.calcParams[1] ?? FP_SRB_DEFAULT_RIGHT_BARS

    const { from, to } = chart.getVisibleRange()
    if (from >= to) return true

    // Single outer save/restore wrapping all draws (mirror Trendlines pattern).
    ctx.save()
    drawSRB(ctx, result, from, to, xAxis, yAxis, ext, leftBars, rightBars)
    ctx.restore()

    // Expose current values for Y-axis label layer (finpath-web consumer).
    // Walk backward to find the last NON-undefined level (skip pivot-change
    // gap bars where emit is undefined).
    const extData = indicator.extendData as unknown as Record<string, unknown> | null
    if (extData !== null) {
      // eslint-disable-next-line @typescript-eslint/init-declarations -- assigned conditionally in loop
      let lastResistance: number | undefined
      // eslint-disable-next-line @typescript-eslint/init-declarations -- assigned conditionally in loop
      let lastSupport: number | undefined
      for (let i = result.length - 1; i >= 0; i--) {
        if (lastResistance === undefined && result[i].resistance !== undefined) {
          lastResistance = result[i].resistance
        }
        if (lastSupport === undefined && result[i].support !== undefined) {
          lastSupport = result[i].support
        }
        if (lastResistance !== undefined && lastSupport !== undefined) break
      }
      extData._resistancePrice = lastResistance
      extData._supportPrice = lastSupport
    }

    return true
  },

  createTooltipDataSource: createSRBTooltip
}

export default finpathSupportResistanceWithBreaks
