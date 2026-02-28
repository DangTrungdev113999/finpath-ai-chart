# External Integrations

**Analysis Date:** 2026-02-28

## Overview

KLineChart is a **zero-dependency** charting library. It contains no external API integrations, database connections, or service dependencies in its core library code. All external service integrations are handled by consuming applications.

## Data Storage

**User Responsibility:**
- The library does not persist data. It operates entirely in-memory.
- Chart data (K-line/OHLCV data) is provided by the consuming application via the public API.
- Data format: `KLineData` interface with `timestamp`, `open`, `high`, `low`, `close`, `volume` properties.

**Browser Storage APIs (Not Used in Library):**
- The library does not use `localStorage`, `sessionStorage`, or `indexedDB`.
- Application implementations may use these for user preferences (chart settings, drawing configurations).

## APIs & External Services

**Not Used in Core Library:**
- No HTTP clients (fetch, axios, etc.) in library code
- No WebSocket connections
- No real-time data streaming
- No cloud service dependencies

**Application Responsibility:**
- Consuming applications must fetch financial data from their chosen sources:
  - Financial data providers (Alpha Vantage, IEX Cloud, Polygon.io, etc.)
  - Exchange APIs (binance, coinbase, etc.)
  - Custom internal APIs

## Authentication & Identity

**Not Applicable:**
- The library contains no authentication logic
- No API keys or credentials handled
- No user identity management
- Applications using the library handle authentication independently

## Monitoring & Observability

**Built-in Logging:**
- Logger utility: `src/common/utils/logger.ts`
- Methods: `logError()`, `logWarn()`, `logTag()`
- Output: Browser console only (no external service)
- Used for debugging and development-time warnings

**Application Responsibility:**
- Error tracking integration (Sentry, Rollbar, etc.)
- Performance monitoring (Datadog, New Relic, etc.)
- User analytics
- Chart usage metrics

## CI/CD & Deployment

**GitHub Actions:**
- Workflow files present in `.github/workflows/` (build and deployment)
- No specific third-party CI service required beyond GitHub

**Documentation Deployment:**
- `gh-pages` 6.1.1 - Deployed to GitHub Pages
- Website built by VitePress and pushed to `gh-pages` branch
- Current deployment: [https://klinecharts.com](https://klinecharts.com)

**NPM Distribution:**
- Published to npm registry: [klinecharts](https://www.npmjs.com/package/klinecharts)
- Multiple bundle formats provided for different use cases

## CDN & Static Distribution

**Available via CDNs:**
- **unpkg** - `https://unpkg.com/klinecharts/dist/umd/klinecharts.min.js`
- **jsDelivr** - `https://cdn.jsdelivr.net/npm/klinecharts/dist/umd/klinecharts.min.js`
- Direct npm installation: `npm install klinecharts`

## Browser APIs (Native, Not External Services)

**Required Browser APIs:**
- **Canvas 2D Context** - Core rendering via HTML5 Canvas
  - `CanvasRenderingContext2D` methods for drawing
  - Canvas image export capabilities

- **ResizeObserver API** - For responsive container sizing
  - Polyfill included: `resize-observer-polyfill` 1.5.1

- **DOM APIs** - Element manipulation
  - Event listeners for mouse/touch interactions
  - Viewport management

- **requestAnimationFrame** - Smooth animations and rendering loops
  - Used for chart animations and smooth interactions

## Web Performance & Compatibility

**Size & Performance:**
- **Gzipped Size:** ~40 KB
- **Zero dependencies:** Reduced bundle size and attack surface
- **ES5 transpilation:** Supports older browsers via build target

## Development Integrations

**Documentation Tools:**
- VitePress 2.0.0-alpha.12 - For building static documentation site
- Shiki - Code syntax highlighting in docs
- Baidu Analytics - Website traffic tracking (embedded in docs config)

**Code Examples Integration:**
- StackBlitz SDK - Live code editor examples
- CodeSandbox SDK - Alternative live sandbox environment
- These allow readers to test code directly from documentation

**Git Integration:**
- Husky - Git hooks for pre-commit/commit-msg checks
- CommitLint - Enforces conventional commit format
- No external Git service integrations

## Data Flow Pattern

**Typical Application Integration:**

```
[External Data Source]
         ↓
[Application Fetch/API Call]
         ↓
[KLineChart.setData(klineData)]
         ↓
[HTML5 Canvas Rendering]
         ↓
[Browser Display]
```

The library is a **view/rendering library** - it displays data provided to it. It does not fetch, store, or transmit data.

## Environment Variables

**Not Required:**
- The library does not require environment configuration
- All configuration is provided at runtime via the public API

**Application Responsibility:**
- API keys for data providers
- Service endpoints
- Feature flags
- User preferences

## Security Considerations

**No Network Operations:**
- No data exfiltration risk
- No dependency vulnerabilities from external APIs
- Safe for offline use once loaded

**Attack Surface:**
- Limited to: Canvas rendering, DOM manipulation, user input handling
- No server-side interaction possible
- No authentication bypass risk

## Summary for Integrating Applications

Applications using KLineChart must handle:
1. **Data fetching** - From financial/market data sources
2. **Authentication** - If API requires credentials
3. **Data formatting** - Converting provider data to KLineData interface
4. **Real-time updates** - WebSocket or polling mechanisms (if needed)
5. **Error handling** - Network errors, data validation
6. **Performance monitoring** - Charting performance metrics
7. **Analytics** - User interaction tracking

The library itself is purely a **data visualization and interaction layer**.

---

*Integration audit: 2026-02-28*
