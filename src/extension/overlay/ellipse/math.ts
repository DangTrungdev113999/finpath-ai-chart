/**
 * Ellipse math utilities.
 *
 *  - sampleEllipsePolygon(cx, cy, a, b, N)  — N-point ellipse perimeter
 *  - isEllipseVisibleAtPeriod(ext, period)  — TF-band visibility gate
 *  - resolveBarIndex(dataList, ts, fb)      — timestamp-first bar lookup
 *  - alphaRgba(color, alpha)                — hex/rgba to rgba() with new alpha
 *  - isLightColor(hex)                      — luminance test for theme-aware CP fill
 */

import type Coordinate from '../../../common/Coordinate'
import type { Period } from '../../../common/Period'
import type Nullable from '../../../common/Nullable'
import { isNumber } from '../../../common/utils/typeChecks'

import type { EllipseExtendData } from './types'
import { PERIOD_VIS_KEY } from './constants'

// ═══════════════════════════════════════
// Ellipse perimeter sampling
// ═══════════════════════════════════════

/**
 * Sample N points on the perimeter of the axis-aligned ellipse centered
 * at (cx, cy) with semi-axes (a, b). Returns points in CCW order.
 *
 * N = 64 produces a visually smooth curve at typical chart sizes. The
 * polygon is used for both drawing and point-in-polygon hit testing.
 */
export function sampleEllipsePolygon (
  cx: number,
  cy: number,
  a: number,
  b: number,
  N = 64
): Coordinate[] {
  const pts: Coordinate[] = []
  const steps = Math.max(3, Math.floor(N))
  for (let i = 0; i < steps; i++) {
    const theta = (2 * Math.PI * i) / steps
    pts.push({
      x: cx + a * Math.cos(theta),
      y: cy + b * Math.sin(theta)
    })
  }
  return pts
}

// ═══════════════════════════════════════
// Visibility gate
// ═══════════════════════════════════════

/**
 * Returns `false` when the ellipse should be hidden at the current
 * period (band disabled, or span outside [min, max]).
 *
 * Fails OPEN — when period is null, unknown type, or range missing,
 * the ellipse renders. We never hide due to transient state.
 */
export function isEllipseVisibleAtPeriod (
  ext: Required<EllipseExtendData>,
  period: Nullable<Period>
): boolean {
  if (period == null) return true
  const key = PERIOD_VIS_KEY[period.type]
  const range = ext[key]
  if (!range.enabled) return false
  const span = period.span
  if (!isNumber(span)) return true
  return span >= range.min && span <= range.max
}

// ═══════════════════════════════════════
// Bar lookup (robust against lazy-loaded scroll)
// ═══════════════════════════════════════

/**
 * Find the current bar index for a stored point.
 *
 * KLineChart's `point.dataIndex` can drift when historical data is
 * lazy-loaded on scroll. `point.timestamp` is the stable identifier.
 * Look up by timestamp first; fall back to the stored dataIndex when the
 * timestamp is missing or the bar is no longer present in the data list.
 *
 * Included for parity with regressionTrend. Not currently used by the
 * ellipse overlay (geometry is driven by pre-projected coordinates) but
 * kept available for future per-bar features.
 */
export function resolveBarIndex (
  dataList: ReadonlyArray<{ timestamp: number }>,
  timestamp: number | undefined,
  fallback: number | undefined
): number {
  if (timestamp != null) {
    const i = dataList.findIndex(d => d.timestamp === timestamp)
    if (i !== -1) return i
  }
  return isNumber(fallback) ? fallback : -1
}

// ═══════════════════════════════════════
// Color helpers
// ═══════════════════════════════════════

/**
 * Convert any supported color notation + alpha into an rgba() string.
 *
 *  - '#RRGGBB' + alpha to 'rgba(r,g,b,a)'
 *  - '#RGB'    + alpha to 'rgba(r,g,b,a)'  (short hex)
 *  - 'rgb(r,g,b)' / 'rgba(r,g,b,_)' + alpha to 'rgba(r,g,b,a)'  (alpha replaced)
 *  - Unrecognised input returns the original string unchanged
 */
export function alphaRgba (color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))

  // #RRGGBB
  const long = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color)
  if (long != null) {
    const r = parseInt(long[1], 16)
    const g = parseInt(long[2], 16)
    const b = parseInt(long[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // #RGB — expand
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color)
  if (short != null) {
    const r = parseInt(short[1] + short[1], 16)
    const g = parseInt(short[2] + short[2], 16)
    const b = parseInt(short[3] + short[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // rgb(r,g,b) or rgba(r,g,b,_)
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color)
  if (rgb != null) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`
  }

  return color
}

/**
 * Perceived-luminance test used to pick CP fill (dark vs light theme).
 * Falls back to false for non-hex colors.
 */
export function isLightColor (color: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(color)
  if (m == null) return false
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}
