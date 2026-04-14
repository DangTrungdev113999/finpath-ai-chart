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

/**
 * Finpath — Analogue Matcher (FP-AM) type definitions.
 *
 * Pine-script `FP Analogue Matcher` port: find the window in history whose
 * regression slope best matches the current window, then project that
 * sequence onto the future (scaled by anchorClose→lastClose).
 *
 * Dual Mode emits BOTH the best bullish-future and best bearish-future
 * matches; Single Mode emits the single closest match regardless of sign.
 */

export type AMMode = 'Single Mode' | 'Dual Mode'

/**
 * calcParams tuple holds heterogeneous values (string + number).
 * Pattern precedent: finpathMovingAverageConvergenceDivergence.ts
 * (`[26, 12, 9, 'EMA']`).
 */
export type AMCalcParam = number | string

export type AMCalcParamsTuple = readonly [AMMode, number, number, number]
//                                         mode    window lookback tolerance

export interface ProjectedBar {
  o: number
  h: number
  l: number
  c: number
}

export interface ProjectionGeometry {
  /** Historic bar index the projection is anchored on. */
  anchorIdx: number
  /** Timestamp of the anchor bar (ms). */
  anchorTime: number
  /** Scale factor applied to anchor OHLC → projected OHLC (lastClose / anchorClose). */
  scale: number
  /** Scaled OHLC sequence, length ≤ window + 1 (truncated at dataList end). */
  bars: ProjectedBar[]
}

export interface AMMatch {
  anchorIdx: number
  anchorTime: number
  anchorR2: number
  /** |currSlope - anchorSlope| — smaller ⇒ stronger slope similarity. */
  diff: number
  /** 0..100 — combines slope similarity + R² similarity. */
  confidence: number
  /** null when the anchor cannot produce a valid projection (edge / zero close). */
  projection: ProjectionGeometry | null
  /** Populated only for Single Mode rows. */
  direction?: 'Bull' | 'Bear'
}

/**
 * Per-bar calc output.
 *
 * For every index except `last` the entry is an empty object (no per-bar plots).
 * Only the last index carries the current slope/R² and match(es).
 */
export interface AMData {
  lastIdx?: number
  currSlope?: number
  currR2?: number
  mode?: AMMode
  window?: number
  tolerance?: number
  /** Dual-Mode bull anchor + projection (null when no match within tolerance). */
  bullMatch?: AMMatch | null
  /** Dual-Mode bear anchor + projection. */
  bearMatch?: AMMatch | null
  /** Single-Mode best anchor + projection. */
  bestMatch?: AMMatch | null
}

/**
 * Non-calc settings delivered through `indicator.extendData`.
 *
 * Underscore-prefixed keys are runtime-written ("internal") and, by
 * convention, diffed as ordinary properties by KLineChart's reference-equality
 * check — include them only when updated deliberately.
 */
export interface AMExtendData {
  // Visibility toggles (Style tab)
  showBoxes?: boolean
  showLines?: boolean
  showTable?: boolean

  // Colour overrides (all default to Pine constants — see constants.ts)
  bullFill?: string
  bearFill?: string
  bullLabel?: string
  bearLabel?: string
  tableBg?: string
  tableBorder?: string
  tableHeaderBg?: string
  tableText?: string

  // Runtime-populated by consumer (e.g. 'Analogue Matcher(Dual, 50, 500, 0.004)').
  _statusLineText?: string
}
