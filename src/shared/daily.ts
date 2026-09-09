/** Days since epoch, UTC. The track shape is derived from this. */
export function dayIndex(now: number = Date.now()): number {
  return Math.floor(now / 86400000)
}

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

const NAMES = ['Kestrel', 'Halcyon', 'Vermillion', 'Torrent', 'Cinder', 'Lantern', 'Meridian']

export function trackName(day: number): string {
  return NAMES[day % NAMES.length]
}
