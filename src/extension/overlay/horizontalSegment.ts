/**
 * HorizontalSegment — Đoạn nằm ngang (Horizontal Segment)
 *
 * Data points: 2 (both locked to same Y, defines finite horizontal span)
 * Features: arrows at ends, price label, text label, control points, stats
 */

import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'

import type { ChartInternal } from './lineCommon'
import {
  CP_COLOR,
  CP_RADIUS,
  CP_CIRCLE_BORDER,
  isLightColor,
  getArrowCoordinates,
  formatNum,
  buildYAxisPill,
  buildXAxisPill,
  formatDate,
  alphaColor
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface HorizSegmentExtendData {
  leftEnd?: number
  rightEnd?: number
  showMiddlePoint?: boolean
  showPriceLabels?: boolean
  showLabel?: boolean
  text?: string
  textcolor?: string
  fontsize?: number
  bold?: boolean
  italic?: boolean
  horzLabelsAlign?: string
  vertLabelsAlign?: string
  showBarsRange?: boolean
  showDistance?: boolean
  alwaysShowStats?: boolean
  statsPosition?: number
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const horizontalSegment: OverlayTemplate<Partial<HorizSegmentExtendData>> = {
  name: 'horizontalSegment',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    if (coordinates.length < 2) return []

    const [c1, c2] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined
    const ext = overlay.extendData ?? {}
    const points = overlay.points
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // Lock both endpoints to same Y (P1.y is authoritative)
    const lineStart = { x: c1.x, y: c1.y }
    const lineEnd = { x: c2.x, y: c1.y }

    // ─── 1. Main line ───
    figures.push({
      key: 'hs_line',
      type: 'line',
      attrs: { coordinates: [lineStart, lineEnd] }
    })

    // ─── 2. Arrow endpoints ───
    const leftEnd = ext.leftEnd ?? 0
    const rightEnd = ext.rightEnd ?? 0

    const [leftPt, rightPt] = lineStart.x <= lineEnd.x
      ? [lineStart, lineEnd]
      : [lineEnd, lineStart]

    if (leftEnd === 1) {
      const arrowCoords = getArrowCoordinates(rightPt, leftPt)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'hs_arrow_left',
          type: 'polygon',
          attrs: { coordinates: arrowCoords },
          styles: { style: 'fill', color: lineColor },
          ignoreEvent: true
        })
      }
    }

    if (rightEnd === 1) {
      const arrowCoords = getArrowCoordinates(leftPt, rightPt)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'hs_arrow_right',
          type: 'polygon',
          attrs: { coordinates: arrowCoords },
          styles: { style: 'fill', color: lineColor },
          ignoreEvent: true
        })
      }
    }

    // ─── 3. Selection state ───
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isActive = isSelected || isHovered

    // ─── 4. Middle point ───
    if (ext.showMiddlePoint === true && isActive) {
      const midX = (c1.x + c2.x) / 2
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'
      figures.push({
        key: 'hs_mid',
        type: 'circle',
        attrs: { x: midX, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'move'
      })
    }

    // ─── 5. Control points ───
    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'hs_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'hs_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 6. Price labels ───
    if (ext.showPriceLabels === true && points.length >= 1) {
      const p1Value = points[0].value
      if (p1Value != null) {
        figures.push({
          key: 'hs_price0',
          type: 'text',
          attrs: { x: c1.x, y: c1.y - 6, text: formatNum(p1Value, pricePrecision), align: 'center' as CanvasTextAlign, baseline: 'bottom' as CanvasTextBaseline },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
        figures.push({
          key: 'hs_price1',
          type: 'text',
          attrs: { x: c2.x, y: c1.y - 6, text: formatNum(p1Value, pricePrecision), align: 'center' as CanvasTextAlign, baseline: 'bottom' as CanvasTextBaseline },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }
    }

    // ─── 7. Text label ───
    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const hAlign = ext.horzLabelsAlign ?? 'center'
      const vAlign = ext.vertLabelsAlign ?? 'top'

      const totalWidth = Math.abs(c2.x - c1.x)
      const leftX = Math.min(c1.x, c2.x)
      let tx = leftX + totalWidth * 0.5
      if (hAlign === 'left') tx = leftX + totalWidth * 0.15
      else if (hAlign === 'right') tx = leftX + totalWidth * 0.85

      const lineWidth = overlayStyles?.line?.size ?? 2
      const gap = 5
      let offsetY = 0
      let baseline: CanvasTextBaseline = 'middle'
      if (vAlign === 'top') {
        offsetY = -(lineWidth / 2 + gap + fontSize)
        baseline = 'bottom'
      } else if (vAlign === 'bottom') {
        offsetY = lineWidth / 2 + gap + fontSize
        baseline = 'top'
      }

      figures.push({
        key: 'hs_label',
        type: 'text',
        attrs: { x: tx, y: c1.y + offsetY, text: ext.text, align: 'center' as CanvasTextAlign, baseline },
        styles: {
          color: textColor,
          size: fontSize,
          weight: ext.bold === true ? 'bold' : 'normal',
          style: ext.italic === true ? 'italic' : 'normal',
          backgroundColor: 'transparent'
        },
        ignoreEvent: true
      })
    }

    // ─── 8. Stats ───
    const showStats = ext.alwaysShowStats === true || isActive
    const hasAnyStats = ext.showBarsRange === true || ext.showDistance === true

    if (showStats && hasAnyStats && points.length >= 2) {
      const p1Index = points[0].dataIndex
      const p2Index = points[1].dataIndex
      const statLines: string[] = []

      if (ext.showBarsRange === true && p1Index != null && p2Index != null) {
        statLines.push(`${Math.abs(p2Index - p1Index)} bars`)
      }
      if (ext.showDistance === true) {
        statLines.push(`Dist: ${formatNum(Math.abs(c2.x - c1.x), 1)}px`)
      }

      if (statLines.length > 0) {
        const statsPos = ext.statsPosition ?? 2
        const midX = (c1.x + c2.x) / 2
        let sx = Math.max(c1.x, c2.x) + 8
        let sy = c1.y - 12
        let sAlign: CanvasTextAlign = 'left'
        let sBaseline: CanvasTextBaseline = 'bottom'

        switch (statsPos) {
          case 0: sx = Math.min(c1.x, c2.x) - 8; sAlign = 'right'; break
          case 1: sx = midX; sAlign = 'center'; break
          case 3: sy = c1.y + 12; sBaseline = 'top'; break
          default: break
        }

        figures.push({
          key: 'hs_stats',
          type: 'text',
          attrs: { x: sx, y: sy, text: statLines.join('  '), align: sAlign, baseline: sBaseline },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }
    }

    return figures
  },

  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const value = overlay.points[0]?.value
    const pill = buildYAxisPill(coordinates[0].y, value, lineColor, precision, bounding, yAxis ?? undefined, 'hs_y0')
    return pill != null ? [pill] : []
  },

  createXAxisFigures: ({ overlay, coordinates, bounding }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const figures: OverlayFigure[] = []
    // Strip between the two anchor X positions
    if (coordinates.length >= 2) {
      const stripLeft = Math.min(coordinates[0].x, coordinates[1].x)
      const stripW = Math.abs(coordinates[1].x - coordinates[0].x)
      if (stripW > 0) {
        figures.push({
          key: 'hs_xstrip',
          type: 'rect',
          attrs: { x: stripLeft, y: 0, width: stripW, height: bounding.height },
          styles: { style: 'fill', color: alphaColor('#2962ff', 0.1) },
          ignoreEvent: true
        })
      }
    }
    const d0 = formatDate(overlay.points[0]?.timestamp)
    if (d0 !== '') figures.push(buildXAxisPill(coordinates[0].x, d0, lineColor, 'hs_x0'))
    if (coordinates.length >= 2) {
      const d1 = formatDate(overlay.points[1]?.timestamp)
      if (d1 !== '') figures.push(buildXAxisPill(coordinates[1].x, d1, lineColor, 'hs_x1'))
    }
    return figures
  },

  performEventPressedMove: ({ points, prevPoints, figureKey, performPoint }) => {
    if (figureKey === 'hs_mid' && prevPoints.length >= 2) {
      if (prevPoints[0].dataIndex != null && prevPoints[1].dataIndex != null) {
        const midOrigIndex = Math.round((prevPoints[0].dataIndex + prevPoints[1].dataIndex) / 2)
        const newIndex = points[0].dataIndex ?? midOrigIndex
        const delta = newIndex - midOrigIndex
        points[0] = { ...prevPoints[0], dataIndex: prevPoints[0].dataIndex + delta, timestamp: undefined }
        points[1] = { ...prevPoints[1], dataIndex: prevPoints[1].dataIndex + delta, timestamp: undefined }
      }
    } else {
      points[0].value = performPoint.value
      points[1].value = performPoint.value
    }
  },

  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      points[0].value = performPoint.value
    }
  }
}

export default horizontalSegment
