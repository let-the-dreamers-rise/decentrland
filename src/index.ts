import { setupGame } from './game'
import { setupUi } from './ui'
import { initLocalUser } from './players'

export function main(): void {
  // The wallet address decides charge ownership and who hosts, so resolve it
  // before the first round starts. The game is playable either way.
  initLocalUser()
    .then(() => console.log('[nightwire] player ready'))
    .catch((error) => console.log('[nightwire] player id failed', error))

  setupGame()
  setupUi()
}
