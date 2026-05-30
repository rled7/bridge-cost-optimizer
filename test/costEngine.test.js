// Unit test (T3 acceptance) — runs with bare `node test/costEngine.test.js`, no deps.
import assert from 'node:assert/strict';
import { getMockRoutes } from '../src/adapters/mock.js';
import { normalize, rank, FLAG_THRESHOLD_BPS } from '../src/core/costEngine.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

console.log('costEngine');

t('normalize decomposes 3 fee layers and computes net + bps', () => {
  const raw = { bridge: 'x', sourceGasUsd: 4, destGasUsd: 1, protocolFeeUsd: 5, tokenPriceUsd: 1, etaSeconds: 100 };
  const q = { fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 1000 };
  const out = normalize(raw, q);
  assert.equal(out.totalCostUsd, 10);
  assert.equal(out.amountInUsd, 1000);
  assert.equal(out.amountOutUsd, 990);
  assert.equal(out.effectiveCostBps, 100); // 10/1000*10000
  assert.equal(out.flagged, false);        // exactly at threshold, not over
});

t('flags routes whose effective cost exceeds threshold', () => {
  const raw = { bridge: 'pricey', sourceGasUsd: 20, destGasUsd: 5, protocolFeeUsd: 10, tokenPriceUsd: 1, etaSeconds: 100 };
  const q = { fromChain: 'ethereum', toChain: 'base', token: 'USDC', amount: 1000 };
  const out = normalize(raw, q);
  assert.ok(out.effectiveCostBps > FLAG_THRESHOLD_BPS);
  assert.equal(out.flagged, true);
});

t('rank orders by net received desc, tie-break eta asc', () => {
  const q = { fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 1000 };
  const quotes = getMockRoutes(q).map((r) => normalize(r, q));
  const ranked = rank(quotes);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].amountOutUsd >= ranked[i].amountOutUsd, 'net received must be non-increasing');
  }
});

t('protocol fee scales with amount; gas stays fixed', () => {
  const small = getMockRoutes({ fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 100 });
  const big = getMockRoutes({ fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 100000 });
  const sAcross = small.find((r) => r.bridge === 'across');
  const bAcross = big.find((r) => r.bridge === 'across');
  assert.ok(bAcross.protocolFeeUsd > sAcross.protocolFeeUsd, 'fee scales with amount');
  assert.equal(bAcross.sourceGasUsd, sAcross.sourceGasUsd, 'gas fixed regardless of amount');
});

console.log(`\n${passed} passed`);
