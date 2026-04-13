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
import type { SRBData } from './types'

/**
 * Pine `ta.pivothigh(left, right)` — returns the HIGH of bar `i - right`
 * when it is the strict local maximum over the `left + right + 1` window,
 * otherwise `undefined`. The pivot is "confirmed" at bar `i` (right bars
 * after the actual pivot bar). Ties on either side disqualify (matches Pine).
 *
 * Copied verbatim from `fpTlb/compute.ts` — pure OHLC-based, identical
 * semantics needed here.
 */
function pivotHigh (
  dataList: KLineData[],
  i: number,
  left: number,
  right: number
): number | undefined {
  const mid = i - right
  if (mid < left || mid < 0 || i >= dataList.length) return undefined
  const pivotVal = dataList[mid].high
  for (let k = mid - left; k < mid; k++) {
    if (dataList[k].high >= pivotVal) return undefined
  }
  for (let k = mid + 1; k <= i; k++) {
    if (dataList[k].high >= pivotVal) return undefined
  }
  return pivotVal
}

function pivotLow (
  dataList: KLineData[],
  i: number,
  left: number,
  right: number
): number | undefined {
  const mid = i - right
  if (mid < left || mid < 0 || i >= dataList.length) return undefined
  const pivotVal = dataList[mid].low
  for (let k = mid - left; k < mid; k++) {
    if (dataList[k].low <= pivotVal) return undefined
  }
  for (let k = mid + 1; k <= i; k++) {
    if (dataList[k].low <= pivotVal) return undefined
  }
  return pivotVal
}

/**
 * Full per-bar computation of Finpath - Support and Resistance Levels with Breaks.
 *
 * Mirrors the LuxAlgo Pine implementation:
 *   highUsePivot = fixnan(pivothigh(leftBars, rightBars)[1])
 *   lowUsePivot  = fixnan(pivotlow(leftBars, rightBars)[1])
 *   short = ema(volume, 5)
 *   long  = ema(volume, 10)
 *   osc   = 100 * (short - long) / long
 *
 *   B (red)    = crossunder(close, lowUsePivot)  && !(open - close < high - open) && osc > volumeThresh
 *   B (green)  = crossover(close, highUsePivot)  && !(open - low > close - open)   && osc > volumeThresh
 *   Bull Wick  = crossover(close, highUsePivot)  &&  (open - low > close - open)
 *   Bear Wick  = crossunder(close, lowUsePivot)  &&  (open - close < high - open)
 *
 * We emit `undefined` for `resistance` / `support` at the FIRST bar where the
 * value differs from the previous bar (Pine `change() ? na`) so the downstream
 * line renderer produces the required single-bar visual gap.
 *
 * Backpaint is NOT applied here — it is a render-time shift of the x-index.
 */
