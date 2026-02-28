# Codebase Concerns

**Analysis Date:** 2026-02-28

## Tech Debt

**Boolean flag proliferation in EventHandler:**
- Issue: `EventHandlerImp` class uses 15+ boolean flags to track internal state (line 113 in `src/common/EventHandler.ts`)
- Files: `src/common/EventHandler.ts` (954 lines)
- Impact: Makes the code hard to understand and maintain; flags like `_mousePressed`, `_cancelClick`, `_cancelTap`, `_touchZoomed`, `_pinchPrevented` could be unified into state machine or enum
- Fix approach: Refactor to use a state enum (e.g., `enum EventState { IDLE, MOUSE_PRESSED, TOUCH_ACTIVE, ZOOMING }`) instead of individual boolean flags

**Memoization function commented out:**
- Issue: Memoization optimization in `src/common/utils/performance.ts` lines 26-46 is commented out
- Files: `src/common/utils/performance.ts`
- Impact: Potential performance optimization is available but disabled; unclear why
- Fix approach: Either implement memoization properly or document why it's disabled; consider if caching calculation results would improve render performance

**Unvalidated numeric edge cases:**
- Issue: Code uses `Number.MAX_SAFE_INTEGER` and `Number.MIN_SAFE_INTEGER` as sentinel values (e.g., in `src/component/YAxis.ts`, indicator calculations)
- Files: `src/component/YAxis.ts`, `src/extension/indicator/*.ts`, `src/common/utils/number.ts`
- Impact: If actual data contains values outside safe integer range, comparisons fail silently; unclear sentinel value semantics in calculations
- Fix approach: Define explicit sentinel constants and validate data against safe ranges on input; document numeric assumptions

**Large monolithic files:**
- Issue: Core files exceed 1600 lines: `Store.ts` (1634), `Chart.ts` (1191), `EventHandler.ts` (954), `Styles.ts` (805), `Event.ts` (718)
- Files: `src/Store.ts`, `src/Chart.ts`, `src/common/EventHandler.ts`, `src/common/Styles.ts`, `src/Event.ts`
- Impact: Hard to navigate, test, and modify; increased cognitive load; multiple concerns per file
- Fix approach: Break into smaller focused modules; `Store.ts` could split into Store + DataManager + FormatterManager; `EventHandler.ts` could separate touch/mouse handling

**TypeScript type assertion bypasses:**
- Issue: ESLint config disables `@typescript-eslint/no-unsafe-type-assertion` and `@typescript-eslint/no-non-null-assertion` rules
- Files: `eslint.config.js` (lines 27-28)
- Impact: Allows unsafe `as any` and `!` assertions without review; 7 instances of `any` type in performance.ts; potential runtime errors
- Fix approach: Enable strict type checks; add comments explaining specific assertion needs; progressively migrate to proper typing

**Inconsistent error handling:**
- Issue: Only 16 try-catch blocks in entire codebase; most code has no error handling
- Files: All source files
- Impact: Runtime errors silently fail or crash application; unclear recovery paths; logging only occurs in development mode
- Fix approach: Add error boundaries for critical operations (data loading, rendering); define error recovery strategy; enable logging in production for errors only

**No automated tests:**
- Issue: `/tests` directory contains only manual HTML test files, no unit/integration tests found
- Files: `tests/html/*`, `tests/js/*`, `tests/css/*`
- Impact: Regression risk on refactoring; no safety net for behavior changes; hard to validate performance improvements
- Fix approach: Add Jest/Vitest suite with test utilities; target 70%+ coverage for core modules

## Performance Bottlenecks

**Throttled mouse move handling:**
- Problem: `mouseMoveEvent` fires frequently; throttling in `src/widget/SeparatorWidget.ts` uses 20ms default delay
- Files: `src/widget/SeparatorWidget.ts`, `src/common/utils/performance.ts`
- Cause: Unthrottled events would cause excessive re-renders; throttle function defined but memoization disabled
- Improvement path: Measure frame rate impact; consider requestAnimationFrame instead of time-based throttling; enable memoization for repeated calculations

