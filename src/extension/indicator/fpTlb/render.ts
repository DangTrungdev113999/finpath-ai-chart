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

import type { TLBData, TLBExtendData } from './types'
import {
  FP_TLB_DEFAULT_UP_COLOR,
  FP_TLB_DEFAULT_DN_COLOR
} from './constants'

interface AxisConv { convertToPixel: (v: number) => number }

/**
 * Top-level render entry. Draws, in z-order low → high:
 *   1. Main solid segments (upper, lower)
 *   2. Dashed right-extending projections (if showExt)
 *   3. Breakout "B" labels at current-bar break events
 *
 * Backpaint is applied exclusively here via `indexOffset` so toggling it
 * triggers only a re-draw (not a recompute).
 */
export function drawTLB (
  ctx: CanvasRenderingContext2D,
  result: TLBData[],
  from: number,
  to: number,
  xAxis: AxisConv,
  yAxis: AxisConv,
  ext: TLBExtendData,
  length: number
): void {
  const upColor = ext.upColor ?? FP_TLB_DEFAULT_UP_COLOR
  const dnColor = ext.dnColor ?? FP_TLB_DEFAULT_DN_COLOR
  const showExt = ext.showExt ?? true
  const backpaint = ext.backpaint ?? true
  const indexOffset = backpaint ? -length : 0

  drawSegmentedLine(ctx, result, xAxis, yAxis, 'upper', upColor, 1, indexOffset)
  drawSegmentedLine(ctx, result, xAxis, yAxis, 'lower', dnColor, 1, indexOffset)

  if (showExt) {
    drawDashedExtension(ctx, result, xAxis, yAxis, 'upper', upColor, length, indexOffset)
    drawDashedExtension(ctx, result, xAxis, yAxis, 'lower', dnColor, length, indexOffset)
  }

  // Pine `plotshape` has no `offset` argument in this script — breakout
  // markers fire at the actual breakout bar regardless of `backpaint`. Pass
  // 0 here so the labels stay anchored to bar `i`, not shifted with the lines.
  drawBreakoutLabels(ctx, result, from, to, xAxis, yAxis, upColor, dnColor, 0)
}

/**
 * Solid trend-line draw. Between two pivot-confirm bars (both emit
 * `undefined` → segment break), the state machine guarantees `upper`/`lower`
 * is LINEAR in bar index (`upperState -= slopePh` with constant `slopePh`).
 * So each contiguous non-undefined run is collapsed to a SINGLE straight
 * line from first-point to last-point — bypassing the per-bar integer
 * pixel snap (`Math.floor` in `dataIndexToCoordinate`) that would otherwise
 * cause visible zigzag waviness at fractional bar spacing.
 *
 * Scans the full data range (not just `[from,to]`): with `indexOffset = -length`
 * (backpaint) a run's endpoints may sit outside the visible data-index window
 * while still being on-screen in pixel space.
 */
function drawSegmentedLine (
  ctx: CanvasRenderingContext2D,
  result: TLBData[],
  xAxis: AxisConv,
  yAxis: AxisConv,
  key: 'upper' | 'lower',
  color: string,
  width: number,
  indexOffset: number
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash([])
  ctx.beginPath()

  let firstIdx = -1
  let firstVal = 0
  let lastIdx = -1
  let lastVal = 0

  const flushRun = (): void => {
    if (firstIdx < 0) return
    const x1 = xAxis.convertToPixel(firstIdx + indexOffset)
    const y1 = yAxis.convertToPixel(firstVal)
    const x2 = xAxis.convertToPixel(lastIdx + indexOffset)
    const y2 = yAxis.convertToPixel(lastVal)
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }

  for (let i = 0; i < result.length; i++) {
    const v = result[i][key]
    if (v === undefined) {
      flushRun()
      firstIdx = -1
      continue
    }
    if (firstIdx < 0) {
      firstIdx = i
      firstVal = v
    }
    lastIdx = i
    lastVal = v
  }
  flushRun()
  ctx.stroke()
}

/**
 * Dashed extension from the most recent defined point forward, projecting
 * `length * 8` bars past the last bar (reliably past the visible right edge
 * at normal zoom). Slope matches the solid-segment slope at time of last
 * pivot confirmation.
 */
