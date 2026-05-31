// Supervisor (T6) — orchestrates cache -> adapter -> costEngine. The adapter is
// selected by env (ADAPTER=mock|lifi). M2 adds the LI.FI adapter.

import { getMockRoutes } from './adapters/mock.js';
import { getLifiRoutes } from './adapters/lifi.js';
import * as cache from './core/cache.js';
import { normalize, rank } from './core/costEngine.js';
import type { RouteQuery, RouteQuote, RawRoute } from './types.js';

type AdapterFn = (q: RouteQuery) => RawRoute[] | Promise<RawRoute[]>;

/** Pick the active adapter. Defaults to mock so the demo never needs network. */
function getAdapter(): AdapterFn {
  const name = (process.env.ADAPTER || 'mock').toLowerCase();
  switch (name) {
    case 'lifi':
      return getLifiRoutes;
    case 'mock':
    default:
      return getMockRoutes;
  }
}

export interface RoutesResult {
  query: RouteQuery;
  routes: RouteQuote[];
  count: number;
}

export async function getRoutes(q: RouteQuery): Promise<RoutesResult> {
  const key = cache.keyFor(q);
  const cached = cache.get(key);
  if (cached) return { query: q, routes: cached, count: cached.length };

  const adapter = getAdapter();
  const raw = await adapter(q);
  const routes = rank(raw.map((r) => normalize(r, q)));

  cache.set(key, routes);
  return { query: q, routes, count: routes.length };
}
