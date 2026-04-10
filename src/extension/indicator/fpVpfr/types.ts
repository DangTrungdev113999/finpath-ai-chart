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

export interface FPVPFRRow {
  low: number
  high: number
  mid: number
  buyVol: number
  sellVol: number
  totalVol: number
}

export interface FPVPFRProfile {
  rows: FPVPFRRow[]
  pocIndex: number
  vahIndex: number
  valIndex: number
  totalVolume: number
  maxRowVolume: number
  profileHigh: number
  profileLow: number
  fromIndex: number
  toIndex: number
}

export interface FPVPFRSettings {
  // Inputs (Tab 1)
  numberOfBars: number
  rowSize: number
  valueAreaPercent: number
  pocColor: string
  pocLineWidth: number
  vaUpColor: string
  vaDownColor: string
  upVolumeColor: string
  downVolumeColor: string
  showPOCLabel: boolean

  // Style (Tab 2)
  showBoxes: boolean
  showPaneLabels: boolean
  showLines: boolean
  showStatusLineValues: boolean

  // Internal cache (not user-facing)
  _cache?: { profile: FPVPFRProfile | null; rangeKey: string }
}
