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

import type { IndicatorTooltipData, IndicatorCreateTooltipDataSourceParams } from '../../../component/Indicator'

import type { VPVRProfile } from './types'

export function createVPVRTooltip (params: IndicatorCreateTooltipDataSourceParams<Record<string, unknown>>): IndicatorTooltipData {
  const { indicator, crosshair, yAxis } = params

  // Return empty name + legends so canvas tooltip draws nothing
  // React HTML tooltip handles the display
  const result: IndicatorTooltipData = {
    name: '',
    calcParamsText: '',
    features: [],
    legends: []
  }

  // Always compute and store _tooltipValues on extendData for React layer to read
  const extData = indicator.extendData as Record<string, unknown> | null
  const cache = extData?._cache as { profile: VPVRProfile | null; rangeKey: string } | undefined

  if (cache?.profile != null && extData != null) {
    const profile = cache.profile
    const crosshairY = crosshair.y

    if (crosshairY !== undefined && profile.rows.length > 0) {
      const crosshairPrice = yAxis.convertFromPixel(crosshairY)

      // Find row at crosshair price
      let matchedRow = profile.rows[0]
      for (const row of profile.rows) {
        if (crosshairPrice >= row.low && crosshairPrice < row.high) {
          matchedRow = row
          break
        }
        if (crosshairPrice >= row.high && row === profile.rows[profile.rows.length - 1]) {
          matchedRow = row
        }
      }

      // Store computed values on extendData so React tooltip loader can read them
      extData._tooltipValues = {
        buyVol: matchedRow.buyVol,
        sellVol: matchedRow.sellVol,
        totalVol: matchedRow.totalVol
      }
    }
  }

  // Return empty legends — React HTML tooltip handles the display
  return result
}