export function computeSRB (
  dataList: KLineData[],
  leftBars: number,
  rightBars: number,
  volumeThresh: number
): SRBData[] {
  const len = dataList.length
  const out: SRBData[] = []
  if (len === 0) return out

  // ─── Volume EMA (Pine ta.ema with sma-warmup) ───────────────────────────
  // Pine `ta.ema(src, length)` initializes via SMA over the first `length`
  // bars (emit at bar `length - 1`), then transitions to EMA recurrence:
  //   ema[i] = α * src[i] + (1 - α) * ema[i-1]   where α = 2 / (length + 1)
  const SHORT_LEN = 5
  const LONG_LEN = 10
  const alphaShort = 2 / (SHORT_LEN + 1)
  const alphaLong = 2 / (LONG_LEN + 1)

  const emaShortBuf: number[] = new Array<number>(len).fill(0)
  const emaLongBuf: number[] = new Array<number>(len).fill(0)
  const emaShortValid: boolean[] = new Array<boolean>(len).fill(false)
  const emaLongValid: boolean[] = new Array<boolean>(len).fill(false)

  {
    let sumShort = 0
    let sumLong = 0
    let emaShort = 0
    let emaLong = 0
    let emaShortInit = false
    let emaLongInit = false

    for (let i = 0; i < len; i++) {
      const v = dataList[i].volume ?? 0

      // Short EMA (length = 5)
      if (!emaShortInit) {
        sumShort += v
        if (i === SHORT_LEN - 1) {
          emaShort = sumShort / SHORT_LEN
          emaShortInit = true
          emaShortBuf[i] = emaShort
          emaShortValid[i] = true
        }
      } else {
        emaShort = alphaShort * v + (1 - alphaShort) * emaShort
        emaShortBuf[i] = emaShort
        emaShortValid[i] = true
      }

      // Long EMA (length = 10)
      if (!emaLongInit) {
        sumLong += v
        if (i === LONG_LEN - 1) {
          emaLong = sumLong / LONG_LEN
          emaLongInit = true
          emaLongBuf[i] = emaLong
          emaLongValid[i] = true
        }
      } else {
        emaLong = alphaLong * v + (1 - alphaLong) * emaLong
        emaLongBuf[i] = emaLong
        emaLongValid[i] = true
      }
    }
  }

  // ─── Per-bar state machine ──────────────────────────────────────────────
  // `prevResistance` / `prevSupport` carry the LAST EMITTED level value
  // (post fixnan). Pine's `[1]` shift is implicit because we use
  // `prevResistance` (yesterday's level) for the crossover comparison —
  // matching `crossover(close, highUsePivot)` where `highUsePivot` carries
  // over via `fixnan` from the prior bar.
  // eslint-disable-next-line @typescript-eslint/init-declarations -- populated at first pivot
  let prevResistance: number | undefined
  // eslint-disable-next-line @typescript-eslint/init-declarations -- populated at first pivot
  let prevSupport: number | undefined

  for (let i = 0; i < len; i++) {
    const d = dataList[i]

    const ph = pivotHigh(dataList, i, leftBars, rightBars)
    const pl = pivotLow(dataList, i, leftBars, rightBars)

    // fixnan — hold previous level when no new pivot confirms.
    const currR = ph ?? prevResistance
    const currS = pl ?? prevSupport

    // Pine `change(x) ? na : x` — emit `undefined` on the FIRST bar where
    // the value differs from the previous bar's value (creates the 1-bar
    // visual gap at pivot transitions).
    // Before the very first pivot confirms, both `prevResistance` and
    // `currR` are `undefined` → emit `undefined` naturally.
    const emitR: number | undefined = (
      prevResistance !== undefined &&
      currR !== undefined &&
      currR === prevResistance
    )
      ? currR
      : undefined
    const emitS: number | undefined = (
      prevSupport !== undefined &&
      currS !== undefined &&
      currS === prevSupport
    )
      ? currS
      : undefined

    // Volume oscillator. Both EMAs must be initialized; guard division.
    let volOsc = 0
    let volOscValid = false
    if (emaShortValid[i] && emaLongValid[i] && emaLongBuf[i] > 0) {
      volOsc = 100 * (emaShortBuf[i] - emaLongBuf[i]) / emaLongBuf[i]
      volOscValid = true
    }

    // Crossovers — compare yesterday's close vs PREVIOUS level (not current)
    // to match Pine `crossover(close, highUsePivot)` where `highUsePivot`
    // already carries the prior bar's value via fixnan.
    let crossOverR = false
    let crossUnderS = false
    if (i > 0 && prevResistance !== undefined) {
      const prevClose = dataList[i - 1].close
      crossOverR = prevClose <= prevResistance && d.close > prevResistance
    }
    if (i > 0 && prevSupport !== undefined) {
      const prevClose = dataList[i - 1].close
      crossUnderS = prevClose >= prevSupport && d.close < prevSupport
    }

    // Wick-body conditions — implemented EXACTLY as Pine. Do NOT simplify
    // — these are NOT logical negations of one another.
    const bullWickBody = (d.open - d.low) > (d.close - d.open)
    const bearWickBody = (d.open - d.close) < (d.high - d.open)

    // 4 break events
    const bUp = crossOverR && !bullWickBody && volOscValid && volOsc > volumeThresh
    const bDown = crossUnderS && !bearWickBody && volOscValid && volOsc > volumeThresh
    const bullWick = crossOverR && bullWickBody
    const bearWick = crossUnderS && bearWickBody

    out.push({
      resistance: emitR,
      support: emitS,
      bUp,
      bDown,
      bullWick,
      bearWick,
      high: d.high,
      low: d.low
    })

    prevResistance = currR
    prevSupport = currS
  }

  return out
}
