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
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,

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

      figures.push({
        key: 'circle_text',
        type: 'text',
        attrs: {
          x: center.x,
          y: center.y,
          text,
          align: 'center' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline
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
  }
}

export default circle
