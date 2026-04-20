/**
 * PriceLine overlay — Đường Giá (Price Line)
 *
 * Data points: 1 (sets Y level; line extends from P1.x to right edge)
 * Features: pill price label at anchor, optional text label, control point
 */

import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'

import type { ChartInternal } from './lineCommon'
import {
  CP_COLOR,
  CP_RADIUS,
  CP_CIRCLE_BORDER,
  isLightColor,
  formatNum
} from './lineCommon'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface PriceLineExtendData {
  showPrice?: boolean
  showLabel?: boolean
  text?: string
  textcolor?: string
  fontsize?: number
  bold?: boolean
  italic?: boolean
  horzLabelsAlign?: string
  vertLabelsAlign?: string
}

// ═══════════════════════════════════════
// PILL CONSTANTS
// ═══════════════════════════════════════

const PILL_PAD_H = 8
const PILL_PAD_V = 4
const PILL_RADIUS = 2

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const priceLine: OverlayTemplate<Partial<PriceLineExtendData>> = {
  name: 'priceLine',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: true,

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

    // ─── 1. Horizontal line from anchor to right edge ───
    figures.push({
      key: 'pl_line',
      type: 'line',
      attrs: { coordinates: [c1, { x: bounding.width, y: c1.y }] }
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
        key: 'pl_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
    }

    // ─── 4. Pill price label ───
    const showPrice = ext.showPrice !== false
    if (showPrice && points.length >= 1) {
      const priceValue = points[0].value
      if (priceValue != null) {
        const priceText = formatNum(priceValue, pricePrecision)
        const textSize = 12
        const charW = textSize * 0.6
        const pillW = priceText.length * charW + PILL_PAD_H * 2
        const pillH = textSize + PILL_PAD_V * 2

        const pillX = c1.x - pillW
        const pillY = c1.y - pillH / 2

        figures.push({
          key: 'pl_pill_bg',
          type: 'rect',
          attrs: { x: pillX, y: pillY, width: pillW, height: pillH },
          styles: { style: 'stroke_fill', color: lineColor, borderColor: lineColor, borderSize: 1, borderRadius: PILL_RADIUS },
          ignoreEvent: true
        })

        figures.push({
          key: 'pl_pill_text',
          type: 'text',
          attrs: {
            x: pillX + pillW / 2,
            y: c1.y,
            text: priceText,
            align: 'center' as CanvasTextAlign,
            baseline: 'middle' as CanvasTextBaseline
          },
          styles: { color: '#ffffff', size: textSize, weight: 'normal', backgroundColor: 'transparent' },
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

      const lineWidth = overlayStyles?.line?.size ?? 1
      const halfWidth = (bounding.width - c1.x) / 2
      let tx = c1.x + halfWidth
      if (hAlign === 'left') tx = c1.x + halfWidth * 0.15
      else if (hAlign === 'right') tx = c1.x + halfWidth * 0.85

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
        key: 'pl_label',
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

    return figures
  }
}

export default priceLine
