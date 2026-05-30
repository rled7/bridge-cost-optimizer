// In-memory TTL cache (T4). Quotes are ephemeral; a short TTL avoids hammering the
// upstream adapter / API rate limits for repeated identical queries.

/** @typedef {import('../types.js').RouteQuery} RouteQuery */

const TTL_MS = 60_000;
const store = new Map(); // key -> { value, expires }

/** Bucket the amount so near-identical sizes share a cache entry. */
const bucket = (amount) => Math.round(amount / 100) * 100;

/**
 * @param {RouteQuery} q
 * @returns {string}
 */
export function keyFor(q) {
  return `${q.fromChain}:${q.toChain}:${q.token}:${bucket(q.amount)}`;
}

export function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function set(key, value) {
  store.set(key, { value, expires: Date.now() + TTL_MS });
}

export function clear() {
  store.clear();
}
