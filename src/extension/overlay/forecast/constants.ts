/**
 * Forecast overlay constants — TradingView-style prediction tool
 * 13 color fields + transparency + linewidth + pricePrecision + fontSize
 */

// ═══════════════════════════════════════
// ExtendData — single source of truth
// ═══════════════════════════════════════

export interface ForecastExtendData {
  // Line
  linecolor: string
  linewidth: 1 | 2 | 3 | 4

  // Source anchor pill (entry)
  sourceBackColor: string
  sourceTextColor: string
  sourceStrokeColor: string

  // Target zone + delta label
  targetBackColor: string
  targetTextColor: string
  targetStrokeColor: string

  // Outcome badges
  successBackground: string
  successTextColor: string
  failureBackground: string
  failureTextColor: string
  intermediateBackColor: string
  intermediateTextColor: string

  // Internal
  centersColor: string
  transparency: number
  pricePrecision: number
  fontSize: number
}

export const FORECAST_DEFAULTS: ForecastExtendData = {
  linecolor: '#2962FF',
  linewidth: 1,
  sourceBackColor: '#2962FF',
  sourceTextColor: '#FFFFFF',
  sourceStrokeColor: '#2962FF',
  targetBackColor: '#2962FF',
  targetTextColor: '#FFFFFF',
  targetStrokeColor: '#2962FF',
  successBackground: '#4CAF50',
  successTextColor: '#FFFFFF',
  failureBackground: '#F23645',
  failureTextColor: '#FFFFFF',
  intermediateBackColor: '#EAD289',
  intermediateTextColor: '#6D4D22',
  centersColor: '#202020',
  transparency: 10,
  pricePrecision: 2,
  fontSize: 11
}

// ═══════════════════════════════════════
// Label layout
// ═══════════════════════════════════════

export const LABEL_PADDING_H = 8
export const LABEL_PADDING_V = 4
export const LABEL_BORDER_RADIUS = 3
// Gap between outcome and delta pill
export const LABEL_STACK_GAP = 4
// Gap between stacked pills and zone top
export const LABEL_TO_ZONE_GAP = 6
// Gap below entry bar
export const ENTRY_PILL_OFFSET_Y = 8
// Gap between price + date lines inside entry pill
export const ENTRY_LABEL_LINE_GAP = 2
export const EXTENSION_RIGHT_MARGIN = 10

// ═══════════════════════════════════════
// Control points
// ═══════════════════════════════════════

export const CP_COLOR = '#2962FF'
export const CP_RADIUS = 5
export const CP_BORDER = 2
export const CP_BORDER_COLOR = '#FFFFFF'

// ═══════════════════════════════════════
// Point 2 marker
// ═══════════════════════════════════════

export const P2_MARKER_RADIUS = 2

// ═══════════════════════════════════════
// Outcome labels
// ═══════════════════════════════════════

export type ForecastOutcome = 'success' | 'failure' | 'intermediate'

export const OUTCOME_LABELS: Record<ForecastOutcome, string> = {
  success: 'TH\u00C0NH C\u00D4NG',
  failure: 'TH\u1EA4T B\u1EA0I',
  intermediate: '\u0110ANG CH\u1EDC'
}
