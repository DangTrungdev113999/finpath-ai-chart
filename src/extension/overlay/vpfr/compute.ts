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

import type { VPFRProfile, VPFRRow } from './types'

/**
 * Compute volume profile for a fixed range of bars.
 * Adapted from VPVR computeVPVRProfile with identical overlap-proportional algorithm.
 */
export function computeVPFRProfile (
  dataList: KLineData[],
  startIdx: number,
  endIdx: number,
  numRows: number,
  vaPercent: number
): VPFRProfile {
  const from = Math.min(startIdx, endIdx)
  const to = Math.max(startIdx, endIdx)
  const bars = dataList.slice(from, to + 1)

  if (bars.length === 0) {
    return {
      rows: [],
      pocIndex: 0,
      vahIndex: 0,
      valIndex: 0,
      profileHigh: 0,
      profileLow: 0,
      maxRowVolume: 0,
      totalVolume: 0
    }
  }

  // Find price range
  let profileHigh = -Infinity
  let profileLow = Infinity
  for (const bar of bars) {
    if (bar.high > profileHigh) profileHigh = bar.high
    if (bar.low < profileLow) profileLow = bar.low
  }
  if (profileHigh === profileLow) profileHigh += 0.01

  // Calculate row count
  const rowCount = Math.max(1, Math.min(numRows, 1000))
  const rowHeight = (profileHigh - profileLow) / rowCount

  // Initialize rows
  const rows: VPFRRow[] = Array.from({ length: rowCount }, (_, i) => ({
    priceLow: profileLow + rowHeight * i,
    priceHigh: profileLow + rowHeight * (i + 1),
    upVolume: 0,
    downVolume: 0,
    totalVolume: 0
  }))

  // Distribute volume using overlap-proportional method
  for (const bar of bars) {
    const vol = bar.volume ?? 0
    if (vol === 0) continue
    const barRange = bar.high - bar.low

    if (barRange === 0) {
      // Doji: 50/50 split to containing row
      const idx = Math.max(0, Math.min(Math.floor((bar.close - profileLow) / rowHeight), rowCount - 1))
      rows[idx].upVolume += vol * 0.5
      rows[idx].downVolume += vol * 0.5
      rows[idx].totalVolume += vol
      continue
    }

    // Buy/sell split: upVolume = vol * (close-low)/(high-low)
    const buyRatio = (bar.close - bar.low) / barRange
    const barUpVol = vol * buyRatio
    const barDownVol = vol * (1 - buyRatio)

    for (let i = 0; i < rowCount; i++) {
      const overlap = Math.max(0, Math.min(bar.high, rows[i].priceHigh) - Math.max(bar.low, rows[i].priceLow))
      if (overlap <= 0) continue
      const proportion = overlap / barRange
      rows[i].upVolume += barUpVol * proportion
      rows[i].downVolume += barDownVol * proportion
    }
  }

  // Compute totalVolume per row and find POC
  let totalVolume = 0
  let maxRowVolume = 0
  let pocIndex = 0
  const midPrice = (profileHigh + profileLow) / 2

  for (let i = 0; i < rowCount; i++) {
    rows[i].totalVolume = rows[i].upVolume + rows[i].downVolume
    totalVolume += rows[i].totalVolume

    // POC: highest totalVolume, tie-break: closer to mid-range
    const rowMid = (rows[i].priceLow + rows[i].priceHigh) / 2
    if (rows[i].totalVolume > maxRowVolume ||
        (rows[i].totalVolume === maxRowVolume && maxRowVolume > 0 &&
         Math.abs(rowMid - midPrice) < Math.abs((rows[pocIndex].priceLow + rows[pocIndex].priceHigh) / 2 - midPrice))) {
      maxRowVolume = rows[i].totalVolume
      pocIndex = i
    }
  }

  // Value Area: bilateral expansion from POC
  const targetVol = totalVolume * (vaPercent / 100)
  let accVol = rows[pocIndex].totalVolume
  let vahIndex = pocIndex
  let valIndex = pocIndex
  let up = pocIndex + 1
  let dn = pocIndex - 1

  while (accVol < targetVol) {
    const volUp = up < rowCount ? rows[up].totalVolume : 0
    const volDn = dn >= 0 ? rows[dn].totalVolume : 0
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
    profileHigh,
    profileLow,
    maxRowVolume,
    totalVolume
  }
}

/**
 * Compute developing POC/VAH/VAL lines across the range.
 * Returns arrays of {dataIndex, price} for stepped line rendering.
 */
export function computeDevelopingLines (
  dataList: KLineData[],
  startIdx: number,
  endIdx: number,
  numRows: number,
  vaPercent: number
): { poc: Array<{ idx: number, price: number }>, vah: Array<{ idx: number, price: number }>, val: Array<{ idx: number, price: number }> } {
  const from = Math.min(startIdx, endIdx)
  const to = Math.max(startIdx, endIdx)

  const poc: Array<{ idx: number, price: number }> = []
  const vah: Array<{ idx: number, price: number }> = []
  const val: Array<{ idx: number, price: number }> = []

  // Compute partial profiles incrementally
  for (let i = from + 1; i <= to; i++) {
    const profile = computeVPFRProfile(dataList, from, i, numRows, vaPercent)
    if (profile.rows.length === 0) continue

    const pocRow = profile.rows[profile.pocIndex]
    const vahRow = profile.rows[profile.vahIndex]
    const valRow = profile.rows[profile.valIndex]

    poc.push({ idx: i, price: (pocRow.priceLow + pocRow.priceHigh) / 2 })
    vah.push({ idx: i, price: vahRow.priceHigh })
    val.push({ idx: i, price: valRow.priceLow })
  }

  return {
    poc,
    vah,
    val
  }
}
