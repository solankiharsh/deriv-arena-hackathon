/**
 * Collision-resistant id generator for client-side list keys.
 *
 * Several renderers previously built ids with just `Date.now()` (millisecond
 * precision). React 18 dev mode double-invokes state updaters, and multiple
 * phantoms / decoys can also fire inside the same tick, so two entries would
 * land on the same millisecond and produce identical keys. That triggers
 * React's "Encountered two children with the same key" warning and can cause
 * duplicated / omitted list items.
 *
 * This helper layers three cheap sources of entropy:
 *   - `Date.now()` for readability / debugging
 *   - a process-local monotonic counter so repeated calls in the same ms diverge
 *   - a short crypto-random suffix (falls back to `Math.random()` in old runtimes)
 *
 * Do NOT use this for anything security-sensitive (tokens, session ids, etc).
 * It is purely for ephemeral UI list keys.
 */

let _counter = 0;

function _randomSuffix(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0].toString(36);
    }
  } catch {
    // ignore and fall through to Math.random fallback
  }
  // Non-security fallback: only used when Web Crypto is unavailable.
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Generate a unique id for ephemeral UI state.
 * @param prefix optional stable prefix (e.g. "st", "decoy", "ai")
 */
export function uniqueId(prefix?: string): string {
  _counter = (_counter + 1) >>> 0;
  const base = `${Date.now()}-${_counter.toString(36)}-${_randomSuffix()}`;
  return prefix ? `${prefix}-${base}` : base;
}
