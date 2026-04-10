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

import { isNumber, isValid } from '../common/utils/typeChecks'

import { eachFigures, type IndicatorFigure, type IndicatorFigureStyle } from '../component/Indicator'
import type { EventHandler } from '../common/EventHandler'

import View from './View'

import type { YAxis } from '../component/YAxis'

export default class IndicatorLastValueView extends View<YAxis> {
  private readonly _boundSectorLabelClickEvent = (sectorName: string) => () => {
    this.getWidget().getPane().getChart().getChartStore().executeAction('onSectorLabelClick', { sectorName })
    return false
  }

  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const defaultStyles = chartStore.getStyles().indicator
    const lastValueMarkStyles = defaultStyles.lastValueMark
    const lastValueMarkTextStyles = lastValueMarkStyles.text
    const yAxis = pane.getAxisComponent()
    const yAxisRange = yAxis.getRange()
    const dataList = chartStore.getDataList()
    const dataIndex = dataList.length - 1
    const indicators = chartStore.getIndicatorsByPaneId(pane.getId())
    const formatter = chartStore.getInnerFormatter()
    const decimalFold = chartStore.getDecimalFold()
    const thousandsSeparator = chartStore.getThousandsSeparator()

    indicators.forEach(indicator => {
      // Per-indicator lastValueMark override takes precedence over global
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- indicator.styles may lack lastValueMark at runtime
      const indicatorLVM = (indicator.styles as Record<string, unknown>)?.lastValueMark as
        { show?: boolean; text?: Record<string, unknown>; figureKeys?: string[] } | undefined
      const shouldShowLastValue = indicatorLVM?.show ?? lastValueMarkStyles.show

      // Standard last-value labels (for indicators with figures)
      if (shouldShowLastValue) {
        const result = indicator.result
        const data = result[dataIndex] ?? {}
        if (isValid(data) && indicator.visible) {
          const precision = indicator.precision
          // Merge per-indicator text styles over global defaults
          const mergedTextStyles = indicatorLVM?.text != null
            ? { ...lastValueMarkTextStyles, ...indicatorLVM.text }
            : lastValueMarkTextStyles
          const figureFilter = indicatorLVM?.figureKeys

          eachFigures(indicator, dataIndex, defaultStyles, (figure: IndicatorFigure, figureStyles: Required<IndicatorFigureStyle>) => {
            // Filter: only show labels for specified figure keys
            if (figureFilter != null && !figureFilter.includes(figure.key)) return

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ignore
            const value = data[figure.key]
            if (isNumber(value)) {
              const y = yAxis.convertToNicePixel(value)
              let text = yAxis.displayValueToText(
                yAxis.realValueToDisplayValue(
                  yAxis.valueToRealValue(value, { range: yAxisRange }),
                  { range: yAxisRange }
                ),
                precision
              )
              if (indicator.shouldFormatBigNumber) {
                text = formatter.formatBigNumber(text)
              }
              text = decimalFold.format(thousandsSeparator.format(text))
              let x = 0
              let textAlign: CanvasTextAlign = 'left'
              if (yAxis.isFromZero()) {
                x = 0
                textAlign = 'left'
              } else {
                x = bounding.width
                textAlign = 'right'
              }

              this.createFigure({
                name: 'text',
                attrs: {
                  x,
                  y,
                  text,
                  align: textAlign,
                  baseline: 'middle'
                },
                styles: {
                  ...mergedTextStyles,
                  backgroundColor: figureStyles.color
                }
              })?.draw(ctx)
            }
          })
        }
      }

      // Custom price label for indicators that store _pocPrice on extendData
      // Runs independently of lastValueMarkStyles.show
      if (indicator.visible) {
        const extData = indicator.extendData as Record<string, unknown> | undefined
        const pocPrice = extData?._pocPrice
        if (isNumber(pocPrice)) {
          const pocColor = (extData!.pocColor as string | undefined) ?? '#FF0000'
          const y = yAxis.convertToNicePixel(pocPrice)
          let text = yAxis.displayValueToText(
            yAxis.realValueToDisplayValue(
              yAxis.valueToRealValue(pocPrice, { range: yAxisRange }),
              { range: yAxisRange }
            ),
            indicator.precision
          )
          text = decimalFold.format(thousandsSeparator.format(text))
          let x = 0
          let textAlign: CanvasTextAlign = 'left'
          if (yAxis.isFromZero()) {
            x = 0
            textAlign = 'left'
          } else {
            x = bounding.width
            textAlign = 'right'
          }
          this.createFigure({
            name: 'text',
            attrs: { x, y, text, align: textAlign, baseline: 'middle' },
            styles: {
              ...lastValueMarkTextStyles,
              backgroundColor: pocColor,
              color: '#FFFFFF'
            }
          })?.draw(ctx)
        }

        // Sector reference VALUE label on Y-axis (just the number, like PE last value)
        const sectorPE = extData?.sectorPE
        const sectorPB = extData?.sectorPB
        const indicatorStylesObj = indicator.styles as Record<string, unknown> | undefined
        const showSectorLine = indicatorStylesObj?.showSectorLine === true
        const sectorLineColor = (indicatorStylesObj?.sectorLineColor as string | undefined) ?? '#26A69A'

        const sectorValue = indicator.name === 'PE' ? sectorPE : indicator.name === 'PB' ? sectorPB : undefined
        if (showSectorLine && isNumber(sectorValue)) {
          let sectorY = yAxis.convertToNicePixel(sectorValue)
          let sectorText = yAxis.displayValueToText(
            yAxis.realValueToDisplayValue(
              yAxis.valueToRealValue(sectorValue, { range: yAxisRange }),
              { range: yAxisRange }
            ),
            indicator.precision
          )
          sectorText = decimalFold.format(thousandsSeparator.format(sectorText))
          const sectorNameStr = (extData?.sectorName as string | undefined) ?? ''

          // Avoid overlap with last value label: find the indicator's last value Y
          const lastResult = indicator.result[dataIndex] ?? {}
          const labelFieldForCollision = indicator.name === 'PE' ? 'pe' : indicator.name === 'PB' ? 'pb' : ''

          const lastVal = (lastResult as Record<string, unknown>)[labelFieldForCollision]
          if (isNumber(lastVal)) {
            const lastValY = yAxis.convertToNicePixel(lastVal)
            const labelHeight = lastValueMarkTextStyles.paddingTop + lastValueMarkTextStyles.size + lastValueMarkTextStyles.paddingBottom
            // If labels overlap (within labelHeight distance), offset sector label
            if (Math.abs(sectorY - lastValY) < labelHeight) {
              sectorY = sectorY > lastValY ? lastValY + labelHeight : lastValY - labelHeight
            }
          }

          let sx = 0
          let sTextAlign: CanvasTextAlign = 'left'
          if (yAxis.isFromZero()) {
            sx = 0
            sTextAlign = 'left'
          } else {
            sx = bounding.width
            sTextAlign = 'right'
          }
          const sectorHandler: EventHandler = {
            mouseClickEvent: this._boundSectorLabelClickEvent(sectorNameStr),
            mouseMoveEvent: () => true
          }
          this.createFigure({
            name: 'text',
            attrs: { x: sx, y: sectorY, text: sectorText, align: sTextAlign, baseline: 'middle' },
            styles: {
              ...lastValueMarkTextStyles,
              backgroundColor: sectorLineColor,
              color: '#FFFFFF'
            }
          }, sectorHandler)?.draw(ctx)
        }

        // Dynamic label: reads indicator.result at the last visible candle index.
        // Set extendData._labelField = "pe" (or "pb") to enable.
        const labelField = extData?._labelField
        if (typeof labelField === 'string' && labelField.length > 0) {
          const visibleRange = chartStore.getVisibleRange()
          const lastVisibleIdx = Math.min(visibleRange.realTo - 1, dataList.length - 1)
          const resultData = (indicator.result[lastVisibleIdx] ?? {}) as Record<string, unknown>
          const labelValue = resultData[labelField]
          if (isNumber(labelValue)) {
            const stylesLines = (indicator.styles as Record<string, unknown>).lines as Array<{ color?: string }> | undefined
            const labelColor = (extData?.pocColor as string | undefined) ??
              stylesLines?.[0]?.color ?? '#1E88FF'
            const y = yAxis.convertToNicePixel(labelValue)
            let text = yAxis.displayValueToText(
              yAxis.realValueToDisplayValue(
                yAxis.valueToRealValue(labelValue, { range: yAxisRange }),
                { range: yAxisRange }
              ),
              indicator.precision
            )
            text = decimalFold.format(thousandsSeparator.format(text))
            let x = 0
            let textAlign: CanvasTextAlign = 'left'
            if (yAxis.isFromZero()) {
              x = 0
              textAlign = 'left'
            } else {
              x = bounding.width
              textAlign = 'right'
            }
            this.createFigure({
              name: 'text',
              attrs: { x, y, text, align: textAlign, baseline: 'middle' },
              styles: {
                ...lastValueMarkTextStyles,
                backgroundColor: labelColor,
                color: '#FFFFFF'
              }
            })?.draw(ctx)
          }
        }

        // Pre-calculated pixel-Y label (for indicators with custom coordinate systems, e.g. VOL_SIMPLE)
        // The indicator's draw function stores _lastValuePixelY and _lastValueText in extendData
        const pixelY = extData?._lastValuePixelY
        const pixelText = extData?._lastValueText
        if (isNumber(pixelY) && typeof pixelText === 'string') {
          const pixelLabelStyles = (extData?._lastValueLabelStyles ?? {}) as Record<string, unknown>
          let px = 0
          let pTextAlign: CanvasTextAlign = 'left'
          if (yAxis.isFromZero()) {
            px = 0
            pTextAlign = 'left'
          } else {
            px = bounding.width
            pTextAlign = 'right'
          }
          this.createFigure({
            name: 'text',
            attrs: { x: px, y: pixelY, text: pixelText, align: pTextAlign, baseline: 'middle' },
            styles: { ...lastValueMarkTextStyles, ...pixelLabelStyles }
          })?.draw(ctx)
        }
      }
    })
  }
}
