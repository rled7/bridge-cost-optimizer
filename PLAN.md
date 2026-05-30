# Bridge Cost Optimizer — Execution Plan (Supervisor → Sub-Agent specs)

**Goal:** Given `(asset, amount, sourceChain, targetChain)`, return a **ranked list of bridge routes** by *net amount received*, after accounting for the three real fee layers — source-chain gas, destination-chain gas, protocol fee/spread + slippage — plus an ETA per route.

**Role fit (Durazno – Airdrop Hunter & Tester):** "route liquidity between chains without bleeding capital to slippage, bad rates, or bridge fees." Doubles as a **QA tool** (flags when a route's fee is unreasonable).

**Safety classification:** This project is **quote/read-only**. No wallets, no signing, no funds move. Every task below is `[mechanical]` — safe to build at full speed.

---

## Decisions (MY CALLS — redline anything before we build)

| # | Decision | My call | Why |
|---|---|---|---|
| D1 | Frontend | **React + TypeScript + Vite** | Your strength (Golden Quill, SyncUp); fast dev server |
| D2 | Backend | **Node + TypeScript + Express** | Your strength; trivial REST |
| D3 | Bridge data source | **LI.FI API** (primary) + **mock adapter** (fallback/demo) | LI.FI aggregates many bridges (Across, Stargate, Hop, CCTP…) behind ONE API and returns gas + fee estimates per route. One integration → many routes. Mock lets us build/demo with zero network. |
| D4 | Gas estimates | Use **LI.FI's per-route gas cost** fields for v1 | Avoids a separate gas oracle; LI.FI already returns `gasCostUSD` per step |
| D5 | Persistence | **None** for v1 (stateless) + **in-memory TTL cache** | Quotes are ephemeral; no DB needed |
| D6 | Ranking metric | **net received in target token**, tie-break by **ETA** | "Preserve the most capital" = the literal job mandate |
| D7 | Chains for v1 | ETH, Arbitrum, Optimism, Base, Polygon, BNB | Covers the job's "ETH/ARB/BNB across networks" |
| D8 | Auth/keys | **None** (LI.FI quote endpoints are keyless for read) | Keeps it zero-secret, zero-risk |

If you're good with all 8, we build. Change any cell and I adapt the specs.

---

## Architecture (supervisor orchestrates concrete modules — not roleplay)

```
React UI  ──GET /api/routes?from&to&token&amount──►  Express API
                                                        │
                                              routeService (SUPERVISOR)
                                                        │
                        ┌───────────────┬───────────────┼──────────────┐
                  lifiAdapter      mockAdapter        cache         costEngine
                  (real quotes)   (fixtures)       (TTL memo)     (3-layer fee math
                                                                   + ranking)
```

The **Supervisor** = `routeService.ts`: takes a query, checks cache, calls the active adapter, pipes raw routes through `costEngine`, returns ranked results. Sub-agents are the files below; each spec is explicit enough to build mechanically.

---

## Data model (`src/types.ts`) — build this FIRST, both sides import it

```ts
export type Chain = 'ethereum'|'arbitrum'|'optimism'|'base'|'polygon'|'bsc';

export interface RouteQuery {
  fromChain: Chain;
  toChain: Chain;
  token: string;        // symbol, e.g. 'USDC'
  amount: number;       // human units, e.g. 1000
}

export interface FeeBreakdown {
  sourceGasUsd: number;       // layer 1
  destGasUsd: number;         // layer 2
  protocolFeeUsd: number;     // layer 3 (bridge cut + spread/slippage)
}

export interface RouteQuote {
  bridge: string;             // 'across' | 'stargate' | 'cctp' | ...
  amountInUsd: number;
  amountOutUsd: number;       // net received, USD
  amountOutToken: number;     // net received, target token units
  fees: FeeBreakdown;
  totalCostUsd: number;       // sum of 3 layers
  effectiveCostBps: number;   // totalCost / amountIn * 10000  ← the QA signal
  etaSeconds: number;
  flagged: boolean;           // true if effectiveCostBps > FLAG_THRESHOLD (QA)
}
```

---

## Sub-agent task specs (each is `[mechanical]`)

### T1 — `src/types.ts`  `[mechanical]`
Create the interfaces above verbatim. **Acceptance:** compiles; imported by T2–T6.

### T2 — `src/adapters/mock.ts`  `[mechanical]`
Export `getMockRoutes(q: RouteQuery): RawRoute[]` returning 4 deterministic routes (across, stargate, cctp, hop) with plausible numbers that VARY by amount (fees scale, gas fixed). No network.
**Acceptance:** `getMockRoutes({...,amount:1000})` returns 4 routes; larger amount → larger protocolFee, same gas.

### T3 — `src/core/costEngine.ts`  `[mechanical]`  ← the "secret sauce"
Export `normalize(raw: RawRoute, q): RouteQuote` and `rank(quotes): RouteQuote[]`.
- Compute the 3 fee layers → `totalCostUsd`, `amountOutUsd`, `effectiveCostBps`.
- `flagged = effectiveCostBps > 100` (1%) — the QA "unreasonable fee" signal.
- `rank` sorts by `amountOutUsd` desc, tie-break `etaSeconds` asc.
**Acceptance:** unit test — given 4 fixed raws, ranking order + bps values match expected (write the test).

### T4 — `src/core/cache.ts`  `[mechanical]`
In-memory `Map` + TTL (60s). `get(key)`, `set(key,val)`, key = `${from}:${to}:${token}:${bucket(amount)}`.
**Acceptance:** second identical query within 60s does not call the adapter (assert via spy).

### T5 — `src/adapters/lifi.ts`  `[mechanical]`
Export `getLifiRoutes(q): Promise<RawRoute[]>` → GET `https://li.quest/v1/quote` (or `/routes`), map response steps → `RawRoute` (extract gasCostUSD, fee, toAmount, tool, estimate.executionDuration). Map our `Chain` → LI.FI chain IDs.
**Acceptance:** with a recorded LI.FI fixture, mapping yields valid `RawRoute[]`. (Tag `ADAPTER=mock|lifi` via env so demo never needs network.)

### T6 — `src/server.ts` + `src/routeService.ts`  `[mechanical]`
Express `GET /api/routes`; `routeService` = cache → adapter(env) → costEngine.rank. CORS on. Port 5050.
**Acceptance:** `curl '/api/routes?from=ethereum&to=arbitrum&token=USDC&amount=1000'` returns ranked JSON.

### T7 — `web/` React app  `[mechanical]`
Form (from, to, token, amount) → fetch `/api/routes` → ranked table: bridge, net received, **3-layer fee breakdown**, ETA, and a red badge when `flagged`. 
**Acceptance:** runs on `vite`, shows ranked routes from the mock backend end-to-end.

---

## Milestones

- **M1 — TODAY's vertical slice (all mock, no network):** T1 → T2 → T3 → T4 → T6 → T7. Result: type in 1000 USDC ETH→Arbitrum, see 4 ranked routes with fee breakdowns + QA flag, running in the browser. **This is the "something to show today."**
- **M2:** T5 — swap `ADAPTER=lifi` for real quotes.
- **M3:** polish — loading/error states, a written **QA findings note** (ties to the job: "logged that bridge X quoted a 3% fee on a $1k transfer — flagged unreasonable").

## Interview talking points (write into README at M3)
- The 3-layer fee decomposition (most people only see headline bridge fee).
- `effectiveCostBps` as an objective, comparable capital-preservation metric.
- The QA `flagged` signal = the "notice the unreasonable fee and log it" job requirement, automated.

---

## What I need from you
Redline the **Decisions** table (or say "go"). Then I execute M1 end-to-end and you'll have a running demo today.
