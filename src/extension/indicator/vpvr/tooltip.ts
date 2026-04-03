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

import type { VPVRProfile, VPVRSettings } from './types'
import { VPVR_DEFAULT_SETTINGS } from './constants'

function formatVolume (vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(3)}B`
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(3)}M`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`
  return vol.toFixed(0)
}

function resolveSettings (extendData: unknown): VPVRSettings {
  if (extendData !== null && extendData !== undefined && typeof extendData === 'object') {
    return { ...VPVR_DEFAULT_SETTINGS, ...(extendData as Partial<VPVRSettings>) }
  }
  return { ...VPVR_DEFAULT_SETTINGS }
}

export function createVPVRTooltip (params: IndicatorCreateTooltipDataSourceParams<Record<string, unknown>>): IndicatorTooltipData {
  const { indicator, crosshair, yAxis } = params
  const settings = resolveSettings(indicator.extendData)

  const volumeTypeLabel = settings.volumeType === 'upDown' ? 'Up/Down' : settings.volumeType === 'total' ? 'Total' : 'Delta'
  const calcParamsText = `Number Of Rows ${settings.rowSize} ${volumeTypeLabel} ${settings.valueAreaPercent}`

  const result: IndicatorTooltipData = {
    name: 'VPVR',
    calcParamsText,
    features: [],
    legends: []
  }

  if (!settings.showStatusLineValues) return result

  // Find the cached profile from extendData
  const cache = settings._cache
  if (cache?.profile == null) return result

  const profile: VPVRProfile = cache.profile

  // Map crosshair Y position to a price level, then find the matching row
  const crosshairY = crosshair.y
  if (crosshairY === undefined || profile.rows.length === 0) return result

  const crosshairPrice = yAxis.convertFromPixel(crosshairY)

  // Binary-ish search for the row containing this price
  let matchedRow = profile.rows[0]
  for (const row of profile.rows) {
    if (crosshairPrice >= row.low && crosshairPrice < row.high) {
      matchedRow = row
      break
    }
    // Handle edge case: price exactly at the top boundary of the last row
    if (crosshairPrice >= row.high && row === profile.rows[profile.rows.length - 1]) {
      matchedRow = row
    }
  }

  result.legends = [
    {
      title: { text: 'Buy: ', color: 'rgba(21, 146, 230, 0.70)' },
      value: { text: formatVolume(matchedRow.buyVol), color: 'rgba(21, 146, 230, 0.70)' }
    },
    {
      title: { text: 'Sell: ', color: 'rgba(251, 193, 35, 0.70)' },
      value: { text: formatVolume(matchedRow.sellVol), color: 'rgba(251, 193, 35, 0.70)' }
    },
    {
      title: { text: 'Total: ', color: '#787B86' },
      value: { text: formatVolume(matchedRow.totalVol), color: '#787B86' }
    }
  ]

  return result
}
