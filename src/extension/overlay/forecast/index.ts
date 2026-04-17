/**
 * Forecast (Dự đoán) overlay — TradingView-style LineToolPrediction
 *
 * Data points: 2 (P1 source anchor, P2 target anchor)
 * Total steps: 3 (2 on-chart clicks + initial "activated-no-click" step)
 *
 * Visual composition (back -> front):
 *   1.  Bezier curve P1 -> P2 (path figure, quadratic Q command) - draw only
 *   2.  Curve hitbox (polygon tube around the curve) - hit-test only
 *   3.  P1 source pill (rect + 2 text lines)
 *   4.  P2 info pill (rect + 2 text lines)
 *   5.  Status badge above or below P2 pill (hidden during draw preview)
 *   6.  Control points (CP0, CP1) - small dots unselected, hollow rings active
 *
 * X-axis figures:
 *   - Footer F / F* markers (ALWAYS visible)
 *   - Date pills (SELECTION only)
 *
 * Y-axis figures:
 *   - Price pills (SELECTION only)
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import { calcTextWidth } from '../../../common/utils/canvas'

import type { ForecastExtendData, ChartInternal } from './constants'
import {
  FORECAST_DEFAULTS,
  PILL_PADDING_H, PILL_PADDING_V, PILL_LINE_GAP, PILL_BORDER_RADIUS, PILL_FONT_SIZE,
  PILL_ANCHOR_GAP,
  BADGE_GAP, BADGE_PADDING_H, BADGE_PADDING_V, BADGE_FONT_SIZE,
  CP_COLOR, CP_INACTIVE_RADIUS, CP_ACTIVE_RADIUS, CP_ACTIVE_BORDER,
  FOOTER_COLOR, FOOTER_MARGIN_BOTTOM, FOOTER_RADIUS, FOOTER_BORDER_SIZE, FOOTER_FONT_SIZE,
  XAXIS_PILL_Y, XAXIS_PILL_PADDING_H, XAXIS_PILL_PADDING_V,
  AXIS_STRIP_COLOR, AXIS_STRIP_OPACITY,
  CURVE_HITBOX_HALF_WIDTH, CURVE_SAMPLES,
  ARROW_LENGTH, ARROW_HALF_WIDTH
} from './constants'
import {
  evaluateStatus, resolveBarIndex,
  computeBezierControlPoint, buildCurveHitbox, buildArrowPolygon,
  quadBezierTangent,
  alpha, formatISO, formatViDatePill,
  formatPrecision, signedPrecision
} from './utils'

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function getExt (extendData: ForecastExtendData | undefined): ForecastExtendData {
  if (extendData == null) return { ...FORECAST_DEFAULTS }
  return { ...FORECAST_DEFAULTS, ...extendData }
}

function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

const BODY_DRAG_KEYS = new Set<string>([
  'fc_curve_hitbox',
  'fc_p1_pill',
  'fc_p2_pill',
  'fc_badge_bg'
])

// Clock emoji inserted between price and date on P2 pill line 2
const CLOCK_CHAR = '\u{1F550}'

// ═══════════════════════════════════════
// Overlay template
// ═══════════════════════════════════════

const forecast: OverlayTemplate<ForecastExtendData> = {
  name: 'forecast',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  mode: 'normal',

  // ─────────────────────────────────────
  // Main pane figures
  // ─────────────────────────────────────
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return []

    const ext = getExt(overlay.extendData)
    const precision = ext.pricePrecision ?? (chart.getSymbol()?.pricePrecision ?? 2)

    const p1 = overlay.points[0] ?? {}
    const p2 = overlay.points[1] ?? {}
    const c1 = coordinates[0]
    const c2 = coordinates[1]

    // "Drawing in progress" detection.
    // OverlayImp.currentStep is -1 once the final click lands.
    // During preview it is a positive number less than totalStep.
    const currentStep = (overlay as { currentStep?: number }).currentStep
    const isDrawing = currentStep != null && currentStep > 0 && currentStep < 3

    // Selection / hover state
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isActive = isSelected || isHovered

    const figures: OverlayFigure[] = []

    // ─── 1. Bezier curve (visual, no events) ───
    const cp = computeBezierControlPoint(c1, c2)
    const lineColorAlpha = alpha(ext.lineColor, ext.lineOpacity)
    figures.push({
      key: 'fc_curve',
      type: 'path',
      attrs: {
        x: 0,
        y: 0,
        width: bounding.width,
        height: bounding.height,
        path: `M ${c1.x} ${c1.y} Q ${cp.x} ${cp.y} ${c2.x} ${c2.y}`
      },
      styles: {
        style: 'stroke',
        color: lineColorAlpha,
        lineWidth: ext.lineWidth
      },
      ignoreEvent: true
    })

    // ─── 2. Curve hitbox (transparent polygon tube, receives events) ───
    const hitboxPoly = buildCurveHitbox(c1, cp, c2, CURVE_HITBOX_HALF_WIDTH, CURVE_SAMPLES)
    figures.push({
      key: 'fc_curve_hitbox',
      type: 'polygon',
      attrs: { coordinates: hitboxPoly },
      styles: { style: 'fill', color: 'transparent' },
      ignoreEvent: false,
      cursor: 'move'
    })

    // ─── 3. P1 source pill ───
    const p1PriceText = p1.value != null ? formatPrecision(p1.value, precision) : ''
    const p1DateText = formatISO(p1.timestamp)
    const p1TextWidth = Math.max(
      calcTextWidth(p1PriceText, PILL_FONT_SIZE),
      calcTextWidth(p1DateText, PILL_FONT_SIZE)
    )
    const p1PillW = p1TextWidth + 2 * PILL_PADDING_H
    const p1PillH = 2 * PILL_FONT_SIZE + PILL_LINE_GAP + 2 * PILL_PADDING_V
    // Right edge of P1 pill touches (c1.x - PILL_ANCHOR_GAP)
    const p1PillX = c1.x - PILL_ANCHOR_GAP - p1PillW
    const p1PillY = c1.y - p1PillH / 2

    figures.push({
      key: 'fc_p1_pill',
      type: 'rect',
      attrs: { x: p1PillX, y: p1PillY, width: p1PillW, height: p1PillH },
      styles: {
        style: 'stroke_fill',
        color: alpha(ext.sourceBgColor, ext.sourceBgOpacity),
        borderColor: alpha(ext.sourceBorderColor, ext.sourceBorderOpacity),
        borderSize: 1,
        borderRadius: PILL_BORDER_RADIUS
      },
      ignoreEvent: false,
      cursor: 'move'
    })

    const p1PillCX = p1PillX + p1PillW / 2
    // Line 1 (price) centered in top half
    figures.push({
      key: 'fc_p1_text_price',
      type: 'text',
      attrs: {
        x: p1PillCX,
        y: p1PillY + PILL_PADDING_V + PILL_FONT_SIZE / 2,
        text: p1PriceText,
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: {
        color: alpha(ext.sourceTextColor, ext.sourceTextOpacity),
        size: PILL_FONT_SIZE,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_p1_text_date',
      type: 'text',
      attrs: {
        x: p1PillCX,
        y: p1PillY + PILL_PADDING_V + PILL_FONT_SIZE + PILL_LINE_GAP + PILL_FONT_SIZE / 2,
        text: p1DateText,
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: {
        color: alpha(ext.sourceTextColor, ext.sourceTextOpacity),
        size: PILL_FONT_SIZE,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })

    // ─── 4. P2 info pill ───
    const dataList = chart.getDataList()
    let deltaLine = ''
    let priceLine = ''
    if (p1.value != null && p2.value != null) {
      const delta = p2.value - p1.value
      const deltaPctStr = p1.value !== 0
        ? ((delta / Math.abs(p1.value)) * 100).toFixed(2)
        : '-'
      const deltaPctSigned = p1.value !== 0 && delta >= 0 ? `+${deltaPctStr}` : deltaPctStr

      const i1 = resolveBarIndex(dataList, p1.timestamp)
      const i2 = resolveBarIndex(dataList, p2.timestamp)
      let barCount = 0
      if (i1 >= 0 && i2 >= 0) barCount = Math.abs(i2 - i1)
      else if (p1.dataIndex != null && p2.dataIndex != null) {
        barCount = Math.abs(p2.dataIndex - p1.dataIndex)
      }

      deltaLine = `${signedPrecision(delta, precision)} (${deltaPctSigned}%) trong ${barCount}n`
      priceLine = `${formatPrecision(p2.value, precision)} ${CLOCK_CHAR} ${formatISO(p2.timestamp)}`
    }

    const p2TextWidth = Math.max(
      calcTextWidth(deltaLine, PILL_FONT_SIZE),
      calcTextWidth(priceLine, PILL_FONT_SIZE)
    )
    const p2PillW = p2TextWidth + 2 * PILL_PADDING_H
    const p2PillH = 2 * PILL_FONT_SIZE + PILL_LINE_GAP + 2 * PILL_PADDING_V
    // Left edge of P2 pill touches (c2.x + PILL_ANCHOR_GAP)
    const p2PillX = c2.x + PILL_ANCHOR_GAP
    const p2PillY = c2.y - p2PillH / 2

    figures.push({
      key: 'fc_p2_pill',
      type: 'rect',
      attrs: { x: p2PillX, y: p2PillY, width: p2PillW, height: p2PillH },
      styles: {
        style: 'stroke_fill',
        color: alpha(ext.targetBgColor, ext.targetBgOpacity),
        borderColor: alpha(ext.targetBorderColor, ext.targetBorderOpacity),
        borderSize: 1,
        borderRadius: PILL_BORDER_RADIUS
      },
      ignoreEvent: false,
      cursor: 'move'
    })

    const p2PillCX = p2PillX + p2PillW / 2
    figures.push({
      key: 'fc_p2_text_line1',
      type: 'text',
      attrs: {
        x: p2PillCX,
        y: p2PillY + PILL_PADDING_V + PILL_FONT_SIZE / 2,
        text: deltaLine,
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: {
        color: alpha(ext.targetTextColor, ext.targetTextOpacity),
        size: PILL_FONT_SIZE,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_p2_text_line2',
      type: 'text',
      attrs: {
        x: p2PillCX,
        y: p2PillY + PILL_PADDING_V + PILL_FONT_SIZE + PILL_LINE_GAP + PILL_FONT_SIZE / 2,
        text: priceLine,
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: {
        color: alpha(ext.targetTextColor, ext.targetTextOpacity),
        size: PILL_FONT_SIZE,
        backgroundColor: 'transparent'
      },
      ignoreEvent: true
    })

    // ─── 5. Status badge (hidden during preview) ───
    if (!isDrawing && p1.value != null && p2.value != null) {
      const status = evaluateStatus(dataList, p1, p2)
      const bullish = p2.value > p1.value

      const badgeText = status === 'success' ? '✓ THÀNH CÔNG' : '☹ THẤT BẠI'
      const badgeTextW = calcTextWidth(badgeText, BADGE_FONT_SIZE)
      const badgeW = badgeTextW + 2 * BADGE_PADDING_H
      const badgeH = BADGE_FONT_SIZE + 2 * BADGE_PADDING_V

      const badgeBgHex = status === 'success' ? ext.successBgColor : ext.failureBgColor
      const badgeBgOpacity = status === 'success' ? ext.successBgOpacity : ext.failureBgOpacity
      const badgeTextHex = status === 'success' ? ext.successTextColor : ext.failureTextColor
      const badgeTextOpacity = status === 'success' ? ext.successTextOpacity : ext.failureTextOpacity

      // Bullish (P2 higher price → smaller Y) → badge ABOVE; bearish → BELOW
      // left-aligned with P2 pill
      const badgeX = p2PillX
      const badgeY = bullish
        ? p2PillY - badgeH - BADGE_GAP
        : p2PillY + p2PillH + BADGE_GAP

      figures.push({
        key: 'fc_badge_bg',
        type: 'rect',
        attrs: { x: badgeX, y: badgeY, width: badgeW, height: badgeH },
        styles: {
          style: 'fill',
          color: alpha(badgeBgHex, badgeBgOpacity),
          borderRadius: PILL_BORDER_RADIUS
        },
        ignoreEvent: false,
        cursor: 'move'
      })
      figures.push({
        key: 'fc_badge_text',
        type: 'text',
        attrs: {
          x: badgeX + badgeW / 2,
          y: badgeY + badgeH / 2,
          text: badgeText,
          align: 'center' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline
        },
        styles: {
          color: alpha(badgeTextHex, badgeTextOpacity),
          size: BADGE_FONT_SIZE,
          backgroundColor: 'transparent'
        },
        ignoreEvent: true
      })
    }

    // ─── 5b. P2 arrow tip (small filled triangle pointing along curve tangent) ───
    // Hidden when selected/hovered — hollow control-point circle covers this area.
    if (!isActive) {
      const tanAtP2 = quadBezierTangent(c1, cp, c2, 1)
      const arrowPoly = buildArrowPolygon(c2, tanAtP2, ARROW_LENGTH, ARROW_HALF_WIDTH)
      figures.push({
        key: 'fc_arrow',
        type: 'polygon',
        attrs: { coordinates: arrowPoly },
        styles: {
          style: 'fill',
          color: lineColorAlpha
        },
        ignoreEvent: true
      })
    }

    // ─── 6. Control points ───
    if (isActive) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'fc_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_ACTIVE_RADIUS },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_ACTIVE_BORDER
        },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'fc_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_ACTIVE_RADIUS },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_ACTIVE_BORDER
        },
        pointIndex: 1,
        cursor: 'pointer'
      })
    } else {
      figures.push({
        key: 'fc_cp0',
        type: 'circle',
        attrs: { x: c1.x, y: c1.y, r: CP_INACTIVE_RADIUS },
        styles: { style: 'fill', color: CP_COLOR },
        pointIndex: 0,
        cursor: 'pointer'
      })
      figures.push({
        key: 'fc_cp1',
        type: 'circle',
        attrs: { x: c2.x, y: c2.y, r: CP_INACTIVE_RADIUS },
        styles: { style: 'fill', color: CP_COLOR },
        pointIndex: 1,
        cursor: 'pointer'
      })
    }

    // ─── 7. Footer F / F* markers (always visible, chart pane bottom) ───
    const footerY = bounding.height - FOOTER_MARGIN_BOTTOM
    figures.push({
      key: 'fc_footer_bg_p1',
      type: 'circle',
      attrs: { x: c1.x, y: footerY, r: FOOTER_RADIUS },
      styles: { style: 'stroke', borderColor: FOOTER_COLOR, borderSize: FOOTER_BORDER_SIZE },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_footer_text_p1',
      type: 'text',
      attrs: {
        x: c1.x,
        y: footerY,
        text: 'F',
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: { color: FOOTER_COLOR, size: FOOTER_FONT_SIZE, backgroundColor: 'transparent' },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_footer_bg_p2',
      type: 'circle',
      attrs: { x: c2.x, y: footerY, r: FOOTER_RADIUS },
      styles: { style: 'stroke', borderColor: FOOTER_COLOR, borderSize: FOOTER_BORDER_SIZE },
      ignoreEvent: true
    })
    figures.push({
      key: 'fc_footer_text_p2',
      type: 'text',
      attrs: {
        x: c2.x,
        y: footerY,
        text: 'F*',
        align: 'center' as CanvasTextAlign,
        baseline: 'middle' as CanvasTextBaseline
      },
      styles: { color: FOOTER_COLOR, size: FOOTER_FONT_SIZE, backgroundColor: 'transparent' },
      ignoreEvent: true
    })

    return figures
  },

  // ─────────────────────────────────────
  // X-axis: date pills (selection only)
  // ─────────────────────────────────────
  createXAxisFigures: ({ chart, overlay, coordinates, bounding }) => {
    if (coordinates.length < 2) return []

    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    if (!isSelected) return []

    const c1 = coordinates[0]
    const c2 = coordinates[1]
    const figures: OverlayFigure[] = []

    const ext = getExt(overlay.extendData)
    const p1 = overlay.points[0] ?? {}
    const p2 = overlay.points[1] ?? {}
    const p1Date = formatViDatePill(p1.timestamp)
    const p2Date = formatViDatePill(p2.timestamp)

    // Translucent bg strip spanning P1 ↔ P2 on the X-axis
    const stripLeftX = Math.min(c1.x, c2.x)
    const stripRightX = Math.max(c1.x, c2.x)
    const stripWidthX = stripRightX - stripLeftX
    if (stripWidthX > 0) {
      figures.push({
        key: 'fc_xstrip',
        type: 'rect',
        attrs: { x: stripLeftX, y: 0, width: stripWidthX, height: bounding.height },
        styles: {
          style: 'fill',
          color: alpha(AXIS_STRIP_COLOR, AXIS_STRIP_OPACITY)
        },
        ignoreEvent: true
      })
    }

    if (p1Date.length > 0) {
      figures.push({
        key: 'fc_xpill_p1',
        type: 'text',
        attrs: {
          x: c1.x,
          y: XAXIS_PILL_Y,
          text: p1Date,
          align: 'center' as CanvasTextAlign,
          baseline: 'top' as CanvasTextBaseline
        },
        styles: {
          color: alpha(ext.sourceTextColor, ext.sourceTextOpacity),
          backgroundColor: alpha(ext.sourceBgColor, ext.sourceBgOpacity),
          paddingLeft: XAXIS_PILL_PADDING_H,
          paddingRight: XAXIS_PILL_PADDING_H,
          paddingTop: XAXIS_PILL_PADDING_V,
          paddingBottom: XAXIS_PILL_PADDING_V,
          borderRadius: PILL_BORDER_RADIUS,
          size: PILL_FONT_SIZE
        },
        ignoreEvent: true
      })
    }
    if (p2Date.length > 0) {
      figures.push({
        key: 'fc_xpill_p2',
        type: 'text',
        attrs: {
          x: c2.x,
          y: XAXIS_PILL_Y,
          text: p2Date,
          align: 'center' as CanvasTextAlign,
          baseline: 'top' as CanvasTextBaseline
        },
        styles: {
          color: alpha(ext.targetTextColor, ext.targetTextOpacity),
          backgroundColor: alpha(ext.targetBgColor, ext.targetBgOpacity),
          paddingLeft: XAXIS_PILL_PADDING_H,
          paddingRight: XAXIS_PILL_PADDING_H,
          paddingTop: XAXIS_PILL_PADDING_V,
          paddingBottom: XAXIS_PILL_PADDING_V,
          borderRadius: PILL_BORDER_RADIUS,
          size: PILL_FONT_SIZE
        },
        ignoreEvent: true
      })
    }

    return figures
  },

  // ─────────────────────────────────────
  // Y-axis: price pills (selection only)
  // ─────────────────────────────────────
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    if (coordinates.length < 2) return []

    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    if (!isSelected) return []

    const ext = getExt(overlay.extendData)
    const precision = ext.pricePrecision ?? (chart.getSymbol()?.pricePrecision ?? 2)
    const p1 = overlay.points[0] ?? {}
    const p2 = overlay.points[1] ?? {}

    const isFromZero = yAxis?.isFromZero() ?? false
    const textAlign: CanvasTextAlign = isFromZero ? 'left' : 'right'
    const x = isFromZero ? 0 : bounding.width

    const figures: OverlayFigure[] = []

    // Translucent bg strip spanning P1 ↔ P2 on the Y-axis
    const c1y = coordinates[0].y
    const c2y = coordinates[1].y
    const stripTopY = Math.min(c1y, c2y)
    const stripBottomY = Math.max(c1y, c2y)
    const stripHeightY = stripBottomY - stripTopY
    if (stripHeightY > 0) {
      figures.push({
        key: 'fc_ystrip',
        type: 'rect',
        attrs: { x: 0, y: stripTopY, width: bounding.width, height: stripHeightY },
        styles: {
          style: 'fill',
          color: alpha(AXIS_STRIP_COLOR, AXIS_STRIP_OPACITY)
        },
        ignoreEvent: true
      })
    }

    if (p1.value != null) {
      figures.push({
        key: 'fc_ypill_p1',
        type: 'text',
        attrs: {
          x,
          y: coordinates[0].y,
          text: formatPrecision(p1.value, precision),
          align: textAlign,
          baseline: 'middle' as CanvasTextBaseline
        },
        styles: {
          color: alpha(ext.sourceTextColor, ext.sourceTextOpacity),
          backgroundColor: alpha(ext.sourceBgColor, ext.sourceBgOpacity),
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 2,
          size: PILL_FONT_SIZE
        },
        ignoreEvent: true
      })
    }
    if (p2.value != null) {
      figures.push({
        key: 'fc_ypill_p2',
        type: 'text',
        attrs: {
          x,
          y: coordinates[1].y,
          text: formatPrecision(p2.value, precision),
          align: textAlign,
          baseline: 'middle' as CanvasTextBaseline
        },
        styles: {
          color: alpha(ext.targetTextColor, ext.targetTextOpacity),
          backgroundColor: alpha(ext.targetBgColor, ext.targetBgOpacity),
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 2,
          size: PILL_FONT_SIZE
        },
        ignoreEvent: true
      })
    }
    return figures
  },

  // ─────────────────────────────────────
  // Press-move: body drag vs CP drag
  // ─────────────────────────────────────
  performEventPressedMove: ({ points, prevPoints, performPoint, figureKey }) => {
    if (figureKey == null) return

    // Body drag (curve / pills / badge) → move both anchors by the same delta
    if (BODY_DRAG_KEYS.has(figureKey)) {
      if (prevPoints.length < 2) return
      const prev0 = prevPoints[0]
      const prev1 = prevPoints[1]
      if (prev0.dataIndex == null || prev1.dataIndex == null) return
      if (prev0.value == null || prev1.value == null) return
      if (performPoint.dataIndex == null || performPoint.value == null) return

      const dIdx = performPoint.dataIndex - prev0.dataIndex
      const dVal = performPoint.value - prev0.value

      points[0] = {
        dataIndex: prev0.dataIndex + dIdx,
        value: prev0.value + dVal,
        timestamp: undefined
      }
      points[1] = {
        dataIndex: prev1.dataIndex + dIdx,
        value: prev1.value + dVal,
        timestamp: undefined
      }
    }

    // Otherwise (fc_cp0 / fc_cp1) → engine default already applied to
    // points[performPointIndex]; nothing extra to do.
  }
}

export default forecast
