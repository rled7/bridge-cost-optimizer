// In-memory TTL cache (T4). Quotes are ephemeral; a short TTL avoids hammering the
// upstream adapter / API rate limits for repeated identical queries.

import type { RouteQuery, RouteQuote } from '../types.js';

const TTL_MS = 60_000;

interface CacheEntry {
  value: RouteQuote[];
  expires: number;
}

const store = new Map<string, CacheEntry>(); // key -> { value, expires }

/** Bucket the amount so near-identical sizes share a cache entry. */
const bucket = (amount: number): number => Math.round(amount / 100) * 100;

export function keyFor(q: RouteQuery): string {
  return `${q.fromChain}:${q.toChain}:${q.token}:${bucket(q.amount)}`;
}

export function get(key: string): RouteQuote[] | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function set(key: string, value: RouteQuote[]): void {
  store.set(key, { value, expires: Date.now() + TTL_MS });
}

export function clear(): void {
  store.clear();
}
