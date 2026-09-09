import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Storage } from '@dcl/sdk/server'
import * as C from '../shared/config'
import { dayIndex, trackName } from '../shared/daily'
import { room } from '../shared/messages'
import { accumulate, buildTrack, project, Track } from '../shared/track'
import { decodePath, encodePath, Sample } from '../shared/codec'
import { fetchLook, packLook } from '../shared/look'

type StoredGhost = {
  address: string
  name: string
  score: number
  path: string
  day: number
  /** Packed wearables of the player who set the run. */
  look: string
}

type Ghost = StoredGhost & {
  /** Cumulative metres run at each sample index, precomputed for overtake checks. */
  metres: number[]
}

type Runner = {
  address: string
  name: string
  running: boolean
  /** Seconds elapsed in the current run. */
  elapsed: number
  /** Seconds until this player can start another run. */
  cooldown: number
  lastProgress: number
  metres: number
  score: number
  overtakes: number
  heat: number
  samples: Sample[]
  sampleTimer: number
  /** Per-ghost "player is currently ahead" flag, keyed by ghost index. */
  ahead: boolean[]
  passed: Set<string>
  best: number
  bestLoaded: boolean
  broadcastTimer: number
}

const day = dayIndex()
const track: Track = buildTrack(day)
const ghosts: Ghost[] = []
const runners = new Map<string, Runner>()
let board: Array<{ name: string; score: number }> = []

const START = track.points[0]

export function initServer(): void {
  void loadState()

  room.onMessage('join', (data, context) => {
    if (!context) return
    const runner = ensureRunner(context.from)
    if (data.name) runner.name = data.name.slice(0, 24)
    sendWelcome(context.from)
  })

  engine.addSystem(update)
}

/* ---------------------------------------------------------------- *
 * Persistence
 * ---------------------------------------------------------------- */

async function loadState(): Promise<void> {
  for (let slot = 0; slot < C.MAX_GHOSTS; slot++) {
    const stored = await Storage.get<StoredGhost>(`ghost:${slot}`)
    if (stored && stored.path) ghosts.push(hydrate(stored))
  }
  ghosts.sort((a, b) => b.score - a.score)

  const storedBoard = await Storage.get<Array<{ name: string; score: number }>>('board')
  if (storedBoard) board = storedBoard

  console.log(`[relay] loaded ${ghosts.length} ghosts, ${board.length} board rows`)
}

/** Precomputes the cumulative distance a ghost had run at each sample. */
function hydrate(stored: StoredGhost): Ghost {
  const samples = decodePath(stored.path)
  const metres: number[] = []
  let total = 0
  let previous = project(track, samples[0]?.x ?? START.x, samples[0]?.z ?? START.z).progress

  for (const sample of samples) {
    const current = project(track, sample.x, sample.z).progress
    total += Math.max(0, accumulate(previous, current, track.length))
    previous = current
    metres.push(total)
  }

  return { ...stored, metres }
}

async function persistGhost(slot: number, ghost: StoredGhost): Promise<void> {
  const saved = await Storage.set(`ghost:${slot}`, ghost)
  if (!saved) console.error(`[relay] ghost ${slot} did not persist`)
}

async function persistBoard(): Promise<void> {
  const saved = await Storage.set('board', board)
  if (!saved) console.error('[relay] leaderboard did not persist')
}

/* ---------------------------------------------------------------- *
 * Runner bookkeeping
 * ---------------------------------------------------------------- */

function ensureRunner(address: string): Runner {
  let runner = runners.get(address)
  if (runner) return runner

  runner = {
    address,
    name: shortAddress(address),
    running: false,
    elapsed: 0,
    cooldown: 0,
    lastProgress: 0,
    metres: 0,
    score: 0,
    overtakes: 0,
    heat: 0,
    samples: [],
    sampleTimer: 0,
    ahead: [],
    passed: new Set<string>(),
    best: 0,
    bestLoaded: false,
    broadcastTimer: 0
  }
  runners.set(address, runner)

  void Storage.player.get<number>(address, 'best').then((best) => {
    runner!.best = best ?? 0
    runner!.bestLoaded = true
  })

  return runner
}

