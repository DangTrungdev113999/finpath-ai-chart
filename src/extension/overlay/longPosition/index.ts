/**
 * Long Position overlay — TradingView-style 4-click risk/reward measurement tool
 *
 * Data points: 4 (P0 upper-left, P1 upper-right, P2 lower-left, P3 lower-right)
 * Control points: 3 visible (P0, P1, P3); P2 hidden (X locked to P1.x)
 * Fill zones: teal (profit) + red (stop loss)
 * Labels: 3 measurement pills (profit, R:R, stop)
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import { isNumber } from '../../../common/utils/typeChecks'
import { calcTextWidth } from '../../../common/utils/canvas'
import { SymbolDefaultPrecisionConstants } from '../../../common/SymbolInfo'

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
  // If already rgba, replace alpha
  const rgbaMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/.exec(color)
  if (rgbaMatch != null) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
  }
  // If hex, convert
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
    if (coordinates.length < 2) return []

    const ext = getSettings(overlay.extendData)
    const points = overlay.points
    const figures: OverlayFigure[] = []

    // Resolve coordinates for available points
    const p0 = coordinates[0] // upper-left (entry-left)
    const p1 = coordinates[1] // upper-right (target)

    // For 2-point state (step 2 drawing P1), show the upper boundary line
    if (coordinates.length === 2) {
      const lineColor = applyOpacity(ext.lineColor, ext.lineOpacity)
      figures.push({
        key: 'lp_upper_line',
        type: 'line',
        attrs: { coordinates: [{ x: p0.x, y: p0.y }, { x: p1.x, y: p1.y }] },
        styles: { style: 'solid' as const, color: lineColor, size: ext.lineWidth },
        ignoreEvent: true
      })
      return figures
    }

    // Need at least 3 points for meaningful rendering
    if (coordinates.length < 3) return figures

    const p2 = coordinates[2] // lower-left (stop-left, hidden CP; X = P1.x)

    // If we have 3 points but not 4, create a temporary P3 for preview
    // During step 4, the mouse position becomes P3
    const p3 = coordinates.length >= 4
      ? coordinates[3] // lower-right (stop)
      : { x: p2.x, y: p2.y } // fallback: same as P2

    // Entry Y = P0.y (entry line is at the level of P0)
    const entryY = p0.y

    // ─── 1. Fill polygons ───────────────────────────
    // Profit zone: P0 -> P1 top-right -> entry line right -> entry line left
    // Upper boundary: P0 to P1
    // Entry line: horizontal at P0.y from P0.x to P1.x
    figures.push({
      key: 'lp_profit_fill',
      type: 'polygon',
      attrs: {
        coordinates: [
          { x: p0.x, y: p0.y },
          { x: p1.x, y: p1.y },
          { x: p1.x, y: entryY },
          { x: p0.x, y: entryY }
        ]
      },
      styles: { style: 'fill' as const, color: ext.profitFillColor },
      ignoreEvent: true
    })

    // Stop zone: entry line left -> entry line right -> P3 -> P2
    figures.push({
      key: 'lp_stop_fill',
      type: 'polygon',
      attrs: {
        coordinates: [
          { x: p0.x, y: entryY },
          { x: p1.x, y: entryY },
          { x: p3.x, y: p3.y },
          { x: p2.x, y: p2.y }
        ]
      },
      styles: { style: 'fill' as const, color: ext.stopFillColor },
      ignoreEvent: true
    })

    // ─── 2. Transparent hitbox polygon ──────────────
    figures.push({
      key: 'lp_hitbox',
      type: 'polygon',
      attrs: {
        coordinates: [
          { x: p0.x, y: p0.y },
          { x: p1.x, y: p1.y },
          { x: p3.x, y: p3.y },
          { x: p2.x, y: p2.y }
        ]
      },
      styles: { style: 'fill' as const, color: 'transparent', borderSize: 0 },
      ignoreEvent: false
    })

    // ─── 3. Boundary lines (4 edges) ───────────────
    const lineColor = applyOpacity(ext.lineColor, ext.lineOpacity)
    const lineStyle = {
      style: 'solid' as const,
      color: lineColor,
      size: ext.lineWidth
    }

    // Top edge: P0 -> P1
    figures.push({
      key: 'lp_line_top',
      type: 'line',
      attrs: { coordinates: [{ x: p0.x, y: p0.y }, { x: p1.x, y: p1.y }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // Right edge: P1 -> P3
    figures.push({
      key: 'lp_line_right',
      type: 'line',
      attrs: { coordinates: [{ x: p1.x, y: p1.y }, { x: p3.x, y: p3.y }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // Bottom edge: P3 -> P2
    figures.push({
      key: 'lp_line_bottom',
      type: 'line',
      attrs: { coordinates: [{ x: p2.x, y: p2.y }, { x: p3.x, y: p3.y }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // Left edge: P2 -> P0
    figures.push({
      key: 'lp_line_left',
      type: 'line',
      attrs: { coordinates: [{ x: p0.x, y: p0.y }, { x: p2.x, y: p2.y }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // ─── 4. Entry divider line (horizontal at P0.y) ─
    figures.push({
      key: 'lp_entry_line',
      type: 'line',
      attrs: { coordinates: [{ x: p0.x, y: entryY }, { x: p1.x, y: entryY }] },
      styles: lineStyle,
      ignoreEvent: true
    })

    // ─── 5. Measurement labels ─────────────────────
    // Only visible when hovered, selected, or alwaysShow
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isDrawing = overlay.currentStep > 0 && overlay.currentStep !== 5

    const showLabels = isSelected || isHovered || ext.alwaysShow || isDrawing

    if (showLabels && coordinates.length >= 4) {
      // Calculate stats
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

      // Helper: create a label pill (rect bg + text)
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
            attrs: {
              x: x + LABEL_PADDING_H,
              y,
              text: labelText,
              baseline: 'middle'
            },
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

      const labelX = Math.min(p0.x, p2.x) + 4

      // Profit label (upper zone, between top edge and entry line)
      const profitLabelY = (p0.y + entryY) / 2
      const profitText = formatProfitLabel(stats, precision, compact)
      figures.push(...createLabel('lp_label_profit', labelX, profitLabelY, profitText))

      // Risk/Reward label (at entry line)
      const rrLabelY = entryY
      const rrText = formatRiskRewardLabel(stats, compact)
      figures.push(...createLabel('lp_label_rr', labelX, rrLabelY, rrText))

      // Stop label (lower zone, between entry line and bottom edge)
      const stopLabelY = (entryY + Math.max(p2.y, p3.y)) / 2
      const stopText = formatStopLabel(stats, precision, compact)
      figures.push(...createLabel('lp_label_stop', labelX, stopLabelY, stopText))
    }

    // ─── 6. Control points (3 visible) ─────────────
    // Only when selected or hovered
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

      // CP1 at P0 (upper-left)
      figures.push(cornerCP('lp_cp0', p0.x, p0.y, 0))

      // CP2 at P1 (upper-right)
      figures.push(cornerCP('lp_cp1', p1.x, p1.y, 1))

      // CP3 at P3 (lower-right) — P2 is hidden
      figures.push(cornerCP('lp_cp3', p3.x, p3.y, 3))
    }

    return figures
  },

  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    // Step 3: placing P2 — lock X to P1.x
    if (currentStep === 3 && points.length >= 2) {
      performPoint.timestamp = points[1].timestamp
      performPoint.dataIndex = points[1].dataIndex
    }
  },

  performEventPressedMove: ({ points, performPointIndex }) => {
    if (points.length < 4) return

    switch (performPointIndex) {
      case 0:
        // P0 (CP1): free drag — no constraints
        break
      case 1:
        // P1 (CP2): free drag, but P2 must follow P1's X
        points[2].timestamp = points[1].timestamp
        points[2].dataIndex = points[1].dataIndex
        break
      case 2:
        // P2 hidden: force X = P1.x (should not happen, but safety)
        points[2].timestamp = points[1].timestamp
        points[2].dataIndex = points[1].dataIndex
        break
      case 3:
        // P3 (CP3): free drag — no constraints
        break
      default:
        break
    }
  },

  createYAxisFigures: ({ chart, overlay, coordinates, yAxis }) => {
    if (coordinates.length === 0 || yAxis == null) return []

    const ext = getSettings(overlay.extendData)
    if (!ext.showPriceLabels) return []

    const points = overlay.points
    if (points.length < 3) return []

    const precision = chart.getSymbol()?.pricePrecision ?? SymbolDefaultPrecisionConstants.PRICE
    const decimalFold = chart.getDecimalFold()
    const thousandsSeparator = chart.getThousandsSeparator()
    const figures: OverlayFigure[] = []

    const formatPrice = (val: number): string =>
      decimalFold.format(thousandsSeparator.format(val.toFixed(precision)))

    // Entry price (P0)
    if (isNumber(points[0].value)) {
      const entryPixelY = yAxis.convertToPixel(points[0].value)
      figures.push({
        key: 'lp_yaxis_entry',
        type: 'text',
        attrs: { x: 0, y: entryPixelY, text: formatPrice(points[0].value), align: 'left', baseline: 'middle' },
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
          backgroundColor: YAXIS_LABEL_BG,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // Target price (P1)
    if (isNumber(points[1].value)) {
      const targetPixelY = yAxis.convertToPixel(points[1].value)
      figures.push({
        key: 'lp_yaxis_target',
        type: 'text',
        attrs: { x: 0, y: targetPixelY, text: formatPrice(points[1].value), align: 'left', baseline: 'middle' },
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
          backgroundColor: 'rgba(8, 153, 129, 0.8)',
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // Stop price (P2)
    if (isNumber(points[2].value)) {
      const stopPixelY = yAxis.convertToPixel(points[2].value)
      figures.push({
        key: 'lp_yaxis_stop',
        type: 'text',
        attrs: { x: 0, y: stopPixelY, text: formatPrice(points[2].value), align: 'left', baseline: 'middle' },
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
          backgroundColor: 'rgba(242, 54, 69, 0.8)',
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    return figures
  }
}

export default longPosition
