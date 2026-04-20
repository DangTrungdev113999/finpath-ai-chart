/**
 * HorizontalStraightLine — Đường nằm ngang (Horizontal Line)
 *
 * Data points: 1 (sets Y level; line extends full width)
 * Features: price label, text label, control point, stats
 */

import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'

import type { ChartInternal } from './lineCommon'
import {
  CP_COLOR,
  CP_RADIUS,
  CP_CIRCLE_BORDER,
  isLightColor,
  formatNum,
  buildYAxisPill
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface HorizStraightLineExtendData {
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

const horizontalStraightLine: OverlayTemplate<Partial<HorizStraightLineExtendData>> = {
  name: 'horizontalStraightLine',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 1) return []

    const [c1] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined
    const ext = overlay.extendData ?? {}
    const points = overlay.points
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const figures: OverlayFigure[] = []

    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    // ─── 1. Horizontal line (full width) ───
    figures.push({
      key: 'hsl_line',
      type: 'line',
      attrs: { coordinates: [{ x: 0, y: c1.y }, { x: bounding.width, y: c1.y }] }
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
        key: 'hsl_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
    }

    // ─── 4. Price label ───
    if (ext.showPriceLabels === true && points.length >= 1) {
      const p1Value = points[0].value
      if (p1Value != null) {
        figures.push({
          key: 'hsl_price0',
          type: 'text',
          attrs: {
            x: c1.x,
            y: c1.y - 6,
            text: formatNum(p1Value, pricePrecision),
            align: 'left' as CanvasTextAlign,
            baseline: 'bottom' as CanvasTextBaseline
          },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }
    }

    // ─── 5. Text label ───
    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const hAlign = ext.horzLabelsAlign ?? 'center'
      const vAlign = ext.vertLabelsAlign ?? 'top'

      let tx = bounding.width / 2
      if (hAlign === 'left') tx = bounding.width * 0.15
      else if (hAlign === 'right') tx = bounding.width * 0.85

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
        key: 'hsl_label',
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

    // ─── 6. Stats ───
    const showStats = ext.alwaysShowStats === true || isActive
    if (showStats && ext.showDistance === true) {
      const statsPos = ext.statsPosition ?? 2
      let sx = bounding.width * 0.75
      let sy = c1.y - 12
      let sAlign: CanvasTextAlign = 'center'
      let sBaseline: CanvasTextBaseline = 'bottom'

      if (statsPos === 0) { sx = 4; sAlign = 'left' } else if (statsPos === 3) { sy = c1.y + 12; sBaseline = 'top' }

      figures.push({
        key: 'hsl_stats',
        type: 'text',
        attrs: { x: sx, y: sy, text: `Dist: ${formatNum(bounding.width, 1)}px`, align: sAlign, baseline: sBaseline },
        styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
        ignoreEvent: true
      })
    }

    return figures
  },

  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    if (coordinates.length < 1) return []
    const lineColor = overlay.styles?.line?.color ?? '#2196F3'
    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const value = overlay.points[0]?.value
    const pill = buildYAxisPill(coordinates[0].y, value, lineColor, precision, bounding, yAxis ?? undefined, 'hsl_y0')
    return pill != null ? [pill] : []
  }
}

export default horizontalStraightLine
