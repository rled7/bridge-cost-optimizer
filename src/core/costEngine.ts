// Cost engine (T3) — THE secret sauce. Turns a raw route into a comparable quote by
// decomposing the true cost into 3 layers, then ranks by net capital preserved.

import type { RawRoute, RouteQuery, RouteQuote } from '../types.js';

/** Flag a route as "unreasonable fee" above this effective cost (QA signal for the job). */
export const FLAG_THRESHOLD_BPS = 100; // 1.00%

export function normalize(raw: RawRoute, q: RouteQuery): RouteQuote {
  const amountInUsd = round(q.amount * raw.tokenPriceUsd);
  const totalCostUsd = round(raw.sourceGasUsd + raw.destGasUsd + raw.protocolFeeUsd);
  const amountOutUsd = round(amountInUsd - totalCostUsd);
  const amountOutToken = round(amountOutUsd / raw.tokenPriceUsd);
  const effectiveCostBps = amountInUsd > 0 ? round((totalCostUsd / amountInUsd) * 10000) : 0;

  return {
    bridge: raw.bridge,
    amountInUsd,
    amountOutUsd,
    amountOutToken,
    fees: {
      sourceGasUsd: raw.sourceGasUsd,
      destGasUsd: raw.destGasUsd,
      protocolFeeUsd: raw.protocolFeeUsd,
    },
    totalCostUsd,
    effectiveCostBps,
    etaSeconds: raw.etaSeconds,
    flagged: effectiveCostBps > FLAG_THRESHOLD_BPS,
  };
}

/**
 * Rank by net received (capital preserved) desc; tie-break by ETA asc.
 */
export function rank(quotes: RouteQuote[]): RouteQuote[] {
  return [...quotes].sort(
    (a, b) => b.amountOutUsd - a.amountOutUsd || a.etaSeconds - b.etaSeconds
  );
}

const round = (n: number): number => Math.round(n * 100) / 100;
