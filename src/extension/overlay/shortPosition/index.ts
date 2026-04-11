/**
 * Short Position overlay — TradingView-style risk/reward measurement tool
 *
 * Inverted from Long Position: profits when price drops.
 * Data points: 4 (P1 entry, P2 TP, P3 SL, P4 width)
 * Control points: P1 circle (free), P2/P3 square (vertical), P4 square (horizontal)
 * Single-click creation (totalStep=2), web layer injects P2/P3/P4 via onDrawEnd
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type { EventOverlayInfo } from '../../../Store'
import { calcTextWidth } from '../../../common/utils/canvas'
import { formatPrecision } from '../../../common/utils/format'

import type { ShortPositionExtendData } from './constants'
import {
  SHORT_POSITION_DEFAULTS,
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

function rgbaToSolid (rgba: string): string {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgba)
  if (match != null) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`
  }
  return rgba
}

function getExt (extendData: ShortPositionExtendData | undefined): ShortPositionExtendData {
  if (extendData == null) return { ...SHORT_POSITION_DEFAULTS }
  return { ...SHORT_POSITION_DEFAULTS, ...extendData }
}

// ═══════════════════════════════════════
// OVERLAY
// ═══════════════════════════════════════

const shortPosition: OverlayTemplate<ShortPositionExtendData> = {
  name: 'shortPosition',
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, overlay }) => {
    const ext = getExt(overlay.extendData)

    if (coordinates.length < 1) return []
    if (coordinates.length < 4) {
      const c1 = coordinates[0]
      return [{
        key: 'sp_entry_line',
        type: 'line',
        attrs: {
          coordinates: [
            { x: c1.x, y: c1.y },
            { x: c1.x + 200, y: c1.y }
          ]
        },
        styles: { style: 'solid', color: ext.lineColor, size: ext.lineWidth },
        ignoreEvent: true
      }]
    }

    const [c1, c2, c3, c4] = coordinates
    const leftX = Math.min(c1.x, c4.x)
    const rightX = Math.max(c1.x, c4.x)
    const entryY = c1.y
    const targetY = c2.y
    const stopY = c3.y
    const zoneWidth = Math.max(rightX - leftX, 50)

    const figures: OverlayFigure[] = []

    // 1. TP zone fill (below entry for short = profit zone)
    if (ext.fillBackground) {
      figures.push({
        key: 'sp_tp_zone',
        type: 'rect',
        attrs: { x: leftX, y: Math.min(targetY, entryY), width: zoneWidth, height: Math.abs(entryY - targetY) },
        styles: { style: 'fill', color: ext.profitBackground },
        ignoreEvent: true
      })
    }

    // 2. SL zone fill (above entry for short = stop zone)
    if (ext.fillBackground) {
      figures.push({
        key: 'sp_sl_zone',
        type: 'rect',
        attrs: { x: leftX, y: Math.min(entryY, stopY), width: zoneWidth, height: Math.abs(stopY - entryY) },
        styles: { style: 'fill', color: ext.stopBackground },
        ignoreEvent: true
      })
    }

    // 3. TP border
    if (ext.drawBorder) {
      figures.push({
        key: 'sp_tp_border',
        type: 'rect',
        attrs: { x: leftX, y: Math.min(targetY, entryY), width: zoneWidth, height: Math.abs(entryY - targetY) },
        styles: { style: 'stroke', borderColor: ext.borderColor, borderSize: 1 },
        ignoreEvent: true
      })
    }

    // 4. SL border
    if (ext.drawBorder) {
      figures.push({
        key: 'sp_sl_border',
        type: 'rect',
        attrs: { x: leftX, y: Math.min(entryY, stopY), width: zoneWidth, height: Math.abs(stopY - entryY) },
        styles: { style: 'stroke', borderColor: ext.borderColor, borderSize: 1 },
        ignoreEvent: true
      })
    }

    // 5. Entry line
    figures.push({
      key: 'sp_entry_line',
      type: 'line',
      attrs: { coordinates: [{ x: leftX, y: entryY }, { x: leftX + zoneWidth, y: entryY }] },
      styles: { style: 'solid', color: ext.lineColor, size: ext.lineWidth },
      ignoreEvent: true
    })

    // 5b. Trade simulation (SHORT logic)
    const dataList = chart.getDataList()
    const entryPrice = overlay.points[0]?.value ?? 0
    const targetPrice = overlay.points[1]?.value ?? 0
    const stopPrice = overlay.points[2]?.value ?? 0

    const convertResult = chart.convertFromPixel(
      [{ x: c1.x }, { x: c4.x }],
      { paneId: overlay.paneId }
    ) as Array<Partial<{ dataIndex: number; value: number }>>
    const p1Idx = Math.max(convertResult[0]?.dataIndex ?? 0, 0)
    const p4Idx = Math.min(convertResult[1]?.dataIndex ?? (dataList.length - 1), dataList.length - 1)

    const scanStart = Math.max(p1Idx, 0)
    const scanEnd = Math.min(p4Idx, dataList.length - 1)
    const hasBarsInRange = scanStart <= scanEnd && scanStart < dataList.length

    let tpHitIdx = -1
    let slHitIdx = -1
    let entryBarIdx = -1
    let tradeResult: 'tp' | 'sl' | 'open' = 'open'
    let tradePL = 0

    if (hasBarsInRange) {
      for (let i = scanStart; i <= scanEnd; i++) {
        const bar = dataList[i]
        if (entryBarIdx < 0 && bar.close <= entryPrice) entryBarIdx = i
        if (tpHitIdx < 0 && bar.low <= targetPrice) tpHitIdx = i
        if (slHitIdx < 0 && bar.high >= stopPrice) slHitIdx = i
      }

      if (tpHitIdx >= 0 && slHitIdx >= 0) {
        tradeResult = tpHitIdx <= slHitIdx ? 'tp' : 'sl'
      } else if (tpHitIdx >= 0) {
        tradeResult = 'tp'
      } else if (slHitIdx >= 0) {
        tradeResult = 'sl'
      }

      const projStartIdx = entryBarIdx >= 0 ? entryBarIdx : scanStart

      const idxToX = (idx: number): number => {
        if (p4Idx === p1Idx) return rightX
        return leftX + (idx - p1Idx) / (p4Idx - p1Idx) * (rightX - leftX)
      }

      const shapeStartX = idxToX(projStartIdx)
      let shapeEndX = rightX
      let shapeEndY = entryY

      if (tradeResult === 'tp') {
        tradePL = entryPrice - targetPrice
        shapeEndX = idxToX(tpHitIdx)
        shapeEndY = targetY
      } else if (tradeResult === 'sl') {
        tradePL = -(stopPrice - entryPrice)
        shapeEndX = idxToX(slHitIdx)
        shapeEndY = stopY
      } else {
        const closePrice = dataList[scanEnd]?.close ?? entryPrice
        tradePL = entryPrice - closePrice
        if (entryPrice !== targetPrice) {
          shapeEndY = entryY + (entryPrice - closePrice) / (entryPrice - targetPrice) * (targetY - entryY)
        }
      }

      // 5c. Projected shape
      const projWidth = Math.abs(shapeEndX - shapeStartX)
      if (Math.abs(shapeEndY - entryY) > 1 && projWidth > 1) {
        const projColor = tradePL >= 0 ? ext.profitBackground : ext.stopBackground
        figures.push({
          key: 'sp_projected',
          type: 'rect',
          attrs: { x: Math.min(shapeStartX, shapeEndX), y: Math.min(entryY, shapeEndY), width: projWidth, height: Math.abs(shapeEndY - entryY) },
          styles: { style: 'fill', color: projColor },
          ignoreEvent: true
        })
      }

      // 5d. Diagonal dashed line
      if (projWidth > 1) {
        figures.push({
          key: 'sp_diagonal',
          type: 'line',
          attrs: { coordinates: [{ x: shapeStartX, y: entryY }, { x: shapeEndX, y: shapeEndY }] },
          styles: { style: 'dashed', color: ext.lineColor, size: 1, dashedValue: [4, 4] },
          ignoreEvent: true
        })
      }
    }

    // 6. Hitbox
    const hitTop = Math.min(targetY, entryY, stopY)
    const hitBottom = Math.max(targetY, entryY, stopY)
    figures.push({
      key: 'sp_hitbox',
      type: 'rect',
      attrs: { x: leftX, y: hitTop, width: zoneWidth, height: Math.max(hitBottom - hitTop, 1) },
      styles: { style: 'fill', color: 'transparent' },
      ignoreEvent: false
    })

    // Selection state
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'
    const isHoveredOrSelected = isSelected || isHovered

    // 7-12. Labels
    const showLabels = ext.alwaysShowStats || isHoveredOrSelected
    if (showLabels) {
      const precision = ext.pricePrecision
      const isClosed = tradeResult !== 'open'
      const stats = calculateStats(entryPrice, targetPrice, stopPrice, entryPrice - tradePL, ext)

      const fontSize = ext.fontSize
      const labelTextColor = ext.textColor
      const tpSolid = rgbaToSolid(ext.profitBackground)
      const slSolid = rgbaToSolid(ext.stopBackground)
      const tpZoneHeight = Math.abs(entryY - targetY)
      const slZoneHeight = Math.abs(stopY - entryY)
      const centerX = leftX + zoneWidth / 2

      // TP label: BELOW TP zone (short: TP is below entry)
      {
        const tpText = formatTpLabel(stats, ext.compact, precision)
        const tpTextW = calcTextWidth(tpText, fontSize)
        const tpLabelW = tpTextW + 2 * LABEL_PADDING_H
        const tpLabelH = fontSize + 2 * LABEL_PADDING_V
        const tpLabelY = Math.max(targetY, entryY) + LABEL_GAP

        figures.push({
          key: 'sp_tp_label_bg',
          type: 'rect',
          attrs: { x: centerX - tpLabelW / 2, y: tpLabelY, width: tpLabelW, height: tpLabelH },
          styles: { style: 'stroke_fill', color: tpSolid, borderColor: tpSolid, borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })
        figures.push({
          key: 'sp_tp_label_text',
          type: 'text',
          attrs: { x: centerX, y: tpLabelY + tpLabelH / 2, text: tpText, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }

      // SL label: ABOVE SL zone (short: SL is above entry)
      {
        const slText = formatSlLabel(stats, ext.compact, precision)
        const slTextW = calcTextWidth(slText, fontSize)
        const slLabelW = slTextW + 2 * LABEL_PADDING_H
        const slLabelH = fontSize + 2 * LABEL_PADDING_V
        const slLabelY = Math.min(stopY, entryY) - slLabelH - LABEL_GAP

        figures.push({
          key: 'sp_sl_label_bg',
          type: 'rect',
          attrs: { x: centerX - slLabelW / 2, y: slLabelY, width: slLabelW, height: slLabelH },
          styles: { style: 'stroke_fill', color: slSolid, borderColor: slSolid, borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })
        figures.push({
          key: 'sp_sl_label_text',
          type: 'text',
          attrs: { x: centerX, y: slLabelY + slLabelH / 2, text: slText, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })
      }

      // Entry label: 2 lines, dynamic bg, white border
      {
        const line1 = formatEntryLabel(stats, ext.compact, precision, isClosed)
        const line2 = formatEntryLabelLine2(stats, ext.compact)
        const hasLine2 = line2.length > 0
        const line1W = calcTextWidth(line1, fontSize)
        const line2W = hasLine2 ? calcTextWidth(line2, fontSize) : 0
        const maxTextW = Math.max(line1W, line2W)
        const entryLabelW = maxTextW + 2 * LABEL_PADDING_H
        const entryLabelH = hasLine2 ? 2 * fontSize + ENTRY_LABEL_LINE_GAP + 2 * LABEL_PADDING_V : fontSize + 2 * LABEL_PADDING_V

        let entryLabelY = entryY - entryLabelH / 2
        if (entryLabelW > zoneWidth) {
          if (tpZoneHeight >= slZoneHeight) {
            entryLabelY = entryY + 5
          } else {
            entryLabelY = entryY - entryLabelH - 5
          }
        }

        const entryBgColor = stats.openPL >= 0 ? tpSolid : slSolid
        figures.push({
          key: 'sp_entry_label_bg',
          type: 'rect',
          attrs: { x: centerX - entryLabelW / 2, y: entryLabelY, width: entryLabelW, height: entryLabelH },
          styles: { style: 'stroke_fill', color: entryBgColor, borderColor: '#ffffff', borderSize: LABEL_BORDER_SIZE, borderRadius: LABEL_BORDER_RADIUS },
          ignoreEvent: true
        })

        const line1Y = hasLine2 ? entryLabelY + LABEL_PADDING_V + fontSize / 2 : entryLabelY + entryLabelH / 2
        figures.push({
          key: 'sp_entry_label_text1',
          type: 'text',
          attrs: { x: centerX, y: line1Y, text: line1, align: 'center', baseline: 'middle' },
          styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
          ignoreEvent: true
        })

        if (hasLine2) {
          const line2Y = line1Y + fontSize + ENTRY_LABEL_LINE_GAP
          figures.push({
            key: 'sp_entry_label_text2',
            type: 'text',
            attrs: { x: centerX, y: line2Y, text: line2, align: 'center', baseline: 'middle' },
            styles: { color: labelTextColor, size: fontSize, backgroundColor: 'transparent' },
            ignoreEvent: true
          })
        }
      }
    }

    // 13-16. Control points
    if (isHoveredOrSelected) {
      const tickTextColor = chart.getStyles().yAxis.tickText.color
      const cpBg = isLightColor(String(tickTextColor)) ? '#131722' : '#ffffff'

      figures.push({
        key: 'sp_cp_entry',
        type: 'circle',
        attrs: { x: leftX, y: entryY, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_CIRCLE_BORDER },
        pointIndex: 0,
        cursor: 'move'
      })

      figures.push({
        key: 'sp_cp_tp',
        type: 'rect',
        attrs: { x: leftX - CP_MID_SIZE / 2, y: targetY - CP_MID_SIZE / 2, width: CP_MID_SIZE, height: CP_MID_SIZE },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_MID_BORDER, borderRadius: CP_MID_BORDER_RADIUS },
        pointIndex: 1,
        cursor: 'ns-resize'
      })

      figures.push({
        key: 'sp_cp_sl',
        type: 'rect',
        attrs: { x: leftX - CP_MID_SIZE / 2, y: stopY - CP_MID_SIZE / 2, width: CP_MID_SIZE, height: CP_MID_SIZE },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_MID_BORDER, borderRadius: CP_MID_BORDER_RADIUS },
        pointIndex: 2,
        cursor: 'ns-resize'
      })

      figures.push({
        key: 'sp_cp_width',
        type: 'rect',
        attrs: { x: rightX - CP_MID_SIZE / 2, y: entryY - CP_MID_SIZE / 2, width: CP_MID_SIZE, height: CP_MID_SIZE },
        styles: { style: 'stroke_fill', color: cpBg, borderColor: CP_COLOR, borderSize: CP_MID_BORDER, borderRadius: CP_MID_BORDER_RADIUS },
        pointIndex: 3,
        cursor: 'ew-resize'
      })
    }

    return figures
  },

  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const ext = getExt(overlay.extendData)
    if (!ext.showPriceLabels) return []
    if (coordinates.length < 3) return []

    const isFromZero = yAxis?.isFromZero() ?? false
    const textAlign: CanvasTextAlign = isFromZero ? 'left' : 'right'
    const x = isFromZero ? 0 : bounding.width
    const precision = ext.pricePrecision
    const figures: OverlayFigure[] = []

    const entryY = coordinates[0].y
    const tpY = coordinates[1].y
    const slY = coordinates[2].y

    // Bg strip (dark blue) — only when selected, profit zone: entry → TP
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    if (isSelected) {
      const profitTop = Math.min(entryY, tpY)
      const profitHeight = Math.max(entryY, tpY) - profitTop
      if (profitHeight > 0) {
        figures.push({
          type: 'rect',
          attrs: { x: 0, y: profitTop, width: bounding.width, height: profitHeight },
          styles: { style: 'fill', color: 'rgba(41, 98, 255, 0.15)' },
          ignoreEvent: true
        })
      }
    }

    const entryPrice = overlay.points[0]?.value
    const targetPrice = overlay.points[1]?.value
    const stopPrice = overlay.points[2]?.value

    if (entryPrice != null) {
      figures.push({
        type: 'text',
        attrs: { x, y: entryY, text: formatPrecision(entryPrice, precision), align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: { color: '#ffffff', backgroundColor: ext.lineColor, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
        ignoreEvent: true
      })
    }

    if (targetPrice != null) {
      figures.push({
        type: 'text',
        attrs: { x, y: tpY, text: formatPrecision(targetPrice, precision), align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: { color: '#ffffff', backgroundColor: rgbaToSolid(ext.profitBackground), paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
        ignoreEvent: true
      })
    }

    if (stopPrice != null) {
      figures.push({
        type: 'text',
        attrs: { x, y: slY, text: formatPrecision(stopPrice, precision), align: textAlign, baseline: 'middle' as CanvasTextBaseline },
        styles: { color: '#ffffff', backgroundColor: rgbaToSolid(ext.stopBackground), paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
        ignoreEvent: true
      })
    }

    return figures
  },

  createXAxisFigures: ({ chart, overlay, coordinates, bounding }) => {
    if (coordinates.length < 1) return []

    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    if (!isSelected) return []

    const figures: OverlayFigure[] = []

    if (coordinates.length >= 4) {
      const leftX = Math.min(coordinates[0].x, coordinates[3].x)
      const rightX = Math.max(coordinates[0].x, coordinates[3].x)
      const stripWidth = rightX - leftX
      if (stripWidth > 0) {
        figures.push({
          type: 'rect',
          attrs: { x: leftX, y: 0, width: stripWidth, height: bounding.height },
          styles: { style: 'fill', color: 'rgba(41, 98, 255, 0.15)' },
          ignoreEvent: true
        })
      }
    }

    const x = coordinates[0].x
    if (x >= 0 && x <= bounding.width) {
      const entryTimestamp = overlay.points[0]?.timestamp
      if (entryTimestamp != null) {
        const d = new Date(entryTimestamp)
        const dateText = `${d.getDate()} Thg ${d.getMonth() + 1} '${d.getFullYear() % 100}`
        figures.push({
          type: 'text',
          attrs: { x, y: 0, text: dateText, align: 'center' as CanvasTextAlign, baseline: 'top' as CanvasTextBaseline },
          styles: { color: '#ffffff', backgroundColor: '#2962FF', paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 2, size: 11 },
          ignoreEvent: true
        })
      }
    }

    return figures
  },

  performEventPressedMove: ({ points, performPointIndex, performPoint, prevPoints }) => {
    switch (performPointIndex) {
      case 0: {
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
        // P2 (TP): vertical only, clamped BELOW entry (short: TP <= entry price)
        points[1].timestamp = points[0]?.timestamp
        points[1].dataIndex = points[0]?.dataIndex
        if ((performPoint.value ?? 0) > (points[0]?.value ?? 0)) {
          points[1].value = points[0].value
        }
        break
      }

      case 2: {
        // P3 (SL): vertical only, clamped ABOVE entry (short: SL >= entry price)
        points[2].timestamp = points[0]?.timestamp
        points[2].dataIndex = points[0]?.dataIndex
        if ((performPoint.value ?? 0) < (points[0]?.value ?? 0)) {
          points[2].value = points[0].value
        }
        break
      }

      case 3: {
        points[3].value = points[0].value
        break
      }
    }
  }
}

export default shortPosition
