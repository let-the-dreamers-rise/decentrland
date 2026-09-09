import { AvatarShape, Billboard, engine, Entity, Material, MeshRenderer, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import * as C from '../shared/config'
import { decodePath, Sample } from '../shared/codec'
import { accumulate, project, Track } from '../shared/track'
import { unpackLook } from '../shared/look'

export type GhostView = {
  address: string
  name: string
  score: number
  samples: Sample[]
  /** Cumulative metres this ghost had run at each sample, for local overtake checks. */
  metres: number[]
  /** The avatar itself, wearing the wearables of the player who set the run. */
  body: Entity
  /** Ground ring under the avatar — the only thing that changes colour on a pass. */
  ring: Entity
  label: Entity
  passed: boolean
}

const ghosts = new Map<string, GhostView>()
let track: Track | null = null

export function setTrack(value: Track): void {
  track = value
}

export function ghostCount(): number {
  return ghosts.size
}

/** Mirrors the server's distance accounting so the client can react instantly. */
function cumulativeMetres(samples: Sample[]): number[] {
  if (!track) return samples.map(() => 0)
  const metres: number[] = []
  let total = 0
  let previous = project(track, samples[0].x, samples[0].z).progress
  for (const sample of samples) {
    const current = project(track, sample.x, sample.z).progress
    total += Math.max(0, accumulate(previous, current, track.length))
    previous = current
    metres.push(total)
  }
  return metres
}

export function upsertGhost(
  address: string,
  name: string,
  score: number,
  path: string,
  packedLook: string
): void {
  const samples = decodePath(path)
  if (samples.length === 0) return

  let ghost = ghosts.get(address)
  if (!ghost) {
    const body = engine.addEntity()
    Transform.create(body, { position: Vector3.create(0, -50, 0) })

    const ring = engine.addEntity()
    Transform.create(ring, {
      position: Vector3.create(0, 0.06, 0),
      scale: Vector3.create(1.6, 0.06, 1.6),
      parent: body
    })
    MeshRenderer.setCylinder(ring, 1, 1)

    const label = engine.addEntity()
    Transform.create(label, { position: Vector3.create(0, 2.4, 0), parent: body })
    Billboard.create(label)
    TextShape.create(label, { text: '', fontSize: 1.3, textColor: Color4.create(0.7, 0.9, 1, 0.85) })

    ghost = { address, name, score, samples, metres: [], body, ring, label, passed: false }
    ghosts.set(address, ghost)
  }

  const look = unpackLook(packedLook)
  AvatarShape.createOrReplace(ghost.body, {
    id: address,
    name,
    bodyShape: look.bodyShape,
    wearables: look.wearables,
    emotes: [],
    skinColor: Color3.create(look.skin.r, look.skin.g, look.skin.b),
    hairColor: Color3.create(look.hair.r, look.hair.g, look.hair.b),
    eyeColor: Color3.create(look.eyes.r, look.eyes.g, look.eyes.b)
  })

  ghost.name = name
  ghost.score = score
  ghost.samples = samples
  ghost.metres = cumulativeMetres(samples)
  TextShape.getMutable(ghost.label).text = `${name}\n${score} m`
  paint(ghost, false)
}

function paint(ghost: GhostView, passed: boolean): void {
  const color = passed ? C.COLORS.ghostPassed : C.COLORS.ghost
  Material.setPbrMaterial(ghost.ring, {
    albedoColor: color,
    emissiveColor: Color3.create(color.r, color.g, color.b),
    emissiveIntensity: passed ? 5 : 1.2,
    roughness: 1
  })
  TextShape.getMutable(ghost.label).textColor = passed
    ? C.COLORS.ghostPassed
    : Color4.create(0.7, 0.9, 1, 0.85)
}

/**
 * Plays every ghost from the start of the local player's run. Ghosts are parked
 * underground between runs so the start pad stays readable.
 */
export function playGhosts(elapsed: number, running: boolean): void {
  for (const ghost of ghosts.values()) {
    const transform = Transform.getMutable(ghost.body)

    if (!running) {
      transform.position = Vector3.create(0, -50, 0)
      if (ghost.passed) {
        ghost.passed = false
        paint(ghost, false)
      }
      continue
    }

    const exact = elapsed * C.SAMPLE_HZ
    const index = Math.min(ghost.samples.length - 1, Math.floor(exact))
    const next = Math.min(ghost.samples.length - 1, index + 1)
    const t = exact - index

    const a = ghost.samples[index]
    const b = ghost.samples[next]
    transform.position = Vector3.create(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)

    // Face the direction of travel, so a ghost reads as running rather than sliding.
    const dx = b.x - a.x
    const dz = b.z - a.z
    if (dx * dx + dz * dz > 0.0001) {
      transform.rotation = quaternionFromYaw(-Math.atan2(dz, dx) * (180 / Math.PI) + 90)
    }
  }
}

function quaternionFromYaw(degrees: number) {
  const half = (degrees * Math.PI) / 360
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
}

/**
 * Lights up every ghost the player is currently ahead of. Run locally each
 * frame so the burst lands on the same frame as the pass; the server still
 * owns the score, this is only feedback.
 */
export function markLocalOvertakes(playerMetres: number, elapsed: number): void {
  const index = Math.floor(elapsed * C.SAMPLE_HZ)
  for (const ghost of ghosts.values()) {
    if (ghost.passed || ghost.metres.length === 0) continue
    const ghostMetres = ghost.metres[Math.min(index, ghost.metres.length - 1)]
    if (playerMetres > ghostMetres + 1.5) {
      ghost.passed = true
      paint(ghost, true)
    }
  }
}
