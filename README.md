# Cross-Chain Bridge Cost Optimizer

Ranks bridge routes by **net capital preserved** — decomposing the true cost into three layers (source-chain gas, destination-chain gas, protocol fee/spread) — and flags routes whose effective cost is unreasonable (a QA signal).

**Role fit (Durazno — Airdrop Hunter & Tester):** "route liquidity between chains without bleeding capital to slippage, bad rates, or bridge fees" + the QA mandate "notice the unreasonable fee and log it."

---

## Why I built it

When you move stablecoins across chains, the headline bridge fee lies — your real cost is **source-chain gas + destination-chain gas + the bridge's protocol fee/spread**, and which route wins *changes with transfer size*. Most UIs surface one number and let you eat the rest as slippage. This tool decomposes all three layers into a single comparable metric (`effectiveCostBps` — basis points of capital lost) so you can rank routes by **net capital preserved**, and it auto-**flags** any route whose effective cost is unreasonable. It's equal parts a capital-efficiency tool and a QA instrument.

## Technology choices (and what I chose against)

| Decision | Chosen | Considered instead | Why |
|---|---|---|---|
| Language | **TypeScript** | plain JS | The domain is full of money math and nested fee objects; static types catch unit/shape bugs (bps vs %, USD vs token) before runtime. |
| Cost engine | **Pure, dependency-free functions** | a pricing SDK / framework | The 3-layer math is the product's core IP — keeping it pure makes it trivially unit-testable, deterministic, and adapter-agnostic. |
| Data source | **LI.FI aggregator** (M2) behind an **adapter interface** | calling Across/Stargate/Hop/CCTP directly | One integration covers many bridges, and the adapter boundary means the engine never knows or cares where quotes come from — `mock` for offline/deterministic tests, `lifi` for live. |
| Tests | **`node:test`** (built-in) | Jest / Vitest | Zero-dependency, zero-config, instant — appropriate for a focused engine. No reason to pull a 200-package test framework for pure functions. |
| Backend (M2) | **Express** | NestJS / raw `http` | A single `/api/routes` endpoint doesn't justify Nest's ceremony; Express is the right weight, and it's a stack recruiters recognize instantly. |
| Frontend | **React + Vite + TS** | Next.js / CRA | No SSR/routing needs — just a fast SPA. Vite's dev server and build are far leaner than Next for a single-view tool; CRA is effectively deprecated. |
| Hosting | **Cloudflare Pages + Pages Functions** | Render / Vercel | The portfolio domain already lives on Cloudflare, so a Pages Function keeps the API same-origin (no CORS, no second host) and free at the edge. See the deployment note below. |

---

## Run it (M1 — zero dependencies)

```bash
npm start          # → http://localhost:5050   (serves API + UI)
npm test           # unit tests for the cost engine
```

No `npm install` needed for M1 — it runs on Node's built-in modules. Open the URL, pick chains + amount, see ranked routes.

> **Try this:** `1,000 USDC` Ethereum→Arbitrum (gas dominates → every route flagged), then `100,000` (protocol fee dominates → the cheapest route *changes*). That size-dependent crossover is the whole point.

---

## How it works

```
web/index.html ──GET /api/routes?from&to&token&amount──► src/server.js
                                                              │
                                                  src/routeService.js  (supervisor)
                                          ┌───────────────────┼────────────────────┐
                                  adapters/mock.js      core/cache.js        core/costEngine.js
                                  (ADAPTER=mock)        (60s TTL)            (3-layer fee math + rank + flag)
```

- **`core/costEngine.js`** is the heart: `normalize()` computes the 3 fee layers → `effectiveCostBps`; `rank()` sorts by net received (tie-break ETA).
- **`ADAPTER` env var** selects the data source. M1 = `mock` (offline, deterministic). M2 = `lifi` (real quotes from the LI.FI bridge aggregator).

## Swapping the data source (the "two options" convention)

The active adapter is chosen in **`src/routeService.js` → `getAdapter()`** (around lines 12–22):

```js
// OPTION 1 (active):  ADAPTER=mock  → src/adapters/mock.js
// OPTION 2 (M2):      ADAPTER=lifi  → src/adapters/lifi.js   (commented until built)
```

To switch, set `ADAPTER=lifi` once `src/adapters/lifi.js` exists. No other code changes — the cost engine and UI are adapter-agnostic.

---

## Roadmap
- **M1 ✅ (done):** types, mock adapter, cost engine (+ tests), cache, HTTP server, UI. Running end-to-end.
- **M2:** `src/adapters/lifi.js` — real quotes (LI.FI aggregates Across / Stargate / Hop / CCTP). Port server to Express, UI to React/Vite/TS (see `PLAN.md`).
- **M3:** loading/error states, a written **QA findings note** (e.g. "bridge X quoted 3% on a $1k transfer — flagged").

## Interview talking points
- Most tools show one headline bridge fee; this decomposes **three** real layers.
- `effectiveCostBps` is an objective, comparable capital-preservation metric.
- The `flagged` signal automates the job's "notice the unreasonable fee and log it" QA requirement.

See `PLAN.md` for the full execution spec (sub-agent tasks, acceptance criteria, decisions).

---

## ⚠️ Deployment note (2026-05-31)
This repo is structured for a **Node/Express host** (e.g. Render/Vercel serverless). It was **not** the right structure for the deployment we settled on. Since the portfolio domain `remberllc.com` is hosted on **Cloudflare**, a Cloudflare-native version was created instead — see **`bridge-cost-optimizer-cloudflare`** (Cloudflare Pages + Pages Functions). This repo remains as the reference Node implementation. `render.yaml` here is unused.
