import { Color4 } from '@dcl/sdk/math'

/** 4x4 parcels: 64 x 64 m. The loop has to fit with room to weave. */
export const SCENE_SIZE = 64
export const CENTER = { x: 32, z: 32 }

/** One run. Short on purpose — see the GDD, this is the whole retention argument. */
export const RUN_SECONDS = 30
/** Gap between a run ending and the next one being armed. Kept tiny. */
export const RESET_SECONDS = 2

/** Server samples every player's verified position at this rate while they run. */
export const SAMPLE_HZ = 5
export const SAMPLE_MS = 1000 / SAMPLE_HZ
export const MAX_SAMPLES = RUN_SECONDS * SAMPLE_HZ

/** Ghost roster held in storage and replayed each run. */
export const MAX_GHOSTS = 16
export const LEADERBOARD_SIZE = 10

/** Overtaking a ghost adds Heat; Heat decays this fast and multiplies distance. */
export const HEAT_PER_OVERTAKE = 1
export const HEAT_DECAY_PER_SEC = 0.34
export const MAX_HEAT = 8
export const OVERTAKE_BONUS_METRES = 50

/** Track geometry. */
export const TRACK_RADIUS = 22
export const TRACK_POINTS = 64
export const TRACK_WIDTH = 5

export const COLORS = {
  floor: Color4.create(0.03, 0.035, 0.06, 1),
  track: Color4.create(0.10, 0.13, 0.22, 1),
  edge: Color4.create(0.20, 0.55, 0.95, 1),
  ghost: Color4.create(0.45, 0.75, 1.0, 0.5),
  ghostPassed: Color4.create(1.0, 0.45, 0.15, 1),
  heat: Color4.create(1.0, 0.55, 0.1, 1),
  you: Color4.create(0.3, 1.0, 0.7, 1)
}
