import { engine, Entity, MeshCollider, MeshRenderer, Material, Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import * as C from './config'

export type NodeState = 'dormant' | 'live' | 'link' | 'charged'

export type GameNode = {
  id: number
  position: Vector3
  /** The flat pad on the floor. */
  pad: Entity
  /** Grows out of the pad as the node charges. */
  pillar: Entity
  /** Beam drawn to the partner node, hidden unless this node is linked. */
  beam: Entity
  state: NodeState
  /** 0..1 */
  charge: number
  /** Node id of the partner on a link step, or -1. */
  partner: number
  /** Rebuilt every frame from avatar positions. */
  occupants: string[]
  /** Seconds left on the post-charge flash. */
  flash: number
}

function ringPositions(count: number, radius: number, offset: number): Vector3[] {
  const positions: Vector3[] = []
  for (let i = 0; i < count; i++) {
    const angle = offset + (i / count) * Math.PI * 2
    positions.push(
      Vector3.create(
        C.ARENA_CENTER.x + Math.cos(angle) * radius,
        0,
        C.ARENA_CENTER.z + Math.sin(angle) * radius
      )
    )
  }
  return positions
}

/**
 * Builds both rings. `rotationOffset` comes from the daily seed, so the grid
 * sits at a different angle each day without changing the arena's shape.
 */
export function buildNodes(rotationOffset: number): GameNode[] {
  const positions = [
    ...ringPositions(C.OUTER_RING.count, C.OUTER_RING.radius, rotationOffset),
    ...ringPositions(C.INNER_RING.count, C.INNER_RING.radius, rotationOffset + Math.PI / 4)
  ]

  return positions.map((position, id) => {
    const pad = engine.addEntity()
    Transform.create(pad, {
      position: Vector3.create(position.x, 0.06, position.z),
      scale: Vector3.create(C.NODE_RADIUS * 2, 0.12, C.NODE_RADIUS * 2)
    })
    MeshRenderer.setCylinder(pad, 1, 1)
    Material.setPbrMaterial(pad, {
      albedoColor: C.COLORS.dormant,
      emissiveColor: C.emissive(C.COLORS.dormant),
      emissiveIntensity: 0.2,
      metallic: 0.1,
      roughness: 0.7
    })

    const pillar = engine.addEntity()
    Transform.create(pillar, {
      position: Vector3.create(position.x, 0.1, position.z),
      scale: Vector3.create(0.6, 0.1, 0.6)
    })
    MeshRenderer.setCylinder(pillar, 0.35, 0.9)
    Material.setPbrMaterial(pillar, {
      albedoColor: C.COLORS.dormant,
      emissiveColor: C.emissive(C.COLORS.dormant),
      emissiveIntensity: 0.5,
      metallic: 0,
      roughness: 0.4
    })

    const beam = engine.addEntity()
    Transform.create(beam, { position: Vector3.create(position.x, 0.9, position.z), scale: Vector3.Zero() })
    MeshRenderer.setBox(beam)
    Material.setPbrMaterial(beam, {
      albedoColor: C.COLORS.link,
      emissiveColor: C.emissive(C.COLORS.link),
      emissiveIntensity: 2,
      metallic: 0,
      roughness: 1
    })

    return {
      id,
      position,
      pad,
      pillar,
      beam,
      state: 'dormant' as NodeState,
      charge: 0,
      partner: -1,
      occupants: [],
      flash: 0
    }
  })
}

function colorFor(node: GameNode) {
  if (node.flash > 0) return C.COLORS.charged
  if (node.state === 'link') return C.COLORS.link
  if (node.state === 'live') return C.COLORS.live
  return C.COLORS.dormant
}

/** Pushes node state onto its entities. Called every frame for every node. */
export function drawNode(node: GameNode, nodes: GameNode[]): void {
  const color = colorFor(node)
  const isActive = node.state === 'live' || node.state === 'link'
  const intensity = node.flash > 0 ? 6 : isActive ? 1.2 + node.charge * 3 : 0.2

  Material.setPbrMaterial(node.pad, {
    albedoColor: color,
    emissiveColor: C.emissive(color),
    emissiveIntensity: intensity,
    metallic: 0.1,
    roughness: 0.7
  })

  const height = isActive ? 0.4 + node.charge * 3.2 : node.flash > 0 ? 3.6 : 0.1
  const pillarTransform = Transform.getMutable(node.pillar)
  pillarTransform.scale = Vector3.create(0.6, height, 0.6)
  pillarTransform.position = Vector3.create(node.position.x, height / 2, node.position.z)

  Material.setPbrMaterial(node.pillar, {
    albedoColor: color,
    emissiveColor: C.emissive(color),
    emissiveIntensity: intensity,
    metallic: 0,
    roughness: 0.4
  })

  const beamTransform = Transform.getMutable(node.beam)
  if (node.state === 'link' && node.partner >= 0) {
    const partner = nodes[node.partner]
    const dx = partner.position.x - node.position.x
    const dz = partner.position.z - node.position.z
    const length = Math.sqrt(dx * dx + dz * dz)
    // Only the lower id draws the beam, otherwise the pair renders it twice.
    if (node.id < partner.id) {
      beamTransform.position = Vector3.create(
        (node.position.x + partner.position.x) / 2,
        1.1,
        (node.position.z + partner.position.z) / 2
      )
      beamTransform.rotation = Quaternion.fromEulerDegrees(0, -Math.atan2(dz, dx) * (180 / Math.PI), 0)
      const thickness = 0.06 + node.charge * 0.14
      beamTransform.scale = Vector3.create(length, thickness, thickness)
    } else {
      beamTransform.scale = Vector3.Zero()
    }
  } else {
    beamTransform.scale = Vector3.Zero()
  }
}

/** The central pylon: a stack of rings that fills up as the Core charges. */
export function buildCore(): { pylon: Entity; halo: Entity } {
  const pylon = engine.addEntity()
  Transform.create(pylon, {
    position: Vector3.create(C.ARENA_CENTER.x, 1, C.ARENA_CENTER.z),
    scale: Vector3.create(1.6, 2, 1.6)
  })
  MeshRenderer.setCylinder(pylon, 0.5, 1)
  MeshCollider.setCylinder(pylon, 0.5, 1)
  Material.setPbrMaterial(pylon, {
    albedoColor: C.COLORS.dormant,
    emissiveColor: C.emissive(C.COLORS.core),
    emissiveIntensity: 0.4,
    metallic: 0.3,
    roughness: 0.3
  })

  const halo = engine.addEntity()
  Transform.create(halo, {
    position: Vector3.create(C.ARENA_CENTER.x, 0.2, C.ARENA_CENTER.z),
    scale: Vector3.create(3, 0.08, 3)
  })
  MeshRenderer.setCylinder(halo, 1, 1)
  Material.setPbrMaterial(halo, {
    albedoColor: C.COLORS.core,
    emissiveColor: C.emissive(C.COLORS.core),
    emissiveIntensity: 1,
    metallic: 0,
    roughness: 1
  })

  return { pylon, halo }
}

/** `fill` is 0..1 of the round's target voltage. */
export function drawCore(core: { pylon: Entity; halo: Entity }, fill: number, time: number): void {
  const clamped = Math.max(0, Math.min(1, fill))

  const pylonTransform = Transform.getMutable(core.pylon)
  const height = 2 + clamped * 6
  pylonTransform.scale = Vector3.create(1.6, height, 1.6)
  pylonTransform.position = Vector3.create(C.ARENA_CENTER.x, height / 2, C.ARENA_CENTER.z)
  pylonTransform.rotation = Quaternion.fromEulerDegrees(0, time * 18, 0)

  Material.setPbrMaterial(core.pylon, {
    albedoColor: C.COLORS.dormant,
    emissiveColor: C.emissive(C.COLORS.core),
    emissiveIntensity: 0.4 + clamped * 5,
    metallic: 0.3,
    roughness: 0.3
  })

  const pulse = 3 + clamped * 9 + Math.sin(time * 3) * 0.4
  const haloTransform = Transform.getMutable(core.halo)
  haloTransform.scale = Vector3.create(pulse, 0.08, pulse)
}