**Y-Axis width recalculation:**
- Problem: Y-axis width computed on every update even when data hasn't changed
- Files: `src/Chart.ts` (lines 654-678), `src/component/YAxis.ts`
- Cause: `cacheYAxisWidth` flag option exists but defaults to false; recalculation happens per render
- Improvement path: Enable caching by default; only recalculate on specific changes (indicators added/removed, precision changed)

**Large data list iteration:**
- Problem: `_visibleRangeDataList` operations use linear scans for common operations
- Files: `src/Store.ts` (contains `_dataList`, `_visibleRangeDataList`), `src/common/utils/number.ts`
- Cause: Binary search available (`binarySearchNearest`) but not consistently used for all lookups
- Improvement path: Profile data operations; ensure binary search used for all sorted list queries; consider segment tree for range max/min queries

**Interval-based extent text updates:**
- Problem: `clearInterval` called on array of timers stored in `_lastPriceMarkExtendTextUpdateTimers`
- Files: `src/Store.ts` (lines 1601-1606)
- Cause: Updating price mark text at fixed intervals; unclear update frequency requirement
- Improvement path: Batch updates; use RAF instead of fixed intervals; evaluate necessity of frequent updates

## Fragile Areas

**Event handler state machine:**
- Files: `src/common/EventHandler.ts` (lines 113-170), `src/Event.ts`
- Why fragile: Complex interaction between 15+ boolean flags tracking click/tap/pinch/drag state; no centralized state machine
- Safe modification: Add comprehensive comments explaining flag lifecycle; add state transition logging; write tests before refactoring
- Test coverage: No tests; high risk of regression in mouse/touch interactions

**Pane and widget rendering hierarchy:**
- Files: `src/pane/*.ts`, `src/widget/*.ts`, `src/view/*.ts`
- Why fragile: Tight coupling between Pane -> Widget -> View layers; canvas drawing order and lifecycle unclear
- Safe modification: Document render lifecycle; ensure all widgets/views are properly disposed; test on multiple browsers
- Test coverage: Gaps in rendering edge cases (empty data, extreme zoom levels, window resize)

**Data loading and visible range synchronization:**
- Files: `src/Store.ts` (visible range calculations), data loader integration
- Why fragile: Multiple interdependent state variables: `_dataList`, `_visibleRangeDataList`, `_visibleRange`, `_visibleRangeHighLowPrice`
- Safe modification: Add invariant checks at method boundaries; log state transitions; test with incomplete/out-of-order data
- Test coverage: No tests for edge cases like rapid scroll + data load conflicts

**Numeric precision and coordinate transformations:**
- Files: `src/common/utils/number.ts`, `src/component/YAxis.ts`, scale/zoom calculation throughout
- Why fragile: Floating point arithmetic used for financial data; no validation of numeric bounds; coordinate transformations involved (canvas pixel -> chart value)
- Safe modification: Add explicit precision declarations; validate inputs; document coordinate system assumptions
- Test coverage: No tests for precision loss over large number ranges or extreme zoom levels

## Scaling Limits

**Canvas rendering for large datasets:**
- Current capacity: Tested with hundreds of candles; behavior >5000 items unknown
- Limit: Canvas drawing is synchronous; rendering all visible data in one frame can block UI
- Scaling path: Implement level-of-detail rendering; pre-calculate summary bars for zoom levels; use OffscreenCanvas if available

**Indicator calculation performance:**
- Current capacity: 20+ indicators available; calculation happens synchronously during data updates
- Limit: Complex indicators (SAR, MACD) with 1000+ data points create computational bottleneck
- Scaling path: Move calculations to Web Worker; cache intermediate results; implement streaming calculation

**Event listener accumulation:**
- Current capacity: 34 addEventListener calls registered; unsubscribe pattern used but error-prone
- Limit: Long-lived charts without proper cleanup leak event listeners and memory
- Scaling path: Implement event delegation pattern; centralize listener management; add memory leak detection

**DOM element count:**
- Current capacity: Multiple canvas elements + tooltip elements; reasonable for single chart
- Limit: Multiple chart instances on page cause exponential memory growth
- Scaling path: Share canvas contexts where possible; implement pooling for tooltip elements; profile memory with DevTools

## Known Issues

**iPad with Magic Mouse touch event timestamp bug:**
- Symptoms: iPad with Magic Mouse reports `e.timestamp` as 0 always
- Files: `src/common/EventHandler.ts` (lines 939-942)
- Trigger: Use Magic Mouse on iPad; timestamp-dependent operations fail silently
- Workaround: Fallback to `performance.now()` implemented; timing may be offset from system time

