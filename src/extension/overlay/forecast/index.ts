/**
 * Forecast overlay — TradingView-style prediction tool
 *
 * Data points: 2 (P1 entry, P2 target)
 * Control points: P1 circle + P2 circle (blue fill, white 2px border)
 * 8 visual elements: x-axis markers, horizontal extension, curve, zone fill,
 * zone border, point-2 marker, entry pill, delta/outcome stacked pills.
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import { calcTextWidth } from '../../../common/utils/canvas'

import type { ForecastExtendData } from './constants'
import {
  FORECAST_DEFAULTS,
  LABEL_PADDING_H, LABEL_PADDING_V, LABEL_BORDER_RADIUS,
  LABEL_STACK_GAP, LABEL_TO_ZONE_GAP, ENTRY_PILL_OFFSET_Y, ENTRY_LABEL_LINE_GAP,
  EXTENSION_RIGHT_MARGIN,
  CP_COLOR, CP_RADIUS, CP_BORDER, CP_BORDER_COLOR,
  P2_MARKER_RADIUS,
  OUTCOME_LABELS
} from './constants'
import {
  calculateForecastStats,
  formatDeltaLabel,
  formatEntryPrice,
  formatEntryDate,
  applyAlpha
} from './utils'

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function getExt (extendData: ForecastExtendData | undefined): ForecastExtendData {
  if (extendData == null) return { ...FORECAST_DEFAULTS }
  return { ...FORECAST_DEFAULTS, ...extendData }
}

/**
 * Sample a quadratic Bezier curve from P1 → P2 with control point at
 * (p2.x, p1.y) — matches TV's "arc" shape.
 */
