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

import type { AMCalcParam, AMData, AMExtendData } from './fpAm/types'
import {
  FP_AM_DEFAULT_CALC_PARAMS,
  FP_AM_DEFAULT_EXTEND_DATA,
  FP_AM_INDICATOR_NAME,
  FP_AM_SHORT_NAME
} from './fpAm/constants'
import { computeAM } from './fpAm/compute'
import { drawAM } from './fpAm/render'
import { createFPAMTooltip } from './fpAm/tooltip'

/**
 * Finpath — Analogue Matcher (FP-AM)
 *
 * Main-pane overlay ("price" series). Finds the window in recent history whose
 * regression slope best matches the current window, then projects that
 * sequence `window` bars into the future (scaled by lastClose / anchorClose).
 *
 * - Dual Mode ⇒ renders BOTH the best-bullish and best-bearish analogue.
 * - Single Mode ⇒ renders the single closest analogue (coloured by its
 *   realised direction).
 *
 * Rendering uses `xAxis.convertToPixel(lastIdx + j)` for j ≥ 0 — same
 * mechanism ichimokuCloud uses for senkou-span displacement (see
 * ichimokuCloud.ts:121 where offset = 25). `dataIndexToCoordinate` in
 * Store.ts accepts any dataIndex, including beyond `dataList.length - 1`.
 *
 * All visuals are drawn inside `draw()` (projected candles + stats table).
 * `figures: []` so the native figure pipeline is suppressed.
 */
const finpathAnalogueMatcher: IndicatorTemplate<AMData, AMCalcParam, AMExtendData> = {
  name: FP_AM_INDICATOR_NAME,
  shortName: FP_AM_SHORT_NAME,
  series: 'price',
  precision: 2,
  shouldOhlc: false,
  shouldFormatBigNumber: false,
  zLevel: 0,

  // Heterogeneous tuple: [mode, window, lookback, tolerance] — see types.ts.
  calcParams: [...FP_AM_DEFAULT_CALC_PARAMS] as unknown as AMCalcParam[],
  figures: [],
  extendData: { ...FP_AM_DEFAULT_EXTEND_DATA },

  // Suppress canvas-layer library tooltip — zero per-bar values.
  styles: { tooltip: { showRule: 'none' } },

  // Recalc only when calcParams change; extendData-only changes (visibility
  // toggles, colour overrides) trigger redraw without recompute.
  shouldUpdate: (prev, curr) => {
    const calc = JSON.stringify(prev.calcParams) !== JSON.stringify(curr.calcParams)
    return { calc, draw: true }
  },

  calc: (dataList, indicator) => computeAM(dataList, indicator),

  draw: ({ ctx, indicator, chart, bounding, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return true
    const ext: AMExtendData = indicator.extendData

    ctx.save()
    drawAM(
      ctx,
      result,
      ext,
      bounding,
      xAxis,
      yAxis,
      chart,
      indicator.id,
      indicator.paneId,
      indicator.name
    )
    ctx.restore()
    return true
  },

  createTooltipDataSource: createFPAMTooltip
}

export default finpathAnalogueMatcher
