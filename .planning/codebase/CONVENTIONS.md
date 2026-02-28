# Coding Conventions

**Analysis Date:** 2026-02-28

## Naming Patterns

**Files:**
- PascalCase for class/interface files: `Chart.ts`, `Pane.ts`, `Store.ts`
- camelCase for utility/helper files: `logger.ts`, `typeChecks.ts`, `format.ts`
- Utility directories use camelCase: `src/common/utils/`, `src/extension/figure/`
- PascalCase for feature directories: `CandlePane.ts`, `IndicatorPane.ts`

**Functions:**
- camelCase for all functions: `init()`, `dispose()`, `binarySearchNearest()`, `formatValue()`
- Getter/setter pattern: `getId()`, `setVisible()`, `getBounding()`, `setBounding()`
- Prefix `is` for boolean predicates: `isString()`, `isNumber()`, `isValid()`, `isArray()`, `isObject()`, `isFunction()`, `isBoolean()`
- Prefix `get` for accessors: `getIndicators()`, `getOverlays()`, `getStyles()`
- Prefix `set` for mutators: `setStyles()`, `setFormatter()`, `setLocale()`

**Variables:**
- camelCase for all variables: `charts`, `chartBaseId`, `dataList`, `targetValue`
- UPPER_SNAKE_CASE for constants: `DEV`, `DEFAULT_BAR_SPACE`, `DEFAULT_OFFSET_RIGHT_DISTANCE`, `BAR_GAP_RATIO`, `SCALE_MULTIPLIER`, `DEFAULT_MIN_TIME_SPAN`
- Single letter allowed for loop indices: `let i = 0`, `for (const key in source)`
- Shortened common prefixes for private fields: `_container`, `_chart`, `_id`, `_bounding`, `_visible`

**Types:**
- PascalCase for all types: `Nullable<T>`, `DeepPartial<T>`, `PickPartial`, `PickRequired`
- Suffix `Type` for union type definitions: `LineType`, `PolygonType`, `TooltipShowType`, `FeatureType`, `CandleType`, `FormatDateType`, `ExtendTextType`, `LayoutChildType`, `ZoomAnchorType`
- Prefix `I` avoided (no interface naming convention prefix)
- Generic type parameters use single uppercase letters: `<T>`, `<U>`, `<X>`

## Code Style

**Formatting:**
- ESLint configured via `eslint.config.js`
- Uses eslint-config-love and eslint-config-standard
- No Prettier found; ESLint is primary style enforcer
- Uses file-progress plugin to track linting progress
- Target: ES5 with lib: ["dom", "es2018"]

**Linting:**
- ESLint 9.20.0
- Active rule enforcement:
  - `complexity: 'off'` - Allows complex functions
  - `promise/avoid-new: 'off'` - Allows promise constructors
  - `no-use-before-define: 'off'` - Functions can reference before definition
  - `@typescript-eslint/no-unsafe-type-assertion: 'off'` - Type assertions allowed
  - `@typescript-eslint/no-non-null-assertion: 'off'` - Non-null assertions allowed (!)
  - `@typescript-eslint/class-methods-use-this: 'off'` - Methods don't need to use this
  - `@typescript-eslint/max-params: 'off'` - No parameter count limit
  - `@typescript-eslint/no-magic-numbers: 'off'` - Magic numbers allowed
  - `@typescript-eslint/prefer-destructuring: 'off'` - Destructuring not enforced
- Ignores: eslint.config.js, scripts/**, dist/**, docs/**, index.js

## Import Organization

**Order:**
1. Type imports: `import type { ... } from '...'`
2. Value imports: `import { ... } from '...'`
3. Default imports: `import DefaultClass from '...'`

**Path Style:**
- Relative paths only: `./common/`, `../pane/`, `../../extension/`
- No path aliases configured in tsconfig.json
- No barrel re-exports in main folders (each module imports directly)

**Pattern Examples from `src/index.ts`:**
```typescript
import type {
  LineType, PolygonType, TooltipShowRule, TooltipShowType, FeatureType, TooltipFeaturePosition,
  CandleType, CandleTooltipRectPosition
} from './common/Styles'
import type Nullable from './common/Nullable'

import { logError, logTag, logWarn } from './common/utils/logger'

import {
  clone, merge, isString, isNumber, isValid, isObject, isArray, isFunction, isBoolean
} from './common/utils/typeChecks'
```

## Error Handling

**Logging Strategy:**
- Console-based logging only in development (checked via `process.env.NODE_ENV === 'development'`)
- Styled console output using CSS styling
- Three logging levels:
  - `logWarn()` - Yellow warning with emoji 😑
  - `logError()` - Red error with emoji 😟
  - `logTag()` - Welcome/debug message with emoji ❤️

**Pattern from `logger.ts`:**
```typescript
function log (templateText: string, tagStyle: string, messageStyle: string, api: string, invalidParam: string, append: string): void {
  if (DEV) {
    const apiStr = api !== '' ? `Call api \`${api}\`${invalidParam !== '' || append !== '' ? ', ' : '.'}` : ''
    const invalidParamStr = invalidParam !== '' ? `invalid parameter \`${invalidParam}\`${append !== '' ? ', ' : '.'}` : ''
    const appendStr = append !== '' ? append : ''
    console.log(templateText, tagStyle, messageStyle, apiStr, invalidParamStr, appendStr)
  }
}
```

**Null/Undefined Handling:**
- Type `Nullable<T>` used extensively: `type Nullable<T> = T | null`
- Guard with `isValid()` predicate: `if (isValid(value)) { ... }`
- Nullish coalescing in returns: `return isValid(value) ? value : (defaultValue ?? '--')`
- Non-null assertions allowed via eslint rule: `dom?.getAttribute()`, `charts.get(id)?.destroy()`

**Error Patterns:**
- Return null/empty on validation failure (no exceptions thrown)
- Validation before execution: `if (dom === null) { logError(...); return null }`
- Graceful degradation: Chart initialization checks for valid DOM and logs warnings for duplicates

## Comments

**When to Comment:**
- Block comments before complex algorithms or non-obvious logic
- JSDoc for public API functions (see `index.ts`)
- Inline comments sparingly; prefer clear naming
- No comment blocks within method bodies (logic should be self-documenting)

**JSDoc Pattern from `index.ts`:**
```typescript
/**
 * Chart version
 * @return {string}
 */
