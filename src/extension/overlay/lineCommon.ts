/**
 * Shared helpers and constants for line-family overlays.
 *
 * Used by:
 *   - segment (Duong Xu huong, reference)
 *   - rayLine (Tia)
 *   - straightLine (Duong Mo rong)
 *   - priceLine (Duong Gia)
 *   - horizontalStraightLine / horizontalRayLine / horizontalSegment
 *   - verticalStraightLine / verticalRayLine / verticalSegment
 *   - infoLine (surface-side Duong Thong tin)
 *   - trendAngle (surface-side Goc Xu huong)
 *   - crossLine (surface-side Duong giao nhau)
 */

import type Coordinate from '../../common/Coordinate'
import type { EventOverlayInfo } from '../../Store'

import { getLinearYFromCoordinates } from '../figure/line'

// ===========================================
// CHART STORE ACCESSOR (for selection/hover detection)
// ===========================================

export interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}

// ===========================================
// CONTROL POINT CONSTANTS
// ===========================================

export const CP_COLOR = '#1592E6'
export const CP_RADIUS = 5
export const CP_CIRCLE_BORDER = 1.5

// ===========================================
// ARROW CONSTANTS
// ===========================================

export const ARROW_LENGTH = 14
export const ARROW_WIDTH = 6

// ===========================================
// HELPERS
// ===========================================

/**
 * Luminance check for adaptive CP background (dark vs light theme).
 */
export function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

/**
 * Compute arrowhead polygon coordinates at `tip` pointing away from `from`.
 * Returns 3 points forming a closed triangle, or [] if from === tip.
 */
export function getArrowCoordinates (from: Coordinate, tip: Coordinate): Coordinate[] {
  const dx = tip.x - from.x
  const dy = tip.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return []

  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux

  const bx = tip.x - ux * ARROW_LENGTH
  const by = tip.y - uy * ARROW_LENGTH

  return [
    { x: tip.x, y: tip.y },
    { x: bx + px * ARROW_WIDTH, y: by + py * ARROW_WIDTH },
    { x: bx - px * ARROW_WIDTH, y: by - py * ARROW_WIDTH }
  ]
}

/**
 * Extend a line segment from c1 to c2 to bounding edges.
 * Handles both the vertical (c1.x === c2.x) and general cases.
 */
export function getExtendedCoordinates (
  c1: Coordinate, c2: Coordinate,
  boundingWidth: number, boundingHeight: number,
  extendLeft: boolean, extendRight: boolean
): [Coordinate, Coordinate] {
  let start: Coordinate = { x: c1.x, y: c1.y }
  let end: Coordinate = { x: c2.x, y: c2.y }

  const isVertical = c1.x === c2.x

  if (isVertical) {
    if (extendLeft) {
      start = c1.y <= c2.y
        ? { x: c1.x, y: 0 }
        : { x: c1.x, y: boundingHeight }
    }
    if (extendRight) {
      end = c1.y <= c2.y
        ? { x: c2.x, y: boundingHeight }
        : { x: c2.x, y: 0 }
    }
    return [start, end]
  }

  if (extendLeft) {
    const direction = c1.x < c2.x ? 0 : boundingWidth
    start = {
      x: direction,
      y: getLinearYFromCoordinates(c1, c2, { x: direction, y: c1.y })
    }
  }

  if (extendRight) {
    const direction = c1.x < c2.x ? boundingWidth : 0
    end = {
      x: direction,
      y: getLinearYFromCoordinates(c1, c2, { x: direction, y: c2.y })
    }
  }

  return [start, end]
}

/**
 * Format a number for display, trimming trailing zeros.
 */
export function formatNum (val: number, precision?: number): string {
  const p = precision ?? 2
  return val.toFixed(p).replace(/\.?0+$/, '')
}
