/**
 * Ellipse (Hình elip) — TradingView-style ellipse with 4 cardinal control points.
 *
 * Data points: 2 (diagonal corners of the bounding box)
 * Control points: 4 (top / bottom / left / right — midpoints of the bbox)
 *
 * Rendering pipeline:
 *   - Sample 64-point polygon on the inscribed ellipse → single 'polygon'
 *     figure with `style: 'stroke_fill'` handles fill + stroke + hit-test.
 *   - Text + placeholder figures follow the rect pattern (width/height for
 *     word-wrap clipped to the inscribed rectangle).
 *   - 4 CPs rendered only when selected or hovered.
 *
 * Drag routing:
 *   - Body / text figures have NO `pointIndex`, so the library dispatches
 *     them through `eventPressedOtherMove` (uniform delta-translation over
 *     all points). `performEventPressedMove` is NOT invoked.
 *   - CPs carry `pointIndex: 0 | 1` and route through `performEventPressedMove`
 *     with `figureKey` — the constrained-axis restore is handled there.
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'

import type { EllipseExtendData } from './types'
import {
  ELLIPSE_DEFAULTS,
  E_BODY, E_TEXT, E_TEXT_PH,
  E_CP_TOP, E_CP_BOT, E_CP_LEFT, E_CP_RIGHT,
  BODY_DRAG_KEYS,
  DASH,
  CP_COLOR, CP_RADIUS, CP_CIRCLE_BORDER,
  type ChartInternal
} from './constants'
import {
  sampleEllipsePolygon,
  isEllipseVisibleAtPeriod,
  alphaRgba,
  isLightColor
} from './math'

export type {
  EllipseExtendData,
  EllipseLineStyle,
  EllipseVisibilityRange
} from './types'

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function mergeExt (ext: EllipseExtendData | undefined): Required<EllipseExtendData> {
  return { ...ELLIPSE_DEFAULTS, ...(ext ?? {}) }
}

// ═══════════════════════════════════════
// Overlay template
// ═══════════════════════════════════════

const ellipse: OverlayTemplate<EllipseExtendData> = {
  name: 'ellipse',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    const figures: OverlayFigure[] = []
    if (coordinates.length < 2) return figures

    const ext = mergeExt(overlay.extendData)

    // TF-band visibility gate — hide when the current period's band is off
    // or the span is outside [min, max].
    if (!isEllipseVisibleAtPeriod(ext, chart.getPeriod())) return figures

    const [p1, p2] = coordinates

    // Normalize bbox — min/max handles arbitrary click order.
    const left = Math.min(p1.x, p2.x)
    const right = Math.max(p1.x, p2.x)
    const top = Math.min(p1.y, p2.y)
    const bottom = Math.max(p1.y, p2.y)
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const a = (right - left) / 2
    const b = (bottom - top) / 2

    // Resolved style fields
    const borderColor = ext.borderColor
    const borderWidth = ext.borderWidth
    const borderStyle = ext.borderStyle
    const fillEnabled = ext.fillEnabled
    const fillColor = ext.fillColor
    const fillOpacity = ext.fillOpacity

    // PolygonStyle.borderStyle only supports 'solid' | 'dashed'. For
    // 'dotted', keep borderStyle 'dashed' but use a tighter dash pattern.
    const effectiveBorderStyle: 'solid' | 'dashed' =
      borderStyle === 'solid' ? 'solid' : 'dashed'
    const borderDashedValue = DASH[borderStyle]

    // Fill color with alpha — hex → rgba(), transparent when disabled
    const bodyFillColor = fillEnabled
      ? alphaRgba(fillColor, fillOpacity)
      : 'transparent'

    // ─── 1. Ellipse body (fill + stroke in one polygon) ───
    const perimeter = sampleEllipsePolygon(cx, cy, a, b, 64)
    figures.push({
      key: E_BODY,
      type: 'polygon',
      attrs: { coordinates: perimeter },
      styles: {
        style: 'stroke_fill',
        color: bodyFillColor,
        borderColor,
        borderSize: borderWidth,
        borderStyle: effectiveBorderStyle,
        borderDashedValue
      }
    })

    // ─── Selection / hover state (needed for text placeholder + CPs) ───
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'

    // ─── 2. Text (or "+ Add text" placeholder) ───
    //
    // Inscribed rectangle inside the ellipse has half-axes (a/√2, b/√2).
    // Clip text to this rect so long strings don't visually escape the shape.
    const isEditing = ext.isEditing
    const text = ext.text
    const textEnabled = ext.textEnabled

    if (textEnabled && !isEditing && text !== '') {
      const inscribedW = Math.max(0, (2 * a) / Math.SQRT2)
      const inscribedH = Math.max(0, (2 * b) / Math.SQRT2)

      figures.push({
        key: E_TEXT,
        type: 'text',
        attrs: {
          x: cx,
          y: cy,
          text,
          align: 'center' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline,
          width: inscribedW,
          height: inscribedH
        },
        styles: {
          color: ext.textColor,
          size: ext.textSize,
          weight: ext.isBold ? 'bold' : '600',
          style: ext.isItalic ? 'italic' : 'normal',
          backgroundColor: 'transparent'
        }
      })
    } else if (
      textEnabled &&
      !isEditing &&
      text === '' &&
      (isSelected || isHovered)
    ) {
      // "+ Add text" hint — only while selected/hovered and empty
      figures.push({
        key: E_TEXT_PH,
        type: 'text',
        attrs: {
          x: cx,
          y: cy,
          text: '+ Add text',
          align: 'center' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline
        },
        styles: {
          color: borderColor,
          size: 13,
          weight: 'normal',
          style: 'normal',
          backgroundColor: 'transparent'
        },
        cursor: 'text'
      })
    }

    // ─── 3. Control points (selected or hovered) ───
    if (isSelected || isHovered) {
      const tickTextColor = String(chart.getStyles().yAxis.tickText.color)
      const cpBg = isLightColor(tickTextColor) ? '#131722' : '#ffffff'

      const cornerCP = (
        key: string,
        x: number,
        y: number,
        pIdx: number,
        cur: string
      ): OverlayFigure => ({
        key,
        type: 'circle',
        attrs: { x, y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: pIdx,
        cursor: cur
      })

      // Static pointIndex strategy (see KNOWN-PITFALLS Strategy A):
      //   top  → pointIndex 0, bot → pointIndex 1 (vertical axis)
      //   left → pointIndex 0, right → pointIndex 1 (horizontal axis)
      // Geometry is normalized per frame via min/max — if the user drags
      // Top past Bottom, the bbox naturally flips and the shape stays
      // visually correct. Same mechanism as rect.
      figures.push(cornerCP(E_CP_TOP, cx, top, 0, 'ns-resize'))
      figures.push(cornerCP(E_CP_BOT, cx, bottom, 1, 'ns-resize'))
      figures.push(cornerCP(E_CP_LEFT, left, cy, 0, 'ew-resize'))
      figures.push(cornerCP(E_CP_RIGHT, right, cy, 1, 'ew-resize'))
    }

    return figures
  },

  // ─── Drag handler ───────────────────────────────────────
  // Called only for figures carrying `pointIndex` (our 4 CPs). Body /
  // text drags bypass this and go through the library's default
  // `eventPressedOtherMove` which translates all points uniformly.
  performEventPressedMove: ({ points, performPointIndex, prevPoints, figureKey }) => {
    if (figureKey == null || figureKey === '' || prevPoints.length < 2) return

    // Defensive: body-drag keys should never reach here (they have no
    // pointIndex), but if the routing ever changes we no-op rather than
    // corrupting point state.
    if (BODY_DRAG_KEYS.has(figureKey)) return

    switch (figureKey) {
      // Top / Bottom CPs: only Y changes; freeze X by restoring
      // timestamp + dataIndex on the dragged point.
      case E_CP_TOP:
      case E_CP_BOT: {
        points[performPointIndex].timestamp = prevPoints[performPointIndex].timestamp
        points[performPointIndex].dataIndex = prevPoints[performPointIndex].dataIndex
        break
      }

      // Left / Right CPs: only X changes; freeze Y by restoring value.
      case E_CP_LEFT:
      case E_CP_RIGHT: {
        points[performPointIndex].value = prevPoints[performPointIndex].value
        break
      }

      default:
        break
    }
  }
}

export default ellipse
