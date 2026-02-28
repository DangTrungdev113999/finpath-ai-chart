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

import type { KLineData } from '../../common/Data'
import type { IndicatorTemplate } from '../../component/Indicator'

interface Boll {
  up?: number
  mid?: number
  dn?: number
}

/**
 * 计算布林指标中的标准差
 * @param dataList
 * @param ma
 * @return {number}
 */
function getBollMd (dataList: KLineData[], ma: number): number {
  const dataSize = dataList.length
  let sum = 0
  dataList.forEach(data => {
    const closeMa = data.close - ma
    sum += closeMa * closeMa
  })
  sum = Math.abs(sum)
  return Math.sqrt(sum / dataSize)
}

/**
 * BOLL
 */
const bollingerBands: IndicatorTemplate<Boll, number> = {
  name: 'BOLL',
  shortName: 'BOLL',
  series: 'price',
  calcParams: [20, 2],
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'up', title: 'UP: ', type: 'line' },
    { key: 'mid', title: 'MID: ', type: 'line' },
    { key: 'dn', title: 'DN: ', type: 'line' }
  ],
  calc: (dataList, indicator) => {
    const params = indicator.calcParams
    const p = params[0] - 1
    let closeSum = 0
    return dataList.map((kLineData, i) => {
      const close = kLineData.close
      const boll: Boll = {}
      closeSum += close
      if (i >= p) {
        boll.mid = closeSum / params[0]
        const md = getBollMd(dataList.slice(i - p, i + 1), boll.mid)
        boll.up = boll.mid + params[1] * md
        boll.dn = boll.mid - params[1] * md
        closeSum -= dataList[i - p].close
      }
      return boll
    })
  },
  draw: (params) => {
    const { ctx, indicator, xAxis, yAxis, chart } = params

    // Guard: empty result
    if (indicator.result.length === 0) {
      return false
    }

    // ─── Three-step fallback chain: styles → extendData → default ─────────────
    const styles = indicator.styles as {
      fill?: { color?: string; show?: boolean }
      lines?: Array<{ show?: boolean; color?: string; size?: number; style?: string; dashedValue?: number[] }>
    } | undefined

    const extendData = indicator.extendData as {
      fillColor?: string
      fillVisible?: boolean
      upVisible?: boolean
      midVisible?: boolean
      dnVisible?: boolean
    } | undefined

    // Fill configuration
    const fillVisible = styles?.fill?.show ?? extendData?.fillVisible ?? true
    const fillColor = styles?.fill?.color ?? extendData?.fillColor ?? 'rgba(33, 150, 243, 0.1)'

    // Per-line visibility
    const upVisible = styles?.lines?.[0]?.show ?? extendData?.upVisible ?? true
    const midVisible = styles?.lines?.[1]?.show ?? extendData?.midVisible ?? true
    const dnVisible = styles?.lines?.[2]?.show ?? extendData?.dnVisible ?? true

    // ─── Visible range ────────────────────────────────────────────────────────
    const visibleRange = chart.getVisibleRange()
    const from = visibleRange.from
    const to = visibleRange.to

    if (from >= to) {
      return false
    }

    const result = indicator.result

    // ─── Fill polygon (DRAW-02: destination-over keeps fill behind candles) ───
    if (fillVisible) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = fillColor

      let segmentUpper: Array<{ x: number; y: number }> = []
      let segmentLower: Array<{ x: number; y: number }> = []

      const flushSegment = (): void => {
        if (segmentUpper.length < 2) {
          segmentUpper = []
          segmentLower = []
          return
        }
        ctx.beginPath()
        ctx.moveTo(segmentUpper[0].x, segmentUpper[0].y)
        for (let j = 1; j < segmentUpper.length; j++) {
          ctx.lineTo(segmentUpper[j].x, segmentUpper[j].y)
        }
        // Trace lower band right-to-left to close the polygon
        for (let j = segmentLower.length - 1; j >= 0; j--) {
          ctx.lineTo(segmentLower[j].x, segmentLower[j].y)
        }
        ctx.closePath()
        ctx.fill()
        segmentUpper = []
        segmentLower = []
      }

      for (let i = from; i < to && i < result.length; i++) {
        const item = result[i]
        if (item.up == null || item.dn == null) {
          // Data gap — close the current segment and start fresh
          flushSegment()
          continue
        }
        const x = xAxis.convertToPixel(i)
        segmentUpper.push({ x, y: yAxis.convertToPixel(item.up) })
        segmentLower.push({ x, y: yAxis.convertToPixel(item.dn) })
      }
      // Close the final segment
      flushSegment()

      ctx.restore()
    }

    // ─── Per-line visibility suppression (STYL-04) ────────────────────────────
    // When all lines are visible, return false and let KlineChart draw them natively.
    // When any line is hidden, take control: draw only the visible lines manually,
    // then return true so KlineChart skips the native figures[] pipeline entirely.
    const allLinesVisible = upVisible && midVisible && dnVisible

    if (!allLinesVisible) {
      const lineConfigs = [
        { key: 'up' as keyof Boll, visible: upVisible, defaultColor: '#2196F3' },
        { key: 'mid' as keyof Boll, visible: midVisible, defaultColor: '#FF6D00' },
        { key: 'dn' as keyof Boll, visible: dnVisible, defaultColor: '#00BCD4' }
      ]

      const lineStyles = styles?.lines

      ctx.save()
      for (let li = 0; li < lineConfigs.length; li++) {
        const cfg = lineConfigs[li]
        if (!cfg.visible) {
          continue
        }

        const lineStyle = lineStyles?.[li]
        ctx.strokeStyle = lineStyle?.color ?? cfg.defaultColor
        ctx.lineWidth = lineStyle?.size ?? 1
        ctx.lineJoin = 'round'

        const dashStyle = lineStyle?.style
        if (dashStyle === 'dashed') {
          ctx.setLineDash(lineStyle?.dashedValue ?? [6, 4])
        } else {
          ctx.setLineDash([])
        }

        ctx.beginPath()
        let started = false
        for (let i = from; i < to && i < result.length; i++) {
          const val = result[i][cfg.key]
          if (val == null) {
            started = false
            continue
          }
          const x = xAxis.convertToPixel(i)
          const y = yAxis.convertToPixel(val)
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    // Return true when we drew lines manually (suppresses KlineChart native pipeline).
    // Return false when all lines are visible (lets KlineChart draw them at native quality).
    return !allLinesVisible
  }
}

export default bollingerBands
