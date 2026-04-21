/**
 * Regression Trend (Xu hướng hồi quy) — TradingView-style Linear Regression Channel.
 *
 * Data points: 2 (start bar + end bar). CPs render at the fitted regression Y,
 * NOT at the raw pointer Y.
 *
 * Three render modes in `createPointFigures`:
 *   A — Drawing in progress (overlay.currentStep !== -1)
 *       → single thin gray preview line between coordinates[0..1]
 *   B — CP drag in progress (pressedOverlayInfo.figureType === 'point')
 *       → same preview line
 *   C — Idle / selected / body-drag
 *       → up to 8 figures:
 *         upper fill, lower fill, center line, upper line, lower line,
 *         Pearson R label, CP0, CP1  (each gated by its visibility flag)
 *
 * On CP release, `performEventPressedMove` discards the raw pointer Y so
 * the next frame re-projects the CP onto the regression line.
 */

import type { OverlayTemplate, OverlayFigure } from '../../../component/Overlay'
import type Coordinate from '../../../common/Coordinate'
import type Point from '../../../common/Point'
import { isNumber } from '../../../common/utils/typeChecks'

import type { RegressionTrendExtendData } from './types'
import {
  REGRESSION_TREND_DEFAULTS,
  RT_PREVIEW,
  RT_UPPER_FILL, RT_LOWER_FILL,
  RT_CENTER_LINE, RT_UPPER_LINE, RT_LOWER_LINE,
  RT_PEARSON_R,
  RT_CP_0, RT_CP_1,
  DASH,
  CP_COLOR, CP_RADIUS, CP_CIRCLE_BORDER,
  PREVIEW_LINE_WIDTH, PREVIEW_FALLBACK_COLOR,
  PEARSON_FONT_SIZE, PEARSON_LABEL_OFFSET_X,
  BASE_LINE_WIDTH, UPPER_LINE_WIDTH, LOWER_LINE_WIDTH,
  FILL_OPACITY,
  type ChartInternal
} from './constants'
import {
  linearRegression, regressionStdDev, pearsonsR,
  getPriceFromSource, alphaRgba, extendToRight, isLightColor
} from './math'

export type {
  RegressionTrendExtendData,
  RegressionSource,
  LineStyle,
  VisibilityRange
} from './types'

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function mergeExt (ext: RegressionTrendExtendData | undefined): Required<RegressionTrendExtendData> {
  return { ...REGRESSION_TREND_DEFAULTS, ...(ext ?? {}) }
}

// ═══════════════════════════════════════
// Overlay template
// ═══════════════════════════════════════

