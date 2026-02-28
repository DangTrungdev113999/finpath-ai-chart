# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
finpath-ai-chart/
├── src/                        # Source code root
│   ├── index.ts               # Public API entry point and library exports
│   ├── Chart.ts               # Chart lifecycle and public interface (ChartImp)
│   ├── Store.ts               # Centralized state management (ChartStore)
│   ├── Event.ts               # User interaction handling and coordination
│   ├── Options.ts             # Configuration interfaces (Options, Formatter, etc.)
│   ├── common/                # Shared utilities and types (Update system, styling, data models)
│   │   ├── utils/             # Helper functions (canvas, DOM, formatting, type checks, platform)
│   │   ├── Styles.ts          # Complete style definitions and defaults
│   │   ├── Updater.ts         # UpdateLevel enum and Updater interface
│   │   ├── EventHandler.ts    # Low-level mouse/touch/keyboard event binding
│   │   ├── Eventful.ts        # Base event emitter for View and Widget
│   │   ├── Canvas.ts          # Canvas context and rendering utilities
│   │   ├── Data.ts            # KLineData interface and data types
│   │   ├── VisibleRange.ts    # Visible data range calculations
│   │   ├── BarSpace.ts        # Candlestick bar spacing calculations
│   │   ├── Crosshair.ts       # Crosshair cursor state type
│   │   ├── Animation.ts       # Smooth scrolling and zoom animation
│   │   ├── TaskScheduler.ts   # Task scheduling and batching
│   │   ├── DataLoader.ts      # Progressive data loading interface
│   │   ├── Nullable.ts        # Nullable<T> type alias
│   │   ├── Period.ts          # Time period definitions
│   │   └── [Type definitions] # Bounding, Coordinate, Point, SymbolInfo, etc.
│   ├── pane/                  # Chart layout sections (vertical panes)
│   │   ├── Pane.ts            # Base pane class (container + DOM management)
│   │   ├── DrawPane.ts        # Pane with canvas rendering (extends Pane)
│   │   ├── CandlePane.ts      # Main candlestick pane
│   │   ├── IndicatorPane.ts   # Technical indicator display pane
│   │   ├── XAxisPane.ts       # Time axis pane
│   │   ├── SeparatorPane.ts   # Draggable pane divider
│   │   └── types.ts           # PaneOptions, PaneIdConstants, height defaults
│   ├── widget/                # Canvas containers and view coordinators
│   │   ├── Widget.ts          # Base widget class (canvas management)
│   │   ├── DrawWidget.ts      # Widget supporting overlay/drawing (extends Widget)
│   │   ├── CandleWidget.ts    # Candlestick rendering widget
│   │   ├── IndicatorWidget.ts # Indicator rendering widget
│   │   ├── XAxisWidget.ts     # X-axis labels rendering widget
│   │   ├── YAxisWidget.ts     # Y-axis labels and values rendering widget
│   │   ├── SeparatorWidget.ts # Draggable separator widget
│   │   └── types.ts           # WidgetNameConstants, widget constants
│   ├── view/                  # Rendering logic for specific chart elements
│   │   ├── View.ts            # Base view class (extends Eventful)
│   │   ├── CandleBarView.ts   # Renders candlesticks and volume bars
│   │   ├── CandleAreaView.ts  # Fills area under candlesticks
│   │   ├── CandleTooltipView.ts # Main tooltip when hovering candle (436 lines)
│   │   ├── CandleLastPriceLineView.ts # Last price horizontal line
│   │   ├── CandleLastPriceLabelView.ts # Last price text label
│   │   ├── CandleHighLowPriceView.ts  # High/low price labels on candles
│   │   ├── IndicatorView.ts   # Renders indicator values (244 lines)
│   │   ├── IndicatorTooltipView.ts # Indicator tooltip display (439 lines)
│   │   ├── IndicatorLastValueView.ts # Last indicator value label
│   │   ├── OverlayView.ts     # Renders user-drawn overlays (584 lines)
│   │   ├── AxisView.ts        # Renders axis labels and ticks
│   │   ├── XAxisView.ts       # Time axis rendering
│   │   ├── YAxisView.ts       # Price axis rendering
│   │   ├── GridView.ts        # Grid lines
│   │   ├── CrosshairLineView.ts # Crosshair vertical/horizontal lines
│   │   ├── CrosshairHorizontalLabelView.ts # Price label on crosshair
│   │   ├── CrosshairVerticalLabelView.ts # Date label on crosshair
│   │   ├── CrosshairFeatureView.ts # Tooltip-like feature box on crosshair
│   │   ├── OverlayXAxisView.ts # Overlay-specific axis labels
│   │   └── ChildrenView.ts    # Container view for nested views
│   ├── component/             # Data models and business logic
│   │   ├── Indicator.ts       # Indicator model and lifecycle (432 lines)
│   │   ├── Overlay.ts         # Overlay model and lifecycle (451 lines)
│   │   ├── Figure.ts          # Drawing primitives and hit detection
│   │   ├── Axis.ts            # Base axis implementation (coordinate transformation)
│   │   ├── XAxis.ts           # Time axis (181 lines)
│   │   └── YAxis.ts           # Price axis (448 lines)
│   └── extension/             # Pluggable implementations (indicators, overlays, figures, styles)
│       ├── indicator/         # 40+ Technical indicators
│       │   ├── index.ts       # Indicator registration system
│       │   ├── movingAverage.ts
│       │   ├── simpleMovingAverage.ts
│       │   ├── exponentialMovingAverage.ts
│       │   ├── movingAverageConvergenceDivergence.ts
│       │   ├── bollingerBands.ts
│       │   ├── relativeStrengthIndex.ts
│       │   ├── stoch.ts
│       │   ├── volume.ts
│       │   └── [34+ other indicators...]
│       ├── overlay/           # Drawing tool implementations (line, rectangle, triangle, etc.)
│       │   └── index.ts       # Overlay registration and factory
│       ├── figure/            # Primitive drawing shapes with hit detection
│       │   ├── index.ts       # Figure registration system
│       │   ├── line.ts        # Line drawing (200 lines, includes linear math)
│       │   ├── arc.ts         # Arc drawing
│       │   ├── circle.ts      # Circle drawing
│       │   ├── polygon.ts     # Polygon drawing
│       │   ├── rect.ts        # Rectangle drawing
│       │   ├── text.ts        # Text rendering
│       │   └── path.ts        # Path drawing (296 lines)
│       ├── x-axis/            # X-axis type implementations
│       │   ├── index.ts       # X-axis registration
│       │   └── normal.ts      # Default time-based x-axis
│       ├── y-axis/            # Y-axis type implementations
│       │   ├── index.ts       # Y-axis registration
│       │   ├── normal.ts      # Normal linear scale
│       │   ├── logarithm.ts   # Logarithmic scale
│       │   └── percentage.ts  # Percentage scale
│       ├── styles/            # Preset color themes
│       │   └── index.ts       # Theme registration
│       └── i18n/              # Localization strings
│           └── index.ts       # Locale registration
├── dist/                      # Build output (ESM, CJS, UMD)
│   ├── index.esm.js          # ES modules export
│   ├── index.cjs             # CommonJS export
│   ├── umd/                  # Universal module definition
│   │   ├── klinecharts.js
│   │   └── klinecharts.min.js
│   └── index.d.ts            # Generated TypeScript definitions
├── tests/                     # Test files and test utilities
├── docs/                      # VitePress documentation site
├── scripts/                   # Build and automation scripts
│   ├── build/                # Build pipeline
│   │   ├── build-esm.js      # ESM build script
│   │   ├── build-cjs.js      # CommonJS build script
│   │   ├── build-umd.js      # UMD build script
│   │   ├── clean.js          # Clean dist/
│   ├── check-env.js          # Environment validation
│   └── pre-publish.js        # Pre-publish checks
├── package.json              # Project metadata and scripts
├── tsconfig.json             # TypeScript configuration
├── eslint.config.js          # Linting rules
└── index.js                  # CommonJS entry point (for Node.js exports)
```

## Directory Purposes

**src/:**
- Purpose: All source code
- Contains: TypeScript implementation
- Key files: Core library entrypoint (`index.ts`), Chart/Store/Event coordination

**src/common/:**
- Purpose: Shared utilities, types, and cross-cutting concerns
- Contains: Type definitions (Nullable, Bounding, Coordinate, etc.), canvas helpers, event binding, styling system
- Key files: `Styles.ts` (805 lines - complete style schema), `EventHandler.ts` (954 lines), `Updater.ts` (UpdateLevel enum)

**src/common/utils/:**
- Purpose: Utility functions for all layers
- Contains: Canvas operations, DOM manipulation, formatting, number operations, type checking, platform detection
- Key files: `typeChecks.ts`, `format.ts`, `canvas.ts`, `dom.ts`

**src/pane/:**
- Purpose: Multi-pane layout organization
- Contains: Pane classes for different chart sections (candlestick, indicators, axis, separators)
- Key files: `Pane.ts` (base), `DrawPane.ts` (1180+ lines with canvas widgets), `CandlePane.ts`, `IndicatorPane.ts`

**src/widget/:**
- Purpose: Canvas element management and view coordination
- Contains: Widget classes for content rendering and event delegation
- Key files: `Widget.ts` (base canvas management), `DrawWidget.ts` (overlay/drawing support)

**src/view/:**
- Purpose: Canvas drawing implementations
- Contains: 20+ View classes, each responsible for rendering specific chart element
- Key files: `CandleTooltipView.ts` (436 lines), `IndicatorTooltipView.ts` (439 lines), `OverlayView.ts` (584 lines)

**src/component/:**
- Purpose: Data models and business logic for chart components
- Contains: Indicator, Overlay, and Axis implementations
- Key files: `Indicator.ts` (432 lines), `Overlay.ts` (451 lines), `YAxis.ts` (448 lines)

**src/extension/:**
- Purpose: Pluggable implementations (indicators, overlays, figures, styles, axes)
- Contains: 40+ indicators, multiple overlay types, 6 primitive figure types, axis variants, themes
- Key files: Each subdirectory has `index.ts` with registration/factory functions

**dist/:**
- Purpose: Build output
- Contains: Compiled JavaScript in three formats (ESM, CJS, UMD) and generated TypeScript definitions
- Generated: By build scripts (build-esm.js, build-cjs.js, build-umd.js)
- Committed: Yes (included for npm/yarn install from GitHub per recent commit)

**tests/:**
- Purpose: Test code and test utilities
- Contains: Test files for core functionality
- Generated: No
- Committed: Yes

**docs/:**
- Purpose: VitePress documentation site
- Contains: Markdown docs, examples, API reference
- Generated: No (docs:build rebuilds static HTML)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/index.ts`: Public API (version, init, dispose, registerIndicator, registerOverlay, utils exports)
- `src/Chart.ts`: ChartImp class - main lifecycle and Chart interface implementation
- `index.js`: CommonJS entry point for Node.js

