/**
 * Long Position overlay — TradingView-style risk/reward measurement tool
 *
 * Data points: 4 (P1 entry, P2 TP, P3 SL, P4 width)
 * Control points: P1 circle (free), P2/P3 square (vertical), P4 square (horizontal)
 * Single-click creation (totalStep=2), web layer injects P2/P3/P4 via onDrawEnd
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import { calcTextWidth } from '../../../common/utils/canvas'
import { formatPrecision } from '../../../common/utils/format'

import type { LongPositionExtendData } from './constants'
import {
  LONG_POSITION_DEFAULTS,
  LABEL_PADDING_H, LABEL_PADDING_V, LABEL_BORDER_RADIUS,
  CP_COLOR, CP_RADIUS, CP_CIRCLE_BORDER,
  CP_MID_SIZE, CP_MID_BORDER, CP_MID_BORDER_RADIUS
} from './constants'
import { calculateStats, formatTpLabel, formatEntryLabel, formatSlLabel } from './utils'

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function isLightColor (hex: string): boolean {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
  if (match == null) return false
  const r = parseInt(match[1], 16)
  const g = parseInt(match[2], 16)
  const b = parseInt(match[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}

/**
 * Extract solid color from an rgba() string for Y-axis pills.
 * e.g. 'rgba(8, 153, 129, 0.2)' -> 'rgb(8, 153, 129)'
 */
