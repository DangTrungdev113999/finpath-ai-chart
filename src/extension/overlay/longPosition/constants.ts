/**
 * Long Position overlay — constants
 */

import type { LongPositionExtendData } from './types'

// ═══════════════════════════════════════
// Control Point styling
// ═══════════════════════════════════════
export const CP_COLOR = '#1592E6'
export const CP_RADIUS = 5
export const CP_BORDER = 1.5

// ═══════════════════════════════════════
// Default colors
// ═══════════════════════════════════════
export const DEFAULT_LINE_COLOR = '#787B86'
export const DEFAULT_PROFIT_FILL = 'rgba(8, 153, 129, 0.2)'
export const DEFAULT_STOP_FILL = 'rgba(242, 54, 69, 0.2)'
export const DEFAULT_TEXT_COLOR = '#FFFFFF'

// ═══════════════════════════════════════
// Label pill styling
// ═══════════════════════════════════════
export const LABEL_BG_COLOR = '#585858'
export const LABEL_BORDER_COLOR = '#667B8B'
export const LABEL_BORDER_WIDTH = 1
export const LABEL_BORDER_RADIUS = 3
export const LABEL_PADDING_H = 6
export const LABEL_PADDING_V = 3
export const LABEL_FONT_FAMILY = 'Helvetica Neue'

// ═══════════════════════════════════════
// Y-axis label styling
// ═══════════════════════════════════════
export const YAXIS_LABEL_BG = '#585858'
export const YAXIS_LABEL_TEXT_COLOR = '#FFFFFF'

// ═══════════════════════════════════════
// Defaults
// ═══════════════════════════════════════
export const LONG_POSITION_DEFAULTS: LongPositionExtendData = {
  lineColor: DEFAULT_LINE_COLOR,
  lineWidth: 1,
  lineOpacity: 100,
  profitFillColor: DEFAULT_PROFIT_FILL,
  stopFillColor: DEFAULT_STOP_FILL,
  textFontSize: 12,
  textColor: DEFAULT_TEXT_COLOR,
  showPriceLabels: true,
  compactStats: false,
  alwaysShow: false,
  accountSize: 1000,
  lotSize: 1,
  riskValue: 25.00,
  riskType: 'percent',
  entryPrice: 0,
  profitTicks: 0,
  profitPrice: 0,
  stopTicks: 0,
  stopPrice: 0,
  pricePrecision: 2,
  tickSize: 0.01
}
