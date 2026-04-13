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

import type { SRBExtendData } from './types'

// Library indicator identifier (used by finpath-web picker / lookup).
export const FP_SRB_INDICATOR_NAME = 'FP_SR_WITH_BREAKS'

// Display name shown in legend.
export const FP_SRB_SHORT_NAME = 'Finpath - S&R with Breaks'

// Pine defaults
export const FP_SRB_DEFAULT_LEFT_BARS = 15
export const FP_SRB_DEFAULT_RIGHT_BARS = 15
export const FP_SRB_DEFAULT_VOLUME_THRESH = 20

// Line colors (from Pine source)
export const FP_SRB_DEFAULT_RESISTANCE_COLOR = '#FF0000'
export const FP_SRB_DEFAULT_SUPPORT_COLOR = '#233DEE'
export const FP_SRB_DEFAULT_LINE_WIDTH = 3

// Break-label colors (TV theme greens/reds — same as Trendlines)
export const FP_SRB_DEFAULT_GREEN = '#089981'
export const FP_SRB_DEFAULT_RED = '#F23645'

export const FP_SRB_DEFAULT_EXTEND_DATA: SRBExtendData = {
  toggleBreaks: true,

  resistanceColor: FP_SRB_DEFAULT_RESISTANCE_COLOR,
  resistanceWidth: FP_SRB_DEFAULT_LINE_WIDTH,
  resistanceVisible: true,

  supportColor: FP_SRB_DEFAULT_SUPPORT_COLOR,
  supportWidth: FP_SRB_DEFAULT_LINE_WIDTH,
  supportVisible: true,

  bUpColor: FP_SRB_DEFAULT_GREEN,
  bUpVisible: true,

  bDownColor: FP_SRB_DEFAULT_RED,
  bDownVisible: true,

  bullWickColor: FP_SRB_DEFAULT_GREEN,
  bullWickVisible: true,

  bearWickColor: FP_SRB_DEFAULT_RED,
  bearWickVisible: true
}
