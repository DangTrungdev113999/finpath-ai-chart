# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of **KLineChart** (v10.0.0-beta1) — a lightweight, zero-dependency candlestick charting library built with HTML5 Canvas and TypeScript. The fork is customized for the Finpath platform with additional drawing tools, indicators, and UI enhancements.

## Commands

```bash
pnpm install              # Install dependencies (pnpm@10.4.1 required)
pnpm run build            # Full build: clean → ESM/CJS/UMD → DTS
pnpm run build-esm        # ES Module only → dist/index.esm.js
pnpm run build-umd        # UMD dev + prod → dist/umd/
pnpm run build-dts        # TypeScript definitions → dist/index.d.ts
pnpm run code-lint        # ESLint on src/**/*.ts
pnpm run docs:dev         # VitePress dev server at http://localhost:8888
```

## Commit Convention

Commitlint enforces conventional commits. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `impr`, `chore`, `test`, `revert`, `ci`, `opt`, `release`.

## Architecture

### Core Pipeline

```
Action → Store (state) → UpdateLevel → Panes → Widgets → Views (canvas render)
```

**Update levels** (from heaviest to lightest): `All` → `Layout` → `AxisRange` → `VisibleData` → `Drawer`

### Key Modules

| File | Role |
|------|------|
| `src/Chart.ts` | Main chart orchestrator, manages panes and lifecycle |
| `src/Store.ts` | Central state: data, visible range, bar spacing, options |
| `src/Event.ts` | Event lifecycle and action dispatch |
| `src/common/EventHandler.ts` | Mouse/touch/keyboard event handling, zoom/pan, crosshair |
| `src/common/Styles.ts` | All style type definitions and defaults |

### Layered Abstraction

- **Panes** (`src/pane/`) — Vertical layout sections: `CandlePane`, `IndicatorPane`, `XAxisPane`, `DrawPane`, `SeparatorPane`. Each pane contains widgets.
- **Widgets** (`src/widget/`) — Interactive canvas regions within a pane. Handle DOM containers and cursor state, delegate rendering to views.
- **Views** (`src/view/`) — Pure canvas renderers. `CandleBarView`, `IndicatorView`, `OverlayView`, tooltip views, axis views, etc.
- **Components** (`src/component/`) — Semantic abstractions: `Indicator` (technical indicator template/instance), `Overlay` (drawing tool template/instance), `YAxis`, `XAxis`, `Figure`.

### Extension System

All extensions live in `src/extension/` and use a registration pattern:

- **Indicators** (`extension/indicator/`) — 22+ built-in (SMA, EMA, RSI, MACD, Bollinger Bands, etc.). Add via `registerIndicator(template)`.
- **Overlays** (`extension/overlay/`) — 14+ drawing tools (lines, channels, fibonacci, etc.). Add via `registerOverlay(template)`.
- **Figures** (`extension/figure/`) — Geometric primitives (arc, circle, line, polygon, rect, text, path) with hit-detection. Add via `registerFigure(template)`.
- **Y-Axis types** (`extension/y-axis/`) — normal, logarithm, percentage.
- **Styles** (`extension/styles/`) — light/dark themes.
- **i18n** (`extension/i18n/`) — en-US, zh-CN.

### Public API (src/index.ts)

- `init(dom, options)` / `dispose(chart)` — lifecycle
- `register*` / `getSupported*` — extension registration
- `utils` — exported helpers for formatting, geometry, type checks

## Build System

Rollup-based, configured in `scripts/build/`. Outputs:
- ESM: `dist/index.esm.js`
- CJS: `dist/index.cjs`
- UMD: `dist/umd/klinecharts.js` (dev) and `klinecharts.min.js` (prod)
- Types: `dist/index.d.ts`

`__VERSION__` is replaced at build time from package.json.

## TypeScript

Target ES5, strict null checks enabled. Key strictness flags: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
