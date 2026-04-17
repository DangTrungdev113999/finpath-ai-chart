/**
 * Forecast (Dự đoán) overlay — TradingView-style LineToolPrediction
 *
 * Data points: 2 (P1 source anchor, P2 target anchor)
 * Features:
 *  - Quadratic Bézier curve P1 → P2 (arcs perpendicular to the chord)
 *  - Two pills (P1 source, P2 info with delta/pct/bars)
 *  - Status badge above/below P2 pill (success / failure)
 *  - Footer F / F* markers on the X-axis pane (ALWAYS visible)
 *  - Selection-only X-axis date pills + Y-axis price pills
 *  - Custom control points (small filled dots unselected, hollow ○ active)
 */

import type { EventOverlayInfo } from '../../../Store'

// ═══════════════════════════════════════
// ExtendData
// ═══════════════════════════════════════

export interface ForecastExtendData {
  // Line (curve)
  lineColor: string
  lineOpacity: number // 0–1
  lineWidth: 1 | 2 | 3 | 4

  // P1 source pill
  sourceTextColor: string
  sourceTextOpacity: number
  sourceBgColor: string
  sourceBgOpacity: number
  sourceBorderColor: string
  sourceBorderOpacity: number

  // P2 info pill
  targetTextColor: string
  targetTextOpacity: number
  targetBgColor: string
  targetBgOpacity: number
  targetBorderColor: string
  targetBorderOpacity: number

  // Success badge
  successTextColor: string
  successTextOpacity: number
  successBgColor: string
  successBgOpacity: number

  // Failure badge
  failureTextColor: string
  failureTextOpacity: number
  failureBgColor: string
  failureBgOpacity: number

  // Meta
  pricePrecision?: number
}

export const FORECAST_DEFAULTS: ForecastExtendData = {
  lineColor: '#2962ff',
  lineOpacity: 1,
  lineWidth: 1,

  sourceTextColor: '#ffffff',
  sourceTextOpacity: 1,
  sourceBgColor: '#2962ff',
  sourceBgOpacity: 1,
  sourceBorderColor: '#2962ff',
  sourceBorderOpacity: 1,

  targetTextColor: '#ffffff',
  targetTextOpacity: 1,
  targetBgColor: '#2962ff',
  targetBgOpacity: 1,
  targetBorderColor: '#2962ff',
  targetBorderOpacity: 1,

  successTextColor: '#ffffff',
  successTextOpacity: 1,
  successBgColor: '#4caf50',
  successBgOpacity: 1,

  failureTextColor: '#ffffff',
  failureTextOpacity: 1,
  failureBgColor: '#ef5350',
  failureBgOpacity: 1
}

// ═══════════════════════════════════════
// Computed state (not persisted)
// ═══════════════════════════════════════

export interface ForecastComputedState {
  status: 'success' | 'failure'
  delta: number
  deltaPct: number
  barCount: number
  bullish: boolean
}

// ═══════════════════════════════════════
// Sizing / layout constants
// ═══════════════════════════════════════

// Pill
export const PILL_PADDING_H = 6
export const PILL_PADDING_V = 4
export const PILL_LINE_GAP = 2
export const PILL_BORDER_RADIUS = 3
export const PILL_FONT_SIZE = 11

// Pill anchor gap (curve endpoint sits this many pixels away from pill edge)
export const PILL_ANCHOR_GAP = 4

// Badge
export const BADGE_GAP = 3
export const BADGE_PADDING_H = 6
export const BADGE_PADDING_V = 3
export const BADGE_FONT_SIZE = 11

// Control points
export const CP_COLOR = '#2962ff'
export const CP_INACTIVE_RADIUS = 2.5
export const CP_ACTIVE_RADIUS = 5.5
export const CP_ACTIVE_BORDER = 1.5

// Footer F / F* markers — rendered in MAIN pane, near bottom edge
// (TradingView pattern: markers sit above the X-axis, inside chart pane)
export const FOOTER_COLOR = '#4caf50'
export const FOOTER_MARGIN_BOTTOM = 14 // px from chart pane bottom to marker center
export const FOOTER_RADIUS = 6
export const FOOTER_BORDER_SIZE = 1.2
export const FOOTER_FONT_SIZE = 9

// X-axis date pills (selection-only) — rendered in X-AXIS pane, top-aligned
export const XAXIS_PILL_Y = 0
export const XAXIS_PILL_PADDING_H = 6
export const XAXIS_PILL_PADDING_V = 3

// Translucent strip between P1 and P2 on X and Y axis panes (selection-only).
// Fixed default blue — NOT tied to user's lineColor setting.
export const AXIS_STRIP_COLOR = '#2962ff'
export const AXIS_STRIP_OPACITY = 0.15

// Curve hitbox
export const CURVE_HITBOX_HALF_WIDTH = 6
export const CURVE_SAMPLES = 30

// Bézier curvature
export const BEZIER_ARC_FACTOR = 0.45
export const BEZIER_ARC_CAP = 140

// P2 arrow tip (small filled triangle at curve endpoint, matches TV)
export const ARROW_LENGTH = 8
export const ARROW_HALF_WIDTH = 5

// ═══════════════════════════════════════
// Narrow chart-store accessor (pattern from longPosition / segment)
// ═══════════════════════════════════════

export interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
  }
}