function sampleBezier (
  p1x: number, p1y: number,
  cpx: number, cpy: number,
  p2x: number, p2y: number,
  segments: number
): Array<{ x: number, y: number }> {
  const pts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const mt = 1 - t
    const x = mt * mt * p1x + 2 * mt * t * cpx + t * t * p2x
    const y = mt * mt * p1y + 2 * mt * t * cpy + t * t * p2y
    pts.push({ x: Math.round(x), y: Math.round(y) })
  }
  return pts
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const forecast: OverlayTemplate<ForecastExtendData> = {
  name: 'forecast',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay, bounding }) => {
    const ext = getExt(overlay.extendData)

    if (coordinates.length < 2) return []

    const [p1, p2] = coordinates
    const leftX = Math.min(p1.x, p2.x)
    const rightX = Math.max(p1.x, p2.x)
    const topY = Math.min(p1.y, p2.y)
    const bottomY = Math.max(p1.y, p2.y)
    const zoneWidth = rightX - leftX
    const zoneHeight = bottomY - topY

    const figures: OverlayFigure[] = []

    // ── Stats for delta + outcome ──
    const dataList = chart.getDataList()
    const entryPrice = overlay.points[0]?.value ?? 0
    const targetPrice = overlay.points[1]?.value ?? 0
    const entryIndex = overlay.points[0]?.dataIndex ?? 0
    const targetIndex = overlay.points[1]?.dataIndex ?? 0
    const stats = calculateForecastStats(entryPrice, targetPrice, entryIndex, targetIndex, dataList)

    const zoneFill = applyAlpha(ext.targetBackColor, ext.transparency)

    // ── 1. Horizontal extension dashed line from (p2.x, p2.y) → right edge ──
    const extEndX = Math.max(p2.x + 1, bounding.width - EXTENSION_RIGHT_MARGIN)
    figures.push({
      key: 'fc_ext_line',
      type: 'line',
      attrs: {
        coordinates: [
          { x: p2.x, y: p2.y },
          { x: extEndX, y: p2.y }
        ]
      },
      styles: {
        style: 'dashed',
        color: ext.linecolor,
        size: 1,
        dashedValue: [4, 3]
      },
      ignoreEvent: true
    })

    // ── 2. Quadratic Bezier curve P1 → P2 ──
    const bezierPts = sampleBezier(p1.x, p1.y, p2.x, p1.y, p2.x, p2.y, 25)
    for (let i = 0; i < bezierPts.length - 1; i++) {
      figures.push({
        key: `fc_curve_${i}`,
        type: 'line',
        attrs: {
          coordinates: [bezierPts[i], bezierPts[i + 1]]
        },
        styles: {
          style: 'solid',
          color: ext.linecolor,
          size: ext.linewidth
        },
        ignoreEvent: true
      })
    }

    // ── 3. Zone rectangle fill ──
    if (zoneWidth > 0 && zoneHeight > 0) {
      figures.push({
        key: 'fc_zone_fill',
        type: 'rect',
        attrs: {
          x: leftX,
          y: topY,
          width: zoneWidth,
          height: zoneHeight
        },
        styles: {
          style: 'fill',
          color: zoneFill
        },
        ignoreEvent: false
      })

      // ── 4. Zone rectangle border ──
      figures.push({
        key: 'fc_zone_border',
        type: 'rect',
        attrs: {
          x: leftX,
          y: topY,
          width: zoneWidth,
          height: zoneHeight
        },
        styles: {
          style: 'stroke',
          borderColor: ext.targetStrokeColor,
          borderSize: 1
        },
        ignoreEvent: true
      })
    }

    // ── 5. Point 2 marker (small dot at current bar) ──
    const currentIdx = dataList.length - 1
    if (currentIdx > entryIndex) {
      const convertResult = chart.convertToPixel(
        [{ dataIndex: currentIdx, value: dataList[currentIdx]?.close ?? entryPrice }],
        { paneId: overlay.paneId, absolute: false }
      ) as Array<Partial<{ x: number, y: number }>>
      const markerPt = convertResult[0]
      const mx = markerPt.x
      const my = markerPt.y
      if (mx != null && my != null) {
        figures.push({
          key: 'fc_p2_marker',
          type: 'circle',
          attrs: { x: mx, y: my, r: P2_MARKER_RADIUS },
          styles: {
            style: 'fill',
            color: ext.centersColor
          },
          ignoreEvent: true
        })
      }
    }

    // ── 6. Entry pill (price + date, below entry bar, outside zone) ──
    const fontSize = ext.fontSize
    const priceText = formatEntryPrice(entryPrice, ext.pricePrecision)
    const dateText = formatEntryDate(overlay.points[0]?.timestamp)
    const hasDate = dateText.length > 0

    const priceTextW = calcTextWidth(priceText, fontSize)
    const dateTextW = hasDate ? calcTextWidth(dateText, fontSize) : 0
    const entryPillTextW = Math.max(priceTextW, dateTextW)
    const entryPillW = entryPillTextW + 2 * LABEL_PADDING_H
    const entryPillH = hasDate
      ? 2 * fontSize + ENTRY_LABEL_LINE_GAP + 2 * LABEL_PADDING_V
      : fontSize + 2 * LABEL_PADDING_V

    const entryPillX = Math.round(p1.x - entryPillW / 2)
    const entryPillY = Math.max(p1.y + ENTRY_PILL_OFFSET_Y, bottomY + 4)

    figures.push({
      key: 'fc_entry_pill_bg',
      type: 'rect',
      attrs: {
        x: entryPillX,
        y: entryPillY,
        width: entryPillW,
        height: entryPillH
      },
      styles: {
        style: 'stroke_fill',
        color: applyAlpha(ext.sourceBackColor, ext.transparency),
        borderColor: ext.sourceStrokeColor,
        borderSize: 1,
        borderRadius: LABEL_BORDER_RADIUS
      },
      ignoreEvent: true
    })

    const priceLineY = hasDate
      ? entryPillY + LABEL_PADDING_V + fontSize / 2
      : entryPillY + entryPillH / 2

    figures.push({
      key: 'fc_entry_pill_price',
      type: 'text',
      attrs: {
        x: p1.x,
        y: priceLineY,
        text: priceText,
        align: 'center',
        baseline: 'middle'
      },
      styles: {
        color: ext.sourceTextColor,
        size: fontSize,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })

    if (hasDate) {
      const dateLineY = priceLineY + fontSize + ENTRY_LABEL_LINE_GAP
      figures.push({
        key: 'fc_entry_pill_date',
        type: 'text',
        attrs: {
          x: p1.x,
          y: dateLineY,
          text: dateText,
          align: 'center',
          baseline: 'middle'
        },
        styles: {
          color: ext.sourceTextColor,
          size: fontSize,
          backgroundColor: 'transparent'
        },
        ignoreEvent: true
      })
    }

    // ── 7-8. Delta + Outcome stacked pills (right-aligned, above zone top) ──
    const deltaText = formatDeltaLabel(stats, ext.pricePrecision)
    const outcomeText = OUTCOME_LABELS[stats.outcome]

    const deltaTextW = calcTextWidth(deltaText, fontSize)
    const outcomeTextW = calcTextWidth(outcomeText, fontSize)

    const deltaPillW = deltaTextW + 2 * LABEL_PADDING_H
    const outcomePillW = outcomeTextW + 2 * LABEL_PADDING_H
    const pillH = fontSize + 2 * LABEL_PADDING_V

    const deltaPillY = topY - LABEL_TO_ZONE_GAP - pillH
    const outcomePillY = deltaPillY - LABEL_STACK_GAP - pillH
    const deltaPillX = rightX - deltaPillW
    const outcomePillX = rightX - outcomePillW

    // Delta pill (targetBackColor)
    figures.push({
      key: 'fc_delta_pill_bg',
      type: 'rect',
      attrs: {
        x: deltaPillX,
        y: deltaPillY,
        width: deltaPillW,
        height: pillH
      },
      styles: {
        style: 'fill',
        color: applyAlpha(ext.targetBackColor, ext.transparency),
        borderRadius: LABEL_BORDER_RADIUS
      },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_delta_pill_text',
      type: 'text',
      attrs: {
        x: deltaPillX + deltaPillW / 2,
        y: deltaPillY + pillH / 2,
        text: deltaText,
        align: 'center',
        baseline: 'middle'
      },
      styles: {
        color: ext.targetTextColor,
        size: fontSize,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })

    // Outcome pill (success/failure/intermediate)
    let outcomeBg = ext.intermediateBackColor
    let outcomeText2 = ext.intermediateTextColor
    if (stats.outcome === 'success') {
      outcomeBg = ext.successBackground
      outcomeText2 = ext.successTextColor
    } else if (stats.outcome === 'failure') {
      outcomeBg = ext.failureBackground
      outcomeText2 = ext.failureTextColor
    }

    figures.push({
      key: 'fc_outcome_pill_bg',
      type: 'rect',
      attrs: {
        x: outcomePillX,
        y: outcomePillY,
        width: outcomePillW,
        height: pillH
      },
      styles: {
        style: 'fill',
        color: applyAlpha(outcomeBg, ext.transparency),
        borderRadius: LABEL_BORDER_RADIUS
      },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_outcome_pill_text',
      type: 'text',
      attrs: {
        x: outcomePillX + outcomePillW / 2,
        y: outcomePillY + pillH / 2,
        text: outcomeText,
        align: 'center',
        baseline: 'middle'
      },
      styles: {
        color: outcomeText2,
        size: fontSize,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })

    // ── 9. Control point handles (always rendered; klinecharts skips default) ──
    figures.push({
      key: 'fc_cp_p1',
      type: 'circle',
      attrs: { x: p1.x, y: p1.y, r: CP_RADIUS + CP_BORDER },
      styles: {
        style: 'stroke_fill',
        color: CP_COLOR,
        borderColor: CP_BORDER_COLOR,
        borderSize: CP_BORDER
      },
      pointIndex: 0,
      cursor: 'move'
    })

    figures.push({
      key: 'fc_cp_p2',
      type: 'circle',
      attrs: { x: p2.x, y: p2.y, r: CP_RADIUS + CP_BORDER },
      styles: {
        style: 'stroke_fill',
        color: CP_COLOR,
        borderColor: CP_BORDER_COLOR,
        borderSize: CP_BORDER
      },
      pointIndex: 1,
      cursor: 'move'
    })

    return figures
  },

  createXAxisFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return []
    const [p1, p2] = coordinates
    return [
      {
        key: 'fc_xaxis_p1',
        type: 'line',
        attrs: {
          coordinates: [
            { x: p1.x, y: 0 },
            { x: p1.x, y: 6 }
          ]
        },
        styles: { style: 'solid', color: '#2962FF', size: 2 },
        ignoreEvent: true
      },
      {
        key: 'fc_xaxis_p2',
        type: 'line',
        attrs: {
          coordinates: [
            { x: p2.x, y: 0 },
            { x: p2.x, y: 6 }
          ]
        },
        styles: { style: 'solid', color: '#2962FF', size: 2 },
        ignoreEvent: true
      }
    ]
  }
}

export default forecast
