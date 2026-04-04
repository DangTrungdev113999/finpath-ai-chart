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

export type VPFRVolumeType = 'upDown' | 'total' | 'delta'
export type VPFRRowLayout = 'numberOfRows' | 'ticksPerRow'
export type VPFRPlacement = 'left' | 'right'
export type VPFRLineStyle = 'solid' | 'dashed' | 'dotted'

export interface VPFRRow {
  low: number
  high: number
  mid: number
  buyVol: number
  sellVol: number
  totalVol: number
}

export interface VPFRProfile {
  rows: VPFRRow[]
  pocIndex: number
  vahIndex: number
  valIndex: number
  totalVolume: number
  maxRowVolume: number
  profileHigh: number
  profileLow: number
}

export interface VPFRExtendData {
  // Inputs
  rowLayout: VPFRRowLayout
  rowSize: number
  volumeType: VPFRVolumeType
  valueAreaPercent: number

  // Style
  showProfile: boolean
  showValues: boolean
  widthPercent: number
  placement: VPFRPlacement

  // Colors (4-color scheme)
  upVolumeColor: string
  downVolumeColor: string
  vaUpColor: string
  vaDownColor: string

  // POC line
  showPOC: boolean
  pocColor: string
  pocLineWidth: number
  pocLineStyle: VPFRLineStyle

  // Developing POC (P2)
  showDevPOC: boolean
  devPOCColor: string
  devPOCLineWidth: number
  devPOCLineStyle: VPFRLineStyle

  // Developing VA (P2)
  showDevVA: boolean
  devVAColor: string
  devVALineWidth: number
  devVALineStyle: VPFRLineStyle

  // Histogram box
  boxColor: string

  // Internal cache
  _cache?: {
    profile: VPFRProfile | null
    rangeKey: string
  }
}
