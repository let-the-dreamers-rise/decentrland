import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import * as C from '../shared/config'
import { view } from './state'

const PANEL = Color4.create(0.02, 0.03, 0.06, 0.75)
const GREEN = Color4.create(0.3, 1, 0.7, 1)
const HEAT = Color4.create(1, 0.55, 0.1, 1)
const DIM = Color4.create(0.62, 0.7, 0.85, 1)
const WHITE = Color4.create(1, 1, 1, 1)

export function setupHud(): void {
  ReactEcsRenderer.setUiRenderer(hud)
}

function pct(value: number, max: number): `${number}%` {
  const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : value / max))
  return `${Math.round(ratio * 100)}%`
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
    <UiEntity
      uiTransform={{ width: 300, flexDirection: 'column', alignItems: 'center', padding: 10, margin: { top: 10 } }}
      uiBackground={{ color: PANEL }}
    >
      {/* One number, as large as the HUD allows. */}
      <UiEntity
        uiTransform={{ width: '100%', height: 44 }}
        uiText={{ value: `${view.score}`, fontSize: 40, color: view.running ? WHITE : DIM }}
      />
      <UiEntity uiTransform={{ width: '100%', height: 16 }} uiText={{ value: 'metres', fontSize: 11, color: DIM }} />

      {/* Time left. Drains left to right, no digits to parse. */}
      <UiEntity
        uiTransform={{ width: '100%', height: 8, margin: { top: 6 } }}
        uiBackground={{ color: Color4.create(1, 1, 1, 0.12) }}
      >
        <UiEntity
          uiTransform={{ width: pct(view.remaining, C.RUN_SECONDS), height: '100%' }}
          uiBackground={{ color: view.remaining < 6 ? HEAT : GREEN }}
        />
      </UiEntity>

      {/* Heat. Climbs on every overtake, drains fast. */}
      <UiEntity
        uiTransform={{ width: '100%', height: 12, margin: { top: 4 } }}
        uiBackground={{ color: Color4.create(1, 1, 1, 0.1) }}
      >
        <UiEntity uiTransform={{ width: pct(view.heat, C.MAX_HEAT), height: '100%' }} uiBackground={{ color: HEAT }} />
      </UiEntity>
      <UiEntity
        uiTransform={{ width: '100%', height: 18, margin: { top: 3 } }}
        uiText={{
          value: view.heat > 0.1 ? `HEAT x${(1 + view.heat * 0.25).toFixed(2)}` : 'pass a ghost for heat',
          fontSize: 13,
          color: view.heat > 0.1 ? HEAT : DIM
        }}
      />
    </UiEntity>

    <UiEntity
      uiTransform={{ width: 340, flexDirection: 'column', alignItems: 'center', padding: 8, margin: { bottom: 14 } }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity
        uiTransform={{ width: '100%', height: 22 }}
        uiText={{ value: view.message, fontSize: 15, color: view.messageHot ? HEAT : GREEN }}
      />
      <UiEntity
        uiTransform={{ width: '100%', height: 18 }}
        uiText={{
          value: `best ${view.best}  ·  ${view.overtakes} passed  ·  ${view.ghosts} ghosts on track`,
          fontSize: 12,
          color: DIM
        }}
      />
      <UiEntity
        uiTransform={{ width: '100%', height: 18 }}
        uiText={{ value: view.boardLine, fontSize: 12, color: DIM }}
      />
    </UiEntity>
  </UiEntity>
)