**Configuration:**
- `src/Options.ts`: Configuration interfaces (Options, Formatter, ZoomAnchor, LayoutChild)
- `package.json`: Project metadata, scripts, dependencies
- `tsconfig.json`: TypeScript compiler options
- `eslint.config.js`: Linting rules and configurations

**Core Logic:**
- `src/Store.ts`: ChartStore (1634 lines - largest file) - state management, calculations
- `src/Event.ts`: Event class - user interaction handling and action coordination
- `src/common/EventHandler.ts`: EventHandlerImp - low-level DOM event binding (954 lines)

**Testing:**
- `tests/`: Test file location (specifics depend on test runner configuration)

## Naming Conventions

**Files:**
- **Class files**: PascalCase matching class name (e.g., `CandlePane.ts`, `Indicator.ts`)
- **Type/interface files**: PascalCase (e.g., `Options.ts`, `Styles.ts`, `Data.ts`)
- **Index files**: `index.ts` for module exports and registration systems
- **Index files for extension modules**: `src/extension/[type]/index.ts` for registration
- **Utility directories**: lowercase plural (e.g., `utils/`, `views/` would be plural if not singular)

**Directories:**
- **Feature directories**: lowercase singular for pane, widget, view, component, extension subdirectories
- **Utility directories**: lowercase plural (src/common/utils/)

