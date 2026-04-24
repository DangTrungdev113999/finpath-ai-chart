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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **finpath-ai-chart** (8707 symbols, 14360 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/finpath-ai-chart/context` | Codebase overview, check index freshness |
| `gitnexus://repo/finpath-ai-chart/clusters` | All functional areas |
| `gitnexus://repo/finpath-ai-chart/processes` | All execution flows |
| `gitnexus://repo/finpath-ai-chart/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
