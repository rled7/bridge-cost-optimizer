// Supervisor (T6) — orchestrates cache -> adapter -> costEngine. The adapter is
// selected by env (ADAPTER=mock|lifi). M1 ships the mock adapter; lifi lands in M2.

import { getMockRoutes } from './adapters/mock.js';
import * as cache from './core/cache.js';
import { normalize, rank } from './core/costEngine.js';

/** @typedef {import('./types.js').RouteQuery} RouteQuery */
/** @typedef {import('./types.js').RouteQuote} RouteQuote */

/** Pick the active adapter. Defaults to mock so the demo never needs network. */
function getAdapter() {
  const name = (process.env.ADAPTER || 'mock').toLowerCase();
  switch (name) {
    case 'mock':
      return getMockRoutes;
    // case 'lifi': return getLifiRoutes;  // M2 — src/adapters/lifi.js
    default:
      return getMockRoutes;
  }
}

/**
 * @param {RouteQuery} q
 * @returns {Promise<{ query: RouteQuery, routes: RouteQuote[], cached: boolean }>}
 */
export async function getRoutes(q) {
  const key = cache.keyFor(q);
  const cached = cache.get(key);
  if (cached) return { query: q, routes: cached, cached: true };

  const adapter = getAdapter();
  const raw = await adapter(q);
  const routes = rank(raw.map((r) => normalize(r, q)));

  cache.set(key, routes);
  return { query: q, routes, cached: false };
}
