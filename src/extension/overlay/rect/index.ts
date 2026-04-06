/**
 * Rectangle overlay — TradingView-style with 8 control points
 *
 * Data points: 2 (diagonal corners)
 * Control points: 4 corners (circles) + 4 edge midpoints (squares)
 * All drag logic handled via performEventPressedMove with figureKey
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import {
  CP_COLOR, CP_BG_COLOR,
  CP_RADIUS, CP_CIRCLE_BORDER,
  CP_MID_SIZE, CP_MID_BORDER, CP_MID_BORDER_RADIUS
} from './constants'

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

export interface RectExtendData {
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  fillEnabled?: boolean
  extendLeft?: boolean
  extendRight?: boolean
  showMiddleLine?: boolean
  middleLineColor?: string
  middleLineStyle?: 'solid' | 'dashed' | 'dotted'
  middleLineWidth?: number
  text?: string
  textColor?: string
  textSize?: number
  isBold?: boolean
  isItalic?: boolean
  horzAlign?: 'left' | 'center' | 'right'
  vertAlign?: 'top' | 'middle' | 'bottom'
  isEditing?: boolean
}

// ═══════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════

const DEFAULT_FILL_COLOR = 'rgba(20, 77, 209, 0.2)'
const DEFAULT_BORDER_COLOR = '#144DD1'
const DEFAULT_BORDER_WIDTH = 1

const LINE_DASH_MAP: Record<string, number[]> = {
  solid: [],
  dashed: [8, 4],
  dotted: [2, 2]
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const rect: OverlayTemplate<RectExtendData> = {
  name: 'rectEnhanced',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const [p1, p2] = coordinates
    const ext = overlay.extendData

    // Rectangle bounds
    let left = Math.min(p1.x, p2.x)
    let right = Math.max(p1.x, p2.x)
    const top = Math.min(p1.y, p2.y)
    const bottom = Math.max(p1.y, p2.y)

    // Extend left/right
    if (ext.extendLeft === true) left = 0
    if (ext.extendRight === true) right = bounding.width

    const width = right - left
    const height = bottom - top

    // Styles
    const fillColor = ext.fillColor ?? DEFAULT_FILL_COLOR
    const borderColor = ext.borderColor ?? DEFAULT_BORDER_COLOR
    const borderWidth = ext.borderWidth ?? DEFAULT_BORDER_WIDTH
    const borderStyle = ext.borderStyle ?? 'solid'
    const fillEnabled = ext.fillEnabled !== false

    const figures: OverlayFigure[] = []

    // 1. Rectangle fill + border
    figures.push({
      key: 'rect_body',
      type: 'rect',
      attrs: { x: left, y: top, width, height },
      styles: {
        style: fillEnabled ? 'stroke_fill' : 'stroke',
        color: fillEnabled ? fillColor : 'transparent',
        borderColor,
        borderSize: borderWidth,
        borderStyle,
        borderDashedValue: LINE_DASH_MAP[borderStyle] ?? []
      }
    })

    // 2. Middle line
    if (ext.showMiddleLine === true) {
      const midY = top + height * 0.5
      const mlColor = ext.middleLineColor ?? borderColor
      const mlStyle = ext.middleLineStyle ?? 'dashed'
      const mlWidth = ext.middleLineWidth ?? 1

      figures.push({
        key: 'rect_midline',
        type: 'line',
        attrs: { coordinates: [{ x: left, y: midY }, { x: right, y: midY }] },
        styles: {
          style: 'dashed',
          color: mlColor,
          size: mlWidth,
          dashedValue: LINE_DASH_MAP[mlStyle] ?? [8, 4]
        },
        ignoreEvent: true
      })
    }

    // 3. Text
    const isEditing = ext.isEditing === true
    const text = ext.text ?? ''
    if (!isEditing && text !== '') {
      const textColor = ext.textColor ?? '#05B069'
      const textSize = ext.textSize ?? 14
      const isBold = ext.isBold === true
      const isItalic = ext.isItalic === true
      const horzAlign = ext.horzAlign ?? 'center'
      const vertAlign = ext.vertAlign ?? 'middle'

      const PAD = 8
      let tx = left + width * 0.5
      let ty = top + height * 0.5

      if (horzAlign === 'left') { tx = left + PAD }
      if (horzAlign === 'right') { tx = right - PAD }
      if (vertAlign === 'top') { ty = top + PAD }
      if (vertAlign === 'bottom') { ty = bottom - PAD }

      figures.push({
        key: 'rect_text',
        type: 'text',
        attrs: { x: tx, y: ty, text, align: horzAlign, baseline: vertAlign, width: width - PAD * 2, height: height - PAD * 2 },
        styles: {
          color: textColor,
          size: textSize,
          weight: isBold ? 'bold' : '600',
          style: isItalic ? 'italic' : 'normal',
          backgroundColor: 'transparent'
        }
      })
    }

    // 4. Control points (only when selected or hovered)
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'

    if (isSelected || isHovered) {
      const midX = (left + right) / 2
      const midY = (top + bottom) / 2

      // Corner handle (circle)
      const cornerCP = (key: string, x: number, y: number, pIdx: number, cur: string): OverlayFigure => ({
        key,
        type: 'circle',
        attrs: { x, y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: CP_BG_COLOR,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: pIdx,
        cursor: cur
      })

      // Midpoint handle (rounded square)
      const midCP = (key: string, x: number, y: number, pIdx: number, cur: string): OverlayFigure => ({
        key,
        type: 'rect',
        attrs: {
          x: x - CP_MID_SIZE / 2,
          y: y - CP_MID_SIZE / 2,
          width: CP_MID_SIZE,
          height: CP_MID_SIZE
        },
        styles: {
          style: 'stroke_fill',
          color: CP_BG_COLOR,
          borderColor: CP_COLOR,
          borderSize: CP_MID_BORDER,
          borderRadius: CP_MID_BORDER_RADIUS
        },
        pointIndex: pIdx,
        cursor: cur
      })

      // 4 corners (circles)
      figures.push(cornerCP('rect_tl', left, top, 0, 'nwse-resize'))
      figures.push(cornerCP('rect_tr', right, top, 1, 'nesw-resize'))
      figures.push(cornerCP('rect_br', right, bottom, 1, 'nwse-resize'))
      figures.push(cornerCP('rect_bl', left, bottom, 0, 'nesw-resize'))

      // 4 midpoints (rounded squares)
      figures.push(midCP('rect_mt', midX, top, 0, 'ns-resize'))
      figures.push(midCP('rect_mr', right, midY, 1, 'ew-resize'))
      figures.push(midCP('rect_mb', midX, bottom, 1, 'ns-resize'))
      figures.push(midCP('rect_ml', left, midY, 0, 'ew-resize'))
    }

    return figures
  },

  performEventPressedMove: ({ points, performPointIndex, prevPoints, figureKey }) => {
    if (figureKey == null || figureKey === '' || prevPoints.length < 2) return

    switch (figureKey) {
      // topRight: update X on point[1], Y on point[0]
      case 'rect_tr': {
        const newY = points[performPointIndex].value
        if (performPointIndex === 1) {
          points[1].value = prevPoints[1].value
          points[0].value = newY
        } else {
          points[0].value = prevPoints[0].value
          points[1].value = newY
        }
        break
      }

      // bottomLeft: update X on point[0], Y on point[1]
      case 'rect_bl': {
        const newY = points[performPointIndex].value
        if (performPointIndex === 0) {
          points[0].value = prevPoints[0].value
          points[1].value = newY
        } else {
          points[1].value = prevPoints[1].value
          points[0].value = newY
        }
        break
      }

      // midTop/midBottom: only Y changes
      case 'rect_mt':
      case 'rect_mb': {
        points[performPointIndex].timestamp = prevPoints[performPointIndex].timestamp
        points[performPointIndex].dataIndex = prevPoints[performPointIndex].dataIndex
        break
      }

      // midLeft/midRight: only X changes
      case 'rect_ml':
      case 'rect_mr': {
        points[performPointIndex].value = prevPoints[performPointIndex].value
        break
      }

      // rect_tl, rect_br: standard — no constraint
      default:
        break
    }
  }
}

export default rect
