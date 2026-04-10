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

import type Bounding from '../../../common/Bounding'
import type { XAxis } from '../../../component/XAxis'
import type { YAxis } from '../../../component/YAxis'
import type { KLineData } from '../../../common/Data'

import type { FPVPFRProfile, FPVPFRSettings } from './types'

interface RectBatch {
  x: number
  y: number
  w: number
  h: number
}

function batchFillRects (ctx: CanvasRenderingContext2D, rects: RectBatch[], color: string): void {
  if (rects.length === 0) return
  ctx.fillStyle = color
  for (const r of rects) {
    ctx.fillRect(r.x, r.y, r.w, r.h)
  }
}

function formatPrice (price: number): string {
  // Auto-detect precision: show enough decimals for meaningful display
  if (price >= 1000) return price.toFixed(0)
  if (price >= 100) return price.toFixed(1)
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

/**
 * Draw a rounded rectangle path (for POC label background).
 */
function roundedRect (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

export function drawFPVPFR (
  ctx: CanvasRenderingContext2D,
  profile: FPVPFRProfile,
  settings: FPVPFRSettings,
  bounding: Bounding,
  xAxis: XAxis,
  yAxis: YAxis,
  dataList: KLineData[]
): void {
  // Time-anchored positioning: bars start at fromIndex
  const fromX = xAxis.convertToPixel(profile.fromIndex)
  const toX = xAxis.convertToPixel(profile.toIndex)
  const rangeWidthPx = Math.abs(toX - fromX)
  const maxBarWidthPx = rangeWidthPx / 3 // ~33% of lookback range

  if (maxBarWidthPx < 1) return

  // With destination-over compositing (zLevel=-1), items drawn FIRST are
  // closest to the front (behind candles but on top of later draws).
  // Draw order: POC line first -> histogram bars -> POC label last

  // === 1. POC Line (solid, not dashed) ===
  if (settings.showLines) {
    const pocY = yAxis.convertToPixel(profile.rows[profile.pocIndex].mid)
    ctx.strokeStyle = settings.pocColor
    ctx.lineWidth = settings.pocLineWidth
    ctx.setLineDash([]) // Solid line — clear any inherited dash pattern
    ctx.beginPath()
    ctx.moveTo(fromX, pocY)
    ctx.lineTo(bounding.width, pocY) // Extends right to chart edge
    ctx.stroke()
  }

  // === 2. Histogram Bars (4-color batched) ===
  if (settings.showBoxes) {
    const upOutside: RectBatch[] = []
    const downOutside: RectBatch[] = []
    const upInside: RectBatch[] = []
    const downInside: RectBatch[] = []

    for (let i = 0; i < profile.rows.length; i++) {
      const row = profile.rows[i]
      if (row.totalVol === 0) continue

      const rowTopY = yAxis.convertToPixel(row.high)
      const rowBottomY = yAxis.convertToPixel(row.low)
      // Small gap between rows per Pine Script formula: dist = (top - bot) / 500
      const dist = Math.abs(rowBottomY - rowTopY) / (profile.rows.length * 2)
      const barHeight = Math.max(1, Math.abs(rowBottomY - rowTopY) - 2 * dist)

      const isVA = i >= profile.valIndex && i <= profile.vahIndex
      const relWidth = row.totalVol / profile.maxRowVolume
      const totalWidth = relWidth * maxBarWidthPx
      const buyRatio = row.totalVol > 0 ? row.buyVol / row.totalVol : 0
      const buyWidth = totalWidth * buyRatio
      const sellWidth = totalWidth - buyWidth

      const y = Math.min(rowTopY, rowBottomY) + dist
      const x = fromX

      // Left = buy (up), Right = sell (down)
      if (buyWidth > 0) {
        ;(isVA ? upInside : upOutside).push({ x, y, w: buyWidth, h: barHeight })
      }
      if (sellWidth > 0) {
        ;(isVA ? downInside : downOutside).push({ x: x + buyWidth, y, w: sellWidth, h: barHeight })
      }
    }

    // Batch draw: outside first (behind), then inside (on top) due to destination-over
    batchFillRects(ctx, downOutside, settings.downVolumeColor)
    batchFillRects(ctx, upOutside, settings.upVolumeColor)
    batchFillRects(ctx, downInside, settings.vaDownColor)
    batchFillRects(ctx, upInside, settings.vaUpColor)
  }

  // === 3. POC Label ===
  // Must use source-over compositing because zLevel=-1 uses destination-over,
  // which would draw white text BEHIND the blue pill (invisible).
  if (settings.showPOCLabel && settings.showPaneLabels) {
    const prevCompositing = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'source-over'

    const pocPrice = profile.rows[profile.pocIndex].mid
    const pocY = yAxis.convertToPixel(pocPrice)
    const labelX = xAxis.convertToPixel(profile.toIndex + 15)
    const labelText = `POC: ${formatPrice(pocPrice)}`
    const lastClose = dataList[profile.toIndex]?.close ?? 0
    const isUp = lastClose >= pocPrice

    const fontSize = 11
    ctx.font = `${fontSize}px sans-serif`
    const textMetrics = ctx.measureText(labelText)
    const textWidth = textMetrics.width

    const paddingH = 6
    const paddingV = 3
    const arrowSize = 5
    const pillWidth = textWidth + paddingH * 2
    const pillHeight = fontSize + paddingV * 2
    const pillX = labelX - pillWidth / 2
    const pillY = isUp ? pocY - pillHeight - arrowSize : pocY + arrowSize

    // Blue background pill
    ctx.fillStyle = '#2196F3'
    roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 3)
    ctx.fill()

    // Arrow (triangle) pointing to POC line
    ctx.beginPath()
    if (isUp) {
      // Arrow pointing down (label is above POC line)
      ctx.moveTo(labelX - arrowSize, pillY + pillHeight)
      ctx.lineTo(labelX + arrowSize, pillY + pillHeight)
      ctx.lineTo(labelX, pillY + pillHeight + arrowSize)
    } else {
      // Arrow pointing up (label is below POC line)
      ctx.moveTo(labelX - arrowSize, pillY)
      ctx.lineTo(labelX + arrowSize, pillY)
      ctx.lineTo(labelX, pillY - arrowSize)
    }
    ctx.closePath()
    ctx.fill()

    // White text
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelText, pillX + pillWidth / 2, pillY + pillHeight / 2)

    ctx.globalCompositeOperation = prevCompositing
  }
}
