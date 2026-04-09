/**
 * SectorReferenceLabelView
 * Renders clickable sector name label on indicator pane (chart area, not Y-axis).
 * Positioned at right edge of chart area, same Y as sector reference line.
 */

import { isNumber, isValid } from '../common/utils/typeChecks'
import { calcTextWidth } from '../common/utils/canvas'
import type { EventHandler } from '../common/EventHandler'

import View from './View'

import type { YAxis } from '../component/YAxis'

export default class SectorReferenceLabelView extends View<YAxis> {
  private readonly _boundSectorClickEvent = (sectorName: string) => () => {
    this.getWidget().getPane().getChart().getChartStore().executeAction('onSectorLabelClick', { sectorName })
    return false
  }

  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const paneId = pane.getId()
    const indicators = chartStore.getIndicatorsByPaneId(paneId)
    const yAxis = pane.getAxisComponent()

    indicators.forEach(indicator => {
      if (!indicator.visible) return

      const extData = indicator.extendData as Record<string, unknown> | undefined
      if (!isValid(extData)) return

      const showSectorLine = (indicator.styles as Record<string, unknown> | undefined)?.showSectorLine === true
      if (!showSectorLine) return

      const sectorLineColor = ((indicator.styles as Record<string, unknown> | undefined)?.sectorLineColor as string | undefined) ?? '#26A69A'
      const sectorName = extData.sectorName as string | undefined
      if (typeof sectorName !== 'string' || sectorName.length === 0) return

      const sectorValue = indicator.name === 'PE'
        ? extData.sectorPE
        : indicator.name === 'PB'
          ? extData.sectorPB
          : undefined

      if (!isNumber(sectorValue)) return

      const y = yAxis.convertToNicePixel(sectorValue)
      if (!Number.isFinite(y) || y < -10 || y > bounding.height + 10) return

      const fontSize = 11
      const fontFamily = 'SF-Pro-Display, SF-Pro-Text, -apple-system, BlinkMacSystemFont, sans-serif'
      const fontWeight = 500
      const paddingH = 5
      const paddingV = 3
      const textWidth = calcTextWidth(sectorName, fontSize, fontWeight, fontFamily)
      const labelWidth = textWidth + paddingH * 2
      const labelHeight = fontSize + paddingV * 2

      const handler: EventHandler = {
        mouseClickEvent: this._boundSectorClickEvent(sectorName),
        mouseMoveEvent: () => true
      }

      this.createFigure({
        name: 'text',
        attrs: {
          x: bounding.width,
          y,
          width: labelWidth,
          height: labelHeight,
          text: sectorName,
          align: 'right',
          baseline: 'middle'
        },
        styles: {
          style: 'fill',
          color: '#FFFFFF',
          size: fontSize,
          family: fontFamily,
          weight: fontWeight,
          paddingLeft: paddingH,
          paddingTop: paddingV,
          paddingRight: paddingH,
          paddingBottom: paddingV,
          borderColor: 'transparent',
          borderStyle: 'solid',
          borderSize: 0,
          borderRadius: 2,
          borderDashedValue: [2],
          backgroundColor: sectorLineColor
        }
      }, handler)?.draw(ctx)
    })
  }
}
