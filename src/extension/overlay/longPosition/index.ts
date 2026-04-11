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
  LABEL_PADDING_H, LABEL_PADDING_V, LABEL_BORDER_RADIUS, LABEL_BORDER_SIZE,
  LABEL_GAP, ENTRY_LABEL_LINE_GAP,
  CP_COLOR, CP_RADIUS, CP_CIRCLE_BORDER,
  CP_MID_SIZE, CP_MID_BORDER, CP_MID_BORDER_RADIUS
} from './constants'
import { calculateStats, formatTpLabel, formatEntryLabel, formatEntryLabelLine2, formatSlLabel } from './utils'

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

    // ── 5b. Diagonal dashed line (entry-left → TP-right) ──
    figures.push({
      key: 'lp_diagonal',
      type: 'line',
      attrs: {
        coordinates: [
          { x: leftX, y: entryY },
          { x: leftX + zoneWidth, y: targetY }
        ]
      },
      styles: {
        style: 'dashed',
        color: ext.lineColor,
        size: 1,
        dashedValue: [4, 4]
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

    // ── 7-12. Labels (TradingView style) ──
    // TP label: ABOVE green zone, teal bg + teal border
    // Entry label: centered on entry line (2 lines), red bg + teal border, smart repositioning
    // SL label: BELOW red zone, red bg + red border
    const showLabels = ext.alwaysShowStats || isHoveredOrSelected
    if (showLabels) {
      const entryPrice = overlay.points[0]?.value ?? 0
      const targetPrice = overlay.points[1]?.value ?? 0
      const stopPrice = overlay.points[2]?.value ?? 0
      const precision = ext.pricePrecision

      // Get current market price for open P&L calculation
      const dataList = chart.getDataList()
      const currentPrice = dataList.length > 0 ? (dataList[dataList.length - 1]?.close ?? entryPrice) : entryPrice

      const stats = calculateStats(entryPrice, targetPrice, stopPrice, currentPrice, ext)

      const fontSize = ext.fontSize
      const labelTextColor = ext.textColor
      const tpSolid = rgbaToSolid(ext.profitBackground)
      const slSolid = rgbaToSolid(ext.stopBackground)

      const tpZoneHeight = Math.abs(entryY - targetY)
      const slZoneHeight = Math.abs(stopY - entryY)
      const centerX = leftX + zoneWidth / 2

      // ── TP label: ABOVE green zone ──
      {
        const tpText = formatTpLabel(stats, ext.compact, precision)
        const tpTextW = calcTextWidth(tpText, fontSize)
        const tpLabelW = tpTextW + 2 * LABEL_PADDING_H
        const tpLabelH = fontSize + 2 * LABEL_PADDING_V
        const tpLabelY = Math.min(targetY, entryY) - tpLabelH - LABEL_GAP

        figures.push({
          key: 'lp_tp_label_bg',
          type: 'rect',
          attrs: { x: centerX - tpLabelW / 2, y: tpLabelY, width: tpLabelW, height: tpLabelH },
          styles: { style: 'stroke_fill', color: tpSolid, borderColor: tpSolid, borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })
        figures.push({
          key: 'lp_tp_label_text',
          type: 'text',
          attrs: { x: centerX, y: tpLabelY + tpLabelH / 2, text: tpText, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }

      // ── SL label: BELOW red zone ──
      {
        const slText = formatSlLabel(stats, ext.compact, precision)
        const slTextW = calcTextWidth(slText, fontSize)
        const slLabelW = slTextW + 2 * LABEL_PADDING_H
        const slLabelH = fontSize + 2 * LABEL_PADDING_V
        const slLabelY = Math.max(stopY, entryY) + LABEL_GAP

        figures.push({
          key: 'lp_sl_label_bg',
          type: 'rect',
          attrs: { x: centerX - slLabelW / 2, y: slLabelY, width: slLabelW, height: slLabelH },
          styles: { style: 'stroke_fill', color: slSolid, borderColor: slSolid, borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })
        figures.push({
          key: 'lp_sl_label_text',
          type: 'text',
          attrs: { x: centerX, y: slLabelY + slLabelH / 2, text: slText, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }

      // ── Entry label: 2 lines, dynamic bg (green if profit, red if loss), white border ──
      {
        const line1 = formatEntryLabel(stats, ext.compact, precision)
        const line2 = formatEntryLabelLine2(stats, ext.compact)
        const hasLine2 = line2.length > 0

        const line1W = calcTextWidth(line1, fontSize)
        const line2W = hasLine2 ? calcTextWidth(line2, fontSize) : 0
        const maxTextW = Math.max(line1W, line2W)

        const entryLabelW = maxTextW + 2 * LABEL_PADDING_H
        const entryLabelH = hasLine2
          ? 2 * fontSize + ENTRY_LABEL_LINE_GAP + 2 * LABEL_PADDING_V
          : fontSize + 2 * LABEL_PADDING_V

        // Smart Y positioning:
        // Default: centered on entry line
        // If label is wider than zone → move to the taller zone area
        let entryLabelY = entryY - entryLabelH / 2
        if (entryLabelW > zoneWidth) {
          if (tpZoneHeight >= slZoneHeight) {
            entryLabelY = entryY - entryLabelH - 5
          } else {
            entryLabelY = entryY + 5
          }
        }

        // Dynamic bg: green when in profit, red when in loss
        const entryBgColor = stats.openPL >= 0 ? tpSolid : slSolid

        figures.push({
          key: 'lp_entry_label_bg',
          type: 'rect',
          attrs: { x: centerX - entryLabelW / 2, y: entryLabelY, width: entryLabelW, height: entryLabelH },
          styles: { style: 'stroke_fill', color: entryBgColor, borderColor: '#ffffff', borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })

        // Line 1
        const line1Y = hasLine2
          ? entryLabelY + LABEL_PADDING_V + fontSize / 2
          : entryLabelY + entryLabelH / 2
        figures.push({
          key: 'lp_entry_label_text1',
          type: 'text',
          attrs: { x: centerX, y: line1Y, text: line1, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })

        // Line 2 (if not compact)
        if (hasLine2) {
          const line2Y = line1Y + fontSize + ENTRY_LABEL_LINE_GAP
          figures.push({
            key: 'lp_entry_label_text2',
            type: 'text',
            attrs: { x: centerX, y: line2Y, text: line2, align: 'center', baseline: 'middle' },
            styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
            ignoreEvent: true
          })
        }
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

  createXAxisFigures: ({ overlay, coordinates, bounding }) => {
    if (coordinates.length < 1) return []

    const figures: OverlayFigure[] = []

    // Show entry date label on X-axis (only when selected)
    const x = coordinates[0].x
    if (x >= 0 && x <= bounding.width) {
      const entryTimestamp = overlay.points[0]?.timestamp
      if (entryTimestamp != null) {
        const d = new Date(entryTimestamp)
        const day = d.getDate()
        const month = d.getMonth() + 1
        const year = d.getFullYear() % 100
        const dateText = `${day} Thg ${month} '${year}`

        figures.push({
          type: 'text',
          attrs: { x, y: 0, text: dateText, align: 'center' as CanvasTextAlign, baseline: 'top' as CanvasTextBaseline },
          styles: {
            color: '#ffffff',
            backgroundColor: '#2962FF',
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 2,
            size: 11
          },
          ignoreEvent: true
        })
      }
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
