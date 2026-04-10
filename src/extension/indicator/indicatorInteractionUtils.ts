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

/**
 * Shared interaction utilities for indicators:
 * - Hit segment collection (for Event.ts hover/click detection)
 * - Sparse control point rendering (when selected)
 */

// ═══════════════════════════════════════════════════════════════
// Control point constants (matches trendline style but smaller)
// ═══════════════════════════════════════════════════════════════

const CP_RADIUS = 3.5
const CP_BORDER = 1.5
const CP_COLOR = '#1592E6'

// ═══════════════════════════════════════════════════════════════
// Theme-aware background color for control points
// ═══════════════════════════════════════════════════════════════

function isLightColor (hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (m === null) return false
  return (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000 > 128
}

interface ChartLike { getStyles: () => { yAxis: { tickText: { color: string } } } }

export function getControlPointBgColor (chart: ChartLike): string {
  const tickTextColor = String(chart.getStyles().yAxis.tickText.color)
  return isLightColor(tickTextColor) ? '#131722' : '#ffffff'
}

// ═══════════════════════════════════════════════════════════════
// Hit segment type
// ═══════════════════════════════════════════════════════════════

export interface HitSegment {
  x1: number; y1: number; x2: number; y2: number
}

// ═══════════════════════════════════════════════════════════════
// Collect straight-line segments between consecutive bars
// ═══════════════════════════════════════════════════════════════

interface AxisConverter { convertToPixel: (v: number) => number }

export function collectLineSegments (
  result: Array<Record<string, unknown>>,
  from: number,
  to: number,
  xAxis: AxisConverter,
  yAxis: AxisConverter,
  key: string,
  indexOffset = 0
): HitSegment[] {
  const segments: HitSegment[] = []
  let prevX = 0
  let prevY = 0
  let started = false

  for (let i = from; i < to && i < result.length; i++) {
    const val = result[i][key]
    if (typeof val !== 'number' || isNaN(val)) {
      started = false
      continue
    }
    const x = xAxis.convertToPixel(i + indexOffset)
    const y = yAxis.convertToPixel(val)
    if (started) {
      segments.push({ x1: prevX, y1: prevY, x2: x, y2: y })
    }
    prevX = x
    prevY = y
    started = true
  }
  return segments
}

// ═══════════════════════════════════════════════════════════════
// Draw sparse control points: start, middle, end of each line
// ═══════════════════════════════════════════════════════════════

export function drawSparseControlPoints (
  ctx: CanvasRenderingContext2D,
  result: Array<Record<string, unknown>>,
  from: number,
  to: number,
  xAxis: AxisConverter,
  yAxis: AxisConverter,
  keys: string[],
  indexOffset = 0,
  bgColor = '#131722'
): void {
  // Visible pixel bounds (with margin for points near edges)
  const visLeft = xAxis.convertToPixel(from + indexOffset) - CP_RADIUS * 2
  const visRight = xAxis.convertToPixel(Math.min(to, result.length) - 1 + indexOffset) + CP_RADIUS * 2

  const points: Array<{ x: number; y: number }> = []

  for (const key of keys) {
    // Scan FULL data range to find fixed segment boundaries
    let segment: number[] = []

    const flushSegment = (): void => {
      if (segment.length === 0) return
      const first = segment[0]
      const last = segment[segment.length - 1]
      const firstVal = result[first][key] as number
      points.push({ x: xAxis.convertToPixel(first + indexOffset), y: yAxis.convertToPixel(firstVal) })
      if (last !== first) {
        const lastVal = result[last][key] as number
        points.push({ x: xAxis.convertToPixel(last + indexOffset), y: yAxis.convertToPixel(lastVal) })
      }
      if (segment.length >= 5) {
        const mid = segment[Math.floor(segment.length / 2)]
        const midVal = result[mid][key] as number
        points.push({ x: xAxis.convertToPixel(mid + indexOffset), y: yAxis.convertToPixel(midVal) })
      }
      segment = []
    }

    for (let i = 0; i < result.length; i++) {
      const val = result[i][key]
      if (typeof val === 'number' && !isNaN(val)) {
        segment.push(i)
      } else {
        flushSegment()
      }
    }
    flushSegment()
  }

  // Draw only points within visible pixel range
  for (const p of points) {
    if (p.x < visLeft || p.x > visRight) continue
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.arc(p.x, p.y, CP_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = CP_COLOR
    ctx.lineWidth = CP_BORDER
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════
// Convenience: store hit segments + draw control points
// ═══════════════════════════════════════════════════════════════

export function applyIndicatorInteraction (
  ctx: CanvasRenderingContext2D,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic indicator type
  indicator: any,
  result: Array<Record<string, unknown>>,
  from: number,
  to: number,
  xAxis: AxisConverter,
  yAxis: AxisConverter,
  keys: string[],
  indexOffset = 0,
  bgColor = '#131722'
): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- generic indicator type
  let extData = indicator.extendData as Record<string, unknown> | null
  if (extData == null) {
    // Initialize extendData if not set (MA, EMA, SMA don't have it by default)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- generic indicator type
    indicator.extendData = {}
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- generic indicator type
    extData = indicator.extendData as Record<string, unknown>
  }

  // Compute hit segments
  const segs: HitSegment[] = []
  for (const key of keys) {
    segs.push(...collectLineSegments(result, from, to, xAxis, yAxis, key, indexOffset))
  }
  extData._hitSegments = segs

  // Draw control points when selected
  if (extData._selected === true) {
    drawSparseControlPoints(ctx, result, from, to, xAxis, yAxis, keys, indexOffset, bgColor)
  }
}
