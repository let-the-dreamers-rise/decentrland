# Nightwire

A co-op arena game for Decentraland. Nodes light up around a small arena, you charge them
by standing on them, and the Core fills. Every third wave puts up a **linked pair** — two
nodes that only charge while somebody is standing on both at once — worth three times a
solo node.

This repository is the project for a **Decentraland Creator Success V0 application**:

- the Game Design Document at [`design/gdd.md`](design/gdd.md)
- a playable test scene in [`src/`](src) built on SDK7

---

## Play it in 30 seconds

1. Spawn at the south edge of the arena and walk in.
2. **Amber pad** — stand on it for ~1.4 s. A column grows; when it tops out the Core gets
   taller and you score.
3. Charge again within 5 seconds to step the chain multiplier up (max ×5).
4. **Magenta pair with a beam between them** — these do not move unless a player is
   standing on *each* end. Grab somebody. They are worth 18v instead of 6v.
5. A round is 90 seconds. Fill the Core to 100v to end it early. Then 12 seconds and the
   next round starts on the same daily grid.

Node positions rotate daily (the HUD names the day's grid), so the routes change even
though the arena does not.

## Running it locally

```bash
npm install
npm start          # opens the scene in the local preview
```

Build and typecheck only:

```bash
npm run build
```

## Deploying to a Decentraland World

The scene is 2×2 parcels and deploys as-is:

```bash
npm run deploy -- --target-content https://worlds-content-server.decentraland.org
```

Before deploying, fill in `owner` and `contact` in `scene.json`, and set the World name
under `worldConfiguration` (see the
[publishing options docs](https://docs.decentraland.org/creator/scenes-sdk7/publishing/publishing-options)).
Deploying signs with your wallet, so it has to be run by the account that owns the NAME —
it is not something this repository can do for you.

## What is in here

| Path | What it does |
|---|---|
| `src/index.ts` | Entry point. Resolves the player id, builds the game, mounts the HUD. |
| `src/game.ts` | Round state machine, wave selection, charging, scoring, host election. |
| `src/nodes.ts` | Node and Core entities, and the per-frame rendering of their state. |
| `src/arena.ts` | Floor, boundary, guide rings, the day's grid sign. Static geometry. |
| `src/players.ts` | Local and remote avatar positions, used for node occupancy. |
| `src/daily.ts` | The seeded rng, the day index, and the shuffle every client agrees on. |
| `src/net.ts` | `MessageBus` channels and message shapes. |
| `src/config.ts` | Every tunable in one file — timings, values, colours, palette. |
| `design/gdd.md` | The Game Design Document. |

## How multiplayer works

There is no server. Two ideas keep clients agreeing:

**Layout is derived, not synced.** Which nodes light up on a given wave is
`shuffle(hash(UTC day, round, step))`. Every client computes the same wave from the same
three integers, so no layout message is ever sent.

**Only outcomes travel.** When a node finishes charging, exactly one client announces it —
the occupant with the lowest wallet address on that node, and on a linked pair the lower
of the two node ids decides — so a two-player link still produces a single message. The
lowest address in the scene acts as host: it retires waves that time out and broadcasts a
1 Hz heartbeat that late joiners snap to.

This is deliberately lightweight and it has limits: a client that joins mid-round trusts
the heartbeat, and the scoring is client-authoritative. Moving round state to a server is
part of the V0 scope in the GDD, alongside the persistence that streaks and leaderboards
need.

## Known limitations of the test scene

These are scoped deliberately — the test scene is meant to prove the core mechanic, not
to be the vertical slice:

- **No persistence.** Streaks, personal bests and leaderboards are session-only. This is
  the first item of V0 scope.
- **No audio.** The chain multiplier especially wants a sound.
- **No onboarding wave.** The two-player rule is currently learned by walking into it.
- **Waves are shuffled, not authored.** V0 replaces the shuffle with hand-built wave
  archetypes.
- **All geometry is engine primitives.** That is a mobile-performance choice for the test
  scene, and also means there is no custom art to review yet.

## Creator Success checklist

| Requirement | Status |
|---|---|
| GDD at `/design/gdd.md` | ✅ in this repo |
| Test scene code in the repo | ✅ `src/`, builds clean with `npm run build` |
| At least one interaction from the core mechanic | ✅ proximity charging, chain multiplier, linked pairs |
| README linking the deployed scene | ⬜ add your World URL below once deployed |
| Scene live in a Decentraland World | ⬜ run `npm run deploy` from a wallet that owns the NAME |
| Repo shared with the Foundation reviewers | ⬜ add `pravusjif`, `popuz`, `baybackner`, `nicoE` |
| V0 application form submitted | ⬜ submit yourself — it needs your identity and declarations |

**Deployed test scene:** _(add the World URL here after deploying)_
