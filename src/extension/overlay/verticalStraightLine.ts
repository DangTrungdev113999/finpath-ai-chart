/**
 * VerticalStraightLine — Đường thẳng đứng (Vertical Line)
 *
 * Data points: 1 (sets X position; line extends full height)
 * Features: date label, text label, control point
 */

import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'

import type { ChartInternal } from './lineCommon'
import {
  CP_COLOR,
  CP_RADIUS,
  CP_CIRCLE_BORDER,
  isLightColor,
  formatNum,
  buildXAxisPill,
  formatDate
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface VertStraightLineExtendData {
  showLabel?: boolean
  text?: string
  textcolor?: string
  fontsize?: number
  bold?: boolean
  italic?: boolean
  horzLabelsAlign?: string
  vertLabelsAlign?: string
  alwaysShowStats?: boolean
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const verticalStraightLine: OverlayTemplate<Partial<VertStraightLineExtendData>> = {
  name: 'verticalStraightLine',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 1) return []

    const [c1] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined
    const ext = overlay.extendData ?? {}

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // ─── 1. Vertical line (full height) ───
    figures.push({
      key: 'vsl_line',
      type: 'line',
      attrs: { coordinates: [{ x: c1.x, y: 0 }, { x: c1.x, y: bounding.height }] }
    })

    // ─── 2. Selection state ───
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isActive = isSelected || isHovered

    // ─── 3. Control point ───
    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'vsl_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
    }

    // ─── 4. Text label (rotated 90° along vertical line) ───
    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const vAlign = ext.vertLabelsAlign ?? 'top'
      const hAlign = ext.horzLabelsAlign ?? 'center'

      let ty = bounding.height / 2
      if (hAlign === 'left') ty = bounding.height * 0.15
      else if (hAlign === 'right') ty = bounding.height * 0.85

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
        key: 'vsl_label',
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

    // ─── 5. Stats (distance from visible left edge) ───
    const showStats = ext.alwaysShowStats === true || isActive
    if (showStats) {
      figures.push({
        key: 'vsl_stats',
        type: 'text',
        attrs: {
          x: c1.x + 6,
          y: 12,
          text: `X: ${formatNum(c1.x, 0)}px`,
          align: 'left' as CanvasTextAlign,
          baseline: 'top' as CanvasTextBaseline
        },
        styles: { color: lineColor, size: 10, weight: 'normal', backgroundColor: 'transparent' },
        ignoreEvent: true
      })
    }

    return figures
  },

  createXAxisFigures: ({ overlay, coordinates }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const d0 = formatDate(overlay.points[0]?.timestamp)
    if (d0 === '') return []
    return [buildXAxisPill(coordinates[0].x, d0, lineColor, 'vsl_x0')]
  }
}

export default verticalStraightLine
