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

import { isValid } from '../common/utils/typeChecks'
import { calcTextWidth } from '../common/utils/canvas'
import type { TextStyle } from '../common/Styles'
import type YAxis from '../component/YAxis'

import View from './View'

import type { FigureCreate } from '../component/Figure'
import type { TextAttrs } from '../extension/figure/text'

export default class CandleLastPriceView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkLineStyles = lastPriceMarkStyles.line
    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkLineStyles.show) {
      const yAxis = pane.getAxisComponent() as YAxis
      const dataList = chartStore.getDataList()
      const data = dataList[dataList.length - 1]
      if (isValid(data)) {
        const { close, open } = data
        const comparePrice = lastPriceMarkStyles.compareRule === 'current_open' ? open : (dataList[dataList.length - 2]?.close ?? close)
        const priceY = yAxis.convertToNicePixel(close)
        let color = ''
        if (close > comparePrice) {
          color = lastPriceMarkStyles.upColor
        } else if (close < comparePrice) {
          color = lastPriceMarkStyles.downColor
        } else {
          color = lastPriceMarkStyles.noChangeColor
        }
        this.createFigure({
          name: 'line',
          attrs: {
            coordinates: [
              { x: 0, y: priceY },
              { x: bounding.width, y: priceY }
            ]
          },
          styles: {
            style: lastPriceMarkLineStyles.style,
            color,
            size: lastPriceMarkLineStyles.size,
            dashedValue: lastPriceMarkLineStyles.dashedValue
          }
        })?.draw(ctx)

        // Draw left_price extend texts at right edge of candle area
        const formatExtendText = chartStore.getInnerFormatter().formatExtendText
        const leftFigures: Array<FigureCreate<TextAttrs, TextStyle>> = []
        lastPriceMarkStyles.extendTexts.forEach((item, index) => {
          if (item.position === 'left_price' && item.show) {
            const text = formatExtendText({ type: 'last_price', data, index })
            if (text.length > 0) {
              const itemWidth = item.paddingLeft + calcTextWidth(text, item.size, item.weight, item.family) + item.paddingRight
              const itemHeight = item.paddingTop + item.size + item.paddingBottom
              leftFigures.push({
                name: 'text',
                attrs: {
                  x: 0,
                  y: priceY,
                  width: itemWidth,
                  height: itemHeight,
                  text,
                  align: 'right',
                  baseline: 'middle'
                },
                styles: { ...item, backgroundColor: item.backgroundColor ?? color }
              })
            }
          }
        })
        if (leftFigures.length > 0) {
          const gap = 2
          let rightX = bounding.width
          // Draw right-to-left from the right edge
          for (let i = leftFigures.length - 1; i >= 0; i--) {
            const fig = leftFigures[i]
            rightX -= gap
            fig.attrs.x = rightX
            fig.attrs.align = 'right'
            this.createFigure(fig)?.draw(ctx)
            rightX -= (fig.attrs.width ?? 0)
          }
        }
      }
    }
  }
}
