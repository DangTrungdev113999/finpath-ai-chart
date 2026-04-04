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

import { isNumber } from '../../../common/utils/typeChecks'

import type { OverlayTemplate } from '../../../component/Overlay'

import type { VPFRExtendData, VPFRProfile } from './types'
import { VPFR_DEFAULT, resolveVPFRExtendData } from './constants'
import { computeVPFRProfile, computeDevelopingLines } from './compute'
import { renderPreview, renderProfile } from './render'

// Module-level cache — overlay.extendData is read-only (frozen by library)
const profileCache = new Map<string, VPFRProfile>()

const MAX_CACHE_SIZE = 200

const volumeProfileFixedRange: OverlayTemplate<VPFRExtendData> = {
  name: 'volumeProfileFixedRange',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: false,
  extendData: VPFR_DEFAULT,
  createPointFigures: ({ chart, coordinates, bounding, overlay, xAxis, yAxis }) => {
    const points = overlay.points

    // Resolve extendData with defaults (handles undefined, empty, or partial from persistence)
    const ext = resolveVPFRExtendData(overlay.extendData)

    // Drawing preview: show vertical dashed lines, no histogram
    if (overlay.currentStep !== -1) {
      return renderPreview(coordinates, bounding.height)
    }

    // Completed overlay: compute and render
    if (coordinates.length < 2) return []

    const dataList = chart.getDataList()
    if (dataList.length === 0) return []

    const maxDataIndex = dataList.length - 1

    // Resolve data indices from points, with clamping
    let startIdx = points[0].dataIndex
    let endIdx = points[1].dataIndex

    if (!isNumber(startIdx) || !isNumber(endIdx)) return []

    startIdx = Math.max(0, Math.min(startIdx, maxDataIndex))
    endIdx = Math.max(0, Math.min(endIdx, maxDataIndex))

    // Need at least 1 bar
    if (startIdx === endIdx) return renderPreview(coordinates, bounding.height)

    const from = Math.min(startIdx, endIdx)
    const to = Math.max(startIdx, endIdx)

    // Cache key includes all settings that affect computation
    const cacheKey = `${overlay.id}_${from}_${to}_${ext.rowSize}_${ext.rowsLayout}_${ext.volumeMode}_${ext.valueAreaVolume}`

    let profile = profileCache.get(cacheKey) ?? null
    if (profile === null) {
      profile = computeVPFRProfile(dataList, from, to, ext.rowSize, ext.valueAreaVolume)
      profileCache.set(cacheKey, profile)
      // Evict oldest if cache too large
      if (profileCache.size > MAX_CACHE_SIZE) {
        const iter = profileCache.keys()
        const first = iter.next()
        if (first.done !== true) { profileCache.delete(first.value) }
      }
    }

    if (profile.rows.length === 0) return []

    // Compute developing lines if any are enabled
    const needDeveloping = ext.developingPocLine.visible || ext.developingVahLine.visible || ext.developingValLine.visible
    const developingData = needDeveloping
      ? computeDevelopingLines(dataList, from, to, ext.rowSize, ext.valueAreaVolume)
      : undefined

    return renderProfile(profile, ext, coordinates, xAxis, yAxis, bounding.height, developingData)
  }
}

export default volumeProfileFixedRange
