# Technology Stack

**Analysis Date:** 2026-02-28

## Languages

**Primary:**
- TypeScript 5.8.3 - Core library language with strict type checking enabled

## Runtime

**Environment:**
- Node.js 24.x (specified in `.nvmrc`)

**Package Manager:**
- pnpm 10.4.1 (ESM-based monorepo support)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks & Build Tools

**Build System:**
- Rollup 4.43.0 - Primary bundler for multiple output formats
  - `@rollup/plugin-typescript` 11.1.6 - TypeScript compilation
  - `@rollup/plugin-node-resolve` 15.2.3 - Node module resolution
  - `@rollup/plugin-commonjs` 25.0.7 - CommonJS interop
  - `@rollup/plugin-replace` 5.0.5 - Environment variable replacement
  - `@rollup/plugin-terser` 0.4.4 - Minification for production
  - `@rollup/plugin-eslint` 9.0.5 - Linting during build
  - `rollup-plugin-filesize` 10.0.0 - Build artifact size reporting

**Code Linting & Quality:**
- ESLint 9.20.0 - Code linting and static analysis
  - `eslint-config-love` 112.0.0 - Strict TypeScript configuration
  - `eslint-config-standard` 17.1.0 - Standard JS rules
  - `eslint-plugin-import` 2.31.0 - Module import rules
  - `eslint-plugin-promise` 7.2.1 - Promise handling rules
  - `eslint-plugin-n` 17.16.2 - Node.js compatibility rules
  - `eslint-plugin-file-progress` 1.5.0 - Build progress tracking

**Type Generation:**
- `dts-bundle-generator` 9.5.1 - Generates TypeScript declaration files (`dist/index.d.ts`)

**Documentation:**
- VitePress 2.0.0-alpha.12 - Static site generator for documentation
  - `@shikijs/vitepress-twoslash` 3.2.2 - Syntax highlighting with TypeScript support
  - `shiki` 2.4.2 - Code syntax highlighter

**Code Integration Tools:**
- Husky 8.0.3 - Git hooks management
- `@commitlint/cli` 19.6.1 - Commit message linting
- `@commitlint/config-conventional` 19.6.0 - Conventional commit configuration
- `gh-pages` 6.1.1 - GitHub Pages deployment

**Utilities:**
- `cross-env` 7.0.3 - Cross-platform environment variable handling
- `fs-extra` 11.2.0 - Extended file system utilities
- `tslib` 2.8.1 - TypeScript runtime utilities
- `resize-observer-polyfill` 1.5.1 - ResizeObserver API polyfill for older browsers

**Babel (Build-time only):**
- `@babel/parser` 7.26.9 - JavaScript parser
- `@babel/generator` 7.26.9 - Code generation from AST
- `@babel/traverse` 7.26.9 - AST traversal utilities
- `@babel/types` 7.26.9 - AST node types
- `@babel/standalone` 7.26.9 - Standalone Babel for documentation

**Development & Testing:**
- `@stackblitz/sdk` 1.9.0 - StackBlitz integration for live code examples
- `codesandbox` 2.2.3 - CodeSandbox integration for live examples
- `@vueuse/core` 11.1.0 - Vue composition utilities (documentation only)
- `@types/node` 20.12.7 - Node.js type definitions

## Output Formats

**Supported Module Formats:**
- **ESM** - `dist/index.esm.js` (612 KB) - Modern ES module format
- **CommonJS** - `dist/index.cjs` (325 B wrapper) - Node.js compatible
- **UMD** - `dist/umd/klinecharts.js` / `klinecharts.min.js` - Browser-ready bundle
- **TypeScript Declarations** - `dist/index.d.ts` (39 KB) - Full type definitions

## Configuration

**TypeScript Compiler Options** (`tsconfig.json`):
- Target: ES5 (broad compatibility)
- Lib: DOM + ES2018
- Strict mode: `strictNullChecks` enabled
- No unused variables/parameters
- No implicit returns
- Experimental decorators enabled

**ESLint Configuration** (`eslint.config.js`):
- Uses ESLint flat config format (ESLint 9.x)
- Extends: standard + love configs
- Excludes: scripts, dist, docs, index.js
- Notable disabled rules:
  - `complexity` - Allows complex functions
  - `no-use-before-define` - Hoisting allowed
  - `@typescript-eslint/no-non-null-assertion` - Allows `!` operator
  - `@typescript-eslint/no-unsafe-type-assertion` - Allows `as` assertions
  - `@typescript-eslint/max-params` - No limit on function parameters

**Editor Configuration** (`.editorconfig`):
- UTF-8 encoding
- 2-space indent (spaces, not tabs)
- LF line endings
- Trim trailing whitespace

## Platform Requirements

**Development:**
- Node.js 24.x
- pnpm 10.4.1+
- TypeScript 5.8.3+ (for development)
- Git (for Husky hooks)

**Production:**
- Browsers with ES5 support minimum (via transpilation)
- Canvas API support (HTML5)
- ResizeObserver API (with polyfill for older browsers)
- requestAnimationFrame support

**Build Targets:**
- Modern browsers via ESM
- Older browsers via UMD build (minified)
- Node.js 16+ via CommonJS

## Key Build Scripts

```bash
npm run build              # Full build: ESM + CJS + UMD + types
npm run build-esm          # ESM format only
npm run build-cjs          # CommonJS format only
npm run build-umd          # UMD format (dev + prod minified)
npm run build-dts          # TypeScript declarations only
npm run code-lint          # ESLint validation
```

---

*Stack analysis: 2026-02-28*
