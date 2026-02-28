# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** Layered Canvas-Based Charting Library with Plugin Extension System

**Key Characteristics:**
- **Canvas-driven rendering**: HTML5 canvas for performance-critical drawing operations
- **Multi-pane layout**: Support for vertical panes (candlestick, indicators, x-axis)
- **Reactive state management**: Centralized Store with UpdateLevel-based change propagation
- **Plugin architecture**: Extensible indicators, overlays, figures, styles, and axes
- **Event-driven interaction**: Unified event system handling mouse, touch, keyboard inputs
- **Immutable data flow**: K-line data drives all rendering updates through store updates

## Layers

**Presentation Layer (View Rendering):**
- Purpose: Render visual content to canvas
- Location: `src/view/`
- Contains: View classes that draw specific chart elements (candlesticks, indicators, overlays, axes, tooltips, grids, crosshairs)
- Depends on: Pane, Widget, Store for data and rendering context
- Used by: Widgets to update visuals based on state changes
- Key files: `View.ts` (base class), `CandleBarView.ts`, `IndicatorView.ts`, `OverlayView.ts`, `CandleTooltipView.ts`

**Widget Layer (Canvas Management & Composition):**
- Purpose: Manages canvas elements and coordinates views within pane sections
- Location: `src/widget/`
- Contains: Widget classes for main content area, y-axis, separators, and draw-enabled areas
- Depends on: Pane, View, Store for geometry and update signals
- Used by: Panes to host renderable content
- Key files: `Widget.ts` (base class), `CandleWidget.ts`, `IndicatorWidget.ts`, `XAxisWidget.ts`, `YAxisWidget.ts`

**Pane Layer (Layout & Organization):**
- Purpose: Organize chart content into resizable, draggable sections
- Location: `src/pane/`
- Contains: Pane classes representing vertical chart sections with configuration
- Depends on: Widget, Chart for geometry and configuration
- Used by: Chart to manage multi-pane layout
- Key files: `Pane.ts` (base class), `CandlePane.ts`, `IndicatorPane.ts`, `XAxisPane.ts`, `DrawPane.ts`

**Component Layer (Data Models & Business Logic):**
- Purpose: Represent and manage chart components (indicators, overlays, axes)
- Location: `src/component/`
- Contains: Indicator, Overlay, Axis implementations with style and calculation logic
- Depends on: Store for shared state, Extension system for implementations
- Used by: Store, Views, Widgets
- Key files: `Indicator.ts`, `Overlay.ts`, `Axis.ts`, `XAxis.ts`, `YAxis.ts`, `Figure.ts`

**State Management Layer (Store):**
- Purpose: Centralized state for chart data, configuration, and cached calculations
- Location: `src/Store.ts`
- Contains: ChartStore class managing K-line data, visible range, zoom, scroll, styles, indicators
- Depends on: Component layer for indicator/overlay data structures
- Used by: Chart API, Event handler, Views for data retrieval
- Key files: `Store.ts` (1634 lines - largest file), `Chart.ts` (1191 lines)

**API & Lifecycle Layer (Chart):**
- Purpose: Public chart interface and lifecycle management
- Location: `src/Chart.ts`, `src/index.ts`
- Contains: ChartImp class implementing Chart interface, public API functions (init, dispose, registerIndicator, etc.)
- Depends on: Store, Event, Pane for internal coordination
- Used by: Library consumers via index.ts exports
- Key files: `Chart.ts`, `index.ts`

**Event Handling Layer:**
- Purpose: Process user interactions and coordinate state updates
- Location: `src/Event.ts`, `src/common/EventHandler.ts`
- Contains: Event class translating mouse/touch/keyboard to chart actions; EventHandlerImp for low-level event binding
- Depends on: Store, Chart, Widget for action execution
- Used by: Chart for attaching to DOM
- Key files: `Event.ts` (718 lines), `EventHandler.ts` (954 lines)

**Extension Layer (Plugins):**
- Purpose: Provide pluggable implementations of indicators, overlays, figures, styles
- Location: `src/extension/`
- Contains: Pre-built implementations and registration system
- Depends on: Component layer interfaces
- Used by: Store to instantiate user-created indicators/overlays
- Subdirectories: `indicator/` (40+ indicators), `overlay/`, `figure/` (arc, circle, line, polygon, rect, text), `x-axis/`, `y-axis/`, `styles/`, `i18n/`

