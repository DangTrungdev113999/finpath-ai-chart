/**
 * Long Position overlay — TradingView-style risk/reward measurement tool
 *
 * Points: P0 = Entry, P1 = Target (TP), P2 = Stop (SL), P3 = Width
 *   - P0: entry price + left edge (1st click)
 *   - P1: target price, X locked to P0 (2nd click, above entry)
 *   - P2: stop price, X locked to P0 (3rd click, below entry)
 *   - P3: right edge width, Y locked to entry (4th click)
 *
 * Rendering: Two axis-aligned rectangles (TP zone teal + SL zone red)
 * Control points: 3 visible (P0=entry, P1=target, P3=width); P2 hidden
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import { isNumber } from '../../../common/utils/typeChecks'
import { calcTextWidth } from '../../../common/utils/canvas'

import type { LongPositionExtendData } from './types'
import {
  LONG_POSITION_DEFAULTS,
  CP_COLOR, CP_RADIUS, CP_BORDER,
  LABEL_BG_COLOR, LABEL_BORDER_COLOR, LABEL_BORDER_WIDTH, LABEL_BORDER_RADIUS,
  LABEL_PADDING_H, LABEL_PADDING_V, LABEL_FONT_FAMILY,
  YAXIS_LABEL_BG, YAXIS_LABEL_TEXT_COLOR
} from './constants'
import {
  calculatePositionStats,
  formatProfitLabel,
  formatRiskRewardLabel,
  formatStopLabel
} from './calculations'

// Default preview offset in pixels before all points placed
const DEFAULT_ZONE_OFFSET = 100

// ═══════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════

function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}

function getSettings (extendData: Partial<LongPositionExtendData> | undefined): LongPositionExtendData {
  return { ...LONG_POSITION_DEFAULTS, ...extendData }
}

function applyOpacity (color: string, opacity: number): string {
  if (opacity >= 100) return color
  const alpha = Math.max(0, Math.min(100, opacity)) / 100
  const rgbaMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/.exec(color)
  if (rgbaMatch != null) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
  }
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(color)
  if (hexMatch != null) {
    const r = parseInt(hexMatch[1], 16)
    const g = parseInt(hexMatch[2], 16)
    const b = parseInt(hexMatch[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

// ═══════════════════════════════════════
// OVERLAY TEMPLATE
// ═══════════════════════════════════════

const longPosition: OverlayTemplate<LongPositionExtendData> = {
  name: 'longPosition',
  totalStep: 5,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    if (coordinates.length < 1) return []

    const ext = getSettings(overlay.extendData)
    const points = overlay.points
    const figures: OverlayFigure[] = []

    // ─── Resolve coordinates ───────────────────
    // P0 = Entry (left edge, entry price)
    const p0 = coordinates[0]
    const p0x = p0.x
    const p0y = p0.y

    // P1 = Target (above entry, X = P0.x)
    const hasP1 = coordinates.length >= 2
    const p1x = hasP1 ? coordinates[1].x : p0x
    const p1y = hasP1 ? coordinates[1].y : p0y - DEFAULT_ZONE_OFFSET

    // P2 = Stop (below entry, X = P0.x)
    const hasP2 = coordinates.length >= 3
    const p2y = hasP2 ? coordinates[2].y : p0y + DEFAULT_ZONE_OFFSET

    // P3 = Width (right edge, Y = P0.y)
    const hasP3 = coordinates.length >= 4
    const p3x = hasP3 ? coordinates[3].x : p0x + 200
    const p3y = hasP3 ? coordinates[3].y : p0y

    // ─── Zone boundaries (axis-aligned rectangles) ──
    const leftX = Math.min(p0x, p3x)
    const rightX = Math.max(p0x, p3x)
    const zoneWidth = Math.max(rightX - leftX, 30)
    const entryY = p0y
    const targetY = p1y
    const stopY = p2y

    const lineColor = applyOpacity(ext.lineColor, ext.lineOpacity)
    const lineStyle = {
      style: 'solid' as const,
      color: lineColor,
      size: ext.lineWidth
    }

    // ─── 1. TP Zone (teal rectangle above entry) ───
    const tpHeight = entryY - targetY
    if (tpHeight > 0) {
      figures.push({
        key: 'lp_tp_fill',
        type: 'rect',
        attrs: { x: leftX, y: targetY, width: zoneWidth, height: tpHeight },
        styles: { style: 'fill' as const, color: ext.profitFillColor },
        ignoreEvent: true
      })
    }

    // ─── 2. SL Zone (red rectangle below entry) ────
    const slHeight = stopY - entryY
    if (slHeight > 0) {
      figures.push({
        key: 'lp_sl_fill',
        type: 'rect',
        attrs: { x: leftX, y: entryY, width: zoneWidth, height: slHeight },
        styles: { style: 'fill' as const, color: ext.stopFillColor },
        ignoreEvent: true
      })
    }

    // ─── 3. Transparent hitbox (full rectangle) ────
    const totalTop = Math.min(targetY, entryY)
    const totalBottom = Math.max(stopY, entryY)
    figures.push({
      key: 'lp_hitbox',
      type: 'rect',
      attrs: { x: leftX, y: totalTop, width: zoneWidth, height: totalBottom - totalTop },
      styles: { style: 'fill' as const, color: 'transparent', borderSize: 0 },
      ignoreEvent: false
    })

    // ─── 4. Boundary lines (rectangle outline + entry divider) ──
    // Top edge (target level)
    figures.push({
      key: 'lp_line_top',
      type: 'line',
      attrs: { coordinates: [{ x: leftX, y: targetY }, { x: leftX + zoneWidth, y: targetY }] },
      styles: lineStyle,
      ignoreEvent: true
    })
    // Bottom edge (stop level)
    figures.push({
      key: 'lp_line_bottom',
      type: 'line',
      attrs: { coordinates: [{ x: leftX, y: stopY }, { x: leftX + zoneWidth, y: stopY }] },
      styles: lineStyle,
      ignoreEvent: true
    })
    // Left edge
    figures.push({
      key: 'lp_line_left',
      type: 'line',
      attrs: { coordinates: [{ x: leftX, y: targetY }, { x: leftX, y: stopY }] },
      styles: lineStyle,
      ignoreEvent: true
    })
    // Right edge
    figures.push({
      key: 'lp_line_right',
      type: 'line',
      attrs: { coordinates: [{ x: leftX + zoneWidth, y: targetY }, { x: leftX + zoneWidth, y: stopY }] },
      styles: lineStyle,
      ignoreEvent: true
    })
    // Entry divider (horizontal at entry price)
    figures.push({
      key: 'lp_entry_line',
      type: 'line',
      attrs: { coordinates: [{ x: leftX, y: entryY }, { x: leftX + zoneWidth, y: entryY }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // ─── 5. Measurement labels ─────────────────────
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== 5

    const showLabels = isSelected || isHovered || ext.alwaysShow || isDrawing

    if (showLabels && points.length >= 3) {
      const entryPrice = isNumber(points[0].value) ? points[0].value : 0
      const targetPrice = isNumber(points[1].value) ? points[1].value : 0
      const stopPrice = isNumber(points[2].value) ? points[2].value : 0

      const precision = chart.getSymbol()?.pricePrecision ?? ext.pricePrecision
      const tickSize = ext.tickSize > 0 ? ext.tickSize : Math.pow(10, -precision)

      const p0Idx = points[0].dataIndex ?? 0
      const p3Idx = points[3]?.dataIndex ?? p0Idx
      const barCount = Math.abs(p3Idx - p0Idx)

      const stats = calculatePositionStats(entryPrice, targetPrice, stopPrice, tickSize, barCount, ext)
      const compact = ext.compactStats
      const fontSize = ext.textFontSize
      const textColor = ext.textColor

      const createLabel = (key: string, x: number, y: number, labelText: string): OverlayFigure[] => {
        const textW = calcTextWidth(labelText, fontSize, 500, LABEL_FONT_FAMILY)
        const pillW = textW + LABEL_PADDING_H * 2
        const pillH = fontSize + LABEL_PADDING_V * 2
        return [
          {
            key: key + '_bg',
            type: 'rect',
            attrs: { x, y: y - pillH / 2, width: pillW, height: pillH },
            styles: {
              style: 'stroke_fill' as const,
              color: LABEL_BG_COLOR,
              borderColor: LABEL_BORDER_COLOR,
              borderSize: LABEL_BORDER_WIDTH,
              borderRadius: LABEL_BORDER_RADIUS
            },
            ignoreEvent: true
          },
          {
            key: key + '_text',
            type: 'text',
            attrs: { x: x + LABEL_PADDING_H, y, text: labelText, baseline: 'middle' },
            styles: {
              style: 'fill' as const,
              color: textColor,
              size: fontSize,
              family: LABEL_FONT_FAMILY,
              weight: 500,
              backgroundColor: 'transparent'
            },
            ignoreEvent: true
          }
        ]
      }

      const labelX = leftX + 4

      // Profit label (in TP zone)
      if (tpHeight > 0) {
        const profitLabelY = targetY + tpHeight * 0.5
        figures.push(...createLabel('lp_label_profit', labelX, profitLabelY, formatProfitLabel(stats, precision, compact)))
      }

      // R:R label (at entry line)
      figures.push(...createLabel('lp_label_rr', labelX, entryY, formatRiskRewardLabel(stats, compact)))

      // Stop label (in SL zone)
      if (slHeight > 0) {
        const stopLabelY = entryY + slHeight * 0.5
        figures.push(...createLabel('lp_label_stop', labelX, stopLabelY, formatStopLabel(stats, precision, compact)))
      }
    }

    // ─── 6. Control points (3 visible) ─────────────
    if ((isSelected || isHovered) && coordinates.length >= 4) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      const cornerCP = (key: string, x: number, y: number, pIdx: number): OverlayFigure => ({
        key,
        type: 'circle',
        attrs: { x, y, r: CP_RADIUS + CP_BORDER },
        styles: {
          style: 'stroke_fill' as const,
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_BORDER
        },
        pointIndex: pIdx,
        cursor: 'pointer'
      })

      // CP0 at P0 (entry, left edge)
      figures.push(cornerCP('lp_cp0', p0x, p0y, 0))
      // CP1 at P1 (target, left edge)
      figures.push(cornerCP('lp_cp1', p1x, p1y, 1))
      // CP2 at P3 (width, right edge) — P2 is hidden
      figures.push(cornerCP('lp_cp3', p3x, p3y, 3))
    }

    return figures
  },

  // ═══════════════════════════════════════
  // Drawing constraints (during 4-click placement)
  // ═══════════════════════════════════════
  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2 && points.length >= 1) {
      // Placing P1 (Target): lock X to P0, constrain above entry
      performPoint.timestamp = points[0].timestamp
      performPoint.dataIndex = points[0].dataIndex
      if (performPoint.value !== undefined && points[0].value !== undefined &&
          performPoint.value < points[0].value) {
        performPoint.value = points[0].value
      }
    } else if (currentStep === 3 && points.length >= 2) {
      // Placing P2 (Stop): lock X to P0, constrain below entry
      performPoint.timestamp = points[0].timestamp
      performPoint.dataIndex = points[0].dataIndex
      if (performPoint.value !== undefined && points[0].value !== undefined &&
          performPoint.value > points[0].value) {
        performPoint.value = points[0].value
      }
    } else if (currentStep === 4 && points.length >= 3) {
      // Placing P3 (Width): lock Y to entry price
      performPoint.value = points[0].value
    }
  },

  // ═══════════════════════════════════════
  // Drag constraints (after placement)
  // ═══════════════════════════════════════
  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    if (points.length < 4) return

    switch (performPointIndex) {
      case 0:
        // P0 (Entry): free move. P1/P2 follow X, P3 Y follows entry.
        points[1].timestamp = points[0].timestamp
        points[1].dataIndex = points[0].dataIndex
        points[2].timestamp = points[0].timestamp
        points[2].dataIndex = points[0].dataIndex
        points[3].value = performPoint.value
        break
      case 1:
        // P1 (Target): vertical only, X follows P0, must stay above entry
        points[1].timestamp = points[0].timestamp
        points[1].dataIndex = points[0].dataIndex
        if ((performPoint.value ?? 0) < (points[0].value ?? 0)) {
          points[1].value = points[0].value
        }
        break
      case 2:
        // P2 (Stop): vertical only, X follows P0, must stay below entry
        points[2].timestamp = points[0].timestamp
        points[2].dataIndex = points[0].dataIndex
        if ((performPoint.value ?? 0) > (points[0].value ?? 0)) {
          points[2].value = points[0].value
        }
        break
      case 3:
        // P3 (Width): horizontal only, Y stays at entry price
        points[3].value = points[0].value
        break
      default:
        break
    }
  },

  // ═══════════════════════════════════════
  // Y-axis price labels
  // ═══════════════════════════════════════
  createYAxisFigures: ({ chart, overlay, yAxis }) => {
    if (yAxis == null) return []
    const ext = getSettings(overlay.extendData)
    if (!ext.showPriceLabels) return []

    const points = overlay.points
    if (points.length < 3) return []

    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const decimalFold = chart.getDecimalFold()
    const thousandsSeparator = chart.getThousandsSeparator()
    const figures: OverlayFigure[] = []

    const formatPrice = (val: number): string =>
      decimalFold.format(thousandsSeparator.format(val.toFixed(precision)))

    const createYLabel = (key: string, value: number, bgColor: string): void => {
      if (!isNumber(value)) return
      const pixelY = yAxis.convertToPixel(value)
      figures.push({
        key,
        type: 'text',
        attrs: { x: 0, y: pixelY, text: formatPrice(value), align: 'left', baseline: 'middle' },
        styles: {
          style: 'fill' as const,
          color: YAXIS_LABEL_TEXT_COLOR,
          size: 11,
          family: LABEL_FONT_FAMILY,
          weight: 500,
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          backgroundColor: bgColor,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    createYLabel('lp_yaxis_entry', points[0].value!, YAXIS_LABEL_BG)
    createYLabel('lp_yaxis_target', points[1].value!, 'rgba(8, 153, 129, 0.8)')
    createYLabel('lp_yaxis_stop', points[2].value!, 'rgba(242, 54, 69, 0.8)')

    return figures
  }
}

export default longPosition