function shortAddress(address: string): string {
  return address.length > 8 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function sendWelcome(address: string): void {
  room.send('ready', { day, trackName: trackName(day) }, { to: [address] })
  ghosts.forEach((ghost, slot) => {
    room.send(
      'ghost',
      {
        slot,
        total: ghosts.length,
        address: ghost.address,
        name: ghost.name,
        score: ghost.score,
        path: ghost.path,
        look: ghost.look
      },
      { to: [address] }
    )
  })
  sendBoard([address])
}

function sendBoard(to?: string[]): void {
  const rows = board.map((row) => `${row.name}|${row.score}`)
  if (to) room.send('leaderboard', { rows }, { to })
  else room.send('leaderboard', { rows })
}

/* ---------------------------------------------------------------- *
 * Frame update — the whole game runs here, from verified positions
 * ---------------------------------------------------------------- */

function update(dt: number): void {
  const seen = new Set<string>()

  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    const transform = Transform.getOrNull(entity)
    if (!transform) continue

    const address = identity.address
    seen.add(address)
    const runner = ensureRunner(address)
    const position = transform.position

    if (runner.running) advanceRun(runner, position, dt)
    else waitToStart(runner, position, dt)
  }

  for (const address of runners.keys()) {
    if (!seen.has(address)) runners.delete(address)
  }
}

function waitToStart(runner: Runner, position: { x: number; y: number; z: number }, dt: number): void {
  if (runner.cooldown > 0) {
    runner.cooldown -= dt
    return
  }

  const dx = position.x - START.x
  const dz = position.z - START.z
  if (dx * dx + dz * dz > 16) return // 4 m start gate

  runner.running = true
  runner.elapsed = 0
  runner.metres = 0
  runner.score = 0
  runner.overtakes = 0
  runner.heat = 0
  runner.samples = []
  runner.sampleTimer = 0
  runner.passed.clear()
  runner.ahead = ghosts.map(() => false)
  runner.lastProgress = project(track, position.x, position.z).progress
}

function advanceRun(runner: Runner, position: { x: number; y: number; z: number }, dt: number): void {
  runner.elapsed += dt

  // Distance travelled along the loop since the last frame. Going backwards
  // earns nothing, but it does not subtract either.
  const projected = project(track, position.x, position.z)
  const delta = accumulate(runner.lastProgress, projected.progress, track.length)
  runner.lastProgress = projected.progress

  // Only count progress made near the racing line, so cutting across the
  // middle of the loop does not score.
  const onTrack = projected.offset <= C.TRACK_WIDTH
  if (onTrack && delta > 0) {
    runner.metres += delta
    runner.score += delta * (1 + runner.heat * 0.25)
  }

  runner.heat = Math.max(0, runner.heat - C.HEAT_DECAY_PER_SEC * dt)

  checkOvertakes(runner)

  runner.sampleTimer += dt * 1000
  if (runner.sampleTimer >= C.SAMPLE_MS && runner.samples.length < C.MAX_SAMPLES) {
    runner.sampleTimer = 0
    runner.samples.push({ x: position.x, y: position.y, z: position.z })
  }

  runner.broadcastTimer += dt
  if (runner.broadcastTimer >= 0.2) {
    runner.broadcastTimer = 0
    room.send(
      'runState',
      {
        address: runner.address,
        running: true,
        remaining: Math.max(0, C.RUN_SECONDS - runner.elapsed),
        metres: runner.metres,
        overtakes: runner.overtakes,
        heat: runner.heat,
        score: Math.round(runner.score)
      },
      { to: [runner.address] }
    )
  }

  if (runner.elapsed >= C.RUN_SECONDS) void finishRun(runner)
}

