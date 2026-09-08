import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

/** The scene is 2x2 parcels (32 x 32 m). Everything is built around the centre. */
export const ARENA_SIZE = 32
export const ARENA_CENTER = Vector3.create(16, 0, 16)

/** Two rings of charge nodes. Outer ring is the running lane, inner ring the risky one. */
export const OUTER_RING = { count: 8, radius: 11 }
export const INNER_RING = { count: 4, radius: 5.5 }

/** How close (horizontally) an avatar has to be for a node to count as occupied. */
export const NODE_RADIUS = 1.6

/** Charge timings, in seconds. */
export const CHARGE_SECONDS = 1.4
export const LINK_CHARGE_SECONDS = 1.0
export const STEP_TIMEOUT = 12

/** Round structure. */
export const ROUND_SECONDS = 90
export const INTERMISSION_SECONDS = 12
export const TARGET_VOLTAGE = 100

/** Scoring. */
export const BASE_VOLTAGE = 6
export const LINK_VOLTAGE = 18
export const CHAIN_WINDOW = 5
export const MAX_MULTIPLIER = 5

/** How many solo nodes are live at once, by number of players in the scene. */
export function liveNodeCount(players: number): number {
  return Math.max(2, Math.min(5, 1 + players))
}

export const COLORS = {
  dormant: Color4.create(0.08, 0.1, 0.18, 1),
  live: Color4.create(1.0, 0.62, 0.15, 1),
  link: Color4.create(0.95, 0.25, 0.85, 1),
  charged: Color4.create(0.25, 0.95, 1.0, 1),
  floor: Color4.create(0.03, 0.04, 0.07, 1),
  wall: Color4.create(0.06, 0.08, 0.14, 1),
  core: Color4.create(0.25, 0.95, 1.0, 1)
}

/** PBR materials want an emissive Color3 while our palette is Color4. */
export function emissive(color: Color4): Color3 {
  return Color3.create(color.r, color.g, color.b)
}
