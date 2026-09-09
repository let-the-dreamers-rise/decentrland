/**
 * A ghost is a person, not a shape. Each one is rendered with the wearables the
 * player actually had on when they set the run, so the field is recognisably
 * made of Decentraland residents rather than anonymous markers.
 *
 * Packed into one string to keep the ghost message a single small payload.
 */

export type Look = {
  bodyShape: string
  wearables: string[]
  skin: { r: number; g: number; b: number }
  hair: { r: number; g: number; b: number }
  eyes: { r: number; g: number; b: number }
}

export const DEFAULT_LOOK: Look = {
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: [],
  skin: { r: 0.6, g: 0.462, b: 0.356 },
  hair: { r: 0.283, g: 0.142, b: 0 },
  eyes: { r: 0.4, g: 0.6, b: 0.8 }
}

function packColor(color: { r: number; g: number; b: number }): string {
  return `${color.r.toFixed(3)},${color.g.toFixed(3)},${color.b.toFixed(3)}`
}

function unpackColor(text: string, fallback: { r: number; g: number; b: number }) {
  const parts = text.split(',').map(Number)
  if (parts.length !== 3 || parts.some((value) => !isFinite(value))) return fallback
  return { r: parts[0], g: parts[1], b: parts[2] }
}

export function packLook(look: Look): string {
  return [
    look.bodyShape,
    look.wearables.join(','),
    packColor(look.skin),
    packColor(look.hair),
    packColor(look.eyes)
  ].join('|')
}

export function unpackLook(packed: string): Look {
  if (!packed) return DEFAULT_LOOK
  const parts = packed.split('|')
  if (parts.length < 5) return DEFAULT_LOOK
  return {
    bodyShape: parts[0] || DEFAULT_LOOK.bodyShape,
    wearables: parts[1] ? parts[1].split(',').filter(Boolean) : [],
    skin: unpackColor(parts[2], DEFAULT_LOOK.skin),
    hair: unpackColor(parts[3], DEFAULT_LOOK.hair),
    eyes: unpackColor(parts[4], DEFAULT_LOOK.eyes)
  }
}

/** Reads a player's live profile from the catalyst. Server-side, once per ghost. */
export async function fetchLook(address: string): Promise<Look> {
  try {
    const response = await fetch(`https://peer.decentraland.org/lambdas/profiles/${address}`)
    if (!response.ok) return DEFAULT_LOOK

    const body = (await response.json()) as {
      avatars?: Array<{
        avatar?: {
          bodyShape?: string
          wearables?: string[]
          skin?: { color?: { r: number; g: number; b: number } }
          hair?: { color?: { r: number; g: number; b: number } }
          eyes?: { color?: { r: number; g: number; b: number } }
        }
      }>
    }

    const avatar = body.avatars?.[0]?.avatar
    if (!avatar) return DEFAULT_LOOK

    return {
      bodyShape: avatar.bodyShape ?? DEFAULT_LOOK.bodyShape,
      wearables: (avatar.wearables ?? []).slice(0, 16),
      skin: avatar.skin?.color ?? DEFAULT_LOOK.skin,
      hair: avatar.hair?.color ?? DEFAULT_LOOK.hair,
      eyes: avatar.eyes?.color ?? DEFAULT_LOOK.eyes
    }
  } catch (error) {
    console.log(`[relay] profile fetch failed for ${address}`, error)
    return DEFAULT_LOOK
  }
}
