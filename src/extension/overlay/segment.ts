/**
 * Segment overlay — TradingView-style trend line
 *
 * Data points: 2 (endpoints)
 * Features: extend left/right, arrow endpoints, middle point,
 *           price labels, text label, stats display, control points
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import type Coordinate from '../../common/Coordinate'
import type { OverlayTemplate, OverlayFigure } from '../../component/Overlay'
import type { EventOverlayInfo } from '../../Store'

import { getLinearYFromCoordinates } from '../figure/line'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface SegmentExtendData {
  // Extend
  extendLeft?: boolean
  extendRight?: boolean
  // End caps: 0=normal, 1=arrow
  leftEnd?: number
  rightEnd?: number
  // Middle point
  showMiddlePoint?: boolean
  // Price labels at endpoints
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
  showBarsRange?: boolean
  showDateTimeRange?: boolean
  showDistance?: boolean
  showAngle?: boolean
  alwaysShowStats?: boolean
  statsPosition?: number
}

// ═══════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════

interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}

function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

// Control point constants (match rect overlay)
const CP_COLOR = '#1592E6'
const CP_RADIUS = 5
const CP_CIRCLE_BORDER = 1.5

// Arrow head constants
const ARROW_LENGTH = 14
const ARROW_WIDTH = 6

/**
 * Compute arrowhead polygon coordinates at `tip` pointing away from `from`.
 */
function getArrowCoordinates (from: Coordinate, tip: Coordinate): Coordinate[] {
  const dx = tip.x - from.x
  const dy = tip.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return []

  // Unit vector along the line
  const ux = dx / len
  const uy = dy / len

  // Perpendicular unit vector
  const px = -uy
  const py = ux

  // Base of the arrowhead
  const bx = tip.x - ux * ARROW_LENGTH
  const by = tip.y - uy * ARROW_LENGTH

  return [
    { x: tip.x, y: tip.y },
    { x: bx + px * ARROW_WIDTH, y: by + py * ARROW_WIDTH },
    { x: bx - px * ARROW_WIDTH, y: by - py * ARROW_WIDTH }
  ]
}

/**
 * Extend a line segment from c1->c2 to bounding edges.
 */
function getExtendedCoordinates (
  c1: Coordinate, c2: Coordinate,
  boundingWidth: number, boundingHeight: number,
  extendLeft: boolean, extendRight: boolean
): [Coordinate, Coordinate] {
  let start: Coordinate = { x: c1.x, y: c1.y }
  let end: Coordinate = { x: c2.x, y: c2.y }

  const isVertical = c1.x === c2.x

  if (isVertical) {
    if (extendLeft) {
      // Extend from c1 in its direction away from c2
      if (c1.y <= c2.y) {
        start = { x: c1.x, y: 0 }
      } else {
        start = { x: c1.x, y: boundingHeight }
      }
    }
    if (extendRight) {
      // Extend from c2 in its direction away from c1
      if (c1.y <= c2.y) {
        end = { x: c2.x, y: boundingHeight }
      } else {
        end = { x: c2.x, y: 0 }
      }
    }
    return [start, end]
  }

  if (extendLeft) {
    // Extend from c1 backward (away from c2)
    const direction = c1.x < c2.x ? 0 : boundingWidth
    start = {
      x: direction,
      y: getLinearYFromCoordinates(c1, c2, { x: direction, y: c1.y })
    }
  }

  if (extendRight) {
    // Extend from c2 forward (away from c1)
    const direction = c1.x < c2.x ? boundingWidth : 0
    end = {
      x: direction,
      y: getLinearYFromCoordinates(c1, c2, { x: direction, y: c2.y })
    }
  }

  return [start, end]
}

/**
 * Format a number for display
 */
