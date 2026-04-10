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

import type { FPVPFRProfile, FPVPFRSettings } from './fpVpfr/types'
import { FP_VPFR_DEFAULT_SETTINGS } from './fpVpfr/constants'
import { computeFPVPFRProfile } from './fpVpfr/compute'
import { drawFPVPFR } from './fpVpfr/render'
import { createFPVPFRTooltip } from './fpVpfr/tooltip'

function resolveSettings (extendData: unknown): FPVPFRSettings {
  if (extendData !== null && extendData !== undefined && typeof extendData === 'object') {
    return { ...FP_VPFR_DEFAULT_SETTINGS, ...(extendData as Partial<FPVPFRSettings>) }
  }
  return { ...FP_VPFR_DEFAULT_SETTINGS }
}

const fpVolumeProfileFixedRange: IndicatorTemplate<Record<string, unknown>, number, FPVPFRSettings> = {
  name: 'FP_VPFR',
  shortName: 'FP_VPFR',
  series: 'price',
  precision: 0,
  shouldOhlc: false,
  shouldFormatBigNumber: true,
  zLevel: -1,
  figures: [],
  calcParams: [],

  // No-op calc: real computation happens in draw() based on fixed lookback range
  calc: (dataList: KLineData[]) => dataList.map(() => ({})),

  draw: ({ ctx, chart, indicator, bounding, xAxis, yAxis }) => {
    const dataList = chart.getDataList()
    if (dataList.length === 0) return true

    const settings = resolveSettings(indicator.extendData)

    // If all visual elements are hidden, skip rendering entirely
    if (!settings.showBoxes && !settings.showLines && !settings.showPaneLabels) return true

    // Fixed lookback range (KEY DIFFERENCE from VPVR)
    const toIdx = dataList.length - 1
    const fromIdx = Math.max(0, toIdx - settings.numberOfBars + 1)
    if (fromIdx >= toIdx) return true

    // Cache check
    const rangeKey = `${fromIdx}-${toIdx}-${settings.rowSize}-${settings.valueAreaPercent}-${dataList.length}`
    const extData = indicator.extendData as unknown as Record<string, unknown> | null
    const existingCache = extData?._cache as { profile: FPVPFRProfile | null; rangeKey: string } | undefined
    let profile = existingCache?.rangeKey === rangeKey ? existingCache.profile ?? null : null

    if (profile === null) {
      profile = computeFPVPFRProfile(dataList, fromIdx, toIdx, settings)
      if (extData != null) {
        extData._cache = { profile, rangeKey }
      }
    }

    if (profile === null || profile.maxRowVolume === 0) return true

    // Store POC price + color for Y-axis label (IndicatorLastValueView reads these)
    if (extData != null && settings.showLines) {
      extData._pocPrice = profile.rows[profile.pocIndex].mid
      extData.pocColor = settings.pocColor
    } else if (extData != null) {
      extData._pocPrice = undefined
    }

    // Store hit area for cursor/click detection (Event.ts reads this)
    if (extData != null) {
      const fromX = xAxis.convertToPixel(fromIdx)
      const toX = xAxis.convertToPixel(toIdx)
      const maxWidth = Math.abs(toX - fromX) / 3
      const topY = yAxis.convertToPixel(profile.profileHigh)
      const bottomY = yAxis.convertToPixel(profile.profileLow)
      extData._hitArea = {
        left: fromX,
        top: Math.min(topY, bottomY),
        right: fromX + maxWidth,
        bottom: Math.max(topY, bottomY)
      }
    }

    ctx.save()
    drawFPVPFR(ctx, profile, settings, bounding, xAxis, yAxis, dataList)
    ctx.restore()

    return true
  },

  createTooltipDataSource: createFPVPFRTooltip
}

export default fpVolumeProfileFixedRange
