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
import type { Indicator } from '../../../component/Indicator'

import type {
  AMData,
  AMCalcParam,
  AMExtendData,
  AMMatch,
  AMMode,
  ProjectedBar,
  ProjectionGeometry
} from './types'
import {
  FP_AM_DEFAULT_LOOKBACK,
  FP_AM_DEFAULT_MODE,
  FP_AM_DEFAULT_TOLERANCE,
  FP_AM_DEFAULT_WINDOW
} from './constants'

/**
 * Pine parity — slope-similarity × R²-similarity, scaled 0..100.
 *  slopeSim = max(0, 1 - diff / tolerance)    // 0 when diff ≥ tolerance
 *  r2Sim    = 1 - |currR2 - anchorR2|          // always 0..1 (both ∈ [0,1])
 */
export function confidence (diff: number, anchorR2: number, currR2: number, tolerance: number): number {
  if (!Number.isFinite(diff) || !Number.isFinite(anchorR2) || !Number.isFinite(currR2) || tolerance <= 0) {
    return 0
  }
  const slopeSim = Math.max(0, 1 - diff / tolerance)
  const r2Sim = 1 - Math.abs(currR2 - anchorR2)
  return Math.max(0, slopeSim * r2Sim * 100)
}

/**
 * Main entry point — one AMData object per bar. Every index except `last` is
 * an empty object (no per-bar plot data). All matching state lives on the
 * final bar.
 *
 * Complexity: O(n) regression (incremental sums) + O(min(lookback, n))
 * search = O(n) overall.
 */
