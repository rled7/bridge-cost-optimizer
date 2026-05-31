// Mock adapter (T2) — deterministic routes for offline dev/demo. No network.
// Fees VARY by amount (protocol fee scales; gas is fixed per bridge). Source gas is
// multiplied on Ethereum L1 to reflect real-world expense — this makes the "cheapest
// route depends on transfer size" lesson visible in the demo.

import type { RouteQuery, RawRoute } from '../types.js';

interface BridgeBase {
  bridge: string;
  sourceGasUsd: number;
  destGasUsd: number;
  feeRate: number;
  etaSeconds: number;
}

const BASE: BridgeBase[] = [
  // bridge,    srcGas, dstGas, feeRate (of amount), eta(s)
  { bridge: 'across',   sourceGasUsd: 4.0, destGasUsd: 0.5, feeRate: 0.0006, etaSeconds: 120 },
  { bridge: 'stargate', sourceGasUsd: 5.0, destGasUsd: 0.8, feeRate: 0.0010, etaSeconds: 90  },
  { bridge: 'cctp',     sourceGasUsd: 6.0, destGasUsd: 1.0, feeRate: 0.0001, etaSeconds: 900 },
  { bridge: 'hop',      sourceGasUsd: 4.5, destGasUsd: 0.6, feeRate: 0.0018, etaSeconds: 300 },
];

export function getMockRoutes(q: RouteQuery): RawRoute[] {
  // Ethereum L1 source gas is dramatically more expensive than L2s.
  const srcMultiplier = q.fromChain === 'ethereum' ? 4 : 1;
  const dstMultiplier = q.toChain === 'ethereum' ? 4 : 1;
  const tokenPriceUsd = 1; // M1 assumes a USD-pegged token (USDC). Real prices arrive with the LI.FI adapter.

  return BASE.map((b) => ({
    bridge: b.bridge,
    sourceGasUsd: round(b.sourceGasUsd * srcMultiplier),
    destGasUsd: round(b.destGasUsd * dstMultiplier),
    protocolFeeUsd: round(q.amount * tokenPriceUsd * b.feeRate),
    tokenPriceUsd,
    etaSeconds: b.etaSeconds,
  }));
}

const round = (n: number): number => Math.round(n * 100) / 100;