function drawDashedExtension (
  ctx: CanvasRenderingContext2D,
  result: TLBData[],
  xAxis: AxisConv,
  yAxis: AxisConv,
  key: 'upper' | 'lower',
  color: string,
  length: number,
  indexOffset: number
): void {
  let lastIdx = -1
  let lastVal = 0
  for (let i = result.length - 1; i >= 0; i--) {
    const v = result[i][key]
    if (v !== undefined) { lastIdx = i; lastVal = v; break }
  }
  if (lastIdx < 0) return

  const slope = key === 'upper' ? result[lastIdx].slopePh : result[lastIdx].slopePl

  const rightExtendBars = length * 8
  const endIdx = result.length - 1 + rightExtendBars
  // Upper descends per bar (−slopePh); lower ascends per bar (+slopePl).
  const slopePerBar = key === 'upper' ? -slope : slope
  const endVal = lastVal + slopePerBar * (endIdx - lastIdx)

  const x1 = xAxis.convertToPixel(lastIdx + indexOffset)
  const y1 = yAxis.convertToPixel(lastVal)
  const x2 = xAxis.convertToPixel(endIdx + indexOffset)
  const y2 = yAxis.convertToPixel(endVal)

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

/** Iterate the visible range; draw break labels at anchor prices. */
function drawBreakoutLabels (
  ctx: CanvasRenderingContext2D,
  result: TLBData[],
  from: number,
  to: number,
  xAxis: AxisConv,
  yAxis: AxisConv,
  upColor: string,
  dnColor: string,
  indexOffset: number
): void {
  for (let i = from; i < to && i < result.length; i++) {
    const r = result[i]
    if (r.upperBreak) {
      drawLabelUp(
        ctx,
        xAxis.convertToPixel(i + indexOffset),
        yAxis.convertToPixel(r.low),
        upColor
      )
    }
    if (r.lowerBreak) {
      drawLabelDown(
        ctx,
        xAxis.convertToPixel(i + indexOffset),
        yAxis.convertToPixel(r.high),
        dnColor
      )
    }
  }
}

/**
 * TV `shape.labelup`: 12×12 body BELOW the anchor with a 4px upward arrow
 * tip touching the anchor (the break bar's `low`). "B" in white, 9px Arial.
 */
function drawLabelUp (ctx: CanvasRenderingContext2D, x: number, y: number, bg: string): void {
  const w = 12
  const h = 12
  const pointer = 4
  const bodyTop = y + pointer
  const bodyBottom = bodyTop + h
  ctx.save()
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.moveTo(x, y) // arrow tip — points UP at anchor
  ctx.lineTo(x + pointer, bodyTop) // right side of pointer base
  ctx.lineTo(x + w / 2, bodyTop) // top-right of body
  ctx.lineTo(x + w / 2, bodyBottom) // bottom-right
  ctx.lineTo(x - w / 2, bodyBottom) // bottom-left
  ctx.lineTo(x - w / 2, bodyTop) // top-left
  ctx.lineTo(x - pointer, bodyTop) // left side of pointer base
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '9px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', x, bodyTop + h / 2)
  ctx.restore()
}

/**
 * TV `shape.labeldown`: mirror of labelup — 12×12 body ABOVE the anchor with
 * a 4px downward arrow tip touching the anchor (the break bar's `high`).
 */
function drawLabelDown (ctx: CanvasRenderingContext2D, x: number, y: number, bg: string): void {
  const w = 12
  const h = 12
  const pointer = 4
  const bodyBottom = y - pointer
  const bodyTop = bodyBottom - h
  ctx.save()
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.moveTo(x, y) // arrow tip — points DOWN at anchor
  ctx.lineTo(x + pointer, bodyBottom) // right side of pointer base
  ctx.lineTo(x + w / 2, bodyBottom) // bottom-right of body
  ctx.lineTo(x + w / 2, bodyTop) // top-right
  ctx.lineTo(x - w / 2, bodyTop) // top-left
  ctx.lineTo(x - w / 2, bodyBottom) // bottom-left
  ctx.lineTo(x - pointer, bodyBottom) // left side of pointer base
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '9px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', x, bodyTop + h / 2)
  ctx.restore()
}
