// Shared types for the Bridge Cost Optimizer — TypeScript version (M2 port of types.js).

export type Chain = 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'polygon' | 'bsc';

export interface RouteQuery {
  fromChain: Chain;
  toChain: Chain;
  token: string;   // symbol, e.g. 'USDC'
  amount: number;  // human units, e.g. 1000
}

/**
 * Raw route as returned by an adapter (mock or LI.FI), before cost normalization.
 */
export interface RawRoute {
  bridge: string;
  sourceGasUsd: number;    // Layer 1: cost to initiate on source chain
  destGasUsd: number;      // Layer 2: cost for relayer/contract on dest chain
  protocolFeeUsd: number;  // Layer 3: bridge cut + spread/slippage
  tokenPriceUsd: number;   // Price used to convert token<->USD (1 for stables)
  etaSeconds: number;
}

export interface FeeBreakdown {
  sourceGasUsd: number;
  destGasUsd: number;
  protocolFeeUsd: number;
}

export interface RouteQuote {
  bridge: string;
  amountInUsd: number;
  amountOutUsd: number;       // net received, USD
  amountOutToken: number;     // net received, target token units
  fees: FeeBreakdown;
  totalCostUsd: number;       // sum of 3 layers
  effectiveCostBps: number;   // totalCost / amountIn * 10000 — the QA signal
  etaSeconds: number;
  flagged: boolean;           // true if effectiveCostBps > FLAG_THRESHOLD_BPS
}
