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

export type VPFRVolumeMode = 'up_down' | 'total' | 'delta'
export type VPFRRowsLayout = 'number_of_rows' | 'ticks_per_row'
export type VPFRPlacement = 'left' | 'right'
export type VPFRLineStyleType = 'solid' | 'dashed' | 'dotted'

export interface VPFRLineConfig {
  visible: boolean
  color: string
  style: VPFRLineStyleType
  width: number
}

export interface VPFRBarColorConfig {
  visible: boolean
  color: string
  opacity: number
}

export interface VPFRRow {
  priceLow: number
  priceHigh: number
  upVolume: number
  downVolume: number
  totalVolume: number
}

export interface VPFRProfile {
  rows: VPFRRow[]
  pocIndex: number
  vahIndex: number
  valIndex: number
  profileHigh: number
  profileLow: number
  maxRowVolume: number
  totalVolume: number
}

export interface VPFRExtendData {
  // Inputs
  rowsLayout: VPFRRowsLayout
  rowSize: number
  valueAreaVolume: number
  volumeMode: VPFRVolumeMode
  placement: VPFRPlacement

  // Style: Histogram
  showProfile: boolean
  showValues: boolean
  histogramWidth: number
  upVolume: VPFRBarColorConfig
  downVolume: VPFRBarColorConfig
  valueAreaUp: VPFRBarColorConfig
  valueAreaDown: VPFRBarColorConfig

  // Style: Lines
  pocLine: VPFRLineConfig
  developingPocLine: VPFRLineConfig
  developingVahLine: VPFRLineConfig
  developingValLine: VPFRLineConfig

  // Internal cache (not persisted)
  _cache?: {
    profile: VPFRProfile | null
    rangeKey: string
  }
}
