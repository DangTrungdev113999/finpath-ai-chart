/**
 * Long Position overlay — calculations and label formatting
 */

import type { PositionStats, LongPositionExtendData } from './types'

/**
 * Compute all trade stats from entry, target, and stop prices.
 */
export function calculatePositionStats (
  entryPrice: number,
  targetPrice: number,
  stopPrice: number,
  tickSize: number,
  barCount: number,
  settings: LongPositionExtendData
): PositionStats {
  const tpPriceDiff = Math.abs(targetPrice - entryPrice)
  const slPriceDiff = Math.abs(entryPrice - stopPrice)

  const tpPercent = entryPrice !== 0 ? (tpPriceDiff / entryPrice) * 100 : 0
  const slPercent = entryPrice !== 0 ? (slPriceDiff / entryPrice) * 100 : 0

  const safeTick = tickSize > 0 ? tickSize : 0.01
  const tpTicks = Math.round(tpPriceDiff / safeTick)
  const slTicks = Math.round(slPriceDiff / safeTick)

  const riskRewardRatio = slPriceDiff !== 0 ? tpPriceDiff / slPriceDiff : 0

  const riskAmount = settings.riskType === 'percent'
    ? settings.accountSize * (settings.riskValue / 100)
    : settings.riskValue

  return {
    tpPriceDiff,
    tpPercent,
    tpTicks,
    slPriceDiff,
    slPercent,
    slTicks,
    riskRewardRatio,
    barCount,
    riskAmount
  }
}

/**
 * Format the profit (top) label text.
 * Full: "Muc hieu: 1234.5 (12.34%) | 5 Mm: 123"
 * Compact: "1234.5 (12.34%)"
 */
export function formatProfitLabel (stats: PositionStats, precision: number, compact: boolean): string {
  const priceDiff = stats.tpPriceDiff.toFixed(precision)
  const pct = stats.tpPercent.toFixed(2)
  if (compact) {
    return `${priceDiff} (${pct}%)`
  }
  return `Muc hieu: ${priceDiff} (${pct}%) | ${stats.barCount} Mm: ${stats.tpTicks}`
}

/**
 * Format the risk/reward (middle) label text.
 * Full: "Muc tieu & Thuc: 0 — 1234 | Ti le loi nhuan: 2.50"
 * Compact: "R:R 2.50"
 */
export function formatRiskRewardLabel (stats: PositionStats, compact: boolean): string {
  const rr = stats.riskRewardRatio.toFixed(2)
  if (compact) {
    return `R:R ${rr}`
  }
  const riskStr = stats.riskAmount.toFixed(0)
  return `Muc tieu & Thuc: 0 \u2014 ${riskStr} | Ti le loi nhuan: ${rr}`
}

/**
 * Format the stop (bottom) label text.
 * Full: "Dung: 1234.5 (12.34%) | 5 Mm: 123"
 * Compact: "1234.5 (12.34%)"
 */
export function formatStopLabel (stats: PositionStats, precision: number, compact: boolean): string {
  const priceDiff = stats.slPriceDiff.toFixed(precision)
  const pct = stats.slPercent.toFixed(2)
  if (compact) {
    return `${priceDiff} (${pct}%)`
  }
  return `Dung: ${priceDiff} (${pct}%) | ${stats.barCount} Mm: ${stats.slTicks}`
}
