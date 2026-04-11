/**
 * Long Position overlay constants
 * Re-exports shared CP constants from rect + LP-specific defaults
 */

// Re-export shared control point constants
export {
  CP_COLOR,
  CP_RADIUS, CP_CIRCLE_BORDER,
  CP_MID_SIZE, CP_MID_BORDER, CP_MID_BORDER_RADIUS
} from '../rect/constants'

// ═══════════════════════════════════════
// LP-specific defaults
// ═══════════════════════════════════════

export interface LongPositionExtendData {
  // Inputs
  accountSize: number
  lotSize: number
  risk: number
  riskDisplayMode: 'percents' | 'money'
  tickMultiplier: number

  // Style
  lineColor: string
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  stopBackground: string
  profitBackground: string
  textColor: string
  fontSize: number
  showPriceLabels: boolean
  compact: boolean
  alwaysShowStats: boolean

  // Hidden
  drawBorder: boolean
  borderColor: string
  fillLabelBackground: boolean
  labelBackgroundColor: string
  fillBackground: boolean
  stopBackgroundTransparency: number
  profitBackgroundTransparency: number

  // Internal
  pricePrecision: number
}

export const LONG_POSITION_DEFAULTS: LongPositionExtendData = {
  accountSize: 1000,
  lotSize: 1,
  risk: 25,
  riskDisplayMode: 'percents',
  tickMultiplier: 100,
  lineColor: '#787B86',
  lineWidth: 4,
  lineStyle: 'solid',
  stopBackground: 'rgba(242, 54, 69, 0.2)',
  profitBackground: 'rgba(8, 153, 129, 0.2)',
  textColor: '#ffffff',
  fontSize: 12,
  showPriceLabels: true,
  compact: false,
  alwaysShowStats: false,
  drawBorder: false,
  borderColor: '#667b8b',
  fillLabelBackground: true,
  labelBackgroundColor: '#585858',
  fillBackground: true,
  stopBackgroundTransparency: 80,
  profitBackgroundTransparency: 80,
  pricePrecision: 2
}

// Label layout
export const LABEL_PADDING_H = 10
export const LABEL_PADDING_V = 5
export const LABEL_BORDER_RADIUS = 6
export const LABEL_BORDER_SIZE = 1.5
export const LABEL_GAP = 10 // gap between label and zone edge
export const ENTRY_LABEL_LINE_GAP = 2 // gap between 2 lines of entry label
