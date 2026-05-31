// LI.FI adapter (T5) — fetches real bridge quotes from https://li.quest/v1/quote
// and maps the response to RawRoute[]. Set ADAPTER=lifi to enable.
// The demo defaults to ADAPTER=mock so no network is required.

import type { RouteQuery, RawRoute, Chain } from '../types.js';

/** Map our Chain identifiers to LI.FI chain IDs. */
const CHAIN_IDS: Record<Chain, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
  bsc: 56,
};

/** USDC has 6 decimals on most chains; for LI.FI we pass fromAmount as integer (micro-units). */
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
};

// ---- LI.FI response shape (partial — only fields we use) ----

interface LifiGasCost {
  amountUSD: string;
}

interface LifiFeeCost {
  amountUSD: string;
}

interface LifiEstimate {
  toAmount: string;
  toAmountUSD: string;
  gasCosts?: LifiGasCost[];
  feeCosts?: LifiFeeCost[];
  executionDuration: number;
}

interface LifiToolDetails {
  name: string;
}

export interface LifiQuoteResponse {
  tool?: string;
  toolDetails?: LifiToolDetails;
  estimate: LifiEstimate;
  includedSteps?: Array<{
    tool?: string;
    toolDetails?: LifiToolDetails;
    estimate: LifiEstimate;
  }>;
}

/**
 * Pure mapping function — maps a LI.FI /v1/quote response to RawRoute[].
 * Exported so the fixture test can exercise mapping without network.
 *
 * LI.FI /v1/quote returns a single best route. We map the top-level quote
 * (and each includedStep if present) to individual RawRoute entries.
 * destGasUsd defaults to 0 — LI.FI does not expose destination gas separately.
 */
export function mapLifiResponse(json: LifiQuoteResponse, q: RouteQuery): RawRoute[] {
  // Use the tokenPriceUsd = 1 for stables; we compute from toAmountUSD / toAmount
  // but fall back to 1 for recognized stable tokens.
  const tokenPriceUsd = 1;

  // Collect all steps to map (prefer includedSteps if present for granularity,
  // otherwise fall back to the top-level quote as a single route).
  type StepLike = {
    tool?: string;
    toolDetails?: LifiToolDetails;
    estimate: LifiEstimate;
  };

  const steps: StepLike[] =
    json.includedSteps && json.includedSteps.length > 0
      ? json.includedSteps
      : [json];

  const routes: RawRoute[] = steps.map((step) => {
    const est = step.estimate;
    const bridgeName =
      step.toolDetails?.name ?? step.tool ?? json.toolDetails?.name ?? json.tool ?? 'unknown';

    // Sum all gas costs (source chain)
    const sourceGasUsd = (est.gasCosts ?? []).reduce(
      (sum, g) => sum + parseFloat(g.amountUSD || '0'),
      0
    );

    // Sum all protocol / LP fees
    const protocolFeeUsd = (est.feeCosts ?? []).reduce(
      (sum, f) => sum + parseFloat(f.amountUSD || '0'),
      0
    );

    // destGasUsd: LI.FI does not expose destination-chain gas separately — default 0
    const destGasUsd = 0;

    const etaSeconds = est.executionDuration ?? 120;

    return {
      bridge: bridgeName,
      sourceGasUsd: round(sourceGasUsd),
      destGasUsd: round(destGasUsd),
      protocolFeeUsd: round(protocolFeeUsd),
      tokenPriceUsd,
      etaSeconds,
    };
  });

  // Deduplicate by bridge name (keep first occurrence)
  const seen = new Set<string>();
  return routes.filter((r) => {
    if (seen.has(r.bridge)) return false;
    seen.add(r.bridge);
    return true;
  });
}

/**
 * Fetch live routes from LI.FI. Requires network (not called during tests).
 */
export async function getLifiRoutes(q: RouteQuery): Promise<RawRoute[]> {
  const decimals = TOKEN_DECIMALS[q.token.toUpperCase()] ?? 6;
  const fromAmount = Math.round(q.amount * Math.pow(10, decimals)).toString();
  const fromChainId = CHAIN_IDS[q.fromChain];
  const toChainId = CHAIN_IDS[q.toChain];

  if (!fromChainId || !toChainId) {
    throw new Error(`Unsupported chain: ${q.fromChain} or ${q.toChain}`);
  }

  const params = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken: q.token,
    toToken: q.token,
    fromAmount,
    fromAddress: '0x0000000000000000000000000000000000000001',
  });

  const url = `https://li.quest/v1/quote?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LI.FI API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as LifiQuoteResponse;
  return mapLifiResponse(json, q);
}

const round = (n: number): number => Math.round(n * 100) / 100;