**iOS mouse leave event handling:**
- Symptoms: Mouse leave events fire unexpectedly on iOS
- Files: `src/common/EventHandler.ts` (line 167, `_acceptMouseLeave = !isIOS()`)
- Trigger: Move mouse/touch off element on iOS device
- Workaround: Disabled for iOS; may suppress legitimate interactions

**Passive event listener constraints:**
- Symptoms: `touchstart` cannot call `preventDefault()` since listener is passive
- Files: `src/common/EventHandler.ts` (lines 911-914)
- Trigger: Try to prevent default scroll on touchstart
- Workaround: Check event type before calling preventDefault

## Security Considerations

**Global object access for DOM manipulation:**
- Risk: Direct access to `window`, `document`, `localStorage` without abstraction
- Files: `src/common/utils/dom.ts`, event handling throughout codebase
- Current mitigation: Browser sandbox prevents escape; usage limited to chart functionality
- Recommendations: Create abstraction layer for DOM access; validate element references before manipulation; consider iframe isolation for untrusted data sources

**Canvas context usage without validation:**
- Risk: Canvas rendering without size validation could cause memory exhaustion
- Files: `src/widget/DrawWidget.ts`, `src/common/Canvas.ts`
- Current mitigation: Canvas size bounded by container dimensions
- Recommendations: Add maximum canvas size limits; validate container dimensions on resize; monitor memory usage

**Data input validation gaps:**
- Risk: KLineData objects accepted without validation; malformed data could break calculations
- Files: `src/Store.ts` (data loading), indicator calculations
- Current mitigation: Basic type checking; calculation guards against NaN
- Recommendations: Validate all data inputs on entry; sanitize numeric ranges; add data integrity checks

**No CSP (Content Security Policy) restrictions:**
- Risk: Any compromised dependency could evaluate arbitrary code
- Files: Entire codebase uses standard JS features
- Current mitigation: No eval/Function constructor usage detected
- Recommendations: Enable strict CSP; audit dependencies for security; implement code signing for distribution

## Dependency Risks

**Beta version dependency:**
- Package: `vitepress@2.0.0-alpha.12` used for documentation
- Risk: Beta versions may have breaking changes; documentation build could fail
- Impact: Docs cannot build; version maintenance burden
- Migration plan: Lock to specific beta version; monitor alpha release channel; plan migration to stable 2.0

**Transitive dependency management:**
- Risk: 100+ transitive dependencies through build tooling (rollup, babel, etc.)
- Impact: Vulnerability surface area; supply chain risk
- Recommendations: Use `npm audit`/`pnpm audit` regularly; pin critical transitive versions; consider fewer build dependencies

## Test Coverage Gaps

**Event handling edge cases:**
- What's not tested: Touch event sequences, pinch zoom + scroll interactions, double-click/double-tap on mobile
- Files: `src/common/EventHandler.ts`, `src/Event.ts`
- Risk: Regression in interaction behavior; browser-specific quirks missed
- Priority: High

**Rendering under extreme conditions:**
- What's not tested: 10000+ data points, extreme zoom levels (1px per bar, 1000px per bar), rapid resize events, canvas context loss
- Files: `src/widget/*.ts`, `src/view/*.ts`
- Risk: Performance degradation, memory leaks, visual glitches
- Priority: High

**Indicator calculation accuracy:**
- What's not tested: Numeric precision for financial indicators (RSI, MACD, Bollinger Bands) against reference implementations
- Files: `src/extension/indicator/*.ts`
- Risk: Silent calculation errors; incorrect financial signals
- Priority: Critical

**Data loading and async operations:**
- What's not tested: Concurrent load requests, data updates during zoom/scroll, loader rejection handling
- Files: `src/Store.ts` data loading section
- Risk: Race conditions, state inconsistency
- Priority: High

**Memory leak scenarios:**
- What's not tested: Multiple chart instances, rapid create/destroy cycles, overlay/indicator lifecycle
- Files: All state management files
- Risk: Long-running applications accumulate memory
- Priority: Medium

---

*Concerns audit: 2026-02-28*
