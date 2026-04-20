/**
 * HorizontalRayLine — Tia nằm ngang (Horizontal Ray)
 *
 * Data points: 2 (P1 = anchor, P2 = direction; both locked to same Y)
 * Geometry: extends from P1 toward P2 to bounding edge
 * Features: arrow at tip, price label, text label, control points, stats
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
  formatDate
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface HorizRayLineExtendData {
  rightEnd?: number
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

const horizontalRayLine: OverlayTemplate<Partial<HorizRayLineExtendData>> = {
  name: 'horizontalRayLine',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const [c1, c2] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined
    const ext = overlay.extendData ?? {}
    const points = overlay.points
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // ─── 1. Compute ray tip (horizontal: same Y as anchor) ───
    const tipX = c1.x < c2.x ? bounding.width : 0
    const rayTip = { x: tipX, y: c1.y }

    // ─── 2. Main line ───
    figures.push({
      key: 'hrl_line',
      type: 'line',
      attrs: { coordinates: [c1, rayTip] }
    })

    // ─── 3. Arrow at tip ───
    const rightEnd = ext.rightEnd ?? 1
    if (rightEnd === 1) {
      const arrowCoords = getArrowCoordinates(c1, rayTip)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'hrl_arrow',
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
        key: 'hrl_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'hrl_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 6. Price label at anchor ───
    if (ext.showPriceLabels === true && points.length >= 1) {
      const p1Value = points[0].value
      if (p1Value != null) {
        figures.push({
          key: 'hrl_price0',
          type: 'text',
          attrs: {
            x: c1.x,
            y: c1.y - 6,
            text: formatNum(p1Value, pricePrecision),
            align: 'center' as CanvasTextAlign,
            baseline: 'bottom' as CanvasTextBaseline
          },
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

      const midX = (c1.x + rayTip.x) / 2
      let tx = midX
      if (hAlign === 'left') tx = c1.x + Math.abs(rayTip.x - c1.x) * 0.15
      else if (hAlign === 'right') tx = c1.x + Math.abs(rayTip.x - c1.x) * 0.85

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
        key: 'hrl_label',
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
        statLines.push(`Dist: ${formatNum(Math.abs(rayTip.x - c1.x), 1)}px`)
      }

      if (statLines.length > 0) {
        const statsPos = ext.statsPosition ?? 2
        const midX = (c1.x + rayTip.x) / 2
        let sx = Math.max(c1.x, rayTip.x) + 8
        let sy = c1.y - 12
        let sAlign: CanvasTextAlign = 'left'
        let sBaseline: CanvasTextBaseline = 'bottom'

        switch (statsPos) {
          case 0: sx = Math.min(c1.x, rayTip.x) - 8; sAlign = 'right'; break
          case 1: sx = midX; sAlign = 'center'; break
          case 3: sy = c1.y + 12; sBaseline = 'top'; break
          default: break
        }

        figures.push({
          key: 'hrl_stats',
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
    const pill = buildYAxisPill(coordinates[0].y, value, lineColor, precision, bounding, yAxis ?? undefined, 'hrl_y0')
    return pill != null ? [pill] : []
  },

  createXAxisFigures: ({ overlay, coordinates }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const d0 = formatDate(overlay.points[0]?.timestamp)
    if (d0 === '') return []
    return [buildXAxisPill(coordinates[0].x, d0, lineColor, 'hrl_x0')]
  },

  performEventPressedMove: ({ points, performPoint }) => {
    points[0].value = performPoint.value
    points[1].value = performPoint.value
  },

  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      points[0].value = performPoint.value
    }
  }
}

export default horizontalRayLine
