import * as C from './config'
import { hash32, makeRng } from './daily'

export type Point = { x: number; z: number }

export type Track = {
  /** Closed polyline, `points[0]` is the start line. */
  points: Point[]
  /** Cumulative arc length at each point. */
  cumulative: number[]
  /** Total loop length in metres. */
  length: number
  /** Pillars placed near the racing line to force weaving. */
  obstacles: Point[]
}

/**
 * The day's loop. A circle with per-day radial wobble, so the racing line moves
 * but the track is always a single closed loop you cannot get lost on.
 *
 * Both server and client call this with the same day and get the same track,
 * so the track itself never has to be sent over the wire.
 */
export function buildTrack(day: number): Track {
  const rng = makeRng(hash32(day, 0x7ac))

  // Three low-frequency harmonics keep the loop smooth and driveable.
  const waves = [
    { freq: 2, amp: 2.5 + rng() * 2.5, phase: rng() * Math.PI * 2 },
    { freq: 3, amp: 1.5 + rng() * 2.0, phase: rng() * Math.PI * 2 },
    { freq: 5, amp: 0.6 + rng() * 1.2, phase: rng() * Math.PI * 2 }
  ]

  const points: Point[] = []
  for (let i = 0; i < C.TRACK_POINTS; i++) {
    const angle = (i / C.TRACK_POINTS) * Math.PI * 2
    let radius = C.TRACK_RADIUS
    for (const wave of waves) radius += Math.sin(angle * wave.freq + wave.phase) * wave.amp
    points.push({
      x: C.CENTER.x + Math.cos(angle) * radius,
      z: C.CENTER.z + Math.sin(angle) * radius
    })
  }

  const cumulative: number[] = [0]
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length]
    cumulative.push(cumulative[i] + distance(points[i], next))
  }
  const length = cumulative[points.length]

  // Obstacles sit just off the centre line, alternating sides.
  const obstacles: Point[] = []
  for (let i = 0; i < 10; i++) {
    const index = Math.floor(rng() * C.TRACK_POINTS)
    const point = points[index]
    const normal = normalAt(points, index)
    const side = i % 2 === 0 ? 1 : -1
    const offset = (0.6 + rng() * 0.9) * side
    obstacles.push({ x: point.x + normal.x * offset, z: point.z + normal.z * offset })
  }

  return { points, cumulative, length, obstacles }
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/** Unit vector perpendicular to the track direction at `index`. */
export function normalAt(points: Point[], index: number): Point {
  const previous = points[(index - 1 + points.length) % points.length]
  const next = points[(index + 1) % points.length]
  const dx = next.x - previous.x
  const dz = next.z - previous.z
  const len = Math.sqrt(dx * dx + dz * dz) || 1
  return { x: -dz / len, z: dx / len }
}

/**
 * Arc length of the point on the loop closest to (x, z), i.e. how far round the
 * track somebody is. Also returns how far off the racing line they are, which is
 * what tells us whether they are actually on the track at all.
 */
export function project(track: Track, x: number, z: number): { progress: number; offset: number } {
  let bestProgress = 0
  let bestDistanceSq = Infinity

  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i]
    const b = track.points[(i + 1) % track.points.length]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const lengthSq = abx * abx + abz * abz || 1

    let t = ((x - a.x) * abx + (z - a.z) * abz) / lengthSq
    if (t < 0) t = 0
    else if (t > 1) t = 1

    const px = a.x + abx * t
    const pz = a.z + abz * t
    const dx = x - px
    const dz = z - pz
    const distanceSq = dx * dx + dz * dz

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestProgress = track.cumulative[i] + Math.sqrt(lengthSq) * t
    }
  }

  return { progress: bestProgress, offset: Math.sqrt(bestDistanceSq) }
}

/**
 * Unwraps lap crossings into a monotonically increasing distance.
 * Without this, crossing the start line reads as a huge backwards jump.
 */
export function accumulate(previous: number, next: number, loopLength: number): number {
  let delta = next - previous
  if (delta > loopLength / 2) delta -= loopLength
  else if (delta < -loopLength / 2) delta += loopLength
  return delta
}

/** World position at a given arc length, used to place ghosts and the start gate. */
export function positionAt(track: Track, arcLength: number): Point {
  const loop = track.length
  let target = arcLength % loop
  if (target < 0) target += loop

  for (let i = 0; i < track.points.length; i++) {
    const start = track.cumulative[i]
    const end = track.cumulative[i + 1]
    if (target <= end) {
      const t = (target - start) / (end - start || 1)
      const a = track.points[i]
      const b = track.points[(i + 1) % track.points.length]
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    }
  }
  return track.points[0]
}