function version (): string {
  return '__VERSION__'
}

/**
 * Init chart instance
 * @param ds
 * @param options
 * @returns {Chart}
 */
function init (ds: HTMLElement | string, options?: Options): Nullable<Chart> {
  // ...
}
```

**Pattern from utilities:**
- JSDoc on all exported functions with parameter and return type documentation
- Chinese comments permitted for internal notes (see `Event.ts`: `// 惯性滚动开始时间`)

## Function Design

**Size:**
- Prefer smaller functions for single responsibilities
- Utility functions stay focused: `binarySearchNearest()` does one search algorithm
- Class methods can be larger: `Chart.ts` is 41KB with complex initialization

**Parameters:**
- Use object parameters for multiple options: `({ dateTimeFormat, timestamp, template, type })`
- Generic type parameters on utility functions: `binarySearchNearest<T>(dataList: T[], valueKey: keyof T, ...)`
- Trailing optional parameters: `options?: Options`, `animationDuration?: number`

**Return Values:**
- Return `Nullable<T>` for operations that may fail: `init()`, `createIndicator()`, `createOverlay()`
- Return type-specific values: `getStyles()` returns `Styles`, `getFormatter()` returns `Formatter`
- Void for state mutation methods: `setStyles()`, `setFormatter()`, `setPaneOptions()`
- Array or single returns based on input: `createOverlay()` returns `Nullable<string> | Array<Nullable<string>>`

## Module Design

**Exports:**
- Default class export: `export default class ChartImp implements Chart`
- Named exports for utilities: `export { clone, merge, isString, ... }`
- Type exports: `export type { Chart, DomPosition, ... }`
- Namespace export: `const utils = { clone, merge, ... }; export { utils }`

**Barrel Files (index.ts):**
- Only in root: `src/index.ts`
- Collects public API: All `register*`, `init`, `dispose`, `utils`
- Not used for intermediate directories (each file imports from exact paths)

**Pattern from root `index.ts`:**
```typescript
const utils = {
  clone,
  merge,
  isString,
  isNumber,
  isValid,
  isObject,
  isArray,
  isFunction,
  isBoolean,
  formatValue,
  formatPrecision,
  // ...
}

export {
  version, init, dispose,
  registerFigure, getSupportedFigures, getFigureClass,
  registerIndicator, getSupportedIndicators,
  registerOverlay, getSupportedOverlays, getOverlayClass,
  registerLocale, getSupportedLocales,
  registerStyles,
  registerXAxis, registerYAxis,
  utils,
  // ... types
}
```

## Class & Type Patterns

**Private Fields:**
- Underscore prefix for private fields: `private readonly _container`, `private _visible`
- Getter/setter pairs: `getContainer()`, `setVisible()`, `getId()`
- All state encapsulated; no public properties

**Utility Type Patterns from `common/`:**
- `Nullable<T>` for nullable values
- `DeepPartial<T>` for nested partial updates:
```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P]
}
```
- `PickPartial<T, K>` for partial select of fields
- `PickRequired<T, K>` for required select of fields
- `DeepRequired<T>` for deep required conversion

**Interface Pattern:**
```typescript
export interface Options {
  locale?: string
  timezone?: string
  styles?: string | DeepPartial<Styles>
  formatter?: Partial<Formatter>
  thousandsSeparator?: Partial<ThousandsSeparator>
  decimalFold?: Partial<DecimalFold>
  zoomAnchor?: ZoomAnchorType | Partial<ZoomAnchor>
  layout?: LayoutChild[]
}
```

## TypeScript Configuration

**Strict Mode:**
- `strictNullChecks: true` - Enforces null/undefined handling
- `noUnusedLocals: true` - Disallows unused variables
- `noUnusedParameters: true` - Disallows unused parameters
- `noImplicitReturns: true` - Requires explicit returns
- `noFallthroughCasesInSwitch: true` - Prevents fall-through switch cases

**Target:** ES5 (broad compatibility)

---

*Convention analysis: 2026-02-28*
