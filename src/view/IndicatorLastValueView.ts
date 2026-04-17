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
import { createDom } from '../common/utils/dom'

import { eachFigures, type IndicatorFigure, type IndicatorFigureStyle } from '../component/Indicator'

import View from './View'

import type { YAxis } from '../component/YAxis'

export default class IndicatorLastValueView extends View<YAxis> {
  // HTML overlay for labels that need to overflow Y-axis canvas bounds (e.g. VOL_SIMPLE)
  private _htmlLabelEl: HTMLElement | null = null
  private _htmlLabelSpan: HTMLElement | null = null

  private _getOrCreateHtmlLabel (): { container: HTMLElement, span: HTMLElement } {
    if (this._htmlLabelEl === null) {
      const paneContainer = this.getWidget().getPane().getContainer()
      this._htmlLabelEl = createDom('div', {
        position: 'absolute',
        right: '5px',
        pointerEvents: 'none',
        zIndex: '3',
        display: 'none',
        whiteSpace: 'nowrap'
      })
      this._htmlLabelSpan = createDom('span', {
        display: 'inline-block',
        fontSize: '11px',
        fontFamily: 'Helvetica Neue, sans-serif',
        fontWeight: 'normal',
        padding: '2px 4px',
        borderRadius: '2px'
      })
      this._htmlLabelEl.appendChild(this._htmlLabelSpan)
      paneContainer.appendChild(this._htmlLabelEl)
    }
    return { container: this._htmlLabelEl, span: this._htmlLabelSpan! }
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
    let hasHtmlLabel = false

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

        // Generic reference labels (avg5y, avg10y, compare stocks, etc.)
        // Populated by the indicator's calc function via extendData._referenceLabels.
        interface RefLabel {
          id?: string
          value?: unknown
          color?: string
          text?: string
          mode?: 'fill' | 'stroke_fill'
        }
        const referenceLabels = extData?._referenceLabels as RefLabel[] | undefined
        if (Array.isArray(referenceLabels) && referenceLabels.length > 0) {
          // Track occupied Y regions for collision avoidance
          const occupied: Array<{ yMin: number, yMax: number }> = []
          // Seed with main indicator last value(s) so reference labels avoid overlapping
          for (const figure of indicator.figures) {
            const mv = (indicator.result[dataIndex] as Record<string, unknown> | undefined)?.[figure.key]
            if (isNumber(mv)) {
              const my = yAxis.convertToNicePixel(mv)
              const h = lastValueMarkTextStyles.paddingTop + lastValueMarkTextStyles.size + lastValueMarkTextStyles.paddingBottom
              occupied.push({ yMin: my - h / 2, yMax: my + h / 2 })
            }
          }

          for (const lbl of referenceLabels) {
            if (!isNumber(lbl.value)) continue
            const rawY = yAxis.convertToNicePixel(lbl.value)
            const h = lastValueMarkTextStyles.paddingTop + lastValueMarkTextStyles.size + lastValueMarkTextStyles.paddingBottom
            let labelY = rawY
            // Push down if colliding with an occupied region (plain loops — no closures)
            for (let iter = 0; iter < 8; iter++) {
              let hit = false
              for (const r of occupied) {
                const rMid = (r.yMin + r.yMax) / 2
                if (Math.abs(labelY - rMid) < h) { hit = true; break }
              }
              if (!hit) break
              labelY = labelY + h
            }
            occupied.push({ yMin: labelY - h / 2, yMax: labelY + h / 2 })

            const rawText = lbl.text ?? yAxis.displayValueToText(
              yAxis.realValueToDisplayValue(
                yAxis.valueToRealValue(lbl.value, { range: yAxisRange }),
                { range: yAxisRange }
              ),
              indicator.precision
            )
            const text = decimalFold.format(thousandsSeparator.format(rawText))

            let lx = 0
            let lAlign: CanvasTextAlign = 'left'
            if (yAxis.isFromZero()) {
              lx = 0
              lAlign = 'left'
            } else {
              lx = bounding.width
              lAlign = 'right'
            }

            const labelColor = lbl.color ?? '#26A69A'
            const isStroke = lbl.mode === 'stroke_fill'
            this.createFigure({
              name: 'text',
              attrs: { x: lx, y: labelY, text, align: lAlign, baseline: 'middle' },
              styles: isStroke
                ? {
                    ...lastValueMarkTextStyles,
                    backgroundColor: '#17171A',
                    color: labelColor,
                    borderColor: labelColor,
                    borderSize: 1
                  }
                : {
                    ...lastValueMarkTextStyles,
                    backgroundColor: labelColor,
                    color: '#FFFFFF'
                  }
            })?.draw(ctx)
          }
        }

        // Dynamic label (PE/PB via _labelField) + pixel-Y label (VOL_SIMPLE via _lastValuePixelY)
        // Both rendered as HTML overlay at pane level to avoid Y-axis canvas clipping.
        const labelField = extData?._labelField
        const pixelY = extData?._lastValuePixelY
        const pixelText = extData?._lastValueText

        // Determine label data: _labelField (PE/PB) or _lastValuePixelY (VOL_SIMPLE)
        // eslint-disable-next-line @typescript-eslint/init-declarations -- set conditionally below
        let htmlLabelY: number | undefined
        // eslint-disable-next-line @typescript-eslint/init-declarations -- set conditionally below
        let htmlLabelText: string | undefined
        // eslint-disable-next-line @typescript-eslint/init-declarations -- set conditionally below
        let htmlLabelStyles: Record<string, string | number | undefined> | undefined

        if (typeof labelField === 'string' && labelField.length > 0) {
          // PE/PB dynamic label: fill (real-time) or stroke_fill (scrolled)
          const visibleRange = chartStore.getVisibleRange()
          const isLastBarVisible = dataIndex >= visibleRange.from && dataIndex < visibleRange.realTo
          const displayIdx = isLastBarVisible ? dataIndex : Math.min(visibleRange.realTo - 1, dataList.length - 1)
          const resultData = (indicator.result[displayIdx] ?? {}) as Record<string, unknown>
          const labelValue = resultData[labelField]
          if (isNumber(labelValue)) {
            htmlLabelY = yAxis.convertToNicePixel(labelValue)
            const labelText = yAxis.displayValueToText(
              yAxis.realValueToDisplayValue(
                yAxis.valueToRealValue(labelValue, { range: yAxisRange }),
                { range: yAxisRange }
              ),
              indicator.precision
            )
            htmlLabelText = decimalFold.format(thousandsSeparator.format(labelText))

            const stylesLines = (indicator.styles as Record<string, unknown>).lines as Array<{ color?: string }> | undefined
            const labelColor = stylesLines?.[0]?.color ?? '#1E88FF'
            const scrolledBg = ((indicator.styles as Record<string, unknown>)._scrolledLabelBgColor as string | undefined) ?? '#17171A'

            if (isLastBarVisible) {
              // REAL-TIME: fill + indicator color bg + white text
              htmlLabelStyles = { backgroundColor: labelColor, color: '#FFFFFF', borderSize: 0 }
            } else {
              // SCROLLED: stroke_fill + theme bg + indicator color border/text
              htmlLabelStyles = { backgroundColor: scrolledBg, color: labelColor, borderColor: labelColor, borderSize: 1 }
            }
          }
        } else if (isNumber(pixelY) && typeof pixelText === 'string') {
          // VOL_SIMPLE pixel-Y label
          htmlLabelY = pixelY
          htmlLabelText = pixelText
          htmlLabelStyles = (extData?._lastValueLabelStyles ?? {}) as Record<string, string | number | undefined>
        }

        // Render HTML overlay if data available
        if (htmlLabelY != null && htmlLabelText != null && htmlLabelStyles != null) {
          hasHtmlLabel = true
          const { container, span } = this._getOrCreateHtmlLabel()
          container.style.display = 'block'
          container.style.top = `${htmlLabelY}px`
          container.style.transform = 'translateY(-50%)'
          span.textContent = htmlLabelText
          span.style.background = String(htmlLabelStyles.backgroundColor ?? 'transparent')
          span.style.color = String(htmlLabelStyles.color ?? '#FFFFFF')
          span.style.border = `${String(htmlLabelStyles.borderSize ?? 0)}px solid ${String(htmlLabelStyles.borderColor ?? 'transparent')}`
          span.style.borderRadius = `${String(htmlLabelStyles.borderRadius ?? 2)}px`
        }
      }
    })

    // Hide HTML label only if NO indicator provided pixel-Y data
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- _htmlLabelEl is lazily created, can be null
    if (!hasHtmlLabel && this._htmlLabelEl !== null) {
      this._htmlLabelEl.style.display = 'none'
    }
  }
}
