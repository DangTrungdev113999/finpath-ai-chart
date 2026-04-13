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

// Slope calculation method — matches LuxAlgo Pine Script input options.
export type TLBCalcMethod = 'Atr' | 'Stdev' | 'Linreg'

/**
 * Typed extendData for Finpath - Trendlines with Breaks.
 *
 * User-configurable settings are optional at the type-level so partial
 * updates from the UI merge cleanly; defaults are applied at runtime
 * via `FP_TLB_DEFAULT_EXTEND_DATA`.
 *
 * Runtime bookkeeping keys (prefixed with `_`) are written by the library
 * during `draw()` and consumed by:
 *   - finpath-web Y-axis label layer (`_upperPrice` / `_lowerPrice`)
 *   - Event.ts hover / click hit-testing (`_hitSegments`)
 *   - library select-state rendering (`_selected`, `_hovered`)
 */
export interface TLBExtendData {
  calcMethod?: TLBCalcMethod
  backpaint?: boolean
  upColor?: string
  dnColor?: string
  showExt?: boolean

  // Runtime bookkeeping (written by library)
  _upperPrice?: number
  _lowerPrice?: number
  _selected?: boolean
  _hovered?: boolean
  _hitSegments?: Array<{ x1: number, y1: number, x2: number, y2: number }>
}

/**
 * Per-bar computed state emitted by `computeTLB()`.
 *
 * `upper` / `lower` are intentionally `undefined` at pivot-confirm bars to
 * produce the single-bar visual gap required by AC-03, and also during
 * warmup (first ~2*length bars) before the first pivot is captured.
 */
export interface TLBData {
  // Trend-line series values — undefined at pivot-confirm bars for visual gap
  upper?: number
  lower?: number

  // Slope state carried forward between pivots
  slopePh: number
  slopePl: number

  // Break state machine (0/1 per Pine)
  upos: number
  dnos: number

  // Current-bar break events → trigger "B" label rendering
  upperBreak: boolean
  lowerBreak: boolean

  // Pivot anchor markers (non-undefined only at bars where the pivot is CONFIRMED,
  // i.e. `length` bars AFTER the actual pivot bar — matches Pine ta.pivothigh semantics).
  pivotHigh?: number
  pivotLow?: number
  pivotHighSrcIndex?: number
  pivotLowSrcIndex?: number

  // Break-label anchors (low/high of the break bar)
  low: number
  high: number

  // Slope captured at most recent pivot confirmation (for dashed extension)
  anchorSlopePh?: number
  anchorSlopePl?: number
}
