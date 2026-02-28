# Testing Patterns

**Analysis Date:** 2026-02-28

## Test Framework

**Runner:**
- Not detected - No test framework configured
- No jest.config.js, vitest.config.js, or similar test configuration found
- No test dependencies in package.json

**Assertion Library:**
- Not detected

**Run Commands:**
- No test scripts in package.json
- Testing not part of development workflow

## Test File Organization

**Location:**
- No tests exist in codebase
- No co-located or separate test structure

**Naming:**
- Not applicable - No test files exist

**Structure:**
- Not applicable - No test files exist

## Testing Status

**Current State:**
- No unit tests implemented
- No integration tests implemented
- No E2E tests implemented
- No test coverage configuration

**Code Quality Approach:**
- Relies on ESLint (eslint-config-love, eslint-config-standard)
- TypeScript strict mode for static analysis:
  - `strictNullChecks: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
- Manual testing via demos (docs site at `docs/` using VitePress)

## Build-Time Validation

**ESLint Checks (`npm run code-lint`):**
```bash
eslint src/**/*.ts
```

**Type Checking (via TypeScript):**
- Compilation as part of build process
- Build scripts in `scripts/build/`:
  - `build-esm.js` - ES module build
  - `build-cjs.js` - CommonJS build
  - `build-umd.js` - UMD build
  - `build-dts.js` - Type definitions generation via dts-bundle-generator

**Build Chain:**
```bash
npm run build
  → npm run clean (remove dist/)
  → npm run build-core
    → npm run build-esm && npm run build-cjs && npm run build-umd
  → npm run build-dts (generate type definitions)
```

## Documentation & Examples

**Demo/Test Alternative:**
- VitePress documentation site at `docs/`
- Interactive examples via @stackblitz/sdk and codesandbox
- Built-in demos for features and indicators
- Run: `npm run docs:dev` for development, `npm run docs:build` for production

**Key Demo Files:**
- `docs/` directory contains markdown documentation with embedded examples
- Shiki syntax highlighting with VitePress TwoSlash integration
- StackBlitz SDK for interactive code examples

## Testing Recommendations

**If Tests Were Implemented:**

**Test Runner Setup:**
```bash
# Install test dependencies
pnpm add -D vitest @vitest/ui happy-dom

# Create vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
```

**Test File Structure:**
```
src/
├── common/
│   ├── utils/
│   │   ├── typeChecks.ts
│   │   └── typeChecks.test.ts
│   ├── Nullable.ts
│   └── Nullable.test.ts
├── Chart.ts
├── Chart.test.ts
└── ...
```

**Unit Test Pattern (for type utilities):**
```typescript
import { describe, it, expect } from 'vitest'
import { isString, isNumber, isValid, isArray, isObject, clone, merge } from '../../src/common/utils/typeChecks'

describe('typeChecks', () => {
  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBe(true)
      expect(isString('')).toBe(true)
    })

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString(undefined)).toBe(false)
    })
  })

  describe('isNumber', () => {
    it('should return true for finite numbers', () => {
      expect(isNumber(42)).toBe(true)
      expect(isNumber(0)).toBe(true)
      expect(isNumber(-3.14)).toBe(true)
    })

    it('should return false for non-finite values', () => {
      expect(isNumber(NaN)).toBe(false)
      expect(isNumber(Infinity)).toBe(false)
      expect(isNumber('42')).toBe(false)
    })
  })

  describe('clone', () => {
    it('should clone objects deeply', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = clone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
    })

    it('should clone arrays', () => {
      const original = [1, 2, [3, 4]]
      const cloned = clone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
    })

    it('should return primitives unchanged', () => {
      expect(clone(42)).toBe(42)
      expect(clone('hello')).toBe('hello')
      expect(clone(true)).toBe(true)
    })
  })

  describe('merge', () => {
    it('should merge objects recursively', () => {
      const target = { a: 1, b: { c: 2 } }
      const source = { b: { d: 3 }, e: 5 }
      merge(target, source)
      expect(target).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 5 })
    })
  })
})
```

**Integration Test Pattern (for Chart initialization):**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { init, dispose } from '../../src/index'

describe('Chart Integration', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'test-chart'
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })

  it('should initialize chart on DOM element', () => {
    const chart = init(container)
    expect(chart).not.toBeNull()
    expect(chart?.id).toBeDefined()
  })

  it('should fail gracefully with null DOM', () => {
    const chart = init(document.createElement('div'))
    // Will return null due to missing k-line-chart-id
    expect(chart).not.toBeNull()
  })

  it('should dispose chart', () => {
    const chart = init(container)
    expect(chart).not.toBeNull()
    dispose(chart!)
    // Chart should be removed from internal map
  })
})
```

