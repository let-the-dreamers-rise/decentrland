import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import * as C from './config'
import { game } from './game'

const PANEL = Color4.create(0.02, 0.03, 0.06, 0.72)
const AMBER = Color4.create(1, 0.62, 0.15, 1)
const CYAN = Color4.create(0.25, 0.95, 1, 1)
const LINK = Color4.create(0.95, 0.25, 0.85, 1)
const DIM = Color4.create(0.65, 0.72, 0.85, 1)

export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(hud)
}

function clock(): string {
  const seconds = Math.max(0, Math.ceil(game.clock))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
}

function fillRatio(): number {
  return Math.max(0, Math.min(1, game.voltage / C.TARGET_VOLTAGE))
}

/** The literal type keeps this usable as a `uiTransform` width. */
function fillPercent(): `${number}%` {
  return `${Math.round(fillRatio() * 100)}%`
}

const hud = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}
  >
    {/* Top: round state. Kept centred and large so it survives a phone screen. */}
    <UiEntity
      uiTransform={{
        width: 320,
        flexDirection: 'column',
        alignItems: 'center',
        padding: 10,
        margin: { top: 12 }
      }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity
        uiTransform={{ width: '100%', height: 28 }}
        uiText={{
          value: game.phase === 'running' ? `CORE  ${fillPercent()}   ·   ${clock()}` : `NEXT ROUND  ${clock()}`,
          fontSize: 20,
          color: game.phase === 'running' ? CYAN : AMBER
        }}
      />

      {/* Voltage bar */}
      <UiEntity uiTransform={{ width: '100%', height: 10, margin: { top: 2, bottom: 6 } }} uiBackground={{ color: Color4.create(1, 1, 1, 0.12) }}>
        <UiEntity uiTransform={{ width: fillPercent(), height: '100%' }} uiBackground={{ color: CYAN }} />
      </UiEntity>

      <UiEntity
        uiTransform={{ width: '100%', height: 20 }}
        uiText={{
          value: `${Math.round(game.voltage)} / ${C.TARGET_VOLTAGE}v    chain x${game.multiplier}`,
          fontSize: 14,
          color: DIM
        }}
      />
    </UiEntity>

    {/* Bottom: what to do, and who is here. */}
    <UiEntity
      uiTransform={{
        width: 360,
        flexDirection: 'column',
        alignItems: 'center',
        padding: 8,
        margin: { bottom: 16 }
      }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity uiTransform={{ width: '100%', height: 20 }} uiText={{ value: game.lastMessage, fontSize: 14, color: AMBER }} />
      <UiEntity
        uiTransform={{ width: '100%', height: 18 }}
        uiText={{
          value: game.players > 1 ? 'Magenta pairs need two players at once' : 'Magenta pairs need a second player',
          fontSize: 12,
          color: LINK
        }}
      />
      <UiEntity
        uiTransform={{ width: '100%', height: 18 }}
        uiText={{
          value: `${game.grid} grid  ·  ${game.players} here  ·  you charged ${game.myCharges} (${Math.round(game.myVoltage)}v)`,
          fontSize: 12,
          color: DIM
        }}
      />
    </UiEntity>
  </UiEntity>
)
