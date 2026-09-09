import { engine, Entity, Material, MeshRenderer, TextShape, Transform, Billboard } from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import * as C from '../shared/config'
import { decodePath, Sample } from '../shared/codec'
import { accumulate, project, Track } from '../shared/track'

export type GhostView = {
  address: string
  name: string
  score: number
  samples: Sample[]
  /** Cumulative metres this ghost had run at each sample, for local overtake checks. */
  metres: number[]
  body: Entity
  label: Entity
  /** True once the local player has passed this ghost in the current run. */
  passed: boolean
}

const ghosts = new Map<string, GhostView>()
let track: Track | null = null

export function setTrack(value: Track): void {
  track = value
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

export function ghostCount(): number {
  return ghosts.size
}

export function upsertGhost(address: string, name: string, score: number, path: string): void {
  const samples = decodePath(path)
  if (samples.length === 0) return

  let ghost = ghosts.get(address)
  if (!ghost) {
    const body = engine.addEntity()
    Transform.create(body, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.8, 1.8, 0.8) })
    MeshRenderer.setCylinder(body, 0.3, 0.45)

    const label = engine.addEntity()
    Transform.create(label, { position: Vector3.create(0, 1.4, 0), parent: body })
    Billboard.create(label)
    TextShape.create(label, { text: name, fontSize: 1.4, textColor: Color4.create(0.7, 0.9, 1, 0.8) })

    ghost = { address, name, score, samples, metres: [], body, label, passed: false }
    ghosts.set(address, ghost)
  }

  ghost.name = name
  ghost.score = score
  ghost.samples = samples
  ghost.metres = cumulativeMetres(samples)
  TextShape.getMutable(ghost.label).text = name
  paint(ghost, false)
}

function paint(ghost: GhostView, passed: boolean): void {
  const color = passed ? C.COLORS.ghostPassed : C.COLORS.ghost
  Material.setPbrMaterial(ghost.body, {
    albedoColor: color,
    emissiveColor: Color3.create(color.r, color.g, color.b),
    emissiveIntensity: passed ? 3 : 1.2,
    roughness: 1
  })
}

/**
 * Plays every ghost from the start of the local player's run. Ghosts are the
 * whole point of the scene, so they are always visible while running and
 * parked underground between runs.
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
    transform.position = Vector3.create(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t + 0.9,
      a.z + (b.z - a.z) * t
    )
  }
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

/** Called when the server reports an overtake, to light the ghost up. */
export function markPassed(names: string[]): void {
  for (const ghost of ghosts.values()) {
    if (!ghost.passed && names.indexOf(ghost.name) >= 0) {
      ghost.passed = true
      paint(ghost, true)
    }
  }
}
