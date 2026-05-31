// LI.FI fixture mapping test — exercises mapLifiResponse without any network call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mapLifiResponse } from '../src/adapters/lifi.js';
import type { LifiQuoteResponse } from '../src/adapters/lifi.js';
import type { RouteQuery } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'lifi-eth-arb-usdc-1000.json');

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as LifiQuoteResponse;

const q: RouteQuery = {
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  token: 'USDC',
  amount: 1000,
};

test('mapLifiResponse returns a non-empty RawRoute array', () => {
  const routes = mapLifiResponse(fixture, q);
  assert.ok(routes.length > 0, 'should return at least one route');
});

test('each mapped RawRoute has required numeric fields', () => {
  const routes = mapLifiResponse(fixture, q);
  for (const r of routes) {
    assert.ok(typeof r.bridge === 'string' && r.bridge.length > 0, 'bridge name present');
    assert.ok(typeof r.sourceGasUsd === 'number' && r.sourceGasUsd >= 0, 'sourceGasUsd >= 0');
    assert.ok(typeof r.destGasUsd === 'number' && r.destGasUsd >= 0, 'destGasUsd >= 0');
    assert.ok(typeof r.protocolFeeUsd === 'number' && r.protocolFeeUsd >= 0, 'protocolFeeUsd >= 0');
    assert.ok(typeof r.tokenPriceUsd === 'number' && r.tokenPriceUsd > 0, 'tokenPriceUsd > 0');
    assert.ok(typeof r.etaSeconds === 'number' && r.etaSeconds > 0, 'etaSeconds > 0');
  }
});

test('bridge name is extracted correctly from toolDetails.name', () => {
  const routes = mapLifiResponse(fixture, q);
  // The fixture has toolDetails.name = "Across" in includedSteps
  const bridgeNames = routes.map((r) => r.bridge.toLowerCase());
  assert.ok(
    bridgeNames.some((n) => n.includes('across') || n.length > 0),
    `expected a named bridge, got: ${bridgeNames.join(', ')}`
  );
});

test('sourceGasUsd is sum of estimate.gasCosts[].amountUSD from fixture', () => {
  // Fixture has one gasCost with amountUSD = "16.00"
  const routes = mapLifiResponse(fixture, q);
  const across = routes.find((r) => r.bridge.toLowerCase().includes('across'));
  assert.ok(across, 'Across route found');
  // The fixture gas cost is $16.00
  assert.equal(across!.sourceGasUsd, 16.0);
});

test('protocolFeeUsd is sum of estimate.feeCosts[].amountUSD from fixture', () => {
  // Fixture has one feeCost with amountUSD = "0.60"
  const routes = mapLifiResponse(fixture, q);
  const across = routes.find((r) => r.bridge.toLowerCase().includes('across'));
  assert.ok(across, 'Across route found');
  assert.equal(across!.protocolFeeUsd, 0.6);
});

test('destGasUsd defaults to 0 (not exposed by LI.FI)', () => {
  const routes = mapLifiResponse(fixture, q);
  for (const r of routes) {
    assert.equal(r.destGasUsd, 0, 'destGasUsd should be 0 (LI.FI does not expose it separately)');
  }
});
