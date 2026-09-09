import { isServer } from '@dcl/sdk/network'
import { initClient } from './client'
import { initServer } from './server'

export function main(): void {
  if (isServer()) initServer()
  else initClient()
}
