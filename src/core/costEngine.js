// Cost engine (T3) — THE secret sauce. Turns a raw route into a comparable quote by
// decomposing the true cost into 3 layers, then ranks by net capital preserved.

/** @typedef {import('../types.js').RawRoute} RawRoute */
/** @typedef {import('../types.js').RouteQuery} RouteQuery */
/** @typedef {import('../types.js').RouteQuote} RouteQuote */

/** Flag a route as "unreasonable fee" above this effective cost (QA signal for the job). */
export const FLAG_THRESHOLD_BPS = 100; // 1.00%

/**
 * @param {RawRoute} raw
 * @param {RouteQuery} q
 * @returns {RouteQuote}
 */
export function normalize(raw, q) {
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
 * @param {RouteQuote[]} quotes
 * @returns {RouteQuote[]}
 */
export function rank(quotes) {
  return [...quotes].sort(
    (a, b) => b.amountOutUsd - a.amountOutUsd || a.etaSeconds - b.etaSeconds
  );
}

const round = (n) => Math.round(n * 100) / 100;
