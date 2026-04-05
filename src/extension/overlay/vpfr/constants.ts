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

export const VPFR_DEFAULT_EXTEND_DATA: VPFRExtendData = {
  rowLayout: 'numberOfRows',
  rowSize: 24,
  volumeType: 'upDown',
  valueAreaPercent: 70,
  showProfile: true,
  showValues: false,
  widthPercent: 30,
  placement: 'left',
  upVolumeColor: 'rgba(74, 111, 165, 0.6)',
  downVolumeColor: 'rgba(139, 122, 47, 0.6)',
  vaUpColor: 'rgba(33, 150, 243, 1.0)',
  vaDownColor: 'rgba(212, 168, 67, 1.0)',
  showPOC: true,
  pocColor: '#EF5350',
  pocLineWidth: 1,
  pocLineStyle: 'solid',
  showDevPOC: false,
  devPOCColor: '#B74848',
  devPOCLineWidth: 1,
  devPOCLineStyle: 'dashed',
  showDevVA: false,
  devVAColor: '#0000FF',
  devVALineWidth: 1,
  devVALineStyle: 'solid',
  boxColor: 'transparent'
}

export const VPFR_CONTROL_POINT_RADIUS = 5
export const VPFR_CONTROL_POINT_BORDER = 2
export const VPFR_CONTROL_POINT_COLOR = '#1592E6'
export const VPFR_CONTROL_POINT_BORDER_COLOR = '#1592E6'
export const VPFR_SELECTION_BORDER_COLOR = 'rgba(21, 146, 230, 0.5)'
export const VPFR_SELECTION_BORDER_WIDTH = 1
export const VPFR_AXIS_LABEL_BG = '#2196F3'
export const VPFR_AXIS_LABEL_TEXT_COLOR = '#FFFFFF'
