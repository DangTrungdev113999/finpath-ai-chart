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

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import type { LineAttrs } from '../../figure/line'

import type { VPFRExtendData, VPFRProfile } from './types'
import { VPFR_DEFAULT_EXTEND_DATA, VPFR_AXIS_LABEL_BG, VPFR_AXIS_LABEL_TEXT_COLOR } from './constants'
import { computeVPFRProfile } from './compute'
import { renderVPFRFigures } from './render'

// Internal helper to access ChartStore from Chart interface.
// ChartImp.getChartStore() is always available but not on the public interface
// to avoid leaking the ChartStore class into the .d.ts output.
interface ChartInternal {
  getChartStore: () => { getClickOverlayInfo: () => EventOverlayInfo }
}

// Module-level cache — extendData is frozen/read-only, so we cache externally
// keyed by overlay id
const profileCache = new Map<string, { profile: VPFRProfile; rangeKey: string }>()

const vpfr: OverlayTemplate<VPFRExtendData> = {
  name: 'vpfr',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  mode: 'normal',
  modeSensitivity: 8,
  extendData: { ...VPFR_DEFAULT_EXTEND_DATA },

  createPointFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const figures: OverlayFigure[] = []

    if (coordinates.length === 0) return figures

    // Drawing in progress with only 1 point — nothing to show yet
    if (coordinates.length === 1) {
      return figures
    }

    // Drawing step 2 — cursor is moving, show dashed preview line
    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== -1
    if (isDrawing) {
      const previewLineAttrs: LineAttrs = {
        coordinates: [
          { x: coordinates[0].x, y: coordinates[0].y },
          { x: coordinates[1].x, y: coordinates[1].y }
        ]
      }
      figures.push({
        key: 'vpfr_preview',
        type: 'line',
        attrs: previewLineAttrs,
        styles: {
          style: 'dashed',
          color: '#2196F3',
          size: 1,
          dashedValue: [6, 4]
        },
        ignoreEvent: true
      })
      return figures
    }

    // Overlay is complete — render full histogram
    const points = overlay.points
    if (points.length < 2 || points[0].dataIndex == null || points[1].dataIndex == null) {
      return figures
    }

    const dataList = chart.getDataList()
    if (dataList.length === 0) return figures

    const extendData = overlay.extendData
    const settings: VPFRExtendData = {
      ...VPFR_DEFAULT_EXTEND_DATA,
      ...extendData
    }

    // Normalize indices — handle CP1 dragged past CP2
    const fromIdx = Math.min(points[0].dataIndex, points[1].dataIndex)
    const toIdx = Math.max(points[0].dataIndex, points[1].dataIndex)

    // Build cache key from all computation parameters
    const overlayId = overlay.id
    const rangeKey = `${fromIdx}-${toIdx}-${settings.rowSize}-${settings.valueAreaPercent}-${settings.volumeType}`

    // Use cached profile if available (module-level cache, keyed by overlay id)
    const cached = profileCache.get(overlayId)
    let profile = cached?.rangeKey === rangeKey ? cached.profile : null

    if (profile == null) {
      profile = computeVPFRProfile(dataList, fromIdx, toIdx, settings)
      if (profile != null) {
        profileCache.set(overlayId, { profile, rangeKey })
      }
    }

    if (profile == null) return figures

    if (yAxis == null) return figures

    // Determine selection state
    const clickOverlayInfo = (chart as unknown as ChartInternal).getChartStore().getClickOverlayInfo()
    const isSelected = clickOverlayInfo.overlay?.id === overlay.id

    // X positions from coordinates (time-based)
    const leftX = Math.min(coordinates[0].x, coordinates[1].x)
    const rightX = Math.max(coordinates[0].x, coordinates[1].x)

    // CP positions: CP1 at start-time/high-price, CP2 at end-time/low-price
    const profileTopY = yAxis.convertToPixel(profile.profileHigh)
    const profileBottomY = yAxis.convertToPixel(profile.profileLow)
    const cp1 = { x: coordinates[0].x, y: profileTopY }
    const cp2 = { x: coordinates[1].x, y: profileBottomY }

    return renderVPFRFigures({
      profile,
      settings,
      leftX,
      rightX,
      boundingWidth: bounding.width,
      yAxis,
      isSelected,
      cp1,
      cp2
    })
  },

  createYAxisFigures: ({ chart, overlay, coordinates, yAxis }) => {
    if (coordinates.length < 2 || yAxis == null) return []

    const points = overlay.points
    if (points.length < 2 || points[0].dataIndex == null || points[1].dataIndex == null) return []

    // Only show axis labels when selected
    const clickOverlayInfo = (chart as unknown as ChartInternal).getChartStore().getClickOverlayInfo()
    const isSelected = clickOverlayInfo.overlay?.id === overlay.id
    if (!isSelected) return []

    const dataList = chart.getDataList()
    if (dataList.length === 0) return []

    // Get profile data from module-level cache
    const overlayId = overlay.id
    const cached = profileCache.get(overlayId)
    const profile = cached?.profile
    if (profile == null) return []

    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const decimalFold = chart.getDecimalFold()
    const thousandsSeparator = chart.getThousandsSeparator()

    const figures: OverlayFigure[] = []

    // Profile high label
    const highY = yAxis.convertToPixel(profile.profileHigh)
    const highText = decimalFold.format(thousandsSeparator.format(profile.profileHigh.toFixed(precision)))
    figures.push({
      key: 'vpfr_yaxis_high',
      type: 'text',
      attrs: {
        x: 0,
        y: highY,
        text: highText,
        align: 'left',
        baseline: 'middle'
      },
      styles: {
        style: 'fill',
        color: VPFR_AXIS_LABEL_TEXT_COLOR,
        size: 11,
        family: 'Helvetica Neue',
        weight: 500,
        paddingLeft: 4,
        paddingTop: 2,
        paddingRight: 4,
        paddingBottom: 2,
        backgroundColor: VPFR_AXIS_LABEL_BG,
        borderRadius: 2
      },
      ignoreEvent: true
    })

    // Profile low label
    const lowY = yAxis.convertToPixel(profile.profileLow)
    const lowText = decimalFold.format(thousandsSeparator.format(profile.profileLow.toFixed(precision)))
    figures.push({
      key: 'vpfr_yaxis_low',
      type: 'text',
      attrs: {
        x: 0,
        y: lowY,
        text: lowText,
        align: 'left',
        baseline: 'middle'
      },
      styles: {
        style: 'fill',
        color: VPFR_AXIS_LABEL_TEXT_COLOR,
        size: 11,
        family: 'Helvetica Neue',
        weight: 500,
        paddingLeft: 4,
        paddingTop: 2,
        paddingRight: 4,
        paddingBottom: 2,
        backgroundColor: VPFR_AXIS_LABEL_BG,
        borderRadius: 2
      },
      ignoreEvent: true
    })

    return figures
  },

  createXAxisFigures: ({ chart, overlay, coordinates }) => {
    if (coordinates.length < 2) return []

    // Only show axis labels when selected
    const clickOverlayInfo = (chart as unknown as ChartInternal).getChartStore().getClickOverlayInfo()
    const isSelected = clickOverlayInfo.overlay?.id === overlay.id
    if (!isSelected) return []

    const points = overlay.points
    if (points.length < 2) return []

    const figures: OverlayFigure[] = []

    // Format timestamps as date labels
    const formatDate = (timestamp: number): string => {
      const d = new Date(timestamp)
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${month}/${day}`
    }

    // CP1 date label
    if (points[0].timestamp != null) {
      figures.push({
        key: 'vpfr_xaxis_cp1',
        type: 'text',
        attrs: {
          x: coordinates[0].x,
          y: 0,
          text: formatDate(points[0].timestamp),
          align: 'center',
          baseline: 'top'
        },
        styles: {
          style: 'fill',
          color: VPFR_AXIS_LABEL_TEXT_COLOR,
          size: 11,
          family: 'Helvetica Neue',
          weight: 500,
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          backgroundColor: VPFR_AXIS_LABEL_BG,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // CP2 date label
    if (points[1].timestamp != null) {
      figures.push({
        key: 'vpfr_xaxis_cp2',
        type: 'text',
        attrs: {
          x: coordinates[1].x,
          y: 0,
          text: formatDate(points[1].timestamp),
          align: 'center',
          baseline: 'top'
        },
        styles: {
          style: 'fill',
          color: VPFR_AXIS_LABEL_TEXT_COLOR,
          size: 11,
          family: 'Helvetica Neue',
          weight: 500,
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          backgroundColor: VPFR_AXIS_LABEL_BG,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    return figures
  },

  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    // CP drag only changes time (dataIndex/timestamp), NOT price.
    // Framework already sets points[performPointIndex].value from cursor Y position.
    // We allow this — createPointFigures always recomputes price from candle data.
    // We just ensure the time position is updated.
    if (performPointIndex >= 0 && performPointIndex < points.length) {
      points[performPointIndex].dataIndex = performPoint.dataIndex
      points[performPointIndex].timestamp = performPoint.timestamp
      // Keep value so KLineChart's coordinate conversion works for the
      // framework, but our rendering ignores it.
      points[performPointIndex].value = performPoint.value
    }
  }
}

export default vpfr