**Classes:**
- **Main implementations**: Suffix `Imp` if implementing an interface (e.g., `ChartImp` implements `Chart`)
- **Indicator extensions**: Lowercase descriptive names (e.g., `movingAverage.ts`, `bollingerBands.ts`)
- **Overlay extensions**: Lowercase with tool name (e.g., `line.ts`, `rectangle.ts`)

**Functions:**
- **camelCase**: All functions use camelCase
- **Factory functions**: `register*` prefix (registerIndicator, registerOverlay, registerFigure)
- **Getter functions**: `get*` prefix (getStyles, getFormatter, getIndicators)
- **Setter functions**: `set*` prefix (setStyles, setData, setFormatter)
- **Utility functions**: Verb + Noun pattern (formatValue, calcTextWidth, binarySearchNearest)

**Variables & Constants:**
- **Constants**: UPPER_SNAKE_CASE for exported constants (e.g., `PaneIdConstants`, `WidgetNameConstants`, `UpdateLevel`)
- **Private fields**: Prefixed with `_` (e.g., `_chart`, `_container`, `_dataList`)
- **Type parameters**: PascalCase single letters (e.g., `<D>` for data, `<C>` for axis component)

## Where to Add New Code

**New Indicator:**
- **Primary code**: `src/extension/indicator/[name].ts` - Define indicator class implementing Indicator<D> interface
- **Registration**: Export from `src/extension/indicator/index.ts` in registerIndicator entry
- **Patterns to follow**:
  - Import from `src/component/Indicator.ts` for IndicatorFigure, IndicatorCreate types
  - Define generic data type (e.g., `interface MAData { value: number }`)
  - Provide `figures` array with figure definitions
  - Provide `calc()` method for calculations
  - Optionally provide `styles()` callback for dynamic styling

