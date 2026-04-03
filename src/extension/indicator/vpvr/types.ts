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

export type VPVRVolumeType = 'upDown' | 'total' | 'delta'
export type VPVRRowLayout = 'numberOfRows' | 'ticksPerRow'
export type VPVRPlacement = 'left' | 'right'
export type VPVRLineStyle = 'solid' | 'dashed' | 'dotted'

export interface VPVRRow {
  low: number
  high: number
  mid: number
  buyVol: number
  sellVol: number
  totalVol: number
}

export interface VPVRProfile {
  rows: VPVRRow[]
  pocIndex: number
  vahIndex: number
  valIndex: number
  totalVolume: number
  maxRowVolume: number
  rangeKey: string
}

export interface VPVRSettings {
  // Inputs
  rowLayout: VPVRRowLayout
  rowSize: number
  volumeType: VPVRVolumeType
  valueAreaPercent: number

  // Style
  showProfile: boolean
  showValues: boolean
  valuesColor: string
  widthPercent: number
  placement: VPVRPlacement

  // Colors
  upVolumeColor: string
  downVolumeColor: string
  vaUpColor: string
  vaDownColor: string

  // POC
  showPOC: boolean
  pocColor: string
  pocLineWidth: number
  pocLineStyle: VPVRLineStyle

  // Developing (P2)
  showDevPOC: boolean
  devPOCColor: string
  showDevVA: boolean
  devVAColor: string

  // Labels
  showPriceScaleLabel: boolean
  showStatusLineValues: boolean

  // Internal cache (not user-facing)
  _cache?: { profile: VPVRProfile | null; rangeKey: string }
}
