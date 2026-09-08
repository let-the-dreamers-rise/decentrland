import { engine, Material, MeshCollider, MeshRenderer, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import * as C from './config'

/** Floor, boundary lip and the two guide rings. Static geometry, built once. */
export function buildArena(gridLabel: string): void {
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(C.ARENA_CENTER.x, -0.05, C.ARENA_CENTER.z),
    scale: Vector3.create(C.ARENA_SIZE, 0.1, C.ARENA_SIZE)
  })
  MeshRenderer.setBox(floor)
  MeshCollider.setBox(floor)
  Material.setPbrMaterial(floor, {
    albedoColor: C.COLORS.floor,
    emissiveColor: C.emissive(C.COLORS.floor),
    emissiveIntensity: 0.1,
    metallic: 0.2,
    roughness: 0.9
  })

  // A low lip on all four sides. Tall enough to read as a boundary, low enough
  // not to block the camera on mobile.
  const half = C.ARENA_SIZE / 2
  const sides: Array<[number, number, number, number]> = [
    [C.ARENA_CENTER.x, C.ARENA_CENTER.z - half, C.ARENA_SIZE, 0.4],
    [C.ARENA_CENTER.x, C.ARENA_CENTER.z + half, C.ARENA_SIZE, 0.4],
    [C.ARENA_CENTER.x - half, C.ARENA_CENTER.z, 0.4, C.ARENA_SIZE],
    [C.ARENA_CENTER.x + half, C.ARENA_CENTER.z, 0.4, C.ARENA_SIZE]
  ]
  for (const [x, z, width, depth] of sides) {
    const wall = engine.addEntity()
    Transform.create(wall, { position: Vector3.create(x, 0.35, z), scale: Vector3.create(width, 0.7, depth) })
    MeshRenderer.setBox(wall)
    MeshCollider.setBox(wall)
    Material.setPbrMaterial(wall, {
      albedoColor: C.COLORS.wall,
      emissiveColor: C.emissive(C.COLORS.core),
      emissiveIntensity: 0.25,
      metallic: 0.1,
      roughness: 0.6
    })
  }

  guideRing(C.OUTER_RING.radius)
  guideRing(C.INNER_RING.radius)

  // Today's grid name, printed on the floor by the spawn point.
  const sign = engine.addEntity()
  Transform.create(sign, {
    position: Vector3.create(C.ARENA_CENTER.x, 0.02, C.ARENA_CENTER.z - 13.5),
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(1, 1, 1)
  })
  TextShape.create(sign, {
    text: `NIGHTWIRE\n${gridLabel} grid`,
    fontSize: 4,
    textColor: Color4.create(0.6, 0.9, 1, 0.9)
  })
}

/** A ring of thin floor tiles marking where the nodes sit. Purely a wayfinding aid. */
function guideRing(radius: number): void {
  const segments = 64
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const tile = engine.addEntity()
    Transform.create(tile, {
      position: Vector3.create(
        C.ARENA_CENTER.x + Math.cos(angle) * radius,
        0.02,
        C.ARENA_CENTER.z + Math.sin(angle) * radius
      ),
      rotation: Quaternion.fromEulerDegrees(0, -angle * (180 / Math.PI), 0),
      scale: Vector3.create(0.7, 0.02, 0.12)
    })
    MeshRenderer.setBox(tile)
    Material.setPbrMaterial(tile, {
      albedoColor: C.COLORS.core,
      emissiveColor: C.emissive(C.COLORS.core),
      emissiveIntensity: 0.6,
      metallic: 0,
      roughness: 1
    })
  }
}