**New Overlay Type:**
- **Primary code**: `src/extension/overlay/[name].ts`
- **Registration**: Export from `src/extension/overlay/index.ts`
- **Patterns to follow**:
  - Import from `src/component/Overlay.ts` for OverlayCreate interface
  - Define overlay shape using figures array
  - Implement create/update coordinate transformation
  - Provide event handlers for mouse interactions if drawing-enabled

**New Figure Type:**
- **Primary code**: `src/extension/figure/[shape].ts`
- **Registration**: Export from `src/extension/figure/index.ts`
- **Patterns to follow**:
  - Extend Figure class from `src/component/Figure.ts`
  - Implement draw(ctx, attrs, styles) method using Canvas API
  - Implement checkCoordinate(coordinate, attrs) for hit detection
  - Handle coordinate arrays (x, y as separate arrays or as Point array)

**New View:**
- **Primary code**: `src/view/[Name]View.ts` - Extend View class
- **Location**: If rendering in main chart area, coordinate through Pane/Widget structure
- **Patterns to follow**:
  - Import View base class from `src/view/View.ts`
  - Override update(level) to re-render based on Store state
  - Use createFigure(create) helper to instantiate drawing primitives
  - Read data from widget's pane's store via getWidget().getPane().getChart().getChartStore()

**New Pane Type:**
- **Primary code**: `src/pane/[Name]Pane.ts` - Extend DrawPane class
- **Registration**: Add instantiation in Chart.ts constructor
- **Patterns to follow**:
  - Create appropriate Widget subclass (likely DrawWidget for content rendering)
  - Set PaneOptions to control height, visibility, axis type
  - Use PaneIdConstants for unique identification

**Styling/Theme:**
- **Primary code**: Define object matching Styles interface from `src/common/Styles.ts`
- **Registration**: `registerStyles(name, styleObject)` exported from `src/index.ts`
- **Override pattern**: Provide partial Styles object; library merges with defaults

**Utility Function:**
- **Location**: `src/common/utils/[category].ts` based on purpose (formatting, canvas, DOM, etc.)
- **Export from**: Same file or via re-export in parent `src/common/utils/index.ts` if creating new file

**Type Definition:**
- **Location**: `src/common/[Name].ts` if domain-specific (VisibleRange, BarSpace) or `src/common/Data.ts` if data-related
- **Convention**: One primary type per file, supporting types in same file

## Special Directories

**dist/:**
- Purpose: Build output directory containing compiled code ready for distribution
- Generated: Yes - by build scripts (clean.js then build-esm.js, build-cjs.js, build-umd.js)
- Committed: Yes (recently changed to include in npm/yarn install from GitHub)
- Build process:
  1. `npm run build` → clean dist/
  2. Rollup bundles TypeScript to ESM (ES2020 target, tree-shakeable)
  3. Rollup bundles to CommonJS with .cjs extension
  4. Rollup bundles to UMD in dist/umd/ (both development and minified)
  5. dts-bundle-generator generates dist/index.d.ts from src/index.ts

**docs/:**
- Purpose: VitePress documentation site source
- Generated: No (source files committed)
- Output: `pnpm docs:build` generates static HTML in website/ directory
- Deployment: Via gh-pages to GitHub Pages

**tests/:**
- Purpose: Test files and test infrastructure
- Generated: No (source tests committed)
- Pattern: Likely co-located or organized by feature

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes - by `pnpm install`
- Committed: No (excluded by .gitignore)

**.planning/:**
- Purpose: GSD planning and analysis documents
- Generated: Yes - by /gsd commands
- Committed: Yes
- Contents: Codebase analysis docs (ARCHITECTURE.md, STRUCTURE.md, etc.)
