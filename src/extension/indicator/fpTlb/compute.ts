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
import type { TLBCalcMethod, TLBData } from './types'

/**
 * Pine `ta.pivothigh(length, length)` — returns the HIGH of bar `i - right`
 * when it is the strict local maximum over the `left + right + 1` window,
 * otherwise `undefined`. The pivot is "confirmed" at bar `i` (right bars
 * after the actual pivot bar). Ties on either side disqualify (matches Pine).
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

/** True Range — used as building block for Pine ta.atr. */
function trueRange (d: KLineData, prev: KLineData | undefined): number {
  if (prev === undefined) return d.high - d.low
  return Math.max(
    d.high - d.low,
    Math.abs(d.high - prev.close),
    Math.abs(d.low - prev.close)
  )
}

/**
 * Per-bar slope magnitude. Returns 0 during warmup (i < length - 1).
 *
 * Pine formulae:
 *   'Atr'    => ta.atr(length) / length * mult
 *   'Stdev'  => ta.stdev(src, length) / length * mult
 *   'Linreg' => |sma(src*n, length) - sma(src, length) * sma(n, length)|
 *               / variance(n, length) / 2 * mult
 * where `n` is bar_index and `src` is close.
 */
function computeSlopeAt (
  dataList: KLineData[],
  i: number,
  length: number,
  mult: number,
  method: TLBCalcMethod,
  atrBuf: number[],
  stdevBuf: number[]
): number {
  if (i < length - 1) return 0
  switch (method) {
    case 'Atr':
      return (atrBuf[i] / length) * mult

    case 'Stdev':
      return (stdevBuf[i] / length) * mult

    case 'Linreg': {
      let sumSrcN = 0
      let sumSrc = 0
      let sumN = 0
      let sumN2 = 0
      for (let k = i - length + 1; k <= i; k++) {
        const c = dataList[k].close
        sumSrcN += c * k
        sumSrc += c
        sumN += k
        sumN2 += k * k
      }
      const smaSrcN = sumSrcN / length
      const smaSrc = sumSrc / length
      const smaN = sumN / length
      // Population variance (ta.variance defaults to biased=true in Pine).
      const varN = sumN2 / length - smaN * smaN
      if (varN === 0) return 0
      return (Math.abs(smaSrcN - smaSrc * smaN) / varN / 2) * mult
    }
  }
}

/**
 * Full per-bar computation of Finpath - Trendlines with Breaks.
 *
 * Mirrors the LuxAlgo Pine implementation:
 *   upper := ph ? ph : upper - slope_ph
 *   lower := pl ? pl : lower + slope_pl
 *   upos  := ph ? 0 : (close > upper - slope_ph * length ? 1 : upos)
 *   dnos  := pl ? 0 : (close < lower + slope_pl * length ? 1 : dnos)
 *
 * We emit `undefined` for `upper` / `lower` at pivot-confirm bars so the
 * downstream line renderer produces the required single-bar visual gap.
 *
 * Backpaint is NOT applied here — it is a render-time shift of the x-index.
 */
export function computeTLB (
  dataList: KLineData[],
  length: number,
  mult: number,
  calcMethod: TLBCalcMethod
): TLBData[] {
  const len = dataList.length
  const out: TLBData[] = []
  if (len === 0) return out

  // ─── Pre-compute ATR (Pine ta.atr = RMA of TR) ──────────────────────────
  const atrBuf: number[] = new Array<number>(len).fill(0)
  {
    let trSum = 0
    for (let i = 0; i < len; i++) {
      const tr = trueRange(dataList[i], i > 0 ? dataList[i - 1] : undefined)
      if (i < length) {
        trSum += tr
        if (i === length - 1) atrBuf[i] = trSum / length
      } else {
        // RMA (Wilder's): atr[i] = (atr[i-1] * (N-1) + tr[i]) / N
        atrBuf[i] = (atrBuf[i - 1] * (length - 1) + tr) / length
      }
    }
  }

  // ─── Pre-compute rolling population stdev of close ──────────────────────
  const stdevBuf: number[] = new Array<number>(len).fill(0)
  for (let i = length - 1; i < len; i++) {
    let mean = 0
    for (let k = i - length + 1; k <= i; k++) mean += dataList[k].close
    mean /= length
    let varSum = 0
    for (let k = i - length + 1; k <= i; k++) {
      const d = dataList[k].close - mean
      varSum += d * d
    }
    // Pine ta.stdev defaults to biased=true → divide by N, not N-1.
    stdevBuf[i] = Math.sqrt(varSum / length)
  }

  // ─── Per-bar state machine ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/init-declarations -- populated at first pivot
  let upperState: number | undefined
  // eslint-disable-next-line @typescript-eslint/init-declarations -- populated at first pivot
  let lowerState: number | undefined
  let slopePh = 0
  let slopePl = 0
  let upos = 0
  let dnos = 0
  let prevUpos = 0
  let prevDnos = 0

  for (let i = 0; i < len; i++) {
    const d = dataList[i]
    const slope = computeSlopeAt(dataList, i, length, mult, calcMethod, atrBuf, stdevBuf)

    const ph = pivotHigh(dataList, i, length, length)
    const pl = pivotLow(dataList, i, length, length)

    // Capture slope at pivot confirmation.
    if (ph !== undefined) slopePh = slope
    if (pl !== undefined) slopePl = slope

    // Working trend-line values drift by captured slope between pivots.
    if (ph !== undefined) {
      upperState = ph
    } else if (upperState !== undefined) {
      upperState = upperState - slopePh
    }

    if (pl !== undefined) {
      lowerState = pl
    } else if (lowerState !== undefined) {
      lowerState = lowerState + slopePl
    }

    // Break state: `close > upper - slope_ph * length` — price vs forward projection.
    const projUpper = (upperState ?? Number.POSITIVE_INFINITY) - slopePh * length
    const projLower = (lowerState ?? Number.NEGATIVE_INFINITY) + slopePl * length

    if (ph !== undefined) {
      upos = 0
    } else if (upperState !== undefined && d.close > projUpper) {
      upos = 1
    }

    if (pl !== undefined) {
      dnos = 0
    } else if (lowerState !== undefined && d.close < projLower) {
      dnos = 1
    }

    const upperBreak = upos > prevUpos
    const lowerBreak = dnos > prevDnos

    // Emit undefined at pivot-confirm bars for the single-bar visual gap (AC-03).
    // Before the first pivot, `*State` is undefined and we emit undefined naturally.
    const emitUpper: number | undefined = (ph !== undefined) ? undefined : upperState
    const emitLower: number | undefined = (pl !== undefined) ? undefined : lowerState

    out.push({
      upper: emitUpper,
      lower: emitLower,
      slopePh,
      slopePl,
      upos,
      dnos,
      upperBreak,
      lowerBreak,
      pivotHigh: ph,
      pivotLow: pl,
      pivotHighSrcIndex: ph !== undefined ? i - length : undefined,
      pivotLowSrcIndex: pl !== undefined ? i - length : undefined,
      low: d.low,
      high: d.high,
      anchorSlopePh: ph !== undefined ? slope : undefined,
      anchorSlopePl: pl !== undefined ? slope : undefined
    })

    prevUpos = upos
    prevDnos = dnos
  }

  return out
}
