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

import type {
  IndicatorCreateTooltipDataSourceParams,
  IndicatorTooltipData
} from '../../../component/Indicator'
import type { TLBData, TLBExtendData } from './types'
import { FP_TLB_DEFAULT_UP_COLOR, FP_TLB_DEFAULT_DN_COLOR } from './constants'

/**
 * Canvas-layer tooltip data source.
 *
 * finpath-web renders its own React legend row for this indicator, so
 * `styles.tooltip.showRule` is set to `'none'` on the indicator to keep
 * the canvas tooltip suppressed. This factory is still provided for
 * completeness and for any headless/non-web consumer.
 *
 * Format matches BRD §3.3 legend status-line:
 *   `Finpath - Trendlines with Breaks  14  1  Atr   20,734   23,285`
 *   └── name ─┘                        └ params ┘   └ values ┘
 */
export function createTLBTooltip (
  params: IndicatorCreateTooltipDataSourceParams<TLBData>
): IndicatorTooltipData {
  const { indicator, crosshair } = params
  const result = indicator.result
  const ext = (indicator.extendData as TLBExtendData | null | undefined) ?? {}

  const dataIndex = crosshair.dataIndex ?? result.length - 1
  const inRange = dataIndex >= 0 && dataIndex < result.length
  const bar: TLBData | null = inRange ? result[dataIndex] : null

  const upColor = ext.upColor ?? FP_TLB_DEFAULT_UP_COLOR
  const dnColor = ext.dnColor ?? FP_TLB_DEFAULT_DN_COLOR

  // Param summary: "{length} {mult} {calcMethod}" e.g. "14 1 Atr" (BRD §3.3).
  const calcParams = indicator.calcParams as number[]
  const length = calcParams[0] ?? 14
  const mult = calcParams[1] ?? 1
  const method = ext.calcMethod ?? 'Atr'

  const fmt = (v: number | undefined): string =>
    v === undefined ? '' : v.toLocaleString(undefined, { maximumFractionDigits: indicator.precision })

  const upperText = bar === null ? '' : fmt(bar.upper)
  const lowerText = bar === null ? '' : fmt(bar.lower)

  return {
    name: indicator.shortName,
    calcParamsText: `${length} ${mult} ${method}`,
    features: [],
    legends: [
      { title: { text: '', color: upColor }, value: { text: upperText, color: upColor } },
      { title: { text: '', color: dnColor }, value: { text: lowerText, color: dnColor } }
    ]
  }
}
