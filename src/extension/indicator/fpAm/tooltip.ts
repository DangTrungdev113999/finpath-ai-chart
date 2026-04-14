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

import type { AMData } from './types'

/**
 * FP-AM exposes no per-bar values — canvas tooltip is suppressed both here
 * (empty TooltipData) AND via `styles.tooltip.showRule: 'none'` at the
 * template level. Mirrors fpVpfr/tooltip.ts.
 */
export function createFPAMTooltip (
  _params: IndicatorCreateTooltipDataSourceParams<AMData>
): IndicatorTooltipData {
  return {
    name: '',
    calcParamsText: '',
    features: [],
    legends: []
  }
}