**Format Utility Test Pattern:**
```typescript
import { describe, it, expect } from 'vitest'
import { formatValue, formatTimestampToDateTime } from '../../src/common/utils/format'

describe('format utilities', () => {
  describe('formatValue', () => {
    it('should extract nested values with dot notation', () => {
      const data = { user: { name: 'John', age: 30 } }
      expect(formatValue(data, 'user.name')).toBe('John')
      expect(formatValue(data, 'user.age')).toBe(30)
    })

    it('should return default value for missing keys', () => {
      const data = { a: 1 }
      expect(formatValue(data, 'b')).toBe('--')
      expect(formatValue(data, 'b', 'N/A')).toBe('N/A')
    })

    it('should handle null/undefined data', () => {
      expect(formatValue(null, 'key')).toBe('--')
      expect(formatValue(undefined, 'key')).toBe('--')
    })
  })

  describe('formatTimestampToDateTime', () => {
    it('should format timestamp to date parts', () => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      const timestamp = new Date('2024-01-15T14:30:00Z').getTime()
      const result = formatTimestampToDateTime(formatter, timestamp)
      expect(result.YYYY).toBe('2024')
      expect(result.MM).toBe('01')
      expect(result.DD).toBe('15')
    })
  })
})
```

**Math Utility Test Pattern:**
```typescript
import { describe, it, expect } from 'vitest'
import { binarySearchNearest, nice } from '../../src/common/utils/number'

describe('number utilities', () => {
  describe('binarySearchNearest', () => {
    it('should find exact match in sorted array', () => {
      const data = [
        { timestamp: 100, value: 1 },
        { timestamp: 200, value: 2 },
        { timestamp: 300, value: 3 }
      ]
      const index = binarySearchNearest(data, 'timestamp', 200)
      expect(index).toBe(1)
    })

    it('should find nearest when exact match not found', () => {
      const data = [
        { timestamp: 100 },
        { timestamp: 300 },
        { timestamp: 500 }
      ]
      const index = binarySearchNearest(data, 'timestamp', 350)
      expect([1, 2]).toContain(index) // Either 300 or next higher
    })
  })

  describe('nice', () => {
    it('should round to nice numbers', () => {
      expect(nice(5.6)).toBe(6)
      expect(nice(17)).toBe(20)
      expect(nice(0.015)).toBe(0.02)
    })
  })
})
```

## Code Areas Needing Tests

**Critical Paths:**
- Chart initialization and lifecycle: `src/Chart.ts`, `src/Store.ts`
- Type checking utilities: `src/common/utils/typeChecks.ts`
- Data formatting: `src/common/utils/format.ts`
- Number calculations: `src/common/utils/number.ts`
- Event handling: `src/Event.ts`

**High Priority:**
- Indicator calculations: `src/extension/indicator/*.ts`
- Overlay rendering logic: `src/view/OverlayView.ts`
- Canvas rendering: `src/pane/CandlePane.ts`, `src/pane/IndicatorPane.ts`

**Coverage Target:** 70%+ (utilities), 50%+ (complex pane/view logic)

## Mocking Considerations

**What to Mock (if tests existed):**
- DOM elements and canvas context
- RequestAnimationFrame (use fake timers)
- EventHandler events
- External indicator data loaders

**What NOT to Mock:**
- Type check utilities (logic is trivial, test directly)
- Pure format functions (test with real data)
- Mathematical calculations (test with known inputs/outputs)

---

*Testing analysis: 2026-02-28*
