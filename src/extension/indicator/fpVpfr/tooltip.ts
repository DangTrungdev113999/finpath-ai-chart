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

import type { IndicatorTooltipData, IndicatorCreateTooltipDataSourceParams } from '../../../component/Indicator'

/**
 * FP_VPFR has no canvas tooltip — zero plot() calls per Pine Script pattern.
 * React HTML tooltip handles the header display.
 */
export function createFPVPFRTooltip (_params: IndicatorCreateTooltipDataSourceParams<Record<string, unknown>>): IndicatorTooltipData {
  return {
    name: '',
    calcParamsText: '',
    features: [],
    legends: []
  }
}
