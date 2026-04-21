/**
 * Regression Trend math utilities.
 *
 *  - linearRegression(prices)   — least-squares slope/intercept
 *  - regressionStdDev(prices)   — RMS of residuals
 *  - pearsonsR(prices)          — correlation coefficient
 *  - getPriceFromSource(bar, s) — OHLC source picker
 *  - alphaRgba(color, a)        — hex/rgba → rgba() with new alpha
 *  - extendToRight(p1, p2, b)   — intersect line p1-p2 with right edge of `b`
 *  - isLightColor(hex)          — luminance test for theme-aware CP fill
 */

import type Coordinate from '../../../common/Coordinate'
import type Bounding from '../../../common/Bounding'
import type { KLineData } from '../../../common/Data'
import type { RegressionSource } from './types'

// ═══════════════════════════════════════
// Linear regression (least squares)
// ═══════════════════════════════════════

/**
 * Fit y = slope * x + intercept over prices[] with x = 0..n-1.
 * Returns {0, mean} when n < 2 or denominator is 0.
 */
export function linearRegression (prices: number[]): { slope: number, intercept: number } {
  const n = prices.length
  if (n === 0) return { slope: 0, intercept: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    const y = prices[i]
    sumX += i
    sumY += y
    sumXY += i * y
    sumX2 += i * i
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) {
    return { slope: 0, intercept: sumY / n }
  }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/**
 * Standard deviation of the residuals against the fitted line.
 * Returns 0 for empty / flat inputs.
 */
export function regressionStdDev (prices: number[], slope: number, intercept: number): number {
  const n = prices.length
  if (n === 0) return 0

  let sum2 = 0
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept
    const residual = prices[i] - predicted
    sum2 += residual * residual
  }
  return Math.sqrt(sum2 / n)
}

/**
 * Pearson correlation coefficient of prices[] vs x = 0..n-1.
 * Returns 0 when variance is 0 or n < 2.
 */
export function pearsonsR (prices: number[]): number {
  const n = prices.length
  if (n < 2) return 0

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0
  for (let i = 0; i < n; i++) {
    const y = prices[i]
    sumX += i
    sumY += y
    sumXY += i * y
    sumX2 += i * i
    sumY2 += y * y
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denominator === 0) return 0
  return numerator / denominator
}

// ═══════════════════════════════════════
// Source picker
// ═══════════════════════════════════════

type OhlcBar = Partial<Pick<KLineData, 'open' | 'high' | 'low' | 'close'>>

/**
 * Extract the configured price field from a bar. Defaults to close on unknown.
 */
export function getPriceFromSource (item: OhlcBar | undefined, source: RegressionSource): number {
  if (item == null) return 0
  const o = item.open ?? 0
  const h = item.high ?? 0
  const l = item.low ?? 0
  const c = item.close ?? 0

  switch (source) {
    case 'open': return o
    case 'high': return h
    case 'low': return l
    case 'hl2': return (h + l) / 2
    case 'hlc3': return (h + l + c) / 3
    case 'ohlc4': return (o + h + l + c) / 4
    case 'close': return c
  }
}

// ═══════════════════════════════════════
// Color helpers
// ═══════════════════════════════════════

/**
 * Convert any supported color notation + alpha into an rgba() string.
 *
 *  - '#RRGGBB' + alpha → 'rgba(r,g,b,a)'
 *  - '#RGB'    + alpha → 'rgba(r,g,b,a)'  (short hex)
 *  - 'rgb(r,g,b)' / 'rgba(r,g,b,_)' + alpha → 'rgba(r,g,b,a)'  (alpha replaced)
 *  - Unrecognised input → original string returned unchanged
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

  // #RGB → expand
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

// ═══════════════════════════════════════
// Geometry
// ═══════════════════════════════════════

/**
 * Extend the line p1→p2 to the RIGHT edge of `bounding`.
 * Returns p2 unchanged when the segment cannot be extended (vertical or
 * already past the edge).
 */
export function extendToRight (
  p1: Coordinate,
  p2: Coordinate,
  bounding: Bounding
): Coordinate {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  if (dx === 0) return p2 // vertical — nothing to extend rightward
  if (p2.x >= bounding.width) return p2

  const t = (bounding.width - p1.x) / dx
  return {
    x: bounding.width,
    y: p1.y + t * dy
  }
}
