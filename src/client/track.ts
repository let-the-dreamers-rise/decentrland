import { engine, Material, MeshCollider, MeshRenderer, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import * as C from '../shared/config'
import { normalAt, Track } from '../shared/track'

function rgb(color: Color4): Color3 {
  return Color3.create(color.r, color.g, color.b)
}

/** Floor, the racing line, obstacles and the start gate. Built once per day. */
export function buildTrackVisuals(track: Track, label: string): void {
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(C.CENTER.x, -0.05, C.CENTER.z),
    scale: Vector3.create(C.SCENE_SIZE, 0.1, C.SCENE_SIZE)
  })
  MeshRenderer.setBox(floor)
  MeshCollider.setBox(floor)
  Material.setPbrMaterial(floor, {
    albedoColor: C.COLORS.floor,
    emissiveColor: rgb(C.COLORS.floor),
    emissiveIntensity: 0.1,
    roughness: 0.95
  })

  // The racing line: one tile per polyline segment, rotated to follow it.
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i]
    const b = track.points[(i + 1) % track.points.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.sqrt(dx * dx + dz * dz)

    const tile = engine.addEntity()
    Transform.create(tile, {
      position: Vector3.create((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2),
      rotation: Quaternion.fromEulerDegrees(0, -Math.atan2(dz, dx) * (180 / Math.PI), 0),
      scale: Vector3.create(length + 0.2, 0.04, C.TRACK_WIDTH * 2)
    })
    MeshRenderer.setBox(tile)
    Material.setPbrMaterial(tile, {
      albedoColor: C.COLORS.track,
      emissiveColor: rgb(C.COLORS.edge),
      // A gradient round the loop so you can always tell which way you are facing.
      emissiveIntensity: 0.12 + 0.5 * (i / track.points.length),
      roughness: 0.8
    })
  }

  for (const obstacle of track.obstacles) {
    const pillar = engine.addEntity()
    Transform.create(pillar, {
      position: Vector3.create(obstacle.x, 1.1, obstacle.z),
      scale: Vector3.create(0.7, 2.2, 0.7)
    })
    MeshRenderer.setCylinder(pillar, 0.35, 0.5)
    MeshCollider.setCylinder(pillar, 0.35, 0.5)
    Material.setPbrMaterial(pillar, {
      albedoColor: Color4.create(0.1, 0.12, 0.2, 1),
      emissiveColor: rgb(C.COLORS.heat),
      emissiveIntensity: 0.8,
      roughness: 0.5
    })
  }

  buildStartGate(track, label)
}

function buildStartGate(track: Track, label: string): void {
  const start = track.points[0]
  const normal = normalAt(track.points, 0)

  const pad = engine.addEntity()
  Transform.create(pad, {
    position: Vector3.create(start.x, 0.05, start.z),
    scale: Vector3.create(8, 0.1, 8)
  })
  MeshRenderer.setCylinder(pad, 1, 1)
  Material.setPbrMaterial(pad, {
    albedoColor: C.COLORS.you,
    emissiveColor: rgb(C.COLORS.you),
    emissiveIntensity: 2.5,
    roughness: 1
  })

  for (const side of [1, -1]) {
    const post = engine.addEntity()
    Transform.create(post, {
      position: Vector3.create(start.x + normal.x * 5 * side, 2, start.z + normal.z * 5 * side),
      scale: Vector3.create(0.4, 4, 0.4)
    })
    MeshRenderer.setBox(post)
    Material.setPbrMaterial(post, {
      albedoColor: C.COLORS.you,
      emissiveColor: rgb(C.COLORS.you),
      emissiveIntensity: 3,
      roughness: 1
    })
  }

  const sign = engine.addEntity()
  Transform.create(sign, { position: Vector3.create(start.x, 4.6, start.z) })
  TextShape.create(sign, {
    text: `GHOST RELAY\n${label}\n\nstand here to run`,
    fontSize: 3,
    textColor: Color4.create(0.6, 1, 0.85, 1)
  })
}
