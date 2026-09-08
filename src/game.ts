import { engine } from '@dcl/sdk/ecs'
import * as C from './config'
import { dayIndex, gridName, hash32, makeRng, shuffledIndices } from './daily'
import { buildCore, buildNodes, drawCore, drawNode, GameNode } from './nodes'
import { buildArena } from './arena'
import { collectOccupants, flatDistance, getLocalUserId, Occupant } from './players'
import { AdvanceMsg, bus, CHANNEL, ChargeMsg, SyncMsg } from './net'

export type Phase = 'running' | 'intermission'

export const game = {
  phase: 'intermission' as Phase,
  clock: 6,
  roundIndex: 0,
  /** Which node selection we are on. Drives the deterministic layout. */
  step: 0,
  voltage: 0,
  multiplier: 1,
  /** Seconds left before the chain multiplier drops back to 1. */
  chainTimer: 0,
  /** Seconds left before the current step is retired unfinished. */
  stepTimer: C.STEP_TIMEOUT,
  players: 1,
  isHost: true,
  day: dayIndex(),
  grid: gridName(dayIndex()),
  /** Session-only stats. Persisting these across visits is V0 scope, see the GDD. */
  myCharges: 0,
  myVoltage: 0,
  lastRoundVoltage: 0,
  bestVoltage: 0,
  lastMessage: 'Stand on an amber node to charge it'
}

let nodes: GameNode[] = []
let core: ReturnType<typeof buildCore> | null = null
let elapsed = 0
const occupants: Occupant[] = []
let syncTimer = 0

export function setupGame(): void {
  const rotation = makeRng(hash32(game.day, 0x5eed))() * Math.PI * 2
  buildArena(game.grid)
  nodes = buildNodes(rotation)
  core = buildCore()

  selectStep()
  listen()

  engine.addSystem(update)
}

/* ------------------------------------------------------------------ *
 * Deterministic node selection
 * ------------------------------------------------------------------ */

/** Every third step is a link step: a pair that only charges with two players on it. */
function isLinkStep(step: number): boolean {
  return step % 3 === 2
}

/**
 * Chooses which nodes are live for the current step. Derived entirely from
 * (day, round, step), so every client lights the same nodes without a message.
 */
function selectStep(): void {
  for (const node of nodes) {
    node.state = 'dormant'
    node.charge = 0
    node.partner = -1
    node.occupants.length = 0
  }

  const rng = makeRng(hash32(game.day, game.roundIndex, game.step))
  const order = shuffledIndices(nodes.length, rng)
  let cursor = 0

  if (isLinkStep(game.step)) {
    const a = nodes[order[cursor++]]
    const b = nodes[order[cursor++]]
    a.state = 'link'
    b.state = 'link'
    a.partner = b.id
    b.partner = a.id
    // Always leave one solo node open so a lone player is never stuck.
    nodes[order[cursor++]].state = 'live'
  } else {
    const count = C.liveNodeCount(game.players)
    for (let i = 0; i < count; i++) nodes[order[cursor++]].state = 'live'
  }

  game.stepTimer = C.STEP_TIMEOUT
}

/* ------------------------------------------------------------------ *
 * Networking
 * ------------------------------------------------------------------ */

function listen(): void {
  bus.on(CHANNEL.charge, (msg: ChargeMsg) => {
    if (msg.userId === getLocalUserId()) return
    if (msg.roundIndex !== game.roundIndex || msg.step !== game.step) return
    applyCharge(msg)
  })

  bus.on(CHANNEL.advance, (msg: AdvanceMsg) => {
    if (game.isHost) return
    if (msg.roundIndex !== game.roundIndex || msg.step !== game.step) return
    game.step++
    game.multiplier = 1
    game.chainTimer = 0
    selectStep()
  })

  bus.on(CHANNEL.sync, (msg: SyncMsg) => {
    if (game.isHost) return
    applySync(msg)
  })

  bus.on(CHANNEL.hello, () => {
    if (game.isHost) broadcastSync()
  })

  bus.emit(CHANNEL.hello, {})
}

function applySync(msg: SyncMsg): void {
  const drifted =
    msg.roundIndex !== game.roundIndex || msg.phase !== game.phase || Math.abs(msg.clock - game.clock) > 1.5

  game.voltage = msg.voltage
  game.multiplier = msg.multiplier

  if (drifted) {
    game.roundIndex = msg.roundIndex
    game.phase = msg.phase
    game.clock = msg.clock
  }

  if (msg.step !== game.step) {
    game.step = msg.step
    selectStep()
  }
}

