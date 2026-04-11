/**
 * Short Position utility functions — calculations and label formatting
 * Inverted from Long Position: profit when price drops
 */

import type { ShortPositionExtendData } from './constants'
import { formatPrecision } from '../../../common/utils/format'

// ═══════════════════════════════════════
// Stats calculation
// ═══════════════════════════════════════

export interface ShortPositionStats {
  tpDiff: number
  slDiff: number
  tpPct: number
  slPct: number
  rrRatio: number
  tpTicks: number
  slTicks: number
  qty: number
  amountTarget: number
  amountStop: number
  openPL: number // entryPrice - currentPrice (positive when price drops)
}

export function calculateStats (
  entryPrice: number,
  targetPrice: number,
  stopPrice: number,
  currentPrice: number,
  ext: ShortPositionExtendData
): ShortPositionStats {
  const tpDiff = entryPrice - targetPrice // TP below entry → positive
  const slDiff = stopPrice - entryPrice // SL above entry → positive
  const tpPct = entryPrice !== 0 ? (tpDiff / entryPrice) * 100 : 0
  const slPct = entryPrice !== 0 ? (slDiff / entryPrice) * 100 : 0
  const rrRatio = slDiff !== 0 ? Math.abs(tpDiff / slDiff) : 0

  const tpTicks = Math.round(tpDiff * ext.tickMultiplier)
  const slTicks = Math.round(slDiff * ext.tickMultiplier)

  const riskAmount = ext.riskDisplayMode === 'percents'
    ? ext.accountSize * (ext.risk / 100)
    : ext.risk
  const qty = slDiff !== 0 ? Math.floor(riskAmount / slDiff) : 0
  const amountTarget = ext.accountSize + tpDiff * qty
  const amountStop = ext.accountSize - slDiff * qty
  const openPL = entryPrice - currentPrice

  return { tpDiff, slDiff, tpPct, slPct, rrRatio, tpTicks, slTicks, qty, amountTarget, amountStop, openPL }
}

// ═══════════════════════════════════════
// Label text formatting
// ═══════════════════════════════════════

function fmtNum (value: number, precision: number): string {
  return formatPrecision(value, precision)
}

function fmtPct (value: number): string {
  return value.toFixed(2)
}

function fmtRatio (value: number): string {
  return value.toFixed(2)
}

export function formatTpLabel (stats: ShortPositionStats, compact: boolean, precision: number): string {
  if (compact) {
    return `${fmtNum(stats.tpDiff, precision)} (${fmtPct(stats.tpPct)}%) ${fmtNum(stats.amountTarget, precision)}`
  }
  return `M\u1EE5c ti\u00EAu: ${fmtNum(stats.tpDiff, precision)} (${fmtPct(stats.tpPct)}%) ${stats.tpTicks}, S\u1ED1 ti\u1EC1n: ${fmtNum(stats.amountTarget, precision)}`
}

export function formatEntryLabel (stats: ShortPositionStats, compact: boolean, precision: number, isClosed = false): string {
  const prefix = isClosed ? '\u0110\u00F3ng' : 'M\u1EDF'
  if (compact) {
    return `${fmtNum(stats.openPL, precision)} - ${stats.qty}`
  }
  return `${prefix} L\u1EE3i nhu\u1EADn & Thua l\u1ED7: ${fmtNum(stats.openPL, precision)}, S.Lg: ${stats.qty}`
}

export function formatEntryLabelLine2 (stats: ShortPositionStats, compact: boolean): string {
  if (compact) return ''
  return `T\u1EF7 l\u1EC7 R\u1EE7i ro/L\u1EE3i nhu\u1EADn: ${fmtRatio(stats.rrRatio)}`
}

export function formatSlLabel (stats: ShortPositionStats, compact: boolean, precision: number): string {
  if (compact) {
    return `${fmtNum(stats.slDiff, precision)} (${fmtPct(stats.slPct)}%) ${fmtNum(stats.amountStop, precision)}`
  }
  return `D\u1EEBng: ${fmtNum(stats.slDiff, precision)} (${fmtPct(stats.slPct)}%) ${stats.slTicks}, S\u1ED1 ti\u1EC1n: ${fmtNum(stats.amountStop, precision)}`
}
