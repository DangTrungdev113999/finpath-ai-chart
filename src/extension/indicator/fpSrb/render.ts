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

import type { SRBData, SRBExtendData } from './types'
import {
  FP_SRB_DEFAULT_RESISTANCE_COLOR,
  FP_SRB_DEFAULT_SUPPORT_COLOR,
  FP_SRB_DEFAULT_LINE_WIDTH,
  FP_SRB_DEFAULT_GREEN,
  FP_SRB_DEFAULT_RED
} from './constants'

interface AxisConv { convertToPixel: (v: number) => number }

/**
 * Top-level render entry. Draws, in z-order low → high:
 *   1. Resistance horizontal segments (solid red, width 3)
 *   2. Support horizontal segments (solid blue, width 3)
 *   3. 'B' green / 'B' red labels (single-char body)
 *   4. 'Bull Wick' / 'Bear Wick' labels (auto-width body)
 *
 * Backpaint is hardcoded to `-(rightBars + 1)` (S&R has no backpaint
 * toggle in Pine source — AC-05).
 *
 * Labels rendered AFTER lines so they sit on top when coincident.
 */
export function drawSRB (
  ctx: CanvasRenderingContext2D,
  result: SRBData[],
  from: number,
  to: number,
  xAxis: AxisConv,
  yAxis: AxisConv,
  ext: SRBExtendData,
  _leftBars: number,
  rightBars: number
): void {
  const resistanceColor = ext.resistanceColor ?? FP_SRB_DEFAULT_RESISTANCE_COLOR
  const supportColor = ext.supportColor ?? FP_SRB_DEFAULT_SUPPORT_COLOR
  const resistanceWidth = ext.resistanceWidth ?? FP_SRB_DEFAULT_LINE_WIDTH
  const supportWidth = ext.supportWidth ?? FP_SRB_DEFAULT_LINE_WIDTH
  const resistanceVisible = ext.resistanceVisible ?? true
  const supportVisible = ext.supportVisible ?? true

  const toggleBreaks = ext.toggleBreaks ?? true
  const bUpVisible = ext.bUpVisible ?? true
  const bDownVisible = ext.bDownVisible ?? true
  const bullWickVisible = ext.bullWickVisible ?? true
  const bearWickVisible = ext.bearWickVisible ?? true
  const bUpColor = ext.bUpColor ?? FP_SRB_DEFAULT_GREEN
  const bDownColor = ext.bDownColor ?? FP_SRB_DEFAULT_RED
  const bullWickColor = ext.bullWickColor ?? FP_SRB_DEFAULT_GREEN
  const bearWickColor = ext.bearWickColor ?? FP_SRB_DEFAULT_RED

  // Pine source: `offset=-(rightBars+1)` — always applied (no toggle).
  const indexOffset = -(rightBars + 1)

  // ─── Lines ──────────────────────────────────────────────────────────────
  if (resistanceVisible) {
    drawSegmentedHorizontalLine(ctx, result, xAxis, yAxis, 'resistance', resistanceColor, resistanceWidth, indexOffset)
  }
  if (supportVisible) {
    drawSegmentedHorizontalLine(ctx, result, xAxis, yAxis, 'support', supportColor, supportWidth, indexOffset)
  }

  // ─── Labels (Pine plotshape has NO offset → labels anchored to bar i) ───
  if (toggleBreaks) {
    for (let i = from; i < to && i < result.length; i++) {
      const r = result[i]
      // 'B' green — resistance broken with volume + clean body (label below bar, arrow up)
      if (r.bUp === true && bUpVisible) {
        drawLabelUp(
          ctx,
          xAxis.convertToPixel(i),
          yAxis.convertToPixel(r.low),
          bUpColor,
          'B'
        )
      }
      // 'B' red — support broken with volume + clean body (label above bar, arrow down)
      if (r.bDown === true && bDownVisible) {
        drawLabelDown(
          ctx,
          xAxis.convertToPixel(i),
          yAxis.convertToPixel(r.high),
          bDownColor,
          'B'
        )
      }
      // 'Bull Wick' — resistance broken with bull-wick body (label below bar, arrow up)
      if (r.bullWick === true && bullWickVisible) {
        drawLabelUp(
          ctx,
          xAxis.convertToPixel(i),
          yAxis.convertToPixel(r.low),
          bullWickColor,
          'Bull Wick'
        )
      }
      // 'Bear Wick' — support broken with bear-wick body (label above bar, arrow down)
      if (r.bearWick === true && bearWickVisible) {
        drawLabelDown(
          ctx,
          xAxis.convertToPixel(i),
          yAxis.convertToPixel(r.high),
          bearWickColor,
          'Bear Wick'
        )
      }
    }
  }
}

/**
 * Step-function horizontal line draw. Each `undefined` entry breaks the
 * current run (creates the 1-bar visual gap from `change() ? na`). A run
 * of contiguous defined values with the SAME value is drawn as one
 * straight horizontal segment from first-bar to last-bar of the run.
 *
 * In S&R levels never drift between pivots (constant value within a run),
 * so collapsing to a single horizontal stroke is exact (no zigzag risk).
 */
function drawSegmentedHorizontalLine (
  ctx: CanvasRenderingContext2D,
  result: SRBData[],
  xAxis: AxisConv,
  yAxis: AxisConv,
  key: 'resistance' | 'support',
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

  const flushRun = (): void => {
    if (firstIdx < 0) return
    const x1 = xAxis.convertToPixel(firstIdx + indexOffset)
    const y = yAxis.convertToPixel(firstVal)
    const x2 = xAxis.convertToPixel(lastIdx + indexOffset)
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
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
  }
  flushRun()
  ctx.stroke()
}

// Cache measured widths per text — measureText is cheap but called per draw,
// so a small cache avoids redundant work for the few unique strings used.
const labelTextWidthCache = new Map<string, number>()

function getLabelBodyWidth (ctx: CanvasRenderingContext2D, text: string): number {
  // Single-char 'B' uses a fixed 12px body for visual consistency with
  // Trendlines breakout markers. Multi-char text auto-fits with padding.
  if (text.length <= 1) return 12

  const cached = labelTextWidthCache.get(text)
  if (cached !== undefined) return cached

  ctx.save()
  ctx.font = '9px Arial'
  const m = ctx.measureText(text)
  ctx.restore()
  const w = Math.ceil(m.width) + 8 // 4px horizontal padding each side
  labelTextWidthCache.set(text, w)
  return w
}

/**
 * TV `shape.labelup`: body BELOW the anchor with a 4px upward arrow tip
 * touching the anchor. Body width auto-fits text, height fixed at 12px.
 */
function drawLabelUp (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bg: string,
  text: string
): void {
  const w = getLabelBodyWidth(ctx, text)
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
  ctx.fillText(text, x, bodyTop + h / 2)
  ctx.restore()
}

/**
 * TV `shape.labeldown`: body ABOVE the anchor with a 4px downward arrow
 * tip touching the anchor. Body width auto-fits text, height fixed at 12px.
 */
function drawLabelDown (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bg: string,
  text: string
): void {
  const w = getLabelBodyWidth(ctx, text)
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
  ctx.fillText(text, x, bodyTop + h / 2)
  ctx.restore()
}
