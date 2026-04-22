/**
 * Circle overlay — TradingView-style with 2 control points
 *
 * Data points: 2 (center + edge)
 * Control points: center (move) + edge (resize)
 * Drag logic: center CP translates entire circle, edge CP resizes
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import {
  CP_COLOR,
  CP_RADIUS, CP_CIRCLE_BORDER
} from '../rect/constants'
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_FILL_COLOR,
  DEFAULT_FILL_OPACITY,
  MIN_RADIUS_PX
} from './constants'
import {
  buildXAxisPill,
  buildYAxisPill,
  formatDate,
  alphaColor
} from '../lineCommon'

function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function hexToRgba (hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (m == null) return `rgba(255, 152, 0, ${alpha})`
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

// Internal helper to access ChartStore from Chart interface
interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}

// Pills + strip always use TV blue, regardless of shape color
const AXIS_PILL_COLOR = '#2962FF'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface CircleExtendData {
  borderColor?: string
  borderWidth?: number
  fillEnabled?: boolean
  fillColor?: string
  fillOpacity?: number
  showLabel?: boolean
  text?: string
  textColor?: string
  textSize?: number
  isBold?: boolean
  isItalic?: boolean
  isEditing?: boolean
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const circle: OverlayTemplate<CircleExtendData> = {
  name: 'circle',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    if (coordinates.length < 2) return []

    const [center, edge] = coordinates
    const ext = overlay.extendData

    // Radius: Euclidean distance, min 5px
    const radius = Math.max(Math.hypot(edge.x - center.x, edge.y - center.y), MIN_RADIUS_PX)

    // Styles
    const borderColor = ext.borderColor ?? DEFAULT_BORDER_COLOR
    const borderWidth = ext.borderWidth ?? DEFAULT_BORDER_WIDTH
    const fillColor = ext.fillColor ?? DEFAULT_FILL_COLOR
    const fillOpacity = ext.fillOpacity ?? DEFAULT_FILL_OPACITY
    const fillEnabled = ext.fillEnabled !== false

    const fillRgba = fillEnabled
      ? hexToRgba(fillColor, fillOpacity / 100)
      : 'transparent'

    const figures: OverlayFigure[] = []

    // Figure 0: Fill circle (always rendered for body drag hit-test)
    figures.push({
      key: 'circle_fill',
      type: 'circle',
      attrs: { x: center.x, y: center.y, r: radius },
      styles: {
        style: 'fill',
        color: fillRgba
      }
    })

    // Figure 1: Border circle
    figures.push({
      key: 'circle_border',
      type: 'circle',
      attrs: { x: center.x, y: center.y, r: radius },
      styles: {
        style: 'stroke',
        borderColor,
        borderSize: borderWidth
      }
    })

    // Figure 2: Text (optional)
    const isEditing = ext.isEditing === true
    const showLabel = ext.showLabel === true
    const text = ext.text ?? ''
    if (!isEditing && showLabel && text !== '') {
      const textColor = ext.textColor ?? DEFAULT_BORDER_COLOR
      const textSize = ext.textSize ?? 14
      const isBold = ext.isBold === true
      const isItalic = ext.isItalic === true

      // Inscribed square for text wrap: side = r * √2 (largest rectangle inside circle)
      const wrapSide = radius * Math.SQRT2
      figures.push({
        key: 'circle_text',
        type: 'text',
        attrs: {
          x: center.x,
          y: center.y,
          text,
          align: 'center' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline,
          width: wrapSide,
          height: wrapSide
        },
        styles: {
          color: textColor,
          size: textSize,
          weight: isBold ? 'bold' : '600',
          style: isItalic ? 'italic' : 'normal',
          backgroundColor: 'transparent'
        },
        ignoreEvent: true
      })
    }

    // Selection state
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'

    // Figures 3-4: Control points (only when selected or hovered)
    if (isSelected || isHovered) {
      // Detect theme from Y-axis tick text color: light text = dark theme
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(tickTextColor) ? '#131722' : '#ffffff'

      // CP at center (drag to translate entire circle)
      figures.push({
        key: 'circle_cp_center',
        type: 'circle',
        attrs: { x: center.x, y: center.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 0,
        cursor: 'move'
      })

      // CP at edge (drag to resize)
      figures.push({
        key: 'circle_cp_edge',
        type: 'circle',
        attrs: { x: edge.x, y: edge.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 1,
        cursor: 'crosshair'
      })
    }

    return figures
  },

  performEventPressedMove: ({ points, prevPoints, figureKey }) => {
    if (figureKey == null || figureKey === '' || prevPoints.length < 2) return

    if (figureKey === 'circle_cp_center') {
      // Translate entire circle: shift edge point by same delta as center
      const dt = (points[0].timestamp ?? 0) - (prevPoints[0].timestamp ?? 0)
      const dv = (points[0].value ?? 0) - (prevPoints[0].value ?? 0)
      points[1].timestamp = (prevPoints[1].timestamp ?? 0) + dt
      points[1].value = (prevPoints[1].value ?? 0) + dv
    }
    // circle_cp_edge: default behavior (center stays fixed, edge moves)
  },

  // ─── X-axis: translucent strip spanning the diameter + pills at both edges ───
  createXAxisFigures: ({ chart, overlay, coordinates, bounding }) => {
    if (coordinates.length < 2) return []

    // Only render while selected or hovered (TradingView behavior)
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    if (!isSelected && !isHovered) return []

    const [center, edge] = coordinates
    const radius = Math.max(Math.hypot(edge.x - center.x, edge.y - center.y), MIN_RADIUS_PX)
    const leftX = center.x - radius
    const rightX = center.x + radius
    const stripWidth = rightX - leftX

    // Convert pixel edges back to timestamps for the pill text
    const leftPoint = chart.convertFromPixel([{ x: leftX }]) as { timestamp?: number } | Array<{ timestamp?: number }>
    const rightPoint = chart.convertFromPixel([{ x: rightX }]) as { timestamp?: number } | Array<{ timestamp?: number }>
    const leftTs = Array.isArray(leftPoint) ? leftPoint[0]?.timestamp : leftPoint.timestamp
    const rightTs = Array.isArray(rightPoint) ? rightPoint[0]?.timestamp : rightPoint.timestamp

    const figs: OverlayFigure[] = []
    if (stripWidth > 0) {
      figs.push({
        key: 'circle_xstrip',
        type: 'rect',
        attrs: { x: leftX, y: 0, width: stripWidth, height: bounding.height },
        styles: { style: 'fill', color: alphaColor(AXIS_PILL_COLOR, 0.2) },
        ignoreEvent: true
      })
    }

    const dLeft = formatDate(leftTs)
    const dRight = formatDate(rightTs)
    if (dLeft !== '') figs.push(buildXAxisPill(leftX, dLeft, AXIS_PILL_COLOR, 'circle_x0'))
    if (dRight !== '' && rightX !== leftX) {
      figs.push(buildXAxisPill(rightX, dRight, AXIS_PILL_COLOR, 'circle_x1'))
    }
    return figs
  },

  // ─── Y-axis: translucent strip spanning the diameter + pills at both edges ───
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    if (coordinates.length < 2) return []

    // Only render while selected or hovered (TradingView behavior)
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    if (!isSelected && !isHovered) return []

    const precision = chart.getSymbol()?.pricePrecision ?? 2

    const [center, edge] = coordinates
    const radius = Math.max(Math.hypot(edge.x - center.x, edge.y - center.y), MIN_RADIUS_PX)
    const topY = center.y - radius
    const bottomY = center.y + radius
    const stripHeight = bottomY - topY

    // Convert pixel edges back to values for the pill text
    const topPoint = chart.convertFromPixel([{ y: topY }]) as { value?: number } | Array<{ value?: number }>
    const botPoint = chart.convertFromPixel([{ y: bottomY }]) as { value?: number } | Array<{ value?: number }>
    const topVal = Array.isArray(topPoint) ? topPoint[0]?.value : topPoint.value
    const bottomVal = Array.isArray(botPoint) ? botPoint[0]?.value : botPoint.value

    const figs: OverlayFigure[] = []
    if (stripHeight > 0) {
      figs.push({
        key: 'circle_ystrip',
        type: 'rect',
        attrs: { x: 0, y: topY, width: bounding.width, height: stripHeight },
        styles: { style: 'fill', color: alphaColor(AXIS_PILL_COLOR, 0.2) },
        ignoreEvent: true
      })
    }

    const pillTop = buildYAxisPill(topY, topVal, AXIS_PILL_COLOR, precision, bounding, yAxis ?? undefined, 'circle_y0')
    if (pillTop != null) figs.push(pillTop)
    if (bottomY !== topY) {
      const pillBot = buildYAxisPill(bottomY, bottomVal, AXIS_PILL_COLOR, precision, bounding, yAxis ?? undefined, 'circle_y1')
      if (pillBot != null) figs.push(pillBot)
    }
    return figs
  }
}

export default circle
