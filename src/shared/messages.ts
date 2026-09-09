import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

/**
 * Registered once at module load on both sides. Clients never talk to each
 * other; everything authoritative (progress, overtakes, score) is decided by
 * the server from verified positions, so the client sends almost nothing.
 */
export const Messages = {
  // Client -> Server
  join: Schemas.Map({ name: Schemas.String }),

  // Server -> Client
  ready: Schemas.Map({ day: Schemas.Int, trackName: Schemas.String }),
  ghost: Schemas.Map({
    slot: Schemas.Int,
    total: Schemas.Int,
    address: Schemas.String,
    name: Schemas.String,
    score: Schemas.Int,
    path: Schemas.String
  }),
  runState: Schemas.Map({
    address: Schemas.String,
    running: Schemas.Boolean,
    remaining: Schemas.Float,
    metres: Schemas.Float,
    overtakes: Schemas.Int,
    heat: Schemas.Float,
    score: Schemas.Int
  }),
  runEnded: Schemas.Map({
    address: Schemas.String,
    score: Schemas.Int,
    best: Schemas.Int,
    isBest: Schemas.Boolean,
    beat: Schemas.Array(Schemas.String),
    rank: Schemas.Int
  }),
  leaderboard: Schemas.Map({ rows: Schemas.Array(Schemas.String) })
}

export const room = registerMessages(Messages)