function formatNum (val: number, precision?: number): string {
  const p = precision ?? 2
  return val.toFixed(p).replace(/\.?0+$/, '')
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const segment: OverlayTemplate<Partial<SegmentExtendData>> = {
  name: 'segment',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const [c1, c2] = coordinates
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- extendData may be undefined at runtime for legacy overlays
    const ext = overlay.extendData ?? {}
    const points = overlay.points
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const figures: OverlayFigure[] = []

    // ─── 1. Compute line coordinates (with optional extend) ───

    const extendLeft = ext.extendLeft === true
    const extendRight = ext.extendRight === true

    let lineStart: Coordinate = { x: c1.x, y: c1.y }
    let lineEnd: Coordinate = { x: c2.x, y: c2.y }

    if (extendLeft || extendRight) {
      const [s, e] = getExtendedCoordinates(
        c1, c2, bounding.width, bounding.height, extendLeft, extendRight
      )
      lineStart = s
      lineEnd = e
    }

    // ─── 2. Main line figure ───

    figures.push({
      key: 'seg_line',
      type: 'line',
      attrs: { coordinates: [lineStart, lineEnd] }
    })

    // ─── 3. Arrow endpoints ───

    const leftEnd = ext.leftEnd ?? 0
    const rightEnd = ext.rightEnd ?? 0

    // Get line color from overlay styles
    const overlayStyles = overlay.styles
    const lineColor = overlayStyles?.line?.color ?? '#2196F3'

    if (leftEnd === 1) {
      const arrowTip = extendLeft ? lineStart : c1
      const arrowFrom = c2
      const arrowCoords = getArrowCoordinates(arrowFrom, arrowTip)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'seg_arrow_left',
          type: 'polygon',
          attrs: { coordinates: arrowCoords },
          styles: { style: 'fill', color: lineColor },
          ignoreEvent: true
        })
      }
    }

    if (rightEnd === 1) {
      const arrowTip = extendRight ? lineEnd : c2
      const arrowFrom = c1
      const arrowCoords = getArrowCoordinates(arrowFrom, arrowTip)
      if (arrowCoords.length === 3) {
        figures.push({
          key: 'seg_arrow_right',
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
      const midX = (c1.x + c2.x) / 2
      const midY = (c1.y + c2.y) / 2

      if (isActive) {
        const tickTextColor = chart.getStyles().yAxis.tickText.color
        const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

        figures.push({
          key: 'seg_mid',
          type: 'circle',
          attrs: { x: midX, y: midY, r: CP_RADIUS + CP_CIRCLE_BORDER },
          styles: {
            style: 'stroke_fill',
            color: cpBg,
            borderColor: CP_COLOR,
            borderSize: CP_CIRCLE_BORDER
          },
          pointIndex: 0,
          cursor: 'move'
        })
      }
    }

    // ─── 6. Control points at endpoints (when selected/hovered) ───

    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'seg_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 0,
        cursor: 'pointer'
      })

      figures.push({
        key: 'seg_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 7. Price labels at endpoints ───

    if (ext.showPriceLabels === true && points.length >= 2) {
      const p1Value = points[0].value
      const p2Value = points[1].value

      if (p1Value != null) {
        const precision = pricePrecision
        figures.push({
          key: 'seg_price0',
          type: 'text',
          attrs: {
            x: c1.x,
            y: c1.y - 18,
            text: formatNum(p1Value, precision),
            align: 'center' as CanvasTextAlign,
            baseline: 'bottom' as CanvasTextBaseline
          },
          styles: {
            color: lineColor,
            size: 11,
            weight: 'normal',
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }

      if (p2Value != null) {
        const precision = pricePrecision
        figures.push({
          key: 'seg_price1',
          type: 'text',
          attrs: {
            x: c2.x,
            y: c2.y - 18,
            text: formatNum(p2Value, precision),
            align: 'center' as CanvasTextAlign,
            baseline: 'bottom' as CanvasTextBaseline
          },
          styles: {
            color: lineColor,
            size: 11,
            weight: 'normal',
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }
    }

    // ─── 8. Text label ───

    if (ext.showLabel === true && ext.text != null && ext.text !== '') {
      const textColor = ext.textcolor ?? lineColor
      const fontSize = ext.fontsize ?? 14
      const isBold = ext.bold === true
      const isItalic = ext.italic === true

      // Position at midpoint of the line
      const midX = (c1.x + c2.x) / 2
      const midY = (c1.y + c2.y) / 2

      // Calculate rotation angle to follow the line direction
      const dx = c2.x - c1.x
      const dy = c2.y - c1.y
      let angle = Math.atan2(dy, dx)
      // Keep text readable (not upside down): if angle > 90° or < -90°, flip it
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle < -Math.PI / 2) angle += Math.PI

      // Offset text slightly above the line
      const offsetPx = fontSize * 0.4 + 4
      const perpX = -Math.sin(angle) * offsetPx
      const perpY = Math.cos(angle) * offsetPx

      figures.push({
        key: 'seg_label',
        type: 'text',
        attrs: {
          x: midX + perpX,
          y: midY + perpY,
          text: ext.text,
          align: 'center' as CanvasTextAlign,
          baseline: 'bottom' as CanvasTextBaseline,
          rotation: angle
        },
        styles: {
          color: textColor,
          size: fontSize,
          weight: isBold ? 'bold' : 'normal',
          style: isItalic ? 'italic' : 'normal',
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
      ext.showDateTimeRange === true ||
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
        const sign = diff >= 0 ? '+' : ''
        const precision = pricePrecision
        statLines.push(`${sign}${formatNum(diff, precision)}`)
      }

      if (ext.showPercentPriceRange === true && p1Value != null && p2Value != null && p1Value !== 0) {
        const pct = ((p2Value - p1Value) / Math.abs(p1Value)) * 100
        const sign = pct >= 0 ? '+' : ''
        statLines.push(`${sign}${formatNum(pct)}%`)
      }

      if (ext.showBarsRange === true && p1Index != null && p2Index != null) {
        const bars = Math.abs(p2Index - p1Index)
        statLines.push(`${bars} bars`)
      }

      if (ext.showDistance === true) {
        const dx = c2.x - c1.x
        const dy = c2.y - c1.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        statLines.push(`Dist: ${formatNum(dist, 1)}px`)
      }

      if (ext.showAngle === true) {
        const dx = c2.x - c1.x
        const dy = c2.y - c1.y
        // Angle from horizontal, positive = up (canvas Y is inverted)
        const angle = Math.atan2(-dy, dx) * (180 / Math.PI)
        statLines.push(`${formatNum(angle, 1)}\u00B0`)
      }

      if (statLines.length > 0) {
        const statsText = statLines.join('  ')
        const statsPos = ext.statsPosition ?? 2

        const midX = (c1.x + c2.x) / 2
        const midY = (c1.y + c2.y) / 2

        let sx: number = Math.max(c1.x, c2.x) + 8
        let sy: number = midY
        let sAlign: CanvasTextAlign = 'left'
        let sBaseline: CanvasTextBaseline = 'middle'

        switch (statsPos) {
          case 0: // left
            sx = Math.min(c1.x, c2.x) - 8
            sy = midY
            sAlign = 'right'
            break
          case 1: // top
            sx = midX
            sy = Math.min(c1.y, c2.y) - 12
            sAlign = 'center'
            sBaseline = 'bottom'
            break
          case 3: // bottom
            sx = midX
            sy = Math.max(c1.y, c2.y) + 12
            sAlign = 'center'
            sBaseline = 'top'
            break
          default: // 2 = right
            sx = Math.max(c1.x, c2.x) + 8
            sy = midY
            sAlign = 'left'
            break
        }

        figures.push({
          key: 'seg_stats',
          type: 'text',
          attrs: {
            x: sx,
            y: sy,
            text: statsText,
            align: sAlign,
            baseline: sBaseline
          },
          styles: {
            color: lineColor,
            size: 11,
            weight: 'normal',
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }
    }

    return figures
  },

  performEventPressedMove: ({ points, prevPoints, figureKey }) => {
    if (figureKey == null || figureKey === '' || prevPoints.length < 2) return

    if (figureKey === 'seg_mid') {
      // Middle point drag: move both points by the same delta
      // The engine sets points[0] to the new dragged position (pointIndex=0).
      // We compute delta from midpoint's original position and apply to both points.
      if (prevPoints[0].dataIndex != null && prevPoints[1].dataIndex != null &&
          prevPoints[0].value != null && prevPoints[1].value != null) {
        const midOrigIndex = Math.round((prevPoints[0].dataIndex + prevPoints[1].dataIndex) / 2)
        const midOrigValue = (prevPoints[0].value + prevPoints[1].value) / 2

        const newIndex = points[0].dataIndex ?? midOrigIndex
        const newValue = points[0].value ?? midOrigValue

        const dxFromMid = newIndex - midOrigIndex
        const dyFromMid = newValue - midOrigValue

        points[0] = {
          ...prevPoints[0],
          dataIndex: prevPoints[0].dataIndex + dxFromMid,
          value: prevPoints[0].value + dyFromMid,
          timestamp: undefined
        }
        points[1] = {
          ...prevPoints[1],
          dataIndex: prevPoints[1].dataIndex + dxFromMid,
          value: prevPoints[1].value + dyFromMid,
          timestamp: undefined
        }
      }
    }

    // seg_cp0, seg_cp1: standard behavior — no constraint needed
  }
}

export default segment
