/**
 * Ellipse (Hình elip) — constants
 *
 * Defaults, figure keys, dash map, body-drag key set, and narrow
 * chart-store accessor interface. Mirrors `regressionTrend` / `rect` pattern.
 */

import type { EventOverlayInfo } from '../../../Store'
import type { PeriodType } from '../../../common/Period'
import type { EllipseExtendData, EllipseLineStyle } from './types'

// Re-use CP sizing constants from rect (proven values).
export { CP_COLOR, CP_RADIUS, CP_CIRCLE_BORDER } from '../rect/constants'

// ═══════════════════════════════════════
// Defaults (BRD §4)
// ═══════════════════════════════════════

export const FILL_OPACITY = 0.2

export const ELLIPSE_DEFAULTS: Required<EllipseExtendData> = {
  // Tab 1 — Định dạng (Style)
  borderColor: '#F44336',
  borderStyle: 'solid',
  borderWidth: 1,
  fillEnabled: true,
  fillColor: '#F44336',
  fillOpacity: FILL_OPACITY,

  // Tab 2 — Văn bản (Text)
  textEnabled: false,
  text: '',
  textColor: '#F44336',
  textSize: 14,
  isBold: false,
  isItalic: false,
  isEditing: false,

  // Tab 3 — Hiển thị (Visibility)
  vis_ticks: { enabled: true, min: 1, max: 59 },
  vis_hours: { enabled: true, min: 1, max: 24 },
  vis_days: { enabled: true, min: 1, max: 366 },
  vis_weeks: { enabled: true, min: 1, max: 52 },
  vis_months: { enabled: true, min: 1, max: 12 }
}

// ═══════════════════════════════════════
// Figure keys (stable identifiers for hit-testing + drag routing)
// ═══════════════════════════════════════

export const E_BODY = 'ellipse_body'
export const E_TEXT = 'ellipse_text'
export const E_TEXT_PH = 'ellipse_text_placeholder'
export const E_CP_TOP = 'ellipse_cp_top'
export const E_CP_BOT = 'ellipse_cp_bottom'
export const E_CP_LEFT = 'ellipse_cp_left'
export const E_CP_RIGHT = 'ellipse_cp_right'

/**
 * Figure keys that translate the whole body.
 *
 * NOTE: these figures have no `pointIndex`, so the library routes their
 * drag through `eventPressedOtherMove` (uniform delta-translation over all
 * points) — not through `performEventPressedMove`. This set is exported
 * for documentation / parity with regressionTrend; `performEventPressedMove`
 * will never receive these keys in practice.
 */
export const BODY_DRAG_KEYS = new Set<string>([
  E_BODY,
  E_TEXT,
  E_TEXT_PH
])

// ═══════════════════════════════════════
// Dash map (pixel pattern per EllipseLineStyle)
// ═══════════════════════════════════════

export const DASH: Record<EllipseLineStyle, number[]> = {
  solid: [],
  dashed: [6, 4],
  dotted: [2, 2]
}

// ═══════════════════════════════════════
// Period type → visibility band mapping
//
// BRD §4.3 exposes 5 bands (ticks/hours/days/weeks/months). We treat
// minute/second candles as "ticks" (sub-hour band).
// ═══════════════════════════════════════

export const PERIOD_VIS_KEY: Record<PeriodType, keyof Pick<
Required<EllipseExtendData>,
'vis_ticks' | 'vis_hours' | 'vis_days' | 'vis_weeks' | 'vis_months'
>> = {
  second: 'vis_ticks',
  minute: 'vis_ticks',
  hour: 'vis_hours',
  day: 'vis_days',
  week: 'vis_weeks',
  month: 'vis_months',
  year: 'vis_months'
}

// ═══════════════════════════════════════
// Narrow chart-store accessor (pattern from rect / regressionTrend)
// ═══════════════════════════════════════

export interface ChartInternal {
  getChartStore: () => {
    getClickOverlayInfo: () => EventOverlayInfo
    getHoverOverlayInfo: () => EventOverlayInfo
    getPressedOverlayInfo: () => EventOverlayInfo
  }
}
