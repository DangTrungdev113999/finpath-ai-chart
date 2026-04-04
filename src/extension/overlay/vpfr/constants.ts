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

import type { VPFRExtendData } from './types'

export const VPFR_DEFAULT: VPFRExtendData = {
  rowsLayout: 'number_of_rows',
  rowSize: 24,
  valueAreaVolume: 70,
  volumeMode: 'up_down',
  placement: 'left',

  showProfile: true,
  showValues: false,
  histogramWidth: 30,

  upVolume: { visible: true, color: '#2962FF', opacity: 0.50 },
  downVolume: { visible: true, color: '#E91E63', opacity: 0.50 },
  valueAreaUp: { visible: true, color: '#2962FF', opacity: 0.30 },
  valueAreaDown: { visible: true, color: '#E91E63', opacity: 0.30 },

  pocLine: { visible: true, color: '#FF6D00', style: 'solid', width: 1 },
  developingPocLine: { visible: false, color: '#FF6D00', style: 'solid', width: 1 },
  developingVahLine: { visible: false, color: '#2962FF', style: 'dashed', width: 1 },
  developingValLine: { visible: false, color: '#E91E63', style: 'dashed', width: 1 }
}

export const VPFR_BACKGROUND_COLOR = 'rgba(41,98,255,0.06)'
