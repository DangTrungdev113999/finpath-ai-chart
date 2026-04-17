/**
 * Forecast overlay utility functions
 *  - Status evaluation (computed-on-render)
 *  - Bezier math (control point, sampling, hitbox tube)
 *  - Formatters (ISO date, Vietnamese pill date, signed number, precision)
 *  - Color alpha helper
 *  - Timestamp -> bar-index resolver
 */

import type Coordinate from '../../../common/Coordinate'
import type Point from '../../../common/Point'
import type { KLineData } from '../../../common/Data'

import { BEZIER_ARC_CAP, BEZIER_ARC_FACTOR } from './constants'

// ==========================================================================
// Status evaluation
// ==========================================================================

/**
 * Evaluate forecast outcome. Looks at bars in the interval (P1, P2] (exclusive P1,
 * inclusive P2) and returns 'success' if the target price is reached by either
 * a high (bullish case) or low (bearish case).
 *
 * Always resolves points by TIMESTAMP — dataIndex is unstable across reload.
 */
export function evaluateStatus (
  dataList: KLineData[],
  p1: Partial<Point>,
  p2: Partial<Point>
): 'success' | 'failure' {
  if (p1.timestamp == null || p2.timestamp == null) return 'failure'
  if (p1.value == null || p2.value == null) return 'failure'

  const i1 = dataList.findIndex(d => d.timestamp === p1.timestamp)
  const i2 = dataList.findIndex(d => d.timestamp === p2.timestamp)
  if (i1 < 0 || i2 < 0) return 'failure'

  const [lo, hi] = i1 <= i2 ? [i1, i2] : [i2, i1]
  const start = lo + 1
  const end = hi
  if (start > end) return 'success' // no bars in window
  if (p2.value === p1.value) return 'success' // equal — trivially reached

  const bullish = p2.value > p1.value
  for (let i = start; i <= end; i++) {
    const bar = dataList[i]
    if (bullish && bar.high >= p2.value) return 'success'
    if (!bullish && bar.low <= p2.value) return 'success'
  }
  return 'failure'
}

/**
 * Resolve a klinedata index from a timestamp. Returns -1 when not found.
 */
export function resolveBarIndex (dataList: KLineData[], timestamp: number | undefined): number {
  if (timestamp == null) return -1
  return dataList.findIndex(d => d.timestamp === timestamp)
}

// ==========================================================================
// Bezier math (pixel space)
// ==========================================================================

/**
 * Compute a single quadratic Bezier control point perpendicular to the P1-P2 chord.
 *
 * Arc height = min(chordLen * 0.3, 120). Direction is chosen so bullish curves
 * bow UP (toward smaller canvas-Y) and bearish curves bow DOWN.
 */
export function computeBezierControlPoint (c1: Coordinate, c2: Coordinate): Coordinate {
  const mx = (c1.x + c2.x) / 2
  const my = (c1.y + c2.y) / 2
  const dx = c2.x - c1.x
  const dy = c2.y - c1.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: mx, y: my }

  // Perpendicular unit vector (rotate 90 deg CCW)
  const px = -dy / len
  const py = dx / len

  const arc = Math.min(len * BEZIER_ARC_FACTOR, BEZIER_ARC_CAP)
  // When dy < 0 (P2 above P1, i.e., bullish), bow upward (toward smaller canvas-Y).
  const sign = dy < 0 ? 1 : -1

  return {
    x: mx + px * arc * sign,
    y: my + py * arc * sign
  }
}

/**
 * Point on a quadratic Bezier at parameter t in [0, 1].
 */
export function quadBezierPoint (c1: Coordinate, cp: Coordinate, c2: Coordinate, t: number): Coordinate {
  const mt = 1 - t
  return {
    x: mt * mt * c1.x + 2 * mt * t * cp.x + t * t * c2.x,
    y: mt * mt * c1.y + 2 * mt * t * cp.y + t * t * c2.y
  }
}

/**
 * Tangent (derivative) on a quadratic Bezier at parameter t.
 */
export function quadBezierTangent (c1: Coordinate, cp: Coordinate, c2: Coordinate, t: number): Coordinate {
  return {
    x: 2 * (1 - t) * (cp.x - c1.x) + 2 * t * (c2.x - cp.x),
    y: 2 * (1 - t) * (cp.y - c1.y) + 2 * t * (c2.y - cp.y)
  }
}

/**
 * Sample a quadratic Bezier at `samples + 1` equally spaced points.
 */
export function sampleBezier (
  c1: Coordinate, cp: Coordinate, c2: Coordinate, samples: number
): Coordinate[] {
  const out: Coordinate[] = []
  for (let i = 0; i <= samples; i++) {
    out.push(quadBezierPoint(c1, cp, c2, i / samples))
  }
  return out
}

/**
 * Build a closed polygon "tube" around the curve for hit-testing.
 * Offsets each sample by ±halfWidth along the curve normal, walks one side
 * forward and the other side back to form a closed ring.
 */
export function buildCurveHitbox (
  c1: Coordinate,
  cp: Coordinate,
  c2: Coordinate,
  halfWidth: number,
  samples: number
): Coordinate[] {
  const upper: Coordinate[] = []
  const lower: Coordinate[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = quadBezierPoint(c1, cp, c2, t)
    const tan = quadBezierTangent(c1, cp, c2, t)
    const rawLen = Math.hypot(tan.x, tan.y)
    const len = rawLen === 0 ? 1 : rawLen
    const nx = -tan.y / len
    const ny = tan.x / len
    upper.push({ x: pt.x + nx * halfWidth, y: pt.y + ny * halfWidth })
    lower.unshift({ x: pt.x - nx * halfWidth, y: pt.y - ny * halfWidth })
  }
  return [...upper, ...lower]
}

// ==========================================================================
// Formatters
// ==========================================================================

/**
 * Convert #rrggbb + opacity (0..1) to a canvas-friendly rgba() string.
 * If the input already looks like rgba(), it is returned unchanged.
 * If alpha is 1 the original hex is returned (canvas accepts it directly).
 */
export function alpha (hex: string, a: number): string {
  const clamp = Math.max(0, Math.min(1, a))
  if (hex.startsWith('rgba') || hex.startsWith('rgb(')) return hex
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (m == null) return hex
  if (clamp >= 1) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${clamp})`
}

/**
 * Format a timestamp as YYYY-MM-DD (used inside pill body text).
 */
export function formatISO (timestamp: number | undefined): string {
  if (timestamp == null) return ''
  const d = new Date(timestamp)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const VI_MONTHS: string[] = [
  'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư',
  'Tháng Năm', 'Tháng Sáu', 'Tháng Bảy', 'Tháng Tám',
  'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai'
]

/**
 * Format a timestamp for X-axis date pills: "DD Tháng {VI-monthName} 'YY".
 */
export function formatViDatePill (timestamp: number | undefined): string {
  if (timestamp == null) return ''
  const d = new Date(timestamp)
  const day = d.getDate()
  const month = VI_MONTHS[d.getMonth()] ?? ''
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  return `${day} ${month} '${yy}`
}

/**
 * Format a number with a fixed precision. Preserves negative sign.
 */
export function formatPrecision (value: number, precision: number): string {
  if (!isFinite(value)) return '-'
  return value.toFixed(precision)
}

/**
 * Prepend '+' for non-negative numbers.
 */
export function signedPrecision (value: number, precision: number): string {
  const s = formatPrecision(value, precision)
  return value >= 0 ? `+${s}` : s
}
