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

import type { VPVRSettings } from './types'

export const VPVR_DEFAULT_SETTINGS: VPVRSettings = {
  rowLayout: 'numberOfRows',
  rowSize: 24,
  volumeType: 'upDown',
  valueAreaPercent: 70,
  showProfile: true,
  showValues: false,
  valuesColor: '#424242',
  widthPercent: 30,
  placement: 'right',
  upVolumeColor: 'rgba(21, 146, 230, 0.24)',
  downVolumeColor: 'rgba(251, 193, 35, 0.24)',
  vaUpColor: 'rgba(21, 146, 230, 0.70)',
  vaDownColor: 'rgba(251, 193, 35, 0.70)',
  showPOC: true,
  pocColor: '#FF0000',
  pocLineWidth: 2,
  pocLineStyle: 'solid',
  showDevPOC: false,
  devPOCColor: '#FF0000',
  showDevVA: false,
  devVAColor: '#0000FF',
  showPriceScaleLabel: true,
  showStatusLineValues: true
}