/** A ghost is overtaken when the player's distance crosses above the ghost's. */
function checkOvertakes(runner: Runner): void {
  const index = Math.min(C.MAX_SAMPLES - 1, Math.floor(runner.elapsed * C.SAMPLE_HZ))

  for (let i = 0; i < ghosts.length; i++) {
    const ghost = ghosts[i]
    const ghostMetres = ghost.metres[Math.min(index, ghost.metres.length - 1)] ?? 0

    if (!runner.ahead[i] && runner.metres > ghostMetres + 1.5) {
      runner.ahead[i] = true
      runner.overtakes++
      runner.heat = Math.min(C.MAX_HEAT, runner.heat + C.HEAT_PER_OVERTAKE)
      runner.score += C.OVERTAKE_BONUS_METRES
      runner.passed.add(ghost.name)
    } else if (runner.ahead[i] && runner.metres < ghostMetres - 1.5) {
      runner.ahead[i] = false
    }
  }
}

async function finishRun(runner: Runner): Promise<void> {
  runner.running = false
  runner.cooldown = C.RESET_SECONDS

  const score = Math.round(runner.score)
  const isBest = score > runner.best
  if (isBest) runner.best = score

  const rank = board.filter((row) => row.score > score).length + 1

  room.send(
    'runEnded',
    {
      address: runner.address,
      score,
      best: runner.best,
      isBest,
      beat: Array.from(runner.passed).slice(0, 5),
      rank
    },
    { to: [runner.address] }
  )

  await recordGhost(runner, score)
  await updateBoard(runner, score)

  if (isBest && runner.bestLoaded) {
    const saved = await Storage.player.set(runner.address, 'best', runner.best)
    if (!saved) console.error(`[relay] best for ${runner.address} did not persist`)
  }
}

/**
 * Keeps the roster fresh rather than purely elite: a run is stored if it beats
 * the weakest ghost, or if the player has no ghost on the board yet. A player
 * only ever occupies one slot, so one fast regular cannot crowd out everyone.
 */
async function recordGhost(runner: Runner, score: number): Promise<void> {
  if (runner.samples.length < C.SAMPLE_HZ * 5) return // runs under 5s are not worth replaying

  // Reuse the look we already have for this player rather than re-fetching
  // their profile on every personal best.
  const known = ghosts.find((ghost) => ghost.address === runner.address)
  const look = known?.look ?? packLook(await fetchLook(runner.address))

  const stored: StoredGhost = {
    address: runner.address,
    name: runner.name,
    score,
    path: encodePath(runner.samples),
    day,
    look
  }

  const existing = ghosts.findIndex((ghost) => ghost.address === runner.address)
  if (existing >= 0) {
    if (ghosts[existing].score >= score) return
    ghosts[existing] = hydrate(stored)
  } else if (ghosts.length < C.MAX_GHOSTS) {
    ghosts.push(hydrate(stored))
  } else {
    let weakest = 0
    for (let i = 1; i < ghosts.length; i++) if (ghosts[i].score < ghosts[weakest].score) weakest = i
    if (ghosts[weakest].score >= score) return
    ghosts[weakest] = hydrate(stored)
  }

  ghosts.sort((a, b) => b.score - a.score)
  for (let slot = 0; slot < ghosts.length; slot++) {
    await persistGhost(slot, ghosts[slot])
  }

  // Everyone currently in the scene gets the new ghost immediately.
  const slot = ghosts.findIndex((ghost) => ghost.address === runner.address)
  room.send('ghost', {
    slot,
    total: ghosts.length,
    address: stored.address,
    name: stored.name,
    score: stored.score,
    path: stored.path,
    look: stored.look
  })
}

async function updateBoard(runner: Runner, score: number): Promise<void> {
  const existing = board.findIndex((row) => row.name === runner.name)
  if (existing >= 0) {
    if (board[existing].score >= score) return
    board[existing].score = score
  } else {
    board.push({ name: runner.name, score })
  }

  board.sort((a, b) => b.score - a.score)
  board = board.slice(0, C.LEADERBOARD_SIZE)

  await persistBoard()
  sendBoard()
}