**Utilities Layer:**
- Purpose: Cross-cutting concerns and helper functions
- Location: `src/common/`, `src/common/utils/`
- Contains: Type definitions, canvas operations, formatting, number utilities, DOM helpers, platform compatibility
- Depends on: Nothing - used by all layers
- Key files: `Styles.ts` (805 lines), `EventHandler.ts` (954 lines), `Canvas.ts`, `format.ts`, `typeChecks.ts`

## Data Flow

**Initialization Flow:**

1. Library consumer calls `init(domElement, options)` from `src/index.ts`
2. Creates ChartImp instance → initializes Store, creates default Panes, binds Event handlers
3. Store creates CandlePane (candlestick), IndicatorPane (default), XAxisPane sections
4. Each Pane creates Widget(s) for rendering and YAxisWidget for y-axis
5. Widgets create View instances for each renderable element

**Data Update Flow (K-Line Data):**

1. Consumer calls `chart.applyData(klineDataArray)` or `chart.setData(klineDataArray)`
2. Store receives data → validates → updates internal `_dataList`
3. Store calculates visible range based on viewport width and bar spacing
4. Store triggers UpdateLevel.Main change notification
5. Chart propagates update to all Panes → Panes to all Widgets → Widgets to all Views
6. Each View reads updated data/coordinates from Store and renders to its canvas

**Interaction Flow (User Input):**

1. Event class receives mouse/touch/keyboard event from DOM
2. Event determines which Widget/Pane is targeted
3. Event triggers action (zoom, scroll, overlay creation, etc.) via Store methods
4. Store state changes → broadcasts UpdateLevel notification
5. Affected Views re-render based on new state

**Rendering Pipeline:**

1. Widget maintains Canvas element for its section
2. Widget calls update(updateLevel) when Store broadcasts changes
3. Widget iterates through child Views in priority order
4. Each View:
   - Reads current Store state (visible range, bar space, styles, symbol info)
   - Calculates coordinates and dimensions
   - Calls Canvas API to draw (line, rect, text, image operations)
5. Browser composites all widget canvases into final chart image

**State Management:**

- **UpdateLevel enum** (`src/common/Updater.ts`):
  - `Main`: K-line data or core layout changed
  - `Overlay`: Overlay/drawing elements changed
  - `Separator`: Pane divider position changed
  - `Drawer`: Overlay in progress (not yet final)
  - `All`: Full redraw needed
- **Store broadcasts changes** → Panes → Widgets → Views consume appropriate update level

## Key Abstractions

**Indicator:**
- Purpose: Technical analysis calculation and visualization
- Examples: `src/extension/indicator/movingAverage.ts`, `bollingerBands.ts`, `movingAverageConvergenceDivergence.ts` (40+ indicators)
- Pattern: Generic interface with `<D>` for calculated data type, figure definitions for rendering, value and style callbacks

**Overlay:**
- Purpose: User-drawn annotations and trading overlays
- Examples: `src/extension/overlay/` contains line, arc, rect, triangle, flag overlays
- Pattern: Generic overlay class with figure array, coordinate transformation, event handling for creation/modification

**Figure:**
- Purpose: Primitive drawing shape with hit detection
- Examples: `src/extension/figure/line.ts`, `arc.ts`, `circle.ts`, `polygon.ts`, `rect.ts`, `text.ts`
- Pattern: Base Figure class with name, coordinates, styles, draw method, checkCoordinate for hit detection

**Axis:**
- Purpose: Coordinate transformation and tick generation
- Examples: `src/component/XAxis.ts` (time axis), `src/component/YAxis.ts` (price axis), extensions for logarithmic, percentage
- Pattern: Base Axis with abstract coordinate conversion, label formatting, range calculation

**View:**
- Purpose: Render specific chart element to canvas
- Examples: `CandleBarView`, `IndicatorView`, `OverlayView`, `GridView`, `CrosshairLineView`
- Pattern: Abstract View class extending Eventful, creates/updates Figures, renders via canvas context, handles event delegation