function rgbaToSolid (rgba: string): string {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgba)
  if (match != null) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`
  }
  return rgba
}

function getExt (extendData: LongPositionExtendData | undefined): LongPositionExtendData {
  if (extendData == null) return { ...LONG_POSITION_DEFAULTS }
  return { ...LONG_POSITION_DEFAULTS, ...extendData }
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const longPosition: OverlayTemplate<LongPositionExtendData> = {
  name: 'longPosition',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    const ext = getExt(overlay.extendData)

    // ── Missing points: show minimal preview ──
    if (coordinates.length < 1) return []
    if (coordinates.length < 4) {
      // Preview: entry line only at first click
      const c1 = coordinates[0]
      return [{
        key: 'lp_entry_line',
        type: 'line',
        attrs: {
          coordinates: [
            { x: c1.x, y: c1.y },
            { x: c1.x + 200, y: c1.y }
          ]
        },
        styles: {
          style: 'solid',
          color: ext.lineColor,
          size: ext.lineWidth
        },
        ignoreEvent: true
      }]
    }

    // ── Full rendering with 4 points ──
    const [c1, c2, c3, c4] = coordinates
    const leftX = Math.min(c1.x, c4.x)
    const rightX = Math.max(c1.x, c4.x)
    const entryY = c1.y
    const targetY = c2.y // above entry = smaller Y
    const stopY = c3.y // below entry = larger Y
    const zoneWidth = Math.max(rightX - leftX, 50)

    const figures: OverlayFigure[] = []

    // ── 1. TP zone fill ──
    if (ext.fillBackground) {
      figures.push({
        key: 'lp_tp_zone',
        type: 'rect',
        attrs: {
          x: leftX,
          y: Math.min(targetY, entryY),
          width: zoneWidth,
          height: Math.abs(entryY - targetY)
        },
        styles: {
          style: 'fill',
          color: ext.profitBackground
        },
        ignoreEvent: true
      })
    }

    // ── 2. SL zone fill ──
    if (ext.fillBackground) {
      figures.push({
        key: 'lp_sl_zone',
        type: 'rect',
        attrs: {
          x: leftX,
          y: Math.min(entryY, stopY),
          width: zoneWidth,
          height: Math.abs(stopY - entryY)
        },
        styles: {
          style: 'fill',
          color: ext.stopBackground
        },
        ignoreEvent: true
      })
    }

    // ── 3. TP border ──
    if (ext.drawBorder) {
      figures.push({
        key: 'lp_tp_border',
        type: 'rect',
        attrs: {
          x: leftX,
          y: Math.min(targetY, entryY),
          width: zoneWidth,
          height: Math.abs(entryY - targetY)
        },
        styles: {
          style: 'stroke',
          borderColor: ext.borderColor,
          borderSize: 1
        },
        ignoreEvent: true
      })
    }

    // ── 4. SL border ──
    if (ext.drawBorder) {
      figures.push({
        key: 'lp_sl_border',
        type: 'rect',
        attrs: {
          x: leftX,
          y: Math.min(entryY, stopY),
          width: zoneWidth,
          height: Math.abs(stopY - entryY)
        },
        styles: {
          style: 'stroke',
          borderColor: ext.borderColor,
          borderSize: 1
        },
        ignoreEvent: true
      })
    }

    // ── 5. Entry line ──
    figures.push({
      key: 'lp_entry_line',
      type: 'line',
      attrs: {
        coordinates: [
          { x: leftX, y: entryY },
          { x: leftX + zoneWidth, y: entryY }
        ]
      },
      styles: {
        style: 'solid',
        color: ext.lineColor,
        size: ext.lineWidth
      },
      ignoreEvent: true
    })

    // ── 6. Hitbox (transparent, catches events) ──
    const hitTop = Math.min(targetY, entryY, stopY)
    const hitBottom = Math.max(targetY, entryY, stopY)
    figures.push({
      key: 'lp_hitbox',
      type: 'rect',
      attrs: {
        x: leftX,
        y: hitTop,
        width: zoneWidth,
        height: Math.max(hitBottom - hitTop, 1)
      },
      styles: {
        style: 'fill',
        color: 'transparent'
      },
      ignoreEvent: false
    })

    // ── Selection state detection ──
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isHoveredOrSelected = isSelected || isHovered

    // ── 7-12. Labels ──
    const showLabels = ext.alwaysShowStats || isHoveredOrSelected
    if (showLabels) {
      const entryPrice = overlay.points[0]?.value ?? 0
      const targetPrice = overlay.points[1]?.value ?? 0
      const stopPrice = overlay.points[2]?.value ?? 0
      const precision = ext.pricePrecision

      const stats = calculateStats(entryPrice, targetPrice, stopPrice, ext)

      const fontSize = ext.fontSize
      const labelMinHeight = fontSize + 2 * LABEL_PADDING_V

      const tpZoneHeight = Math.abs(entryY - targetY)
      const slZoneHeight = Math.abs(stopY - entryY)
      const showTpLabel = tpZoneHeight >= labelMinHeight
      const showSlLabel = slZoneHeight >= labelMinHeight

      const tpLabelBg = ext.fillLabelBackground ? rgbaToSolid(ext.profitBackground) : 'transparent'
      const slLabelBg = ext.fillLabelBackground ? rgbaToSolid(ext.stopBackground) : 'transparent'
      const entryLabelBg = ext.fillLabelBackground ? ext.labelBackgroundColor : 'transparent'
      const labelTextColor = ext.textColor

      // TP label (centered inside green zone)
      if (showTpLabel) {
        const tpText = formatTpLabel(stats, ext.compact, precision)
        const tpTextWidth = calcTextWidth(tpText, fontSize)
        const tpLabelW = tpTextWidth + 2 * LABEL_PADDING_H
        const tpLabelH = fontSize + 2 * LABEL_PADDING_V
        const tpCenterX = leftX + zoneWidth / 2
        const tpCenterY = Math.min(targetY, entryY) + tpZoneHeight / 2

        figures.push({
          key: 'lp_tp_label_bg',
          type: 'rect',
          attrs: {
            x: tpCenterX - tpLabelW / 2,
            y: tpCenterY - tpLabelH / 2,
            width: tpLabelW,
            height: tpLabelH
          },
          styles: {
            style: 'fill',
            color: tpLabelBg,
            borderRadius: LABEL_BORDER_RADIUS
          },
          ignoreEvent: true
        })

        figures.push({
          key: 'lp_tp_label_text',
          type: 'text',
          attrs: {
            x: tpCenterX,
            y: tpCenterY,
            text: tpText,
            align: 'center',
            baseline: 'middle'
          },
          styles: {
            color: labelTextColor,
            size: fontSize,
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }

      // Entry label (centered on entry line)
      {
        const entryText = formatEntryLabel(stats, ext.compact, precision)
        const entryTextWidth = calcTextWidth(entryText, fontSize)
        const entryLabelW = entryTextWidth + 2 * LABEL_PADDING_H
        const entryLabelH = fontSize + 2 * LABEL_PADDING_V
        const entryCenterX = leftX + zoneWidth / 2

        figures.push({
          key: 'lp_entry_label_bg',
          type: 'rect',
          attrs: {
            x: entryCenterX - entryLabelW / 2,
            y: entryY - entryLabelH / 2,
            width: entryLabelW,
            height: entryLabelH
          },
          styles: {
            style: 'fill',
            color: entryLabelBg,
            borderRadius: LABEL_BORDER_RADIUS
          },
          ignoreEvent: true
        })

        figures.push({
          key: 'lp_entry_label_text',
          type: 'text',
          attrs: {
            x: entryCenterX,
            y: entryY,
            text: entryText,
            align: 'center',
            baseline: 'middle'
          },
          styles: {
            color: labelTextColor,
            size: fontSize,
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }

      // SL label (centered inside red zone)
      if (showSlLabel) {
        const slText = formatSlLabel(stats, ext.compact, precision)
        const slTextWidth = calcTextWidth(slText, fontSize)
        const slLabelW = slTextWidth + 2 * LABEL_PADDING_H
        const slLabelH = fontSize + 2 * LABEL_PADDING_V
        const slCenterX = leftX + zoneWidth / 2
        const slCenterY = Math.min(entryY, stopY) + slZoneHeight / 2

        figures.push({
          key: 'lp_sl_label_bg',
          type: 'rect',
          attrs: {
            x: slCenterX - slLabelW / 2,
            y: slCenterY - slLabelH / 2,
            width: slLabelW,
            height: slLabelH
          },
          styles: {
            style: 'fill',
            color: slLabelBg,
            borderRadius: LABEL_BORDER_RADIUS
          },
          ignoreEvent: true
        })

        figures.push({
          key: 'lp_sl_label_text',
          type: 'text',
          attrs: {
            x: slCenterX,
            y: slCenterY,
            text: slText,
            align: 'center',
            baseline: 'middle'
          },
          styles: {
            color: labelTextColor,
            size: fontSize,
            backgroundColor: 'transparent'
          },
          ignoreEvent: true
        })
      }
    }

    // ── 13-16. Control points (only when selected or hovered) ──
    if (isHoveredOrSelected) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      // P1: Entry circle (free movement)
      figures.push({
        key: 'lp_cp_entry',
        type: 'circle',
        attrs: { x: leftX, y: entryY, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 0,
        cursor: 'move'
      })

      // P2: TP square (vertical only)
      figures.push({
        key: 'lp_cp_tp',
        type: 'rect',
        attrs: {
          x: leftX - CP_MID_SIZE / 2,
          y: targetY - CP_MID_SIZE / 2,
          width: CP_MID_SIZE,
          height: CP_MID_SIZE
        },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_MID_BORDER,
          borderRadius: CP_MID_BORDER_RADIUS
        },
        pointIndex: 1,
        cursor: 'ns-resize'
      })

      // P3: SL square (vertical only)
      figures.push({
        key: 'lp_cp_sl',
        type: 'rect',
        attrs: {
          x: leftX - CP_MID_SIZE / 2,
          y: stopY - CP_MID_SIZE / 2,
          width: CP_MID_SIZE,
          height: CP_MID_SIZE
        },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_MID_BORDER,
          borderRadius: CP_MID_BORDER_RADIUS
        },
        pointIndex: 2,
        cursor: 'ns-resize'
      })

      // P4: Width square (horizontal only)
      figures.push({
        key: 'lp_cp_width',
        type: 'rect',
        attrs: {
          x: rightX - CP_MID_SIZE / 2,
          y: entryY - CP_MID_SIZE / 2,
          width: CP_MID_SIZE,
          height: CP_MID_SIZE
        },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_MID_BORDER,
          borderRadius: CP_MID_BORDER_RADIUS
        },
        pointIndex: 3,
        cursor: 'ew-resize'
      })
    }

    return figures
  },

  createYAxisFigures: ({ overlay, coordinates, bounding, yAxis }) => {
    const ext = getExt(overlay.extendData)
    if (!ext.showPriceLabels) return []
    if (coordinates.length < 3) return []

    const isFromZero = yAxis?.isFromZero() ?? false
    const textAlign: CanvasTextAlign = isFromZero ? 'left' : 'right'
    const x = isFromZero ? 0 : bounding.width
    const precision = ext.pricePrecision
    const figures: OverlayFigure[] = []

    const entryPrice = overlay.points[0]?.value
    const targetPrice = overlay.points[1]?.value
    const stopPrice = overlay.points[2]?.value

    // Entry pill (gray)
    if (entryPrice != null) {
      const entryText = formatPrecision(entryPrice, precision)
      figures.push({
        type: 'text',
        attrs: { x, y: coordinates[0].y, text: entryText, align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: {
          color: '#ffffff',
          backgroundColor: ext.lineColor,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // TP pill (teal)
    if (targetPrice != null) {
      const tpText = formatPrecision(targetPrice, precision)
      const tpBg = rgbaToSolid(ext.profitBackground)
      figures.push({
        type: 'text',
        attrs: { x, y: coordinates[1].y, text: tpText, align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: {
          color: '#ffffff',
          backgroundColor: tpBg,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    // SL pill (red)
    if (stopPrice != null) {
      const slText = formatPrecision(stopPrice, precision)
      const slBg = rgbaToSolid(ext.stopBackground)
      figures.push({
        type: 'text',
        attrs: { x, y: coordinates[2].y, text: slText, align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: {
          color: '#ffffff',
          backgroundColor: slBg,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 2
        },
        ignoreEvent: true
      })
    }

    return figures
  },

  performEventPressedMove: ({ points, performPointIndex, performPoint, prevPoints }) => {
    switch (performPointIndex) {
      case 0: {
        // P1 (Entry): free H+V — P2/P3 follow X, P4.Y = entry
        if (points.length > 1) {
          points[1].timestamp = points[0].timestamp
          points[1].dataIndex = points[0].dataIndex
        }
        if (points.length > 2) {
          points[2].timestamp = points[0].timestamp
          points[2].dataIndex = points[0].dataIndex
        }
        if (points.length > 3) {
          points[3].value = performPoint.value
          points[3].timestamp = prevPoints[3]?.timestamp
          points[3].dataIndex = prevPoints[3]?.dataIndex
        }
        break
      }

      case 1: {
        // P2 (TP): vertical only, clamped above entry
        points[1].timestamp = points[0]?.timestamp
        points[1].dataIndex = points[0]?.dataIndex
        // For long position, TP must be >= entry price (higher value = above)
        if ((performPoint.value ?? 0) < (points[0]?.value ?? 0)) {
          points[1].value = points[0].value
        }
        break
      }

      case 2: {
        // P3 (SL): vertical only, clamped below entry
        points[2].timestamp = points[0]?.timestamp
        points[2].dataIndex = points[0]?.dataIndex
        // For long position, SL must be <= entry price (lower value = below)
        if ((performPoint.value ?? 0) > (points[0]?.value ?? 0)) {
          points[2].value = points[0].value
        }
        break
      }

      case 3: {
        // P4 (Width): horizontal only — Y locked to entry price
        points[3].value = points[0].value
        break
      }
    }
  }
}

export default longPosition
