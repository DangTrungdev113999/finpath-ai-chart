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

import type { AMExtendData, AMMode, AMCalcParamsTuple } from './types'

/** Library indicator name — consumer must use this exact string. */
export const FP_AM_INDICATOR_NAME = 'FP_AM'
export const FP_AM_SHORT_NAME = 'Analogue Matcher'

// ── Pine defaults ──────────────────────────────────────────────────────────
export const FP_AM_DEFAULT_MODE: AMMode = 'Dual Mode'
export const FP_AM_DEFAULT_WINDOW = 50
export const FP_AM_DEFAULT_LOOKBACK = 500
export const FP_AM_DEFAULT_TOLERANCE = 0.004

export const FP_AM_DEFAULT_CALC_PARAMS: AMCalcParamsTuple = [
  FP_AM_DEFAULT_MODE,
  FP_AM_DEFAULT_WINDOW,
  FP_AM_DEFAULT_LOOKBACK,
  FP_AM_DEFAULT_TOLERANCE
]

// ── Pine colour constants (→ rgba) ─────────────────────────────────────────
// Pine `color.new(color.green, 60)` ⇒ 60% transparency ⇒ alpha = 0.40.
export const FP_AM_BULL_FILL = 'rgba(0, 128, 0, 0.40)'
export const FP_AM_BULL_WICK = 'rgba(0, 128, 0, 0.40)'
export const FP_AM_BEAR_FILL = 'rgba(255, 0, 0, 0.40)'
export const FP_AM_BEAR_WICK = 'rgba(255, 0, 0, 0.40)'

// Label text (table "Bull"/"Bear" colours) — lime / red, full opacity.
export const FP_AM_BULL_LABEL = '#00FF00'
export const FP_AM_BEAR_LABEL = '#FF0000'

// Stats-table palette (Pine: color.new(color.black, 70) = 30% opacity bg).
export const FP_AM_TABLE_BG = 'rgba(0, 0, 0, 0.30)'
export const FP_AM_TABLE_BORDER = '#808080'
export const FP_AM_TABLE_HEADER_BG = '#808080'
export const FP_AM_TABLE_TEXT = '#FFFFFF'

export const FP_AM_DEFAULT_EXTEND_DATA: AMExtendData = {
  showBoxes: true,
  showLines: true,
  showTable: true,

  bullFill: FP_AM_BULL_FILL,
  bearFill: FP_AM_BEAR_FILL,
  bullLabel: FP_AM_BULL_LABEL,
  bearLabel: FP_AM_BEAR_LABEL,
  tableBg: FP_AM_TABLE_BG,
  tableBorder: FP_AM_TABLE_BORDER,
  tableHeaderBg: FP_AM_TABLE_HEADER_BG,
  tableText: FP_AM_TABLE_TEXT
}
