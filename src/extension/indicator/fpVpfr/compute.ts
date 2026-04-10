/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { KLineData } from '../../../common/Data'

import type { FPVPFRProfile, FPVPFRRow, FPVPFRSettings } from './types'

/**
 * Geometric overlap between two ranges [y1Low..y1High] and [y2Low..y2High].
 * Matches Pine Script `get_vol` overlap formula.
 */
function getOverlap (y1Low: number, y1High: number, y2Low: number, y2High: number): number {
  return Math.max(
    0,
    Math.min(Math.max(y1Low, y1High), Math.max(y2Low, y2High)) -
    Math.max(Math.min(y1Low, y1High), Math.min(y2Low, y2High))
  )
}

/**
 * Compute the Volume Profile Fixed Range profile using 2x wick-weighted
 * volume distribution per Pine Script formula.
 */
export function computeFPVPFRProfile (
  dataList: KLineData[],
  fromIdx: number,
  toIdx: number,
  settings: FPVPFRSettings
): FPVPFRProfile | null {
  if (fromIdx >= toIdx || fromIdx < 0 || toIdx >= dataList.length) {
    return null
  }

  // Find price range over the lookback
  let profileHigh = -Infinity
  let profileLow = Infinity
  for (let i = fromIdx; i <= toIdx; i++) {
    const bar = dataList[i]
    if (bar.high > profileHigh) profileHigh = bar.high
    if (bar.low < profileLow) profileLow = bar.low
  }
  if (profileHigh === profileLow) profileHigh += 0.01

  // Build price level rows
  const rowCount = Math.max(1, Math.min(settings.rowSize, 1000))
  const step = (profileHigh - profileLow) / rowCount

  const rows: FPVPFRRow[] = Array.from({ length: rowCount }, (_, i) => ({
    low: profileLow + step * i,
    high: profileLow + step * (i + 1),
    mid: profileLow + step * (i + 0.5),
    buyVol: 0,
    sellVol: 0,
    totalVol: 0
  }))

  // 2x wick-weighted volume distribution
  for (let bi = fromIdx; bi <= toIdx; bi++) {
    const bar = dataList[bi]
    const vol = bar.volume ?? 0
    if (vol === 0) continue

    const bodyTop = Math.max(bar.close, bar.open)
    const bodyBot = Math.min(bar.close, bar.open)
    const topWick = bar.high - bodyTop
    const bottomWick = bodyBot - bar.low
    const body = bodyTop - bodyBot

    const denominator = 2 * topWick + 2 * bottomWick + body
    if (denominator === 0) continue // Doji with no range — skip

    const bodyVol = body * vol / denominator
    const topWickVol = 2 * topWick * vol / denominator
    const bottomWickVol = 2 * bottomWick * vol / denominator

    const isGreen = bar.close >= bar.open

    for (let ri = 0; ri < rowCount; ri++) {
      const row = rows[ri]

      // Body overlap
      if (body > 0) {
        const bodyOverlap = getOverlap(row.low, row.high, bodyBot, bodyTop)
        if (bodyOverlap > 0) {
          const bodyProportion = bodyOverlap / body
          if (isGreen) {
            row.buyVol += bodyVol * bodyProportion
          } else {
            row.sellVol += bodyVol * bodyProportion
          }
        }
      }

      // Top wick overlap — split 50/50 buy/sell
      if (topWick > 0) {
        const topWickOverlap = getOverlap(row.low, row.high, bodyTop, bar.high)
        if (topWickOverlap > 0) {
          const wickProportion = topWickOverlap / topWick
          const halfVol = topWickVol * wickProportion / 2
          row.buyVol += halfVol
          row.sellVol += halfVol
        }
      }

      // Bottom wick overlap — split 50/50 buy/sell
      if (bottomWick > 0) {
        const bottomWickOverlap = getOverlap(row.low, row.high, bar.low, bodyBot)
        if (bottomWickOverlap > 0) {
          const wickProportion = bottomWickOverlap / bottomWick
          const halfVol = bottomWickVol * wickProportion / 2
          row.buyVol += halfVol
          row.sellVol += halfVol
        }
      }
    }
  }

  // Compute totalVol per row, find POC (max volume row)
  let totalVolume = 0
  let maxRowVolume = 0
  let pocIndex = 0
  const midPrice = (profileHigh + profileLow) / 2

  for (let i = 0; i < rowCount; i++) {
    rows[i].totalVol = rows[i].buyVol + rows[i].sellVol
    totalVolume += rows[i].totalVol

    // POC: highest totalVol, tie-break: closer to mid-range
    if (rows[i].totalVol > maxRowVolume ||
        (rows[i].totalVol === maxRowVolume && maxRowVolume > 0 &&
         Math.abs(rows[i].mid - midPrice) < Math.abs(rows[pocIndex].mid - midPrice))) {
      maxRowVolume = rows[i].totalVol
      pocIndex = i
    }
  }

  // Value Area: bilateral expansion from POC
  const targetVol = totalVolume * (settings.valueAreaPercent / 100)
  let accVol = rows[pocIndex].totalVol
  let vahIndex = pocIndex
  let valIndex = pocIndex
  let up = pocIndex + 1
  let dn = pocIndex - 1

  while (accVol < targetVol) {
    const volUp = up < rowCount ? rows[up].totalVol : 0
    const volDn = dn >= 0 ? rows[dn].totalVol : 0
    if (volUp === 0 && volDn === 0) break
    if (volUp >= volDn && up < rowCount) {
      accVol += volUp
      vahIndex = up
      up++
    } else if (dn >= 0) {
      accVol += volDn
      valIndex = dn
      dn--
    } else {
      break
    }
  }

  return {
    rows,
    pocIndex,
    vahIndex,
    valIndex,
    totalVolume,
    maxRowVolume,
    profileHigh,
    profileLow,
    fromIndex: fromIdx,
    toIndex: toIdx
  }
}