**Widget:**
- Purpose: Canvas container and view coordinator for pane section
- Examples: `CandleWidget`, `IndicatorWidget`, `XAxisWidget`, `DrawWidget` (base for overlay-supporting widgets)
- Pattern: Abstract Widget managing single HTMLCanvasElement, holds Views, updates based on UpdateLevel signals

**Pane:**
- Purpose: Chart layout unit (vertical section with header/content/separator)
- Examples: `CandlePane`, `IndicatorPane`, `XAxisPane`, `SeparatorPane`
- Pattern: Abstract Pane with container div, owns Widgets and YAxisWidget, stores PaneOptions (height, visibility, axis type)

## Entry Points

**Public API Entry Point:**
- Location: `src/index.ts`
- Triggers: Called by library consumers with `import { init, dispose, registerIndicator } from 'klinecharts'`
- Responsibilities:
  - Initialize chart with `init(container, options)`
  - Register extensions with `registerIndicator`, `registerOverlay`, `registerFigure`, `registerLocale`, `registerStyles`
  - Export utility functions and type definitions
  - Maintain global chart instance registry

**Chart Constructor Entry Point:**
- Location: `src/Chart.ts` class ChartImp
- Triggers: Called by `init()` function
- Responsibilities:
  - Create Store instance
  - Create default Panes (Candle, Indicator, XAxis)
  - Create Event handler and attach to DOM
  - Initialize resize observer
  - Provide Chart public API (setData, createIndicator, createOverlay, scroll, zoom, etc.)

**Store Entry Point:**
- Location: `src/Store.ts` class ChartStore
- Triggers: Created by Chart constructor
- Responsibilities:
  - Receive and validate K-line data
  - Manage visible range and zoom state
  - Coordinate indicator calculations
  - Track overlay instances
  - Calculate bar spacing and coordinate conversions
  - Broadcast UpdateLevel changes to listeners

## Error Handling

**Strategy:** Silent fallback with optional logging rather than throwing exceptions

**Patterns:**
- **Null returns**: API functions like `createIndicator()`, `createOverlay()`, `getDom()` return `Nullable<T>` instead of throwing
- **Type validation**: Utility functions `isString()`, `isNumber()`, `isArray()`, `isValid()` in `src/common/utils/typeChecks.ts` guard operations
- **Logging**: `src/common/utils/logger.ts` provides `logError()`, `logWarn()`, `logTag()` for debugging without crashes
- **Duplicate initialization guard**: init() checks if chart already initialized on DOM and returns existing instance
- **DOM safety**: init() validates that DOM element exists before creating chart

## Cross-Cutting Concerns

**Logging:**
- Centralized in `src/common/utils/logger.ts`
- Functions: `logError()`, `logWarn()`, `logTag()`
- No external dependencies - uses console
- Tagged output helps identify library source vs application code

**Validation:**
- Type guards in `src/common/utils/typeChecks.ts`
- Functions: `isString()`, `isNumber()`, `isValid()`, `isObject()`, `isArray()`, `isFunction()`, `isBoolean()`
- Prevents type errors before DOM/canvas operations

**Styling & Theming:**
- Default styles defined in `src/common/Styles.ts` (805 lines)
- Extension system allows registration of preset themes via `registerStyles(name, styles)`
- Per-element style overrides supported in indicator/overlay definitions
- Style changes trigger UpdateLevel.Overlay or UpdateLevel.All depending on scope

**Formatting:**
- Centralized formatters in `src/common/utils/format.ts`
- Consumer provides custom formatters via Store.setFormatter()
- Default formatters handle: date/time via templates, big numbers, thousands separators, decimal folding
- Used throughout for tooltip/axis label generation

**Animation:**
- Smooth scrolling and zooming via `src/common/Animation.ts`
- Used by scroll operations with configurable duration and easing
- RequestAnimationFrame-based implementation for browser coordination

**Canvas Context Caching:**
- HTMLCanvasElement context obtained once during widget initialization
- Cached in Widget for reuse across View renders
- Device pixel ratio detected and applied for crisp rendering on high-DPI displays

**Memory Management:**
- dispose() function removes chart instance from registry
- Event handlers unbound
- DOM elements removed
- No memory leaks from circular references due to explicit cleanup
