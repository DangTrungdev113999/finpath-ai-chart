/**
 * Long Position overlay — type definitions
 */

export interface LongPositionExtendData {
  // === Format (Dinh dang) ===
  lineColor: string
  lineWidth: number
  lineOpacity: number
  profitFillColor: string
  stopFillColor: string
  textFontSize: number
  textColor: string
  showPriceLabels: boolean
  compactStats: boolean
  alwaysShow: boolean

  // === Inputs (Cac dau vao) ===
  accountSize: number
  lotSize: number
  riskValue: number
  riskType: 'percent' | 'cash'
  entryPrice: number
  profitTicks: number
  profitPrice: number
  stopTicks: number
  stopPrice: number

  // === Internal ===
  pricePrecision: number
  tickSize: number
}

export interface PositionStats {
  tpPriceDiff: number
  tpPercent: number
  tpTicks: number
  slPriceDiff: number
  slPercent: number
  slTicks: number
  riskRewardRatio: number
  barCount: number
  riskAmount: number
}