const regressionTrend: OverlayTemplate<RegressionTrendExtendData> = {
  name: 'regressionTrend',
  // 2 clicks → OVERLAY_DRAW_STEP_FINISHED (-1). TAD §2.1: CPs live at
  // the regression Y, not at points[i].value, so default point figures
  // are disabled.
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const figures: OverlayFigure[] = []
    if (coordinates.length < 1) return figures

    // ─── Mode detection (drawing vs CP drag vs full channel) ───
    const chartStore = (chart as unknown as ChartInternal).getChartStore()
    const pressed = chartStore.getPressedOverlayInfo()
    const currentStep = (overlay as { currentStep?: number }).currentStep
    const isDrawing = currentStep != null && currentStep !== -1
    const isCpDrag =
      !isDrawing &&
      pressed.overlay?.id === overlay.id &&
      pressed.figureType === 'point'

    // ─── Mode A / Mode B: preview line only ───
    if (isDrawing || isCpDrag) {
      if (coordinates.length < 2) return figures
      const rawCrosshairColor = chart.getStyles().crosshair.horizontal.line.color
      const crosshairColor = rawCrosshairColor !== '' ? rawCrosshairColor : PREVIEW_FALLBACK_COLOR
      figures.push({
        key: RT_PREVIEW,
        type: 'line',
        attrs: { coordinates: [coordinates[0], coordinates[1]] },
        styles: {
          color: crosshairColor,
          size: PREVIEW_LINE_WIDTH,
          style: 'solid'
        },
        ignoreEvent: true
      })
      return figures
    }

    // ─── Mode C: full channel ───
    if (coordinates.length < 2) return figures

    const ext = mergeExt(overlay.extendData)
    const i1 = overlay.points[0]?.dataIndex
    const i2 = overlay.points[1]?.dataIndex

    // Degenerate case — less than 2 distinct bars. Render plain center line only.
    if (!isNumber(i1) || !isNumber(i2) || Math.abs(i2 - i1) < 1) {
      figures.push({
        key: RT_CENTER_LINE,
        type: 'line',
        attrs: { coordinates: [coordinates[0], coordinates[1]] },
        styles: {
          color: ext.baseColor,
          size: BASE_LINE_WIDTH,
          style: ext.baseStyle,
          dashedValue: DASH[ext.baseStyle]
        }
      })
      return figures
    }

    // ─── Clamp bar range + extract prices ───
    const dataList = chart.getDataList()
    if (dataList.length === 0) return figures

    const startIdx = Math.min(i1, i2)
    const endIdx = Math.max(i1, i2)
    const start = Math.max(0, startIdx)
    const end = Math.min(dataList.length - 1, endIdx)
    if (end - start < 1) return figures

    const prices: number[] = []
    for (let k = start; k <= end; k++) {
      prices.push(getPriceFromSource(dataList[k], ext.source))
    }
    if (prices.length < 2) return figures

    // ─── Regression + Pearson R ───
    const { slope, intercept } = linearRegression(prices)
    const stdDev = regressionStdDev(prices, slope, intercept)
    const r = pearsonsR(prices)

    const regStartVal = intercept
    const regEndVal = slope * (prices.length - 1) + intercept
    const upOffset = ext.upperDeviation * stdDev
    const loOffset = ext.lowerDeviation * stdDev

    // ─── Project 6 anchor prices to pixel ───
    const pts: Array<Partial<Point>> = [
      { dataIndex: start, value: regStartVal },
      { dataIndex: end, value: regEndVal },
      { dataIndex: start, value: regStartVal + upOffset },
      { dataIndex: end, value: regEndVal + upOffset },
      { dataIndex: start, value: regStartVal + loOffset },
      { dataIndex: end, value: regEndVal + loOffset }
    ]
    const pixels = chart.convertToPixel(pts, { paneId: overlay.paneId }) as Array<Partial<Coordinate>>
    const toCoord = (c: Partial<Coordinate> | undefined): Coordinate => ({ x: c?.x ?? 0, y: c?.y ?? 0 })

    const regS = toCoord(pixels[0])
    const regE = toCoord(pixels[1])
    const upS = toCoord(pixels[2])
    const upE = toCoord(pixels[3])
    const loS = toCoord(pixels[4])
    const loE = toCoord(pixels[5])

    // ─── Extend right (optional) ───
    const regE2 = ext.extendLines ? extendToRight(regS, regE, bounding) : regE
    const upE2 = ext.extendLines ? extendToRight(upS, upE, bounding) : upE
    const loE2 = ext.extendLines ? extendToRight(loS, loE, bounding) : loE

    // ─── Fills (bottom) ───
    if (ext.useUpperDeviation) {
      figures.push({
        key: RT_UPPER_FILL,
        type: 'polygon',
        attrs: { coordinates: [regS, regE2, upE2, upS] },
        styles: {
          style: 'fill',
          color: alphaRgba(ext.upperColor, FILL_OPACITY)
        }
      })
    }
    if (ext.useLowerDeviation) {
      figures.push({
        key: RT_LOWER_FILL,
        type: 'polygon',
        attrs: { coordinates: [regS, regE2, loE2, loS] },
        styles: {
          style: 'fill',
          color: alphaRgba(ext.lowerColor, FILL_OPACITY)
        }
      })
    }

    // ─── Lines ───
    if (ext.baseVisible) {
      figures.push({
        key: RT_CENTER_LINE,
        type: 'line',
        attrs: { coordinates: [regS, regE2] },
        styles: {
          color: ext.baseColor,
          size: BASE_LINE_WIDTH,
          style: ext.baseStyle,
          dashedValue: DASH[ext.baseStyle]
        }
      })
    }
    if (ext.upperVisible && ext.useUpperDeviation) {
      figures.push({
        key: RT_UPPER_LINE,
        type: 'line',
        attrs: { coordinates: [upS, upE2] },
        styles: {
          color: ext.upperColor,
          size: UPPER_LINE_WIDTH,
          style: ext.upperStyle,
          dashedValue: DASH[ext.upperStyle]
        }
      })
    }
    if (ext.lowerVisible && ext.useLowerDeviation) {
      figures.push({
        key: RT_LOWER_LINE,
        type: 'line',
        attrs: { coordinates: [loS, loE2] },
        styles: {
          color: ext.lowerColor,
          size: LOWER_LINE_WIDTH,
          style: ext.lowerStyle,
          dashedValue: DASH[ext.lowerStyle]
        }
      })
    }

    // ─── Pearson R label (left of regS, text color = upperColor per TAD §6) ───
    if (ext.pearsonR) {
      figures.push({
        key: RT_PEARSON_R,
        type: 'text',
        attrs: {
          x: regS.x - PEARSON_LABEL_OFFSET_X,
          y: regS.y,
          text: r.toFixed(15),
          align: 'right' as CanvasTextAlign,
          baseline: 'middle' as CanvasTextBaseline
        },
        styles: {
          color: ext.upperColor,
          size: PEARSON_FONT_SIZE,
          weight: 'normal',
          family: 'Arial, sans-serif',
          backgroundColor: 'transparent'
        },
        ignoreEvent: true
      })
    }

    // ─── Control points (selected or hovered) ───
    const isSelected = chartStore.getClickOverlayInfo().overlay?.id === overlay.id
    const hoverInfo = chartStore.getHoverOverlayInfo()
    const isHovered = hoverInfo.overlay?.id === overlay.id && hoverInfo.figureType !== 'none'

    if (isSelected || isHovered) {
      const tickTextColor = String(chart.getStyles().yAxis.tickText.color)
      const cpBg = isLightColor(tickTextColor) ? '#131722' : '#ffffff'

      figures.push({
        key: RT_CP_0,
        type: 'circle',
        attrs: { x: regS.x, y: regS.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 0,
        cursor: 'move'
      })
      figures.push({
        key: RT_CP_1,
        type: 'circle',
        attrs: { x: regE.x, y: regE.y, r: CP_RADIUS + CP_CIRCLE_BORDER },
        styles: {
          style: 'stroke_fill',
          color: cpBg,
          borderColor: CP_COLOR,
          borderSize: CP_CIRCLE_BORDER
        },
        pointIndex: 1,
        cursor: 'move'
      })
    }

    return figures
  },

  // ─────────────────────────────────────
  // CP drag: discard raw pointer Y so the CP snaps to regression Y on release.
  // Body drag (figureType === 'other') is handled by the engine's default
  // eventPressedOtherMove which translates all points by the same delta.
  // ─────────────────────────────────────
  performEventPressedMove: ({ points, performPointIndex, prevPoints }) => {
    if (performPointIndex !== 0 && performPointIndex !== 1) return
    if (prevPoints.length < 2) return

    // dataIndex/timestamp already follow the cursor via the engine default.
    // Wipe the pointer-derived Y — Mode C recomputes it from regression.
    points[performPointIndex].value = undefined
  }
}

export default regressionTrend
