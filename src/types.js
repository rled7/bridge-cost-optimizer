// Shared types for the Bridge Cost Optimizer (JSDoc — gives editor type hints with no build step).
// M2 note: these become TypeScript interfaces when we port to the React/Express/TS stack (see PLAN.md D1/D2).

/** @typedef {'ethereum'|'arbitrum'|'optimism'|'base'|'polygon'|'bsc'} Chain */

/**
 * @typedef {Object} RouteQuery
 * @property {Chain}  fromChain
 * @property {Chain}  toChain
 * @property {string} token    Token symbol, e.g. 'USDC'
 * @property {number} amount   Human units, e.g. 1000
 */

/**
 * Raw route as returned by an adapter (mock or LI.FI), before cost normalization.
 * @typedef {Object} RawRoute
 * @property {string} bridge
 * @property {number} sourceGasUsd     Layer 1: cost to initiate on source chain
 * @property {number} destGasUsd       Layer 2: cost for relayer/contract on dest chain
 * @property {number} protocolFeeUsd   Layer 3: bridge cut + spread/slippage
 * @property {number} tokenPriceUsd    Price used to convert token<->USD (1 for stables)
 * @property {number} etaSeconds
 */

/**
 * @typedef {Object} FeeBreakdown
 * @property {number} sourceGasUsd
 * @property {number} destGasUsd
 * @property {number} protocolFeeUsd
 */

/**
 * Normalized, rankable quote.
 * @typedef {Object} RouteQuote
 * @property {string}       bridge
 * @property {number}       amountInUsd
 * @property {number}       amountOutUsd      Net received, USD
 * @property {number}       amountOutToken    Net received, target token units
 * @property {FeeBreakdown} fees
 * @property {number}       totalCostUsd      Sum of the 3 layers
 * @property {number}       effectiveCostBps  totalCost / amountIn * 10000  (the QA signal)
 * @property {number}       etaSeconds
 * @property {boolean}      flagged           effectiveCostBps > FLAG_THRESHOLD_BPS
 */

export {};
