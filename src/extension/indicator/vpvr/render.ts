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
import type { YAxis } from '../../../component/YAxis'

import type { VPVRProfile, VPVRSettings, VPVRLineStyle } from './types'

interface RectBatch {
  x: number
  y: number
  w: number
  h: number
}

function lineStyleToDash (style: VPVRLineStyle): number[] {
  switch (style) {
    case 'dashed': return [6, 4]
    case 'dotted': return [2, 2]
    default: return []
  }
}

function formatVolume (vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`
  return vol.toFixed(0)
}

export function drawVPVR (
  ctx: CanvasRenderingContext2D,
  profile: VPVRProfile,
  settings: VPVRSettings,
  bounding: Bounding,
  yAxis: YAxis
): void {
  if (!settings.showProfile || profile.rows.length === 0 || profile.maxRowVolume === 0) return

  const maxWidth = bounding.width * (settings.widthPercent / 100)

  // Collect rects in 4 color groups for batch rendering
  const upOutside: RectBatch[] = []
  const downOutside: RectBatch[] = []
  const upInside: RectBatch[] = []
  const downInside: RectBatch[] = []

  for (let i = 0; i < profile.rows.length; i++) {
    const row = profile.rows[i]
    if (row.totalVol === 0) continue

    const rowTopY = yAxis.convertToPixel(row.high)
    const rowBottomY = yAxis.convertToPixel(row.low)
    const y = Math.min(rowTopY, rowBottomY)
    const barHeight = Math.max(1, Math.abs(rowBottomY - rowTopY) - 1)

    const isInsideVA = i >= profile.valIndex && i <= profile.vahIndex
    const relativeWidth = row.totalVol / profile.maxRowVolume
    const totalBarWidth = relativeWidth * maxWidth

    if (settings.volumeType === 'upDown') {
      const buyRatio = row.totalVol > 0 ? row.buyVol / row.totalVol : 0
      const buyWidth = totalBarWidth * buyRatio
      const sellWidth = totalBarWidth - buyWidth

      if (settings.placement === 'right') {
        // Bars extend leftward from right edge
        // Down (gold) on left, Up (blue) on right
        const baseX = bounding.width - totalBarWidth
        if (sellWidth > 0) {
          const target = isInsideVA ? downInside : downOutside
          target.push({ x: baseX, y, w: sellWidth, h: barHeight })
        }
        if (buyWidth > 0) {
          const target = isInsideVA ? upInside : upOutside
          target.push({ x: baseX + sellWidth, y, w: buyWidth, h: barHeight })
        }
      } else {
        // Bars extend rightward from left edge
        if (buyWidth > 0) {
          const target = isInsideVA ? upInside : upOutside
          target.push({ x: 0, y, w: buyWidth, h: barHeight })
        }
        if (sellWidth > 0) {
          const target = isInsideVA ? downInside : downOutside
          target.push({ x: buyWidth, y, w: sellWidth, h: barHeight })
        }
      }
    } else {
      // 'total' or 'delta' mode
      const isDelta = settings.volumeType === 'delta'
      const delta = row.buyVol - row.sellVol
      const barWidth = isDelta
        ? (Math.abs(delta) / profile.maxRowVolume) * maxWidth
        : totalBarWidth
      const isUpColor = isDelta ? delta >= 0 : true

      if (barWidth > 0) {
        const barX = settings.placement === 'right' ? bounding.width - barWidth : 0
        const rect: RectBatch = { x: barX, y, w: barWidth, h: barHeight }
        if (isUpColor) {
          (isInsideVA ? upInside : upOutside).push(rect)
        } else {
          (isInsideVA ? downInside : downOutside).push(rect)
        }
      }
    }
  }

  // Batch render: 4 fillStyle calls for all rects
  const batchDraw = (rects: RectBatch[], color: string): void => {
    if (rects.length === 0) return
    ctx.fillStyle = color
    for (const r of rects) {
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
  }

  // With destination-over compositing (zLevel=-1), items drawn FIRST are
  // closest to the front (behind candles but on top of later draws).
  // Draw order: POC line first → histogram bars after (POC on top of bars).

  // POC line: full chart width — drawn FIRST so it's on top of bars
  if (settings.showPOC && profile.rows.length > 0) {
    const pocRow = profile.rows[profile.pocIndex]
    const pocY = yAxis.convertToPixel(pocRow.mid)
    ctx.strokeStyle = settings.pocColor
    ctx.lineWidth = settings.pocLineWidth
    ctx.setLineDash(lineStyleToDash(settings.pocLineStyle))
    ctx.beginPath()
    ctx.moveTo(0, pocY)
    ctx.lineTo(bounding.width, pocY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Histogram bars: drawn AFTER POC so they appear behind the POC line
  batchDraw(downOutside, settings.downVolumeColor)
  batchDraw(upOutside, settings.upVolumeColor)
  batchDraw(downInside, settings.vaDownColor)
  batchDraw(upInside, settings.vaUpColor)

  // Value text on bars (P2, off by default)
  if (settings.showValues) {
    ctx.fillStyle = settings.valuesColor
    ctx.font = '10px sans-serif'
    ctx.textBaseline = 'middle'

    for (const row of profile.rows) {
      if (row.totalVol === 0) continue

      const rowTopY = yAxis.convertToPixel(row.high)
      const rowBottomY = yAxis.convertToPixel(row.low)
      const midY = (rowTopY + rowBottomY) / 2
      const text = formatVolume(row.totalVol)
      const relativeWidth = row.totalVol / profile.maxRowVolume
      const barWidth = relativeWidth * maxWidth

      if (settings.placement === 'right') {
        ctx.textAlign = 'right'
        ctx.fillText(text, bounding.width - barWidth - 4, midY)
      } else {
        ctx.textAlign = 'left'
        ctx.fillText(text, barWidth + 4, midY)
      }
    }
  }
}
