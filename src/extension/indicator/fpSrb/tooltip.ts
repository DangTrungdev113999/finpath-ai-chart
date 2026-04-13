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
import type { SRBData, SRBExtendData } from './types'
import {
  FP_SRB_DEFAULT_RESISTANCE_COLOR,
  FP_SRB_DEFAULT_SUPPORT_COLOR,
  FP_SRB_DEFAULT_LEFT_BARS,
  FP_SRB_DEFAULT_RIGHT_BARS,
  FP_SRB_DEFAULT_VOLUME_THRESH
} from './constants'

/**
 * Canvas-layer tooltip data source.
 *
 * finpath-web renders its own React legend row for this indicator, so
 * `styles.tooltip.showRule` is set to `'none'` on the indicator to keep
 * the canvas tooltip suppressed. This factory is still provided for
 * completeness and for any headless/non-web consumer.
 *
 * Format matches BRD §10 legend status-line:
 *   `Finpath - S&R with Breaks  15  15  20   25,150.00   23,800.00`
 *   └── name ─────────────────┘  └ params ┘   └ resistance / support ┘
 */
export function createSRBTooltip (
  params: IndicatorCreateTooltipDataSourceParams<SRBData>
): IndicatorTooltipData {
  const { indicator, crosshair } = params
  const result = indicator.result
  const ext = (indicator.extendData as SRBExtendData | null | undefined) ?? {}

  const dataIndex = crosshair.dataIndex ?? result.length - 1
  const inRange = dataIndex >= 0 && dataIndex < result.length
  const bar: SRBData | null = inRange ? result[dataIndex] : null

  const resistanceColor = ext.resistanceColor ?? FP_SRB_DEFAULT_RESISTANCE_COLOR
  const supportColor = ext.supportColor ?? FP_SRB_DEFAULT_SUPPORT_COLOR

  const calcParams = indicator.calcParams as number[]
  const leftBars = calcParams[0] ?? FP_SRB_DEFAULT_LEFT_BARS
  const rightBars = calcParams[1] ?? FP_SRB_DEFAULT_RIGHT_BARS
  const volumeThresh = calcParams[2] ?? FP_SRB_DEFAULT_VOLUME_THRESH

  const fmt = (v: number | undefined): string =>
    v === undefined ? '' : v.toLocaleString(undefined, { maximumFractionDigits: indicator.precision })

  const resistanceText = bar === null ? '' : fmt(bar.resistance)
  const supportText = bar === null ? '' : fmt(bar.support)

  return {
    name: indicator.shortName,
    calcParamsText: `${leftBars} ${rightBars} ${volumeThresh}`,
    features: [],
    legends: [
      { title: { text: '', color: resistanceColor }, value: { text: resistanceText, color: resistanceColor } },
      { title: { text: '', color: supportColor }, value: { text: supportText, color: supportColor } }
    ]
  }
}
