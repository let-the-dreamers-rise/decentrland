import { MessageBus } from '@dcl/sdk/message-bus'

export const bus = new MessageBus()

/** A node finished charging. Sent by the client that owned the charge. */
export type ChargeMsg = {
  step: number
  roundIndex: number
  nodeId: number
  userId: string
  voltage: number
  multiplier: number
}

/** The step timed out with nothing charged. Sent by the host only. */
export type AdvanceMsg = {
  step: number
  roundIndex: number
}

/** Host heartbeat, and the answer a joining client gets to `hello`. */
export type SyncMsg = {
  roundIndex: number
  step: number
  phase: 'running' | 'intermission'
  clock: number
  voltage: number
  multiplier: number
}

export const CHANNEL = {
  charge: 'nw:charge',
  advance: 'nw:advance',
  sync: 'nw:sync',
  hello: 'nw:hello'
} as const
