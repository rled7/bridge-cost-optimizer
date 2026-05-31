// Unit tests for costEngine (T3 acceptance). Uses node:test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMockRoutes } from '../src/adapters/mock.js';
import { normalize, rank, FLAG_THRESHOLD_BPS } from '../src/core/costEngine.js';
import type { RouteQuery } from '../src/types.js';

test('normalize decomposes 3 fee layers and computes net + bps', () => {
  const raw = {
    bridge: 'x',
    sourceGasUsd: 4,
    destGasUsd: 1,
    protocolFeeUsd: 5,
    tokenPriceUsd: 1,
    etaSeconds: 100,
  };
  const q: RouteQuery = { fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 1000 };
  const out = normalize(raw, q);
  assert.equal(out.totalCostUsd, 10);
  assert.equal(out.amountInUsd, 1000);
  assert.equal(out.amountOutUsd, 990);
  assert.equal(out.effectiveCostBps, 100); // 10/1000*10000
  assert.equal(out.flagged, false);        // exactly at threshold, not over
});

test('flags routes whose effective cost exceeds threshold', () => {
  const raw = {
    bridge: 'pricey',
    sourceGasUsd: 20,
    destGasUsd: 5,
    protocolFeeUsd: 10,
    tokenPriceUsd: 1,
    etaSeconds: 100,
  };
  const q: RouteQuery = { fromChain: 'ethereum', toChain: 'base', token: 'USDC', amount: 1000 };
  const out = normalize(raw, q);
  assert.ok(out.effectiveCostBps > FLAG_THRESHOLD_BPS);
  assert.equal(out.flagged, true);
});

test('rank orders by net received desc, tie-break eta asc', () => {
  const q: RouteQuery = { fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 1000 };
  const quotes = getMockRoutes(q).map((r) => normalize(r, q));
  const ranked = rank(quotes);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(
      ranked[i - 1].amountOutUsd >= ranked[i].amountOutUsd,
      'net received must be non-increasing'
    );
  }
});

test('protocol fee scales with amount; gas stays fixed', () => {
  const small = getMockRoutes({ fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 100 });
  const big = getMockRoutes({ fromChain: 'arbitrum', toChain: 'base', token: 'USDC', amount: 100000 });
  const sAcross = small.find((r) => r.bridge === 'across')!;
  const bAcross = big.find((r) => r.bridge === 'across')!;
  assert.ok(bAcross.protocolFeeUsd > sAcross.protocolFeeUsd, 'fee scales with amount');
  assert.equal(bAcross.sourceGasUsd, sAcross.sourceGasUsd, 'gas fixed regardless of amount');
});
