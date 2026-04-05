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

import type { OverlayFigure } from '../../../component/Overlay'
import type { YAxis } from '../../../component/YAxis'
import type { RectAttrs } from '../../figure/rect'
import type { LineAttrs } from '../../figure/line'

import type { VPFRProfile, VPFRExtendData } from './types'
import {
  VPFR_CONTROL_POINT_RADIUS,
  VPFR_CONTROL_POINT_BORDER,
  VPFR_CONTROL_POINT_COLOR,
  VPFR_CONTROL_POINT_BORDER_COLOR
} from './constants'

interface RenderParams {
  profile: VPFRProfile
  settings: VPFRExtendData
  leftX: number
  rightX: number
  boundingWidth: number
  yAxis: YAxis
  isSelected: boolean
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
}

/**
 * Generate all OverlayFigure[] for the VPFR histogram, POC line,
 * selection border, and control points.
 */
export function renderVPFRFigures (params: RenderParams): OverlayFigure[] {
  const {
    profile, settings, leftX, rightX,
    yAxis, isSelected, cp1, cp2
  } = params

  const figures: OverlayFigure[] = []
  const { rows, pocIndex, vahIndex, valIndex, maxRowVolume, profileHigh, profileLow } = profile

  if (rows.length === 0 || maxRowVolume === 0) return figures

  const topY = yAxis.convertToPixel(profileHigh)
  const bottomY = yAxis.convertToPixel(profileLow)
  const rangeWidth = Math.abs(rightX - leftX)
  const maxBarWidth = rangeWidth * (settings.widthPercent / 100)

  // Ignore pressed-move events on hit area and histogram bars
  // so body drag falls through to chart pan
  const ignoreBodyDrag: Array<'onPressedMoveStart' | 'onPressedMoving' | 'onPressedMoveEnd'> = [
    'onPressedMoveStart', 'onPressedMoving', 'onPressedMoveEnd'
  ]

  // 1. Hit area (transparent rect covering full range box) — click-to-select
  const hitAreaMinY = Math.min(topY, bottomY)
  const hitAreaMaxY = Math.max(topY, bottomY)
  const hitAreaAttrs: RectAttrs = {
    x: leftX,
    y: hitAreaMinY,
    width: rangeWidth,
    height: Math.max(1, hitAreaMaxY - hitAreaMinY)
  }
  figures.push({
    key: 'vpfr_hitArea',
    type: 'rect',
    attrs: hitAreaAttrs,
    styles: { style: 'fill', color: 'transparent' },
    ignoreEvent: ignoreBodyDrag
  })

  // 2. Background fill behind histogram (always shown, semi-transparent)
  const bgFillColor = settings.boxColor !== 'transparent'
    ? settings.boxColor
    : 'rgba(30, 40, 60, 0.3)'
  const boxAttrs: RectAttrs = {
    x: leftX,
    y: hitAreaMinY,
    width: rangeWidth,
    height: Math.max(1, hitAreaMaxY - hitAreaMinY)
  }
  figures.push({
    key: 'vpfr_box',
    type: 'rect',
    attrs: boxAttrs,
    styles: { style: 'fill', color: bgFillColor },
    ignoreEvent: true
  })

  // 3. Histogram bars — 4 batched rect groups
  if (settings.showProfile) {
    const upOutsideRects: RectAttrs[] = []
    const downOutsideRects: RectAttrs[] = []
    const vaUpRects: RectAttrs[] = []
    const vaDownRects: RectAttrs[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.totalVol === 0) continue

      const rowTopY = yAxis.convertToPixel(row.high)
      const rowBottomY = yAxis.convertToPixel(row.low)
      const barHeight = Math.max(1, Math.abs(rowBottomY - rowTopY) - 1)
      const barY = Math.min(rowTopY, rowBottomY) + 0.5

      const relWidth = row.totalVol / maxRowVolume
      const totalBarWidth = relWidth * maxBarWidth

      // Buy/sell split widths
      const buyWidth = row.totalVol > 0 ? (row.buyVol / row.totalVol) * totalBarWidth : 0
      const sellWidth = totalBarWidth - buyWidth

      const isInVA = i >= valIndex && i <= vahIndex
      const isPlacementLeft = settings.placement === 'left'

      // Determine bar X position based on placement
      // 'left' = bars grow from leftX to the right
      // 'right' = bars grow from rightX to the left
      let buyX = 0
      let sellX = 0

      if (isPlacementLeft) {
        buyX = leftX
        sellX = leftX + buyWidth
      } else {
        sellX = rightX - totalBarWidth
        buyX = sellX + sellWidth
      }

      if (buyWidth > 0) {
        const rect: RectAttrs = { x: buyX, y: barY, width: buyWidth, height: barHeight }
        if (isInVA) {
          vaUpRects.push(rect)
        } else {
          upOutsideRects.push(rect)
        }
      }

      if (sellWidth > 0) {
        const rect: RectAttrs = { x: sellX, y: barY, width: sellWidth, height: barHeight }
        if (isInVA) {
          vaDownRects.push(rect)
        } else {
          downOutsideRects.push(rect)
        }
      }
    }

    // Push batched figures — 4 draw calls for all histogram bars
    if (upOutsideRects.length > 0) {
      figures.push({
        key: 'vpfr_upOutside',
        type: 'rect',
        attrs: upOutsideRects,
        styles: { style: 'fill', color: settings.upVolumeColor },
        ignoreEvent: true
      })
    }
    if (downOutsideRects.length > 0) {
      figures.push({
        key: 'vpfr_downOutside',
        type: 'rect',
        attrs: downOutsideRects,
        styles: { style: 'fill', color: settings.downVolumeColor },
        ignoreEvent: true
      })
    }
    if (vaUpRects.length > 0) {
      figures.push({
        key: 'vpfr_vaUp',
        type: 'rect',
        attrs: vaUpRects,
        styles: { style: 'fill', color: settings.vaUpColor },
        ignoreEvent: true
      })
    }
    if (vaDownRects.length > 0) {
      figures.push({
        key: 'vpfr_vaDown',
        type: 'rect',
        attrs: vaDownRects,
        styles: { style: 'fill', color: settings.vaDownColor },
        ignoreEvent: true
      })
    }
  }

  // 4. POC line — only within the drawn range (not extending to chart edge)
  if (settings.showPOC && pocIndex < rows.length) {
    const pocPrice = rows[pocIndex].mid
    const pocY = yAxis.convertToPixel(pocPrice)
    const dashedValue = settings.pocLineStyle === 'dashed'
      ? [4, 4]
      : settings.pocLineStyle === 'dotted'
        ? [2, 2]
        : [0]

    const pocLineAttrs: LineAttrs = {
      coordinates: [
        { x: leftX, y: pocY },
        { x: rightX, y: pocY }
      ]
    }
    figures.push({
      key: 'vpfr_poc',
      type: 'line',
      attrs: pocLineAttrs,
      styles: {
        style: settings.pocLineStyle === 'solid' ? 'solid' : 'dashed',
        color: settings.pocColor,
        size: settings.pocLineWidth,
        dashedValue
      },
      ignoreEvent: ignoreBodyDrag
    })
  }

  // 5. Control points (circles, selected only — no selection border)
  if (isSelected) {
    // CP1 — top-left corner of range (start time, high price)
    figures.push({
      key: 'vpfr_cp1',
      type: 'circle',
      attrs: { x: cp1.x, y: cp1.y, r: VPFR_CONTROL_POINT_RADIUS + VPFR_CONTROL_POINT_BORDER },
      styles: {
        style: 'stroke_fill',
        color: VPFR_CONTROL_POINT_COLOR,
        borderColor: VPFR_CONTROL_POINT_BORDER_COLOR,
        borderSize: VPFR_CONTROL_POINT_BORDER
      },
      pointIndex: 0
    })

    // CP2 — bottom-right corner of range (end time, low price)
    figures.push({
      key: 'vpfr_cp2',
      type: 'circle',
      attrs: { x: cp2.x, y: cp2.y, r: VPFR_CONTROL_POINT_RADIUS + VPFR_CONTROL_POINT_BORDER },
      styles: {
        style: 'stroke_fill',
        color: VPFR_CONTROL_POINT_COLOR,
        borderColor: VPFR_CONTROL_POINT_BORDER_COLOR,
        borderSize: VPFR_CONTROL_POINT_BORDER
      },
      pointIndex: 1
    })
  }

  return figures
}
