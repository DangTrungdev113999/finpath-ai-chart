/**
 * VerticalSegment — Đoạn thẳng đứng (Vertical Segment)
 *
 * Data points: 2 (P1 and P2, same X, finite vertical span)
 * Features: arrows at ends, text label, control points, stats
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
  buildXAxisPill,
  formatDate
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface VertSegmentExtendData {
  leftEnd?: number
  rightEnd?: number
  showMiddlePoint?: boolean
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

const verticalSegment: OverlayTemplate<Partial<VertSegmentExtendData>> = {
  name: 'verticalSegment',
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

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // Lock both points to same X (P1.x is authoritative)
    const topPt = c1.y <= c2.y ? c1 : c2
    const botPt = c1.y <= c2.y ? c2 : c1

    // ─── 1. Main line ───
    figures.push({
      key: 'vs_line',
      type: 'line',
      attrs: { coordinates: [{ x: c1.x, y: topPt.y }, { x: c1.x, y: botPt.y }] }
    })

    // ─── 2. Arrow endpoints ───
    const leftEnd = ext.leftEnd ?? 0
    const rightEnd = ext.rightEnd ?? 0

    if (leftEnd === 1) {
      const arrowCoords = getArrowCoordinates({ x: c1.x, y: botPt.y }, { x: c1.x, y: topPt.y })
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'vs_arrow_top',
          type: 'polygon',
          attrs: { coordinates: arrowCoords },
          styles: { style: 'fill', color: lineColor },
          ignoreEvent: true
        })
      }
    }

    if (rightEnd === 1) {
      const arrowCoords = getArrowCoordinates({ x: c1.x, y: topPt.y }, { x: c1.x, y: botPt.y })
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'vs_arrow_bot',
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
      const midY = (c1.y + c2.y) / 2
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'
      figures.push({
        key: 'vs_mid',
        type: 'circle',
        attrs: { x: c1.x, y: midY, r: CP_RADIUS + CP_CIRCLE_BORDER },
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
        key: 'vs_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'vs_cp1',
        type: 'circle',
        attrs: { x: c1.x, y: c2.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 6. Text label (rotated along vertical) ───
    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const hAlign = ext.horzLabelsAlign ?? 'center'
      const vAlign = ext.vertLabelsAlign ?? 'top'

      const spanH = Math.abs(c2.y - c1.y)
      const topY = Math.min(c1.y, c2.y)
      let ty = topY + spanH * 0.5
      if (hAlign === 'left') ty = topY + spanH * 0.15
      else if (hAlign === 'right') ty = topY + spanH * 0.85

      const lineWidth = overlayStyles?.line?.size ?? 2
      const gap = 5
      let offsetX = 0
      let baseline: CanvasTextBaseline = 'middle'
      if (vAlign === 'top') {
        offsetX = lineWidth / 2 + gap + fontSize
        baseline = 'bottom'
      } else if (vAlign === 'bottom') {
        offsetX = -(lineWidth / 2 + gap + fontSize)
        baseline = 'top'
      }

      figures.push({
        key: 'vs_label',
        type: 'text',
        attrs: {
          x: c1.x + offsetX,
          y: ty,
          text: ext.text,
          align: 'center' as CanvasTextAlign,
          baseline,
          rotation: -Math.PI / 2
        },
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

    // ─── 7. Stats ───
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
        statLines.push(`Dist: ${formatNum(Math.abs(c2.y - c1.y), 1)}px`)
      }

      if (statLines.length > 0) {
        const statsPos = ext.statsPosition ?? 2
        const midY = (c1.y + c2.y) / 2
        let sx = c1.x + 8
        let sy = midY
        let sAlign: CanvasTextAlign = 'left'

        if (statsPos === 0) { sx = c1.x - 8; sAlign = 'right' } else if (statsPos === 1) { sy = Math.min(c1.y, c2.y) - 8 } else if (statsPos === 3) { sy = Math.max(c1.y, c2.y) + 8 }

        figures.push({
          key: 'vs_stats',
          type: 'text',
          attrs: { x: sx, y: sy, text: statLines.join('  '), align: sAlign, baseline: 'middle' as CanvasTextBaseline },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }
    }

    return figures
  },

  createXAxisFigures: ({ overlay, coordinates }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const figures: OverlayFigure[] = []
    const d0 = formatDate(overlay.points[0]?.timestamp)
    if (d0 !== '') figures.push(buildXAxisPill(coordinates[0].x, d0, lineColor, 'vs_x0'))
    if (coordinates.length >= 2) {
      const d1 = formatDate(overlay.points[1]?.timestamp)
      if (d1 !== '') figures.push(buildXAxisPill(coordinates[1].x, d1, lineColor, 'vs_x1'))
    }
    return figures
  },

  performEventPressedMove: ({ points, prevPoints, figureKey, performPoint }) => {
    if (figureKey === 'vs_mid' && prevPoints.length >= 2) {
      if (prevPoints[0].dataIndex != null && prevPoints[1].dataIndex != null) {
        const midOrigIndex = Math.round((prevPoints[0].dataIndex + prevPoints[1].dataIndex) / 2)
        const newIndex = points[0].dataIndex ?? midOrigIndex
        const delta = newIndex - midOrigIndex
        points[0] = { ...prevPoints[0], dataIndex: prevPoints[0].dataIndex + delta, timestamp: undefined }
        points[1] = { ...prevPoints[1], dataIndex: prevPoints[1].dataIndex + delta, timestamp: undefined }
      }
    } else {
      points[0].timestamp = performPoint.timestamp
      points[0].dataIndex = performPoint.dataIndex
      points[1].timestamp = performPoint.timestamp
      points[1].dataIndex = performPoint.dataIndex
    }
  },

  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      points[0].timestamp = performPoint.timestamp
      points[0].dataIndex = performPoint.dataIndex
    }
  }
}

export default verticalSegment
