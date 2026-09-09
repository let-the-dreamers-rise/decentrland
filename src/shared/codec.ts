/**
 * Ghost paths are stored and sent as strings, so they have to be compact:
 * a 30-second run is 150 samples, and a full roster of 16 ghosts travels to
 * every client on join.
 *
 * Each sample becomes 6 characters — x, y, z quantised to decimetres and
 * written as fixed-width base-36. That is 900 bytes per ghost, which keeps a
 * single ghost message far inside the ~13 KB transport limit.
 */

export type Sample = { x: number; y: number; z: number }

const WIDTH = 2
const MAX_UNIT = 36 * 36 - 1

function encodeUnit(metres: number): string {
  let units = Math.round(metres * 10)
  if (units < 0) units = 0
  else if (units > MAX_UNIT) units = MAX_UNIT
  const text = units.toString(36)
  return text.length >= WIDTH ? text : '0'.repeat(WIDTH - text.length) + text
}

export function encodePath(samples: Sample[]): string {
  let out = ''
  for (const sample of samples) {
    out += encodeUnit(sample.x) + encodeUnit(sample.y) + encodeUnit(sample.z)
  }
  return out
}

export function decodePath(encoded: string): Sample[] {
  const samples: Sample[] = []
  const stride = WIDTH * 3
  for (let i = 0; i + stride <= encoded.length; i += stride) {
    samples.push({
      x: parseInt(encoded.substr(i, WIDTH), 36) / 10,
      y: parseInt(encoded.substr(i + WIDTH, WIDTH), 36) / 10,
      z: parseInt(encoded.substr(i + WIDTH * 2, WIDTH), 36) / 10
    })
  }
  return samples
}
