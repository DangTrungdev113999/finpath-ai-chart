/**
 * VerticalRayLine — Tia thẳng đứng (Vertical Ray)
 *
 * Data points: 2 (P1 = anchor, P2 = direction up/down; same X)
 * Geometry: extends from P1 toward P2 to bounding edge
 * Features: arrow at tip, text label, control points
 */

import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'

import type { ChartInternal } from './lineCommon'
import {
  CP_COLOR,
  CP_RADIUS,
  CP_CIRCLE_BORDER,
  isLightColor,
  getArrowCoordinates,
  formatNum
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface VertRayLineExtendData {
  rightEnd?: number
  showLabel?: boolean
  text?: string
  textcolor?: string
  fontsize?: number
  bold?: boolean
  italic?: boolean
  horzLabelsAlign?: string
  vertLabelsAlign?: string
  showBarsRange?: boolean
  alwaysShowStats?: boolean
  statsPosition?: number
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const verticalRayLine: OverlayTemplate<Partial<VertRayLineExtendData>> = {
  name: 'verticalRayLine',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const [c1, c2] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined
    const ext = overlay.extendData ?? {}

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // ─── 1. Compute ray tip (vertical: same X, extends up or down) ───
    const tipY = c1.y < c2.y ? bounding.height : 0
    const rayTip = { x: c1.x, y: tipY }

    // ─── 2. Main line ───
    figures.push({
      key: 'vrl_line',
      type: 'line',
      attrs: { coordinates: [c1, rayTip] }
    })

    // ─── 3. Arrow at tip ───
    const rightEnd = ext.rightEnd ?? 1
    if (rightEnd === 1) {
      const arrowCoords = getArrowCoordinates(c1, rayTip)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'vrl_arrow',
          type: 'polygon',
          attrs: { coordinates: arrowCoords },
          styles: { style: 'fill', color: lineColor },
          ignoreEvent: true
        })
      }
    }

    // ─── 4. Selection state ───
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isActive = isSelected || isHovered

    // ─── 5. Control points ───
    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'vrl_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'vrl_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
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

      const rayLen = Math.abs(rayTip.y - c1.y)
      const topY = Math.min(c1.y, rayTip.y)
      let ty = topY + rayLen * 0.5
      if (hAlign === 'left') ty = topY + rayLen * 0.15
      else if (hAlign === 'right') ty = topY + rayLen * 0.85

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
        key: 'vrl_label',
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
    if (showStats && ext.showBarsRange === true) {
      const statsText = `${formatNum(Math.abs(rayTip.y - c1.y), 0)}px`
      const statsPos = ext.statsPosition ?? 2
      let sx = c1.x + 8
      const sy = (c1.y + rayTip.y) / 2
      let sAlign: CanvasTextAlign = 'left'

      if (statsPos === 0) { sx = c1.x - 8; sAlign = 'right' }

      figures.push({
        key: 'vrl_stats',
        type: 'text',
        attrs: { x: sx, y: sy, text: statsText, align: sAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
        ignoreEvent: true
      })
    }

    return figures
  },

  performEventPressedMove: ({ points, performPoint }) => {
    points[0].timestamp = performPoint.timestamp
    points[0].dataIndex = performPoint.dataIndex
    points[1].timestamp = performPoint.timestamp
    points[1].dataIndex = performPoint.dataIndex
  },

  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      points[0].timestamp = performPoint.timestamp
      points[0].dataIndex = performPoint.dataIndex
    }
  }
}

export default verticalRayLine