function broadcastSync(): void {
  const msg: SyncMsg = {
    roundIndex: game.roundIndex,
    step: game.step,
    phase: game.phase,
    clock: game.clock,
    voltage: game.voltage,
    multiplier: game.multiplier
  }
  bus.emit(CHANNEL.sync, msg)
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

function applyCharge(msg: ChargeMsg): void {
  game.voltage += msg.voltage
  game.multiplier = msg.multiplier
  game.chainTimer = C.CHAIN_WINDOW

  const node = nodes[msg.nodeId]
  if (node) node.flash = 0.5

  if (msg.userId === getLocalUserId()) {
    game.myCharges++
    game.myVoltage += msg.voltage
  }

  game.lastMessage =
    node && node.partner >= 0
      ? `Link charged! x${msg.multiplier} chain`
      : `Node charged  ·  x${msg.multiplier} chain`

  game.step++
  selectStep()
}

/* ------------------------------------------------------------------ *
 * Frame update
 * ------------------------------------------------------------------ */

function update(dt: number): void {
  elapsed += dt

  collectOccupants(occupants)
  game.players = occupants.length
  game.isHost = electHost(occupants)

  if (game.phase === 'running') {
    updateCharging(dt)
    game.chainTimer = Math.max(0, game.chainTimer - dt)
    if (game.chainTimer === 0) game.multiplier = 1
  }

  advanceClock(dt)

  for (const node of nodes) {
    node.flash = Math.max(0, node.flash - dt)
    drawNode(node, nodes)
  }
  if (core) drawCore(core, game.voltage / C.TARGET_VOLTAGE, elapsed)

  if (game.isHost) {
    syncTimer += dt
    if (syncTimer >= 1) {
      syncTimer = 0
      broadcastSync()
    }
  }
}

/** Lowest wallet address in the scene is the host. Stable, and free of an election round-trip. */
function electHost(present: Occupant[]): boolean {
  let lowest = getLocalUserId()
  for (const occupant of present) {
    if (occupant.userId < lowest) lowest = occupant.userId
  }
  return lowest === getLocalUserId()
}

function advanceClock(dt: number): void {
  game.clock -= dt

  if (game.phase === 'running') {
    game.stepTimer -= dt
    if (game.stepTimer <= 0 && game.isHost) {
      const msg: AdvanceMsg = { step: game.step, roundIndex: game.roundIndex }
      bus.emit(CHANNEL.advance, msg)
      game.step++
      game.multiplier = 1
      game.chainTimer = 0
      selectStep()
    }

    if (game.clock <= 0 || game.voltage >= C.TARGET_VOLTAGE) endRound()
    return
  }

  if (game.clock <= 0) startRound()
}

function startRound(): void {
  game.phase = 'running'
  game.clock = C.ROUND_SECONDS
  game.roundIndex++
  game.step = 0
  game.voltage = 0
  game.multiplier = 1
  game.chainTimer = 0
  game.myCharges = 0
  game.myVoltage = 0
  game.lastMessage = 'Round live — charge the Core'
  selectStep()
  if (game.isHost) broadcastSync()
}

function endRound(): void {
  game.phase = 'intermission'
  game.clock = C.INTERMISSION_SECONDS
  game.lastRoundVoltage = game.voltage
  game.bestVoltage = Math.max(game.bestVoltage, game.voltage)
  game.lastMessage =
    game.voltage >= C.TARGET_VOLTAGE
      ? `Core online at ${Math.round(game.voltage)}v`
      : `Round over at ${Math.round(game.voltage)}v of ${C.TARGET_VOLTAGE}v`
  for (const node of nodes) {
    node.state = 'dormant'
    node.charge = 0
    node.partner = -1
  }
  if (game.isHost) broadcastSync()
}

/* ------------------------------------------------------------------ *
 * The core mechanic: standing on a node charges it
 * ------------------------------------------------------------------ */

function updateCharging(dt: number): void {
  // Pass 1 — who is standing where.
  for (const node of nodes) {
    node.occupants.length = 0
    if (node.state !== 'live' && node.state !== 'link') continue
    for (const occupant of occupants) {
      if (flatDistance(occupant.position, node.position) <= C.NODE_RADIUS) {
        node.occupants.push(occupant.userId)
      }
    }
  }

  // Pass 2 — advance or decay the charge. A link node only moves while its
  // partner is occupied too, which is the whole point of the pair.
  for (const node of nodes) {
    if (node.state !== 'live' && node.state !== 'link') continue

    const partnerHeld = node.partner < 0 || nodes[node.partner].occupants.length > 0
    const charging = node.occupants.length > 0 && partnerHeld

    if (!charging) {
      node.charge = Math.max(0, node.charge - dt * 0.8)
      continue
    }

    const seconds = node.partner >= 0 ? C.LINK_CHARGE_SECONDS : C.CHARGE_SECONDS
    node.charge = Math.min(1, node.charge + dt / seconds)

    if (node.charge >= 1 && ownsCharge(node)) completeCharge(node)
  }
}

/**
 * Exactly one client has to announce a completed charge. The occupant with the
 * lowest id on the node does it, and on a link pair the pair's lower node decides,
 * so a two-player link still produces a single message.
 */
function ownsCharge(node: GameNode): boolean {
  if (node.partner >= 0 && nodes[node.partner].id < node.id) return false

  const candidates =
    node.partner >= 0 ? node.occupants.concat(nodes[node.partner].occupants) : node.occupants

  let lowest = candidates[0]
  for (const userId of candidates) if (userId < lowest) lowest = userId
  return lowest === getLocalUserId()
}

function completeCharge(node: GameNode): void {
  const multiplier =
    game.chainTimer > 0 ? Math.min(C.MAX_MULTIPLIER, game.multiplier + 1) : 1
  const base = node.partner >= 0 ? C.LINK_VOLTAGE : C.BASE_VOLTAGE

  const msg: ChargeMsg = {
    step: game.step,
    roundIndex: game.roundIndex,
    nodeId: node.id,
    userId: getLocalUserId(),
    voltage: base * multiplier,
    multiplier
  }

  bus.emit(CHANNEL.charge, msg)
  applyCharge(msg)
}
