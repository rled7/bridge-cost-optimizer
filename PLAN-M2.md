# Bridge Cost Optimizer — M2 Build Spec (Opus supervisor → Sonnet worker)

**M2 goal:** Evolve the working M1 (plain JS + static HTML) into the real stack from `PLAN.md`:
TypeScript + Express backend, React + Vite + TS frontend, and a **real LI.FI adapter**
(fixture-backed so the demo never needs network). Then this gets deployed to Vercel (web) + Render (API).

**Source of truth for logic:** the existing M1 files (`src/*.js`, `web/index.html`, `test/costEngine.test.js`).
Port their behavior faithfully — do NOT reinvent the fee math or ranking. Read them first.

## Hard constraints (READ THESE)
- **`npm install` and booting a server REQUIRE `dangerouslyDisableSandbox: true`** — the npm registry and
  port binding are blocked in the default sandbox. Use it for install/build/run commands only.
- Write project files with the **Write tool** (this dir is in the writable allowlist).
- **Mock adapter stays the DEFAULT** (`ADAPTER=mock`) so the demo/tests never depend on network.
- **Do NOT commit, push, or deploy.** Opus reviews and handles git + deployment.
- Keep everything keyless (LI.FI quote endpoints need no API key).

## Layout (monorepo: backend at root, frontend in web/)
```
package.json          # backend (TS + Express)
tsconfig.json
src/types.ts          # port of types.js + add RawRoute
src/adapters/mock.ts  # port of adapters/mock.js — getMockRoutes(q): RawRoute[]
src/adapters/lifi.ts  # NEW — getLifiRoutes(q): Promise<RawRoute[]>
src/core/costEngine.ts# port of core/costEngine.js — normalize(), rank()
src/core/cache.ts     # port of core/cache.js — Map + 60s TTL
src/routeService.ts   # port — cache -> adapter(env ADAPTER) -> costEngine.rank
src/server.ts         # Express GET /api/routes, CORS, PORT||5050
test/costEngine.test.ts
test/lifi.test.ts     # maps recorded fixture -> RawRoute[], asserts valid
test/fixtures/lifi-eth-arb-usdc-1000.json   # recorded real LI.FI response
web/                  # Vite + React + TS app (form -> /api/routes -> ranked table)
```

## Backend details
- `package.json`: `"type":"module"`; deps `express`, `cors`; devDeps `typescript`, `tsx`,
  `@types/express`, `@types/cors`, `@types/node`. Scripts:
  `"dev":"tsx watch src/server.ts"`, `"start":"tsx src/server.ts"`,
  `"build":"tsc -p tsconfig.json"`, `"typecheck":"tsc --noEmit"`, `"test":"tsx --test test/*.test.ts"`.
- `tsconfig.json`: target ES2022, module/moduleResolution NodeNext, strict, esModuleInterop, outDir dist, skipLibCheck.
- `src/types.ts`: `Chain`, `RouteQuery`, `FeeBreakdown`, `RouteQuote` exactly as in PLAN.md, plus a
  `RawRoute` interface (the pre-normalized shape both adapters emit: bridge/tool, toAmount, gas costs, fee, etaSeconds).
- `costEngine.ts`: `normalize(raw, q): RouteQuote` computes the 3 fee layers → totalCostUsd, amountOutUsd,
  effectiveCostBps; `flagged = effectiveCostBps > 100`. `rank(quotes)` sorts amountOutUsd desc, tie-break etaSeconds asc.
- `lifi.ts`: GET `https://li.quest/v1/quote` with params (fromChain, toChain, fromToken, toToken, fromAmount,
  fromAddress placeholder). Map our Chain→LI.FI chain IDs (ethereum=1, arbitrum=42161, optimism=10, base=8453,
  polygon=137, bsc=56). Map response `estimate`/`steps` → `RawRoute` (gasCostUSD, feeCostUSD, toAmount/toAmountUSD,
  tool, estimate.executionDuration). Export a pure `mapLifiResponse(json, q): RawRoute[]` so the fixture test
  can exercise mapping without network.
- `server.ts`: `GET /api/routes?from&to&token&amount` → routeService → JSON `{ query, routes, count }`. CORS open.

## Frontend details (web/)
- Vite React TS app. deps `react`, `react-dom`; devDeps `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
- `src/App.tsx`: form — from/to `<select>` (6 chains), token text (default USDC), amount number (default 1000).
  On submit fetch `${import.meta.env.VITE_API_URL ?? 'http://localhost:5050'}/api/routes?...`.
  Render ranked table: rank #, bridge, net received (USD), 3-layer fee breakdown (source gas / dest gas / protocol),
  effectiveCostBps, ETA; **red badge when `flagged`**. Loading + error states.
- Keep styling clean and minimal (inline or a small CSS file). It should look presentable for an interview demo.

## Self-verification before you report done (sandbox OFF for install/build/run)
1. Backend: `npm install` → `npm run typecheck` (clean) → `npm test` (pass).
2. Boot backend (`PORT=5050 npm start &`), then `curl 'http://localhost:5050/api/routes?from=ethereum&to=arbitrum&token=USDC&amount=1000'`
   → returns ranked JSON with 4 routes, fee breakdowns, and at least the math sane. Kill the server.
3. Frontend: `cd web && npm install && npm run build` → builds with no TS errors.
4. Report back: what you built, file list, the curl output, and any deviations from this spec.

## Acceptance
- `npm run typecheck` clean, `npm test` green, API returns ranked routes on mock, web builds.
- LI.FI mapping proven via the recorded fixture test (no live network needed to pass tests).
