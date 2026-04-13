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

import type { TLBExtendData } from './types'

// Library indicator identifier (used by finpath-web picker / lookup).
export const FP_TLB_INDICATOR_NAME = 'FP_TL_WITH_BREAKS'

// Display name shown in legend.
export const FP_TLB_SHORT_NAME = 'Finpath - Trendlines with Breaks'

// TV LuxAlgo defaults (color.teal / color.red).
export const FP_TLB_DEFAULT_UP_COLOR = '#089981'
export const FP_TLB_DEFAULT_DN_COLOR = '#F23645'

// Pine defaults — lookback = 14 bars, slope multiplier = 1.
export const FP_TLB_DEFAULT_LENGTH = 14
export const FP_TLB_DEFAULT_MULT = 1

export const FP_TLB_DEFAULT_EXTEND_DATA: TLBExtendData = {
  calcMethod: 'Atr',
  backpaint: true,
  upColor: FP_TLB_DEFAULT_UP_COLOR,
  dnColor: FP_TLB_DEFAULT_DN_COLOR,
  showExt: true
}
