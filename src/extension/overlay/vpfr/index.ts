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

import type { VPFRExtendData, VPFRProfile } from './types'
import { VPFR_DEFAULT_EXTEND_DATA, VPFR_AXIS_LABEL_BG, VPFR_AXIS_LABEL_TEXT_COLOR } from './constants'
import { computeVPFRProfile } from './compute'
import { renderVPFRFigures } from './render'

// Internal helper to access ChartStore from Chart interface.
// ChartImp.getChartStore() is always available but not on the public interface
// to avoid leaking the ChartStore class into the .d.ts output.
interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
    getStyles: () => { yAxis: { tickText: { color: string } } }
  }
}

function isLightColor (hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (m === null) return false
  return (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000 > 128
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

  createPointFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const figures: OverlayFigure[] = []

    if (coordinates.length === 0) return figures

    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== -1

    // Drawing preview — show vertical dashed lines + range highlight
    if (isDrawing) {
      const topEdge = 0
      const bottomEdge = bounding.height
      const dashStyle = {
        style: 'dashed' as const,
        color: '#2196F3',
        size: 1,
        dashedValue: [4, 4]
      }

      // Vertical dashed line at first click position
      figures.push({
        key: 'vpfr_preview_v1',
        type: 'line',
        attrs: {
          coordinates: [
            { x: coordinates[0].x, y: topEdge },
            { x: coordinates[0].x, y: bottomEdge }
          ]
        },
        styles: dashStyle,
        ignoreEvent: true
      })

      if (coordinates.length >= 2) {
        // Vertical dashed line at cursor position
        figures.push({
          key: 'vpfr_preview_v2',
          type: 'line',
          attrs: {
            coordinates: [
              { x: coordinates[1].x, y: topEdge },
              { x: coordinates[1].x, y: bottomEdge }
            ]
          },
          styles: dashStyle,
          ignoreEvent: true
        })

        // Range highlight fill between the two vertical lines
        const xLeft = Math.min(coordinates[0].x, coordinates[1].x)
        const xRight = Math.max(coordinates[0].x, coordinates[1].x)
        figures.push({
          key: 'vpfr_preview_fill',
          type: 'rect',
          attrs: { x: xLeft, y: topEdge, width: Math.max(1, xRight - xLeft), height: bottomEdge },
          styles: { style: 'fill', color: 'rgba(33, 150, 243, 0.08)' },
          ignoreEvent: true
        })
      }

      return figures
    }

    // Overlay is complete — render full histogram
    const points = overlay.points
    if (points.length < 2) {
      return figures
    }

    const dataList = chart.getDataList()
    if (dataList.length === 0) return figures

    const lastIndex = dataList.length - 1

    // Resolve bar indices from timestamps (dataIndex is NOT stable across reload)
    const ts0 = points[0].timestamp
    const ts1 = points[1].timestamp
    let idx0 = points[0].dataIndex ?? 0
    let idx1 = points[1].dataIndex ?? 0

    // Find correct dataIndex by matching timestamp in dataList
    if (ts0 != null) {
      const found = dataList.findIndex(d => d.timestamp === ts0)
      if (found >= 0) idx0 = found
    }
    if (ts1 != null) {
      const found = dataList.findIndex(d => d.timestamp === ts1)
      if (found >= 0) idx1 = found
    }

    // Clamp to valid range
    idx0 = Math.max(0, Math.min(idx0, lastIndex))
    idx1 = Math.max(0, Math.min(idx1, lastIndex))

    // Sync back so coordinates render correctly
    points[0].dataIndex = idx0
    points[1].dataIndex = idx1

    const extendData = overlay.extendData
    const settings: VPFRExtendData = {
      ...VPFR_DEFAULT_EXTEND_DATA,
      ...extendData
    }

    // Normalize indices — handle CP1 dragged past CP2
    const fromIdx = Math.min(idx0, idx1)
    const toIdx = Math.max(idx0, idx1)

    // Build cache key from all computation parameters
    const overlayId = overlay.id
    const rangeKey = `${fromIdx}-${toIdx}-${settings.rowSize}-${settings.valueAreaPercent}-${settings.volumeType}-${dataList.length}`

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

    // Determine selection, hover, and theme state
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const tickTextColor = String(chartStore.getStyles().yAxis.tickText.color)
    const isDarkTheme = isLightColor(tickTextColor)

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
      isHovered,
      isDarkTheme,
      cp1,
      cp2
    })
  },

  createYAxisFigures: ({ chart, overlay, coordinates, yAxis }) => {
    if (coordinates.length === 0 || yAxis == null) return []

    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== -1
    const points = overlay.points

    // During drawing — show Y-axis label at first click price
    if (isDrawing && points.length >= 1 && points[0].value != null) {
      const precision = chart.getSymbol()?.pricePrecision ?? 2
      const decimalFold = chart.getDecimalFold()
      const thousandsSeparator = chart.getThousandsSeparator()
      const priceText = decimalFold.format(thousandsSeparator.format(points[0].value.toFixed(precision)))
      const pY = yAxis.convertToPixel(points[0].value)
      return [{
        key: 'vpfr_yaxis_drawing',
        type: 'text',
        attrs: { x: 0, y: pY, text: priceText, align: 'left', baseline: 'middle' },
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
      }]
    }

    if (points.length < 2 || points[0].dataIndex == null || points[1].dataIndex == null) return []

    // Get profile data from module-level cache
    const overlayId = overlay.id
    const cached = profileCache.get(overlayId)
    const profile = cached?.profile
    if (profile == null) return []

    const extendData = overlay.extendData
    const settings: VPFRExtendData = { ...VPFR_DEFAULT_EXTEND_DATA, ...extendData }

    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const decimalFold = chart.getDecimalFold()
    const thousandsSeparator = chart.getThousandsSeparator()

    const figures: OverlayFigure[] = []

    // POC price label — ALWAYS shown (red, like TradingView)
    if (settings.showPOC && profile.pocIndex < profile.rows.length) {
      const pocPrice = profile.rows[profile.pocIndex].mid
      const pocY = yAxis.convertToPixel(pocPrice)
      const pocText = decimalFold.format(thousandsSeparator.format(pocPrice.toFixed(precision)))
      figures.push({
        key: 'vpfr_yaxis_poc',
        type: 'text',
        attrs: {
          x: 0,
          y: pocY,
          text: pocText,
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
          backgroundColor: settings.pocColor,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // Selected-only: Y-axis bg fill + high/low price labels (blue)
    const clickOverlayInfo = (chart as unknown as ChartInternal).getChartStore().getClickOverlayInfo()
    const isSelected = clickOverlayInfo.overlay?.id === overlay.id
    if (isSelected) {
      const highY = yAxis.convertToPixel(profile.profileHigh)
      const lowY = yAxis.convertToPixel(profile.profileLow)
      const yAxisMinY = Math.min(highY, lowY)
      const yAxisHeight = Math.abs(lowY - highY)

      // Blue bg fill from high to low on Y-axis
      figures.push({
        key: 'vpfr_yaxis_fill',
        type: 'rect',
        attrs: {
          x: 0,
          y: yAxisMinY,
          width: 100,
          height: Math.max(1, yAxisHeight)
        },
        styles: {
          style: 'fill',
          color: 'rgba(33, 150, 243, 0.15)'
        },
        ignoreEvent: true
      })
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
    }

    return figures
  },

  createXAxisFigures: ({ chart, overlay, coordinates }) => {
    if (coordinates.length === 0) return []

    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== -1
    const points = overlay.points

    // Format timestamps as date labels
    const formatDate = (timestamp: number): string => {
      const d = new Date(timestamp)
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${month}/${day}`
    }

    // During drawing — show X-axis label at first click date (+ cursor date if available)
    if (isDrawing && points.length >= 1 && points[0].timestamp != null) {
      const drawingFigures: OverlayFigure[] = []
      drawingFigures.push({
        key: 'vpfr_xaxis_drawing_cp1',
        type: 'text',
        attrs: { x: coordinates[0].x, y: 0, text: formatDate(points[0].timestamp), align: 'center', baseline: 'top' },
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
      if (coordinates.length >= 2 && points.length >= 2 && points[1].timestamp != null) {
        drawingFigures.push({
          key: 'vpfr_xaxis_drawing_cp2',
          type: 'text',
          attrs: { x: coordinates[1].x, y: 0, text: formatDate(points[1].timestamp), align: 'center', baseline: 'top' },
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
      return drawingFigures
    }

    if (coordinates.length < 2) return []

    // Only show axis labels when selected
    const clickOverlayInfo = (chart as unknown as ChartInternal).getChartStore().getClickOverlayInfo()
    const isSelected = clickOverlayInfo.overlay?.id === overlay.id
    if (!isSelected) return []
    if (points.length < 2) return []

    const figures: OverlayFigure[] = []

    // Blue bg fill between CP1 and CP2 on X-axis
    const xLeft = Math.min(coordinates[0].x, coordinates[1].x)
    const xRight = Math.max(coordinates[0].x, coordinates[1].x)
    figures.push({
      key: 'vpfr_xaxis_fill',
      type: 'rect',
      attrs: {
        x: xLeft,
        y: 0,
        width: Math.max(1, xRight - xLeft),
        height: 30
      },
      styles: {
        style: 'fill',
        color: 'rgba(33, 150, 243, 0.15)'
      },
      ignoreEvent: true
    })

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
    if (performPointIndex >= 0 && performPointIndex < points.length) {
      points[performPointIndex].dataIndex = performPoint.dataIndex
      points[performPointIndex].timestamp = performPoint.timestamp
      points[performPointIndex].value = performPoint.value
    }
  }
}

export default vpfr
