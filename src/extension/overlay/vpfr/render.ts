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

import type Nullable from '../../../common/Nullable'
import type Coordinate from '../../../common/Coordinate'
import type { OverlayFigure } from '../../../component/Overlay'
import type { XAxis } from '../../../component/XAxis'
import type { YAxis } from '../../../component/YAxis'
import type { RectAttrs } from '../../figure/rect'
import type { LineAttrs } from '../../figure/line'

import type { VPFRExtendData, VPFRProfile, VPFRLineConfig } from './types'
import { VPFR_BACKGROUND_COLOR } from './constants'

function hexToRgba (hex: string, opacity: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

function lineStyleToDash (style: string): number[] {
  switch (style) {
    case 'dashed': return [4, 4]
    case 'dotted': return [2, 2]
    default: return []
  }
}

/**
 * Render drawing preview: vertical dashed lines at each boundary.
 */
export function renderPreview (
  coordinates: Coordinate[],
  boundingHeight: number
): OverlayFigure[] {
  const figures: OverlayFigure[] = []

  for (const coord of coordinates) {
    const lineAttrs: LineAttrs = {
      coordinates: [
        { x: coord.x, y: 0 },
        { x: coord.x, y: boundingHeight }
      ]
    }
    figures.push({
      type: 'line',
      attrs: lineAttrs,
      styles: {
        style: 'dashed',
        color: 'rgba(41,98,255,0.4)',
        size: 1,
        dashedValue: [4, 4]
      },
      ignoreEvent: true
    })
  }

  return figures
}

/**
 * Render the complete volume profile histogram, POC line, and developing lines.
 */
export function renderProfile (
  profile: VPFRProfile,
  ext: VPFRExtendData,
  coordinates: Coordinate[],
  xAxis: Nullable<XAxis>,
  yAxis: Nullable<YAxis>,
  _boundingHeight: number,
  developingData?: {
    poc: Array<{ idx: number, price: number }>
    vah: Array<{ idx: number, price: number }>
    val: Array<{ idx: number, price: number }>
  }
): OverlayFigure[] {
  if (profile.rows.length === 0 || xAxis === null || yAxis === null) return []

  const figures: OverlayFigure[] = []

  const x1 = coordinates[0].x
  const x2 = coordinates[1].x
  const leftX = Math.min(x1, x2)
  const rightX = Math.max(x1, x2)
  const rangeWidth = rightX - leftX

  if (rangeWidth <= 0) return []

  // 1. Background rect
  const bgTopPx = yAxis.convertToPixel(profile.profileHigh)
  const bgBottomPx = yAxis.convertToPixel(profile.profileLow)
  const bgTop = Math.min(bgTopPx, bgBottomPx)
  const bgHeight = Math.abs(bgBottomPx - bgTopPx)

  const bgRect: RectAttrs = {
    x: leftX,
    y: bgTop,
    width: rangeWidth,
    height: bgHeight
  }
  figures.push({
    type: 'rect',
    attrs: bgRect,
    styles: { style: 'fill', color: VPFR_BACKGROUND_COLOR },
    ignoreEvent: false
  })

  // 2. Histogram bars (if showProfile)
  if (ext.showProfile) {
    const maxBarWidth = rangeWidth * (ext.histogramWidth / 100)

    // Categorize rects by color batch for efficiency
    const upOutside: RectAttrs[] = []
    const downOutside: RectAttrs[] = []
    const upInside: RectAttrs[] = []
    const downInside: RectAttrs[] = []

    for (let i = 0; i < profile.rows.length; i++) {
      const row = profile.rows[i]
      if (row.totalVolume === 0) continue

      const rowTopPx = yAxis.convertToPixel(row.priceHigh)
      const rowBottomPx = yAxis.convertToPixel(row.priceLow)
      const rowTop = Math.min(rowTopPx, rowBottomPx)
      const rowHeight = Math.max(Math.abs(rowBottomPx - rowTopPx) - 1, 1)

      const isInsideVA = i >= profile.valIndex && i <= profile.vahIndex

      // Calculate bar widths based on volume mode
      const totalBarWidth = (row.totalVolume / profile.maxRowVolume) * maxBarWidth

      if (ext.volumeMode === 'up_down') {
        // Split bar: up on left, down on right
        const upWidth = row.totalVolume > 0 ? (row.upVolume / row.totalVolume) * totalBarWidth : 0
        const downWidth = totalBarWidth - upWidth

        if (ext.placement === 'left') {
          if (upWidth > 0) {
            const rect: RectAttrs = { x: leftX, y: rowTop, width: upWidth, height: rowHeight }
            if (isInsideVA) { upInside.push(rect) } else { upOutside.push(rect) }
          }
          if (downWidth > 0) {
            const rect: RectAttrs = { x: leftX + upWidth, y: rowTop, width: downWidth, height: rowHeight }
            if (isInsideVA) { downInside.push(rect) } else { downOutside.push(rect) }
          }
        } else {
          // Right placement: bars extend leftward from right boundary
          if (downWidth > 0) {
            const rect: RectAttrs = { x: rightX - totalBarWidth, y: rowTop, width: downWidth, height: rowHeight }
            if (isInsideVA) { downInside.push(rect) } else { downOutside.push(rect) }
          }
          if (upWidth > 0) {
            const rect: RectAttrs = { x: rightX - upWidth, y: rowTop, width: upWidth, height: rowHeight }
            if (isInsideVA) { upInside.push(rect) } else { upOutside.push(rect) }
          }
        }
      } else if (ext.volumeMode === 'total') {
        // Single bar, use up color
        const barX = ext.placement === 'left' ? leftX : rightX - totalBarWidth
        const rect: RectAttrs = { x: barX, y: rowTop, width: totalBarWidth, height: rowHeight }
        if (isInsideVA) { upInside.push(rect) } else { upOutside.push(rect) }
      } else {
        // Delta mode: color based on sign of (upVolume - downVolume)
        const delta = row.upVolume - row.downVolume
        const barX = ext.placement === 'left' ? leftX : rightX - totalBarWidth
        const rect: RectAttrs = { x: barX, y: rowTop, width: totalBarWidth, height: rowHeight }
        if (delta >= 0) {
          if (isInsideVA) { upInside.push(rect) } else { upOutside.push(rect) }
        } else {
          if (isInsideVA) { downInside.push(rect) } else { downOutside.push(rect) }
        }
      }
    }

    // Push rect batches
    pushRects(figures, upOutside, ext.upVolume.color, ext.upVolume.opacity, ext.upVolume.visible)
    pushRects(figures, downOutside, ext.downVolume.color, ext.downVolume.opacity, ext.downVolume.visible)
    pushRects(figures, upInside, ext.valueAreaUp.color, ext.valueAreaUp.opacity, ext.valueAreaUp.visible)
    pushRects(figures, downInside, ext.valueAreaDown.color, ext.valueAreaDown.opacity, ext.valueAreaDown.visible)
  }

  // 3. POC line
  if (ext.pocLine.visible && profile.rows.length > 0) {
    const pocRow = profile.rows[profile.pocIndex]
    const pocPrice = (pocRow.priceLow + pocRow.priceHigh) / 2
    const pocY = yAxis.convertToPixel(pocPrice)

    pushLine(figures, leftX, rightX, pocY, ext.pocLine)
  }

  // 4. Developing lines
  if (developingData !== undefined) {
    if (ext.developingPocLine.visible && developingData.poc.length > 1) {
      pushSteppedLine(figures, developingData.poc, xAxis, yAxis, ext.developingPocLine)
    }
    if (ext.developingVahLine.visible && developingData.vah.length > 1) {
      pushSteppedLine(figures, developingData.vah, xAxis, yAxis, ext.developingVahLine)
    }
    if (ext.developingValLine.visible && developingData.val.length > 1) {
      pushSteppedLine(figures, developingData.val, xAxis, yAxis, ext.developingValLine)
    }
  }

  return figures
}

function pushRects (
  figures: OverlayFigure[],
  rects: RectAttrs[],
  color: string,
  opacity: number,
  visible: boolean
): void {
  if (!visible || rects.length === 0) return
  const fillColor = hexToRgba(color, opacity)
  for (const r of rects) {
    figures.push({
      type: 'rect',
      attrs: r,
      styles: { style: 'fill', color: fillColor },
      ignoreEvent: true
    })
  }
}

function pushLine (
  figures: OverlayFigure[],
  x1: number,
  x2: number,
  y: number,
  config: VPFRLineConfig
): void {
  const lineAttrs: LineAttrs = {
    coordinates: [{ x: x1, y }, { x: x2, y }]
  }
  figures.push({
    type: 'line',
    attrs: lineAttrs,
    styles: {
      style: config.style === 'solid' ? 'solid' : 'dashed',
      color: config.color,
      size: config.width,
      dashedValue: lineStyleToDash(config.style)
    },
    ignoreEvent: true
  })
}

function pushSteppedLine (
  figures: OverlayFigure[],
  points: Array<{ idx: number, price: number }>,
  xAxis: XAxis,
  yAxis: YAxis,
  config: VPFRLineConfig
): void {
  // Build stepped coordinates: for each point, add horizontal then vertical segment
  const coords: Coordinate[] = []
  for (let i = 0; i < points.length; i++) {
    const x = xAxis.convertToPixel(points[i].idx)
    const y = yAxis.convertToPixel(points[i].price)
    if (i > 0) {
      // Horizontal step from previous point's y to current x
      coords.push({ x, y: coords[coords.length - 1].y })
    }
    coords.push({ x, y })
  }

  if (coords.length < 2) return

  const lineAttrs: LineAttrs = { coordinates: coords }
  figures.push({
    type: 'line',
    attrs: lineAttrs,
    styles: {
      style: config.style === 'solid' ? 'solid' : 'dashed',
      color: config.color,
      size: config.width,
      dashedValue: lineStyleToDash(config.style)
    },
    ignoreEvent: true
  })
}
