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
import type { Chart } from '../../../Chart'

import type { HitSegment } from '../indicatorInteractionUtils'
import type { AMData, AMExtendData, AMMatch, ProjectionGeometry } from './types'
import {
  FP_AM_BEAR_FILL,
  FP_AM_BEAR_LABEL,
  FP_AM_BEAR_WICK,
  FP_AM_BULL_FILL,
  FP_AM_BULL_LABEL,
  FP_AM_BULL_WICK,
  FP_AM_TABLE_BG,
  FP_AM_TABLE_BORDER,
  FP_AM_TABLE_HEADER_BG,
  FP_AM_TABLE_TEXT
} from './constants'

// ── Stats-table layout constants (Pine parity; see tad-specifics.md §2). ──
const COL_WIDTHS = [48, 72, 96, 72] as const
const TABLE_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0)
const ROW_HEIGHT = 18
const TABLE_FONT = '12px Arial'
const TABLE_MARGIN = 8

// ── Time formatting (Pine "MM-dd HH:mm") ──────────────────────────────────
function pad2 (n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatAnchorTime (ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'N/A'
  const d = new Date(ts)
  const MM = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const HH = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${MM}-${dd} ${HH}:${mm}`
}

// ── Projected-candle primitives ───────────────────────────────────────────

function drawProjectedBody (
  ctx: CanvasRenderingContext2D,
  xL: number,
  xR: number,
  yTop: number,
  yBot: number,
  fill: string
): void {
  const x = Math.round(Math.min(xL, xR))
  const w = Math.max(1, Math.round(Math.abs(xR - xL)) - 1) // 1-px gutter between candles
  const y = Math.round(Math.min(yTop, yBot))
  const h = Math.max(1, Math.round(Math.abs(yBot - yTop))) // doji → h=1
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
}

function drawProjectedWick (
  ctx: CanvasRenderingContext2D,
  xC: number,
  yHigh: number,
  yLow: number,
  stroke: string
): void {
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.beginPath()
  // +0.5 on X only — crisp 1-px vertical stroke aligned to pixel grid.
  const x = Math.round(xC) + 0.5
  ctx.moveTo(x, Math.round(yHigh))
  ctx.lineTo(x, Math.round(yLow))
  ctx.stroke()
}

function drawProjection (
  ctx: CanvasRenderingContext2D,
  proj: ProjectionGeometry,
  lastIdx: number,
  bodyColor: string,
  wickColor: string,
  showBoxes: boolean,
  showLines: boolean,
  xAxis: XAxis,
  yAxis: YAxis,
  bounding: Bounding,
  hitSegments?: HitSegment[]
): void {
  if (!showBoxes && !showLines) return
  const bars = proj.bars
  if (bars.length === 0) return

  // Viewport cull — skip entire projection if fully off-screen.
  const firstX = xAxis.convertToPixel(lastIdx)
  const lastX = xAxis.convertToPixel(lastIdx + bars.length)
  const left = bounding.left
  const right = bounding.left + bounding.width
  if (lastX < left || firstX > right) return

  for (let j = 0; j < bars.length; j++) {
    const bar = bars[j]
    const xL = xAxis.convertToPixel(lastIdx + j - 0.5)
    const xR = xAxis.convertToPixel(lastIdx + j + 0.5)
    const xC = xAxis.convertToPixel(lastIdx + j)

    if (showBoxes) {
      const yTop = yAxis.convertToPixel(Math.max(bar.o, bar.c))
      const yBot = yAxis.convertToPixel(Math.min(bar.o, bar.c))
      drawProjectedBody(ctx, xL, xR, yTop, yBot, bodyColor)
      // Hit segments: top + bottom body edges — cover horizontal click area.
      if (hitSegments !== undefined) {
        hitSegments.push({ x1: xL, y1: yTop, x2: xR, y2: yTop })
        hitSegments.push({ x1: xL, y1: yBot, x2: xR, y2: yBot })
      }
    }
    if (showLines) {
      const yHigh = yAxis.convertToPixel(bar.h)
      const yLow = yAxis.convertToPixel(bar.l)
      drawProjectedWick(ctx, xC, yHigh, yLow, wickColor)
      // Hit segment: full wick — covers vertical click area of the candle.
      if (hitSegments !== undefined) {
        hitSegments.push({ x1: xC, y1: yHigh, x2: xC, y2: yLow })
      }
    }
  }
}

// ── Stats table ───────────────────────────────────────────────────────────

interface Cell {
  text: string
  color: string
}
interface Row {
  cells: [Cell, Cell, Cell, Cell]
}

function naRow (dirLabel: 'Bull' | 'Bear', dirColor: string, textColor: string): Row {
  return {
    cells: [
      { text: dirLabel, color: dirColor },
      { text: 'N/A', color: textColor },
      { text: 'N/A', color: textColor },
      { text: '0.00%', color: textColor }
    ]
  }
}

function matchRow (
  dirLabel: 'Bull' | 'Bear',
  dirColor: string,
  match: AMMatch,
  textColor: string
): Row {
  return {
    cells: [
      { text: dirLabel, color: dirColor },
      { text: String(match.anchorIdx), color: textColor },
      { text: formatAnchorTime(match.anchorTime), color: textColor },
      { text: match.confidence.toFixed(2) + '%', color: textColor }
    ]
  }
}

interface TimeCell {
  x: number
  y: number
  w: number
  h: number
  timestamp: number
}

interface TableLayout {
  hitArea: { left: number; top: number; right: number; bottom: number }
  timeCells: TimeCell[]
}

function drawStatsTable (
  ctx: CanvasRenderingContext2D,
  bounding: Bounding,
  rows: Row[],
  rowTimestamps: Array<number | null>,
  ext: AMExtendData,
  tableOffsetY: number,
  selected: boolean
): TableLayout | null {
  if (rows.length === 0) return null

  const bgColor = ext.tableBg ?? FP_AM_TABLE_BG
  const borderColor = selected ? '#2962FF' : (ext.tableBorder ?? FP_AM_TABLE_BORDER)
  const headerBgColor = ext.tableHeaderBg ?? FP_AM_TABLE_HEADER_BG

  const tableH = ROW_HEIGHT * rows.length
  const anchorX = Math.round(bounding.left + bounding.width - TABLE_WIDTH - TABLE_MARGIN)
  const anchorY = Math.round(bounding.top + TABLE_MARGIN + tableOffsetY)

  // 1. Background fill (entire table).
  ctx.fillStyle = bgColor
  ctx.fillRect(anchorX, anchorY, TABLE_WIDTH, tableH)

  // 2. Header row fill (gray).
  ctx.fillStyle = headerBgColor
  ctx.fillRect(anchorX, anchorY, TABLE_WIDTH, ROW_HEIGHT)

  // 3. Outer 1-px border (blue when selected).
  ctx.strokeStyle = borderColor
  ctx.lineWidth = selected ? 1.5 : 1
  ctx.strokeRect(anchorX + 0.5, anchorY + 0.5, TABLE_WIDTH - 1, tableH - 1)

  // Build the hit area (full table rect) + per-row Time cell rects so the
  // consumer can detect clicks on the Time column and scroll the chart.
  const hitArea = {
    left: anchorX,
    top: anchorY,
    right: anchorX + TABLE_WIDTH,
    bottom: anchorY + tableH
  }
  const timeCells: TimeCell[] = []
  // Column 2 is the Time column: x starts after col 0 (Dir) + col 1 (Bar).
  const timeColX = anchorX + COL_WIDTHS[0] + COL_WIDTHS[1]
  const timeColW = COL_WIDTHS[2]
  // Rows 1..N are data rows (row 0 is the header). Only populate when
  // rowTimestamps[r] is a finite number (skip N/A rows).
  for (let r = 1; r < rows.length; r++) {
    const ts = rowTimestamps[r]
    if (ts === null || !Number.isFinite(ts)) continue
    timeCells.push({
      x: timeColX,
      y: anchorY + r * ROW_HEIGHT,
      w: timeColW,
      h: ROW_HEIGHT,
      timestamp: ts
    })
  }

  // 4. Row separators (horizontal).
  ctx.beginPath()
  for (let r = 1; r < rows.length; r++) {
    const y = anchorY + r * ROW_HEIGHT + 0.5
    ctx.moveTo(anchorX, y)
    ctx.lineTo(anchorX + TABLE_WIDTH, y)
  }
  ctx.stroke()

  // 5. Column separators (vertical).
  ctx.beginPath()
  let xAcc = anchorX
  for (let c = 0; c < COL_WIDTHS.length - 1; c++) {
    xAcc += COL_WIDTHS[c]
    const x = xAcc + 0.5
    ctx.moveTo(x, anchorY)
    ctx.lineTo(x, anchorY + tableH)
  }
  ctx.stroke()

  // 6. Cell text (last — always on top).
  ctx.font = TABLE_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let r = 0; r < rows.length; r++) {
    const y = anchorY + r * ROW_HEIGHT + ROW_HEIGHT / 2
    let x = anchorX
    for (let c = 0; c < 4; c++) {
      const cell = rows[r].cells[c]
      ctx.fillStyle = cell.color
      ctx.fillText(cell.text, x + COL_WIDTHS[c] / 2, y)
      x += COL_WIDTHS[c]
    }
  }

  return { hitArea, timeCells }
}

// ── Multi-instance stacking offset (Pine AC-32) ───────────────────────────
function resolveInstanceOffsetY (
  chart: Chart | undefined,
  indicatorId: string | undefined,
  paneId: string | undefined,
  name: string,
  tableH: number
): number {
  if (chart === undefined || indicatorId === undefined || paneId === undefined) return 0
  try {
    const siblings = chart.getIndicators({ paneId, name })
    const siblingIdx = siblings.findIndex(i => i.id === indicatorId)
    if (siblingIdx <= 0) return 0
    return siblingIdx * (tableH + 4)
  } catch {
    return 0
  }
}

// ── Public entry point ────────────────────────────────────────────────────

/**
 * Render analogue-matcher projection(s) + stats table.
 *
 * Render order (back → front) guarantees wicks / text are never clipped:
 *   1. Bull projection bodies
 *   2. Bear projection bodies
 *   3. Bull projection wicks
 *   4. Bear projection wicks
 *   5. Stats-table bg + header + border + separators
 *   6. Stats-table text
 */
export function drawAM (
  ctx: CanvasRenderingContext2D,
  result: AMData[],
  ext: AMExtendData,
  bounding: Bounding,
  xAxis: XAxis,
  yAxis: YAxis,
  chart?: Chart,
  indicatorId?: string,
  indicatorPaneId?: string,
  indicatorName?: string
): void {
  if (result.length === 0) return
  const last = result[result.length - 1]
  const lastIdx = last.lastIdx
  if (lastIdx === undefined) return

  const showBoxes = ext.showBoxes ?? true
  const showLines = ext.showLines ?? true
  const showTable = ext.showTable ?? true
  const selected = (ext as unknown as { _selected?: boolean })._selected === true

  // Hit segments — library uses these for click-near-line detection (6px tolerance).
  // Covers projected wicks, body top/bottom edges, and stats-table border.
  const hitSegments: HitSegment[] = []

  const bullFill = ext.bullFill ?? FP_AM_BULL_FILL
  const bearFill = ext.bearFill ?? FP_AM_BEAR_FILL
  const bullWick = ext.bullFill ?? FP_AM_BULL_WICK
  const bearWick = ext.bearFill ?? FP_AM_BEAR_WICK
  const bullLabel = ext.bullLabel ?? FP_AM_BULL_LABEL
  const bearLabel = ext.bearLabel ?? FP_AM_BEAR_LABEL
  const textColor = ext.tableText ?? FP_AM_TABLE_TEXT

  const isDual = last.mode === 'Dual Mode'

  // ── 1. Bull bodies ──────────────────────────────────────────────────────
  if (isDual) {
    const bull = last.bullMatch ?? null
    if (bull?.projection != null) {
      drawProjection(ctx, bull.projection, lastIdx, bullFill, bullWick, showBoxes, false, xAxis, yAxis, bounding, hitSegments)
    }
    const bear = last.bearMatch ?? null
    // 2. Bear bodies
    if (bear?.projection != null) {
      drawProjection(ctx, bear.projection, lastIdx, bearFill, bearWick, showBoxes, false, xAxis, yAxis, bounding, hitSegments)
    }
    // 3. Bull wicks
    if (bull?.projection != null) {
      drawProjection(ctx, bull.projection, lastIdx, bullFill, bullWick, false, showLines, xAxis, yAxis, bounding, hitSegments)
    }
    // 4. Bear wicks
    if (bear?.projection != null) {
      drawProjection(ctx, bear.projection, lastIdx, bearFill, bearWick, false, showLines, xAxis, yAxis, bounding, hitSegments)
    }
  } else {
    const best = last.bestMatch ?? null
    if (best?.projection != null) {
      const dir = best.direction ?? 'Bull'
      const bodyColor = dir === 'Bull' ? bullFill : bearFill
      const wickColor = dir === 'Bull' ? bullWick : bearWick
      // Single projection: draw bodies then wicks (no cross-candle ordering needed).
      drawProjection(ctx, best.projection, lastIdx, bodyColor, wickColor, showBoxes, false, xAxis, yAxis, bounding, hitSegments)
      drawProjection(ctx, best.projection, lastIdx, bodyColor, wickColor, false, showLines, xAxis, yAxis, bounding, hitSegments)
    }
  }

  // ── 5 + 6. Stats table ─────────────────────────────────────────────────
  if (!showTable) {
    // Still persist hit segments even if table is hidden. Clear AABB + time cells.
    const extMut = ext as unknown as {
      _hitSegments: HitSegment[]
      _hitArea?: unknown
      _timeCells?: unknown
    }
    extMut._hitSegments = hitSegments
    extMut._hitArea = undefined
    extMut._timeCells = undefined
    return
  }

  const headerRow: Row = {
    cells: [
      { text: 'Dir', color: textColor },
      { text: 'Bar', color: textColor },
      { text: 'Time', color: textColor },
      { text: 'Conf (R\u00B2)', color: textColor }
    ]
  }

  const rows: Row[] = [headerRow]
  const rowTimestamps: Array<number | null> = [null] // header has no timestamp
  if (isDual) {
    const bull = last.bullMatch ?? null
    const bear = last.bearMatch ?? null
    rows.push(bull != null
      ? matchRow('Bull', bullLabel, bull, textColor)
      : naRow('Bull', bullLabel, textColor))
    rowTimestamps.push(bull?.anchorTime ?? null)
    rows.push(bear != null
      ? matchRow('Bear', bearLabel, bear, textColor)
      : naRow('Bear', bearLabel, textColor))
    rowTimestamps.push(bear?.anchorTime ?? null)
  } else {
    const best = last.bestMatch ?? null
    if (best != null) {
      const dir = best.direction ?? 'Bull'
      const dirColor = dir === 'Bull' ? bullLabel : bearLabel
      rows.push(matchRow(dir, dirColor, best, textColor))
      rowTimestamps.push(best.anchorTime)
    } else {
      // No match in Single Mode → render a neutral N/A row (default to Bull tint).
      rows.push(naRow('Bull', bullLabel, textColor))
      rowTimestamps.push(null)
    }
  }

  const tableH = ROW_HEIGHT * rows.length
  const offsetY = resolveInstanceOffsetY(chart, indicatorId, indicatorPaneId, indicatorName ?? '', tableH)
  const tableLayout = drawStatsTable(ctx, bounding, rows, rowTimestamps, ext, offsetY, selected)

  // Persist hit info on extendData so Event.ts can detect clicks:
  //   _hitSegments — line segments for projected candles (6px tolerance)
  //   _hitArea    — AABB rect for the stats table (entire table clickable)
  //   _timeCells  — per-row Time column bounds + timestamp (consumer scrolls chart)
  const extMut = ext as unknown as {
    _hitSegments: HitSegment[]
    _hitArea?: { left: number; top: number; right: number; bottom: number }
    _timeCells?: TimeCell[]
  }
  extMut._hitSegments = hitSegments
  if (tableLayout !== null) {
    extMut._hitArea = tableLayout.hitArea
    extMut._timeCells = tableLayout.timeCells
  } else {
    extMut._hitArea = undefined
    extMut._timeCells = undefined
  }
}
