/**
 * Forecast utility functions — outcome evaluation, stats, color alpha
 */

import type { KLineData } from '../../../common/Data'
import { formatPrecision } from '../../../common/utils/format'

import type { ForecastOutcome } from './constants'

// Stats

export interface ForecastStats {
  deltaPrice: number
  deltaPct: number
  barCount: number
  outcome: ForecastOutcome
}

export function calculateForecastStats (
  entryPrice: number,
  targetPrice: number,
  entryIndex: number,
  targetIndex: number,
  dataList: KLineData[]
): ForecastStats {
  const deltaPrice = targetPrice - entryPrice
  const deltaPct = entryPrice !== 0 ? (deltaPrice / entryPrice) * 100 : 0
  const barCount = Math.abs(targetIndex - entryIndex)
  const outcome = evaluateOutcome(entryPrice, targetPrice, entryIndex, targetIndex, dataList)
  return { deltaPrice, deltaPct, barCount, outcome }
}

// Outcome evaluation

export function evaluateOutcome (
  entryPrice: number,
  targetPrice: number,
  entryIndex: number,
  targetIndex: number,
  dataList: KLineData[]
): ForecastOutcome {
  const isBullish = targetPrice > entryPrice
  const startIdx = Math.max(0, Math.min(entryIndex, targetIndex))
  const endIdx = Math.min(dataList.length - 1, Math.max(entryIndex, targetIndex))
  const currentIdx = dataList.length - 1

  if (targetIndex > currentIdx) {
    const scanEnd = Math.min(currentIdx, endIdx)
    for (let i = startIdx; i <= scanEnd; i++) {
      const bar = dataList[i]
      if (isBullish && bar.high >= targetPrice) return 'success'
      if (!isBullish && bar.low <= targetPrice) return 'success'
    }
    return 'intermediate'
  }

  for (let i = startIdx; i <= endIdx; i++) {
    const bar = dataList[i]
    if (isBullish && bar.high >= targetPrice) return 'success'
    if (!isBullish && bar.low <= targetPrice) return 'success'
  }

  return 'failure'
}

// Label formatting

export function formatDeltaLabel (stats: ForecastStats, precision: number): string {
  const priceSign = stats.deltaPrice >= 0 ? '+' : ''
  const pctSign = stats.deltaPct >= 0 ? '+' : ''
  const priceStr = `${priceSign}${formatPrecision(stats.deltaPrice, precision)}`
  const pctStr = `${pctSign}${stats.deltaPct.toFixed(2)}%`
  return `${priceStr} (${pctStr}) trong ${stats.barCount}n`
}

export function formatEntryPrice (price: number, precision: number): string {
  return formatPrecision(price, precision)
}

export function formatEntryDate (timestamp: number | undefined): string {
  if (timestamp == null || !isFinite(timestamp)) return ''
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Color alpha — apply transparency (0=opaque, 100=invisible)

export function applyAlpha (hex: string, transparencyPct: number): string {
  const alpha = Math.max(0, Math.min(1, 1 - transparencyPct / 100))
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (match == null) return hex
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}
