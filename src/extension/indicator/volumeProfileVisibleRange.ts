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

import type { VPVRSettings } from './vpvr/types'
import { VPVR_DEFAULT_SETTINGS } from './vpvr/constants'
import { computeVPVRProfile } from './vpvr/compute'
import { drawVPVR } from './vpvr/render'
import { createVPVRTooltip } from './vpvr/tooltip'

function resolveSettings (extendData: unknown): VPVRSettings {
  if (extendData !== null && extendData !== undefined && typeof extendData === 'object') {
    return { ...VPVR_DEFAULT_SETTINGS, ...(extendData as Partial<VPVRSettings>) }
  }
  return { ...VPVR_DEFAULT_SETTINGS }
}

const volumeProfileVisibleRange: IndicatorTemplate<Record<string, unknown>, number, VPVRSettings> = {
  name: 'VPVR',
  shortName: 'VPVR',
  series: 'price',
  precision: 0,
  shouldOhlc: false,
  shouldFormatBigNumber: true,
  zLevel: -1,
  figures: [],
  calcParams: [],

  // No-op calc: real computation happens in draw() based on visible range
  calc: (dataList: KLineData[]) => dataList.map(() => ({})),

  draw: ({ ctx, chart, indicator, bounding, yAxis }) => {
    const dataList = chart.getDataList()
    if (dataList.length === 0) return true

    const settings = resolveSettings(indicator.extendData)
    if (!settings.showProfile) return true

    const visibleRange = chart.getVisibleRange()
    const from = Math.max(0, visibleRange.realFrom)
    const to = Math.min(dataList.length - 1, visibleRange.realTo)
    if (from >= to) return true

    const rangeKey = `${from}-${to}-${settings.rowSize}-${settings.valueAreaPercent}-${settings.volumeType}`

    // Check cache: reuse profile if range hasn't changed
    let profile = settings._cache?.rangeKey === rangeKey ? settings._cache.profile ?? null : null

    if (profile === null) {
      profile = computeVPVRProfile(dataList, from, to, settings)
      // Store cache in extendData (instance-level, not module-level)
      settings._cache = { profile, rangeKey }
    }

    if (profile.rows.length === 0 || profile.maxRowVolume === 0) return true

    ctx.save()
    drawVPVR(ctx, profile, settings, bounding, yAxis)
    ctx.restore()

    return true
  },

  createTooltipDataSource: createVPVRTooltip
}

export default volumeProfileVisibleRange
