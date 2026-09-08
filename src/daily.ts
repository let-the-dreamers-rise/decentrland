/**
 * Everything that has to look identical on every client is derived from a seed
 * instead of being synced: the daily layout, and which nodes go live on a step.
 */

/** Days since the epoch. Rolls over at 00:00 UTC, which is what "daily grid" means here. */
export function dayIndex(now: number = Date.now()): number {
  return Math.floor(now / 86400000)
}

/** Cheap deterministic mix of a few integers into one 32-bit seed. */
export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const part of parts) {
    let value = part | 0
    for (let byte = 0; byte < 4; byte++) {
      h ^= value & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
      value >>>= 8
    }
  }
  return h >>> 0
}

/** xorshift32. Same seed, same sequence, on every client. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

/** Fisher-Yates over [0..count) using the supplied rng. */
export function shuffledIndices(count: number, rng: () => number): number[] {
  const order: number[] = []
  for (let i = 0; i < count; i++) order.push(i)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  return order
}

const GRID_NAMES = ['Ember', 'Halide', 'Cobalt', 'Quartz', 'Vellum', 'Static', 'Auric']

/** A human-readable name for today's grid, so returning players can tell the days apart. */
export function gridName(day: number): string {
  return GRID_NAMES[day % GRID_NAMES.length]
}
