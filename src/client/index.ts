import { engine, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { getUserData } from '~system/UserIdentity'
import * as C from '../shared/config'
import { dayIndex, trackName } from '../shared/daily'
import { room } from '../shared/messages'
import { accumulate, buildTrack, project } from '../shared/track'
import { buildTrackVisuals } from './track'
import { ghostCount, markLocalOvertakes, playGhosts, setTrack, upsertGhost } from './ghosts'
import { setupHud } from './hud'
import { view } from './state'

const day = dayIndex()
const track = buildTrack(day)
const START = track.points[0]

let myAddress = ''
/** Local clock for ghost playback, resynced from every server runState. */
let elapsed = 0
let localMetres = 0
let lastProgress = 0

export function initClient(): void {
  setTrack(track)
  buildTrackVisuals(track, trackName(day))
  setupHud()
  view.trackName = trackName(day)

  void announce()
  listen()
  engine.addSystem(update)
}

async function announce(): Promise<void> {
  try {
    const data = await getUserData({})
    myAddress = data.data?.userId ?? ''
    room.send('join', { name: data.data?.displayName ?? 'runner' })
  } catch (error) {
    console.log('[relay] could not read user data', error)
    room.send('join', { name: 'runner' })
  }
}

function listen(): void {
  room.onMessage('ready', (data) => {
    view.trackName = data.trackName
  })

  room.onMessage('ghost', (data) => {
    upsertGhost(data.address, data.name, data.score, data.path)
    view.ghosts = ghostCount()
  })

  room.onMessage('runState', (data) => {
    if (data.address !== myAddress) return

    if (!view.running && data.running) startLocalRun()

    view.running = data.running
    view.remaining = data.remaining
    view.score = data.score
    view.metres = data.metres
    view.overtakes = data.overtakes
    view.heat = data.heat

    // The server is authoritative for the clock; keep local playback pinned to it.
    elapsed = C.RUN_SECONDS - data.remaining
  })

  room.onMessage('runEnded', (data) => {
    if (data.address !== myAddress) return

    view.running = false
    view.remaining = 0
    view.best = data.best
    view.messageHot = data.isBest

    if (data.isBest) view.message = `New best — ${data.score} m`
    else if (data.beat.length > 0) view.message = `${data.score} m · passed ${data.beat.join(', ')}`
    else view.message = `${data.score} m · rank #${data.rank}`

    // Snap back to the line so the next run costs nothing but a moment.
    void movePlayerTo({
      newRelativePosition: Vector3.create(START.x, 1, START.z),
      cameraTarget: Vector3.create(C.CENTER.x, 1, C.CENTER.z)
    })
  })

  room.onMessage('leaderboard', (data) => {
    view.boardLine = data.rows
      .slice(0, 3)
      .map((row, index) => {
        const [name, score] = row.split('|')
        return `${index + 1}. ${name} ${score}`
      })
      .join('   ')
  })
}

function startLocalRun(): void {
  elapsed = 0
  localMetres = 0
  view.message = 'GO'
  view.messageHot = false
  const player = Transform.getOrNull(engine.PlayerEntity)
  lastProgress = player ? project(track, player.position.x, player.position.z).progress : 0
}

function update(dt: number): void {
  if (!view.running) {
    playGhosts(0, false)
    return
  }

  elapsed += dt
  playGhosts(elapsed, true)

  // Local mirror of the server's distance, only so overtake bursts land on the
  // frame the pass happens rather than up to 200 ms later.
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player) {
    const projected = project(track, player.position.x, player.position.z)
    const delta = accumulate(lastProgress, projected.progress, track.length)
    lastProgress = projected.progress
    if (projected.offset <= C.TRACK_WIDTH && delta > 0) localMetres += delta
    markLocalOvertakes(localMetres, elapsed)
  }
}
