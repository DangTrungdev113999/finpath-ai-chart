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

import type { VPFRProfile, VPFRRow, VPFRExtendData } from './types'

/**
 * Compute VPFR profile from fixed bar range.
 * Algorithm is identical to VPVR — price binning, overlap-proportional volume
 * distribution, POC (highest-volume row), Value Area (bilateral expansion).
 */
export function computeVPFRProfile (
  dataList: KLineData[],
  fromIdx: number,
  toIdx: number,
  settings: VPFRExtendData
): VPFRProfile | null {
  const from = Math.max(0, Math.min(fromIdx, toIdx))
  const to = Math.min(dataList.length - 1, Math.max(fromIdx, toIdx))

  if (from > to || dataList.length === 0) {
    return null
  }

  const rangeBars = dataList.slice(from, to + 1)
  if (rangeBars.length === 0) {
    return null
  }

  // Step 1: Determine price range
  let profileHigh = -Infinity
  let profileLow = Infinity
  for (const bar of rangeBars) {
    if (bar.high > profileHigh) profileHigh = bar.high
    if (bar.low < profileLow) profileLow = bar.low
  }
  if (profileHigh === profileLow) profileHigh += 0.01

  // Step 2: Create rows
  const rowCount = Math.max(1, Math.min(settings.rowSize, 1000))
  const rowHeight = (profileHigh - profileLow) / rowCount

  const rows: VPFRRow[] = Array.from({ length: rowCount }, (_, i) => ({
    low: profileLow + rowHeight * i,
    high: profileLow + rowHeight * (i + 1),
    mid: profileLow + rowHeight * (i + 0.5),
    buyVol: 0,
    sellVol: 0,
    totalVol: 0
  }))

  // Step 3: Distribute volume proportionally
  for (const bar of rangeBars) {
    const vol = bar.volume ?? 0
    if (vol === 0) continue
    const barRange = bar.high - bar.low

    if (barRange === 0) {
      // Doji: 50/50 split to containing row
      const idx = Math.min(Math.floor((bar.close - profileLow) / rowHeight), rowCount - 1)
      const safeIdx = Math.max(0, idx)
      rows[safeIdx].buyVol += vol * 0.5
      rows[safeIdx].sellVol += vol * 0.5
      rows[safeIdx].totalVol += vol
      continue
    }

    const buyRatio = (bar.close - bar.low) / barRange
    const barBuyVol = vol * buyRatio
    const barSellVol = vol * (1 - buyRatio)

    for (let i = 0; i < rowCount; i++) {
      const overlap = Math.max(0, Math.min(bar.high, rows[i].high) - Math.max(bar.low, rows[i].low))
      if (overlap <= 0) continue
      const proportion = overlap / barRange
      rows[i].buyVol += barBuyVol * proportion
      rows[i].sellVol += barSellVol * proportion
    }
  }

  // Step 4: Compute totalVol per row, find POC
  let totalVolume = 0
  let maxRowVolume = 0
  let pocIndex = 0
  const midPrice = (profileHigh + profileLow) / 2

  for (let i = 0; i < rowCount; i++) {
    rows[i].totalVol = rows[i].buyVol + rows[i].sellVol
    totalVolume += rows[i].totalVol

    // POC: highest totalVol, tie-break: closer to mid-range, then lower row
    if (rows[i].totalVol > maxRowVolume ||
        (rows[i].totalVol === maxRowVolume && maxRowVolume > 0 &&
         Math.abs(rows[i].mid - midPrice) < Math.abs(rows[pocIndex].mid - midPrice))) {
      maxRowVolume = rows[i].totalVol
      pocIndex = i
    }
  }

  // Step 5: Value Area — bilateral expansion from POC
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
    profileLow
  }
}
