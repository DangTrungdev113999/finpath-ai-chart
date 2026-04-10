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

import type { FPVPFRSettings } from './types'

export const FP_VPFR_DEFAULT_SETTINGS: FPVPFRSettings = {
  numberOfBars: 150,
  rowSize: 24,
  valueAreaPercent: 70,
  pocColor: '#FF0000',
  pocLineWidth: 2,
  vaUpColor: 'rgba(33, 150, 243, 0.70)',
  vaDownColor: 'rgba(255, 152, 0, 0.70)',
  upVolumeColor: 'rgba(33, 150, 243, 0.25)',
  downVolumeColor: 'rgba(255, 152, 0, 0.25)',
  showPOCLabel: true,
  showBoxes: true,
  showPaneLabels: true,
  showLines: true,
  showStatusLineValues: true
}
