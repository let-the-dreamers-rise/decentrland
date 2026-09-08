import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { getUserData } from '~system/UserIdentity'

export type Occupant = { userId: string; position: Vector3 }

let localUserId = `guest-${Math.floor(Math.random() * 1000000)}`

export function getLocalUserId(): string {
  return localUserId
}

/** Resolves the wallet address once at boot. Guests keep the random fallback id. */
export async function initLocalUser(): Promise<void> {
  try {
    const data = await getUserData({})
    if (data.data?.userId) localUserId = data.data.userId
  } catch (error) {
    console.log('[nightwire] could not read user data, staying a guest', error)
  }
}

/**
 * Everyone currently standing in the scene: the local avatar plus every remote
 * avatar the engine knows about. Written into `out` so the hot loop allocates nothing.
 */
export function collectOccupants(out: Occupant[]): Occupant[] {
  out.length = 0

  const self = Transform.getOrNull(engine.PlayerEntity)
  if (self) out.push({ userId: localUserId, position: self.position })

  for (const [, identity, transform] of engine.getEntitiesWith(PlayerIdentityData, Transform)) {
    if (identity.address === localUserId) continue
    out.push({ userId: identity.address, position: transform.position })
  }

  return out
}

/** Distance ignoring height, so a jumping avatar still counts as standing on a node. */
export function flatDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}
