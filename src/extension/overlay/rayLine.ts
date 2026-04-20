/**
 * RayLine overlay — TradingView-style Tia (Ray)
 *
 * Data points: 2 (P1 = anchor, P2 = direction)
 * Geometry: extends from P1 toward P2 to bounding edge
 * Features: arrow at tip, price label, text label, stats, control points
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
import { getLinearYFromCoordinates } from '../figure/line'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface RayLineExtendData {
  // End cap: 0=normal, 1=arrow (right end only for ray)
  leftEnd?: number
  rightEnd?: number
  // Middle point (optional handle at midpoint of visible ray)
  showMiddlePoint?: boolean
  // Price label at anchor
  showPriceLabels?: boolean
  // Text label
  showLabel?: boolean
  text?: string
  textcolor?: string
  fontsize?: number
  bold?: boolean
  italic?: boolean
  horzLabelsAlign?: string
  vertLabelsAlign?: string
  // Stats
  showPriceRange?: boolean
  showPercentPriceRange?: boolean
  showPipsPriceRange?: boolean
  showBarsRange?: boolean
  showDateTimeRange?: boolean
  showDistance?: boolean
  showAngle?: boolean
  alwaysShowStats?: boolean
  statsPosition?: number
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const rayLine: OverlayTemplate<Partial<RayLineExtendData>> = {
  name: 'rayLine',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const [c1, c2] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime for legacy overlays
    const ext = overlay.extendData ?? {}
    const points = overlay.points
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const figures: OverlayFigure[] = []

    // ─── 1. Compute ray tip ───
    const rayTip = c1.x === c2.x && c1.y !== c2.y
      ? { x: c1.x, y: c1.y < c2.y ? bounding.height : 0 }
      : c1.x > c2.x
        ? { x: 0, y: getLinearYFromCoordinates(c1, c2, { x: 0, y: c1.y }) }
        : { x: bounding.width, y: getLinearYFromCoordinates(c1, c2, { x: bounding.width, y: c1.y }) }

    // ─── 2. Main line ───
    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    figures.push({
      key: 'ray_line',
      type: 'line',
      attrs: { coordinates: [c1, rayTip] }
    })

    // ─── 3. Arrow at tip ───
    const rightEnd = ext.rightEnd ?? 1
    if (rightEnd === 1) {
      const arrowCoords = getArrowCoordinates(c1, rayTip)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'ray_arrow',
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

    // ─── 5. Middle point ───
    if (ext.showMiddlePoint === true) {
      const midX = (c1.x + rayTip.x) / 2
      const midY = (c1.y + rayTip.y) / 2
      if (isActive) {
        const tickTextColor = chart.getStyles().yAxis.tickText.color
        const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'
        figures.push({
          key: 'ray_mid',
          type: 'circle',
          attrs: { x: midX, y: midY, r: CP_RADIUS + CP_CIRCLE_BORDER },
          styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
          pointIndex: 0,
          cursor: 'move'
        })
      }
    }

    // ─── 6. Control points ───
    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'ray_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'ray_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 7. Price label at anchor ───
    if (ext.showPriceLabels === true && points.length >= 1) {
      const p1Value = points[0].value
      if (p1Value != null) {
        figures.push({
          key: 'ray_price0',
          type: 'text',
          attrs: {
            x: c1.x,
            y: c1.y - 18,
            text: formatNum(p1Value, pricePrecision),
            align: 'center' as CanvasTextAlign,
            baseline: 'bottom' as CanvasTextBaseline
          },
          styles: { color: lineColor, size: 11, weight: 'normal', backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }
    }

    // ─── 8. Text label ───
    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const hAlign = ext.horzLabelsAlign ?? 'center'
      const vAlign = ext.vertLabelsAlign ?? 'top'

      const dx = rayTip.x - c1.x
      const dy = rayTip.y - c1.y
      let angle = Math.atan2(dy, dx)
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle < -Math.PI / 2) angle += Math.PI

      let t = 0.5
      if (hAlign === 'left') t = 0.15
      else if (hAlign === 'right') t = 0.85

      const anchorX = c1.x + dx * t
      const anchorY = c1.y + dy * t

      const lineWidth = overlayStyles?.line?.size ?? 2
      const gap = 5
      let offsetPx = 0
      let baseline: CanvasTextBaseline = 'middle'
      if (vAlign === 'top') {
        offsetPx = -(lineWidth / 2 + gap + fontSize)
        baseline = 'bottom'
      } else if (vAlign === 'bottom') {
        offsetPx = lineWidth / 2 + gap + fontSize
        baseline = 'top'
      }
      const perpX = -Math.sin(angle) * offsetPx
      const perpY = Math.cos(angle) * offsetPx

      figures.push({
        key: 'ray_label',
        type: 'text',
        attrs: {
          x: anchorX + perpX,
          y: anchorY + perpY,
          text: ext.text,
          align: 'center' as CanvasTextAlign,
          baseline,
          rotation: angle
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

    // ─── 9. Stats display ───
    const showStats = ext.alwaysShowStats === true || isActive
    const hasAnyStats = (
      ext.showPriceRange === true ||
      ext.showPercentPriceRange === true ||
      ext.showBarsRange === true ||
      ext.showDistance === true ||
      ext.showAngle === true
    )

    if (showStats && hasAnyStats && points.length >= 2) {
      const p1Value = points[0].value
      const p2Value = points[1].value
      const p1Index = points[0].dataIndex
      const p2Index = points[1].dataIndex
      const statLines: string[] = []

      if (ext.showPriceRange === true && p1Value != null && p2Value != null) {
        const diff = p2Value - p1Value
        statLines.push(`${diff >= 0 ? '+' : ''}${formatNum(diff, pricePrecision)}`)
      }

      if (ext.showPercentPriceRange === true && p1Value != null && p2Value != null && p1Value !== 0) {
        const pct = ((p2Value - p1Value) / Math.abs(p1Value)) * 100
        statLines.push(`${pct >= 0 ? '+' : ''}${formatNum(pct)}%`)
      }

      if (ext.showBarsRange === true && p1Index != null && p2Index != null) {
        statLines.push(`${Math.abs(p2Index - p1Index)} bars`)
      }

      if (ext.showDistance === true) {
        const ddx = rayTip.x - c1.x
        const ddy = rayTip.y - c1.y
        statLines.push(`Dist: ${formatNum(Math.sqrt(ddx * ddx + ddy * ddy), 1)}px`)
      }

      if (ext.showAngle === true) {
        const adx = c2.x - c1.x
        const ady = c2.y - c1.y
        statLines.push(`${formatNum(Math.atan2(-ady, adx) * (180 / Math.PI), 1)}\u00B0`)
      }

      if (statLines.length > 0) {
        const statsText = statLines.join('  ')
        const statsPos = ext.statsPosition ?? 2
        const midX = (c1.x + rayTip.x) / 2
        const midY = (c1.y + rayTip.y) / 2
        let sx = Math.max(c1.x, rayTip.x) + 8
        let sy = midY
        let sAlign: CanvasTextAlign = 'left'
        let sBaseline: CanvasTextBaseline = 'middle'

        switch (statsPos) {
          case 0: sx = Math.min(c1.x, rayTip.x) - 8; sy = midY; sAlign = 'right'; break
          case 1: sx = midX; sy = Math.min(c1.y, rayTip.y) - 12; sAlign = 'center'; sBaseline = 'bottom'; break
          case 3: sx = midX; sy = Math.max(c1.y, rayTip.y) + 12; sAlign = 'center'; sBaseline = 'top'; break
          default: sx = Math.max(c1.x, rayTip.x) + 8; sy = midY; break
        }

        figures.push({
          key: 'ray_stats',
          type: 'text',
          attrs: { x: sx, y: sy, text: statsText, align: sAlign, baseline: sBaseline },
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
    const figures: OverlayFigure[] = []
    // Strip between the two anchor prices
    if (coordinates.length >= 2) {
      const stripTop = Math.min(coordinates[0].y, coordinates[1].y)
      const stripH = Math.abs(coordinates[1].y - coordinates[0].y)
      if (stripH > 0) {
        figures.push({
          key: 'ray_ystrip',
          type: 'rect',
          attrs: { x: 0, y: stripTop, width: bounding.width, height: stripH },
          styles: { style: 'fill', color: alphaColor(lineColor, 0.1) },
          ignoreEvent: true
        })
      }
    }
    const p1 = buildYAxisPill(coordinates[0].y, overlay.points[0]?.value, lineColor, precision, bounding, yAxis ?? undefined, 'ray_y0')
    if (p1 != null) figures.push(p1)
    if (coordinates.length >= 2) {
      const p2 = buildYAxisPill(coordinates[1].y, overlay.points[1]?.value, lineColor, precision, bounding, yAxis ?? undefined, 'ray_y1')
      if (p2 != null) figures.push(p2)
    }
    return figures
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
          key: 'ray_xstrip',
          type: 'rect',
          attrs: { x: stripLeft, y: 0, width: stripW, height: bounding.height },
          styles: { style: 'fill', color: alphaColor(lineColor, 0.1) },
          ignoreEvent: true
        })
      }
    }
    const d0 = formatDate(overlay.points[0]?.timestamp)
    if (d0 !== '') figures.push(buildXAxisPill(coordinates[0].x, d0, lineColor, 'ray_x0'))
    if (coordinates.length >= 2) {
      const d1 = formatDate(overlay.points[1]?.timestamp)
      if (d1 !== '') figures.push(buildXAxisPill(coordinates[1].x, d1, lineColor, 'ray_x1'))
    }
    return figures
  }
}

export default rayLine