export function computeAM (
  dataList: KLineData[],
  indicator: Indicator<AMData, AMCalcParam, AMExtendData>
): AMData[] {
  const n = dataList.length
  const out: AMData[] = []
  for (let i = 0; i < n; i++) out.push({})

  // ── Resolve calc params with defaults ───────────────────────────────────
  const params = indicator.calcParams
  const rawMode = params[0]
  const mode: AMMode = (rawMode === 'Single Mode' || rawMode === 'Dual Mode')
    ? rawMode
    : FP_AM_DEFAULT_MODE
  const rawWindow = params[1]
  const window = typeof rawWindow === 'number' && rawWindow > 0
    ? Math.floor(rawWindow)
    : FP_AM_DEFAULT_WINDOW
  const rawLookback = params[2]
  const lookback = typeof rawLookback === 'number' && rawLookback > 0
    ? Math.floor(rawLookback)
    : FP_AM_DEFAULT_LOOKBACK
  const rawTol = params[3]
  const tolerance = typeof rawTol === 'number' && rawTol > 0
    ? rawTol
    : FP_AM_DEFAULT_TOLERANCE

  // Need at least two full windows + 1 so that slope[last-1] is defined AND
  // the search has at least one candidate (i = window, aIdx = last - window,
  // fIdx = last, which requires last ≥ window). With slope[last-1] we need
  // last - 1 ≥ window - 1 ⇒ last ≥ window. Combined with the aIdx ≥ 0 lookup
  // we require n ≥ window * 2 + 1 to reliably produce a match.
  if (n < window * 2 + 1) return out

  // ── Rolling linear regression: close vs time, fixed window length. ──────
  // Incremental rolling sums → O(n), not O(n*window).
  //
  // Pine: ta.linreg(close, window) + ta.correlation(close, n, window).
  // We compute slope & r² for each bar `i` over bars [i - window + 1 .. i].
  //
  // Note: time deltas between bars can be huge (timestamps in ms), so sums of
  // x*x may be large but still safe within Float64 for reasonable dataset
  // sizes (< 10^9 bars).
  const slope = new Float64Array(n)
  const rsq = new Float64Array(n)
  slope.fill(NaN)
  rsq.fill(NaN)

  let sX = 0
  let sY = 0
  let sXY = 0
  let sXX = 0
  let sYY = 0
  for (let i = 0; i < n; i++) {
    const x = dataList[i].timestamp
    const y = dataList[i].close
    sX += x
    sY += y
    sXY += x * y
    sXX += x * x
    sYY += y * y
    if (i >= window) {
      const k = i - window
      const px = dataList[k].timestamp
      const py = dataList[k].close
      sX -= px
      sY -= py
      sXY -= px * py
      sXX -= px * px
      sYY -= py * py
    }
    if (i >= window - 1) {
      const N = window
      const mX = sX / N
      const mY = sY / N
      const cov = sXY / N - mX * mY
      const varX = sXX / N - mX * mX
      const varY = sYY / N - mY * mY
      const sd = Math.sqrt(Math.max(0, varX) * Math.max(0, varY))
      slope[i] = varX > 0 ? cov / varX : 0
      const r = sd > 0 ? cov / sd : 0
      rsq[i] = r * r
    }
  }

  // ── Best-match search ───────────────────────────────────────────────────
  // Pine uses `slope[1]` / `rsq[1]` — i.e. one-back — to reduce noise from
  // the in-progress bar. We do the same by reading slope[last - 1].
  const last = n - 1
  const currSlope = slope[last - 1]
  const currR2 = rsq[last - 1]
  if (!Number.isFinite(currSlope) || !Number.isFinite(currR2)) return out

  // Pine's `for i = window to lookback` iterates back-indices i = [window..lookback].
  // Clamp so aIdx = last - i ≥ 0 AND aIdx + window ≤ last (fIdx within data).
  // That last constraint ⇒ i ≥ window, so the effective upper bound is
  // min(lookback, last - window).
  const upperI = Math.min(lookback, last - window)

  let bullIdx = -1
  let bullDiff = Infinity
  let bullR2 = 0
  let bullTm = -1

  let bearIdx = -1
  let bearDiff = Infinity
  let bearR2 = 0
  let bearTm = -1

  let bestIdx = -1
  let bestDiff = Infinity
  let bestR2 = 0
  let bestTm = -1
  let bestDir: 'Bull' | 'Bear' = 'Bull'

  for (let i = window; i <= upperI; i++) {
    const aIdx = last - i
    if (aIdx < 0) break

    const anchorSlope = slope[aIdx]
    if (!Number.isFinite(anchorSlope)) continue

    const diff = Math.abs(currSlope - anchorSlope)
    if (diff > tolerance) continue

    // Pine back-index: p_change = close[i - window] - close[i]
    // Forward indexing (aIdx = last - i, fIdx = aIdx + window = last - i + window):
    const fIdx = aIdx + window
    if (fIdx > last) continue
    const pChange = dataList[fIdx].close - dataList[aIdx].close

    const anchorR2 = rsq[aIdx]
    const anchorTm = dataList[aIdx].timestamp

    if (mode === 'Dual Mode') {
      if (pChange > 0 && diff < bullDiff) {
        bullDiff = diff
        bullIdx = aIdx
        bullTm = anchorTm
        bullR2 = anchorR2
      } else if (pChange < 0 && diff < bearDiff) {
        bearDiff = diff
        bearIdx = aIdx
        bearTm = anchorTm
        bearR2 = anchorR2
      }
    } else {
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = aIdx
        bestTm = anchorTm
        bestR2 = anchorR2
        bestDir = pChange > 0 ? 'Bull' : 'Bear'
      }
    }
  }

  // ── Build projection geometry (scaled OHLC, 1 per projected bar) ────────
  const buildProjection = (anchorIdx: number): ProjectionGeometry | null => {
    if (anchorIdx < 0) return null
    const anchorClose = dataList[anchorIdx].close
    if (!Number.isFinite(anchorClose) || anchorClose === 0) return null
    const scale = dataList[last].close / anchorClose
    const bars: ProjectedBar[] = []
    for (let j = 0; j <= window; j++) {
      const src = anchorIdx + j
      if (src > last) break
      const k = dataList[src]
      bars.push({
        o: k.open * scale,
        h: k.high * scale,
        l: k.low * scale,
        c: k.close * scale
      })
    }
    return {
      anchorIdx,
      anchorTime: dataList[anchorIdx].timestamp,
      scale,
      bars
    }
  }

  const makeMatch = (
    idx: number,
    diff: number,
    anchorR2: number,
    anchorTm: number,
    direction?: 'Bull' | 'Bear'
  ): AMMatch | null => {
    if (idx < 0) return null
    return {
      anchorIdx: idx,
      anchorTime: anchorTm,
      anchorR2,
      diff,
      confidence: confidence(diff, anchorR2, currR2, tolerance),
      projection: buildProjection(idx),
      ...(direction !== undefined ? { direction } : {})
    }
  }

  const lastBar: AMData = out[last]
  lastBar.lastIdx = last
  lastBar.currSlope = currSlope
  lastBar.currR2 = currR2
  lastBar.mode = mode
  lastBar.window = window
  lastBar.tolerance = tolerance

  if (mode === 'Dual Mode') {
    lastBar.bullMatch = makeMatch(bullIdx, bullDiff, bullR2, bullTm)
    lastBar.bearMatch = makeMatch(bearIdx, bearDiff, bearR2, bearTm)
  } else {
    lastBar.bestMatch = makeMatch(bestIdx, bestDiff, bestR2, bestTm, bestDir)
  }

  return out
}
