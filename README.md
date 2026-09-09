# Ghost Relay

A 30-second sprint against the recorded runs of everyone who came before.

Decentraland has about 28 concurrent players across its 100 busiest places. A game that
needs two people online at once is a game nobody can play. So this one records every run
and replays it: the track is always full, even when the world is empty. Passing a ghost
is worth more than running clean, and your best run becomes a ghost other people race.

This repository is a **Decentraland Creator Success V0 application**:

- the Game Design Document at [`design/gdd.md`](design/gdd.md)
- a playable test scene in [`src/`](src), running on the hosted Multiplayer Server

---

## Play it

1. Walk onto the green pad. The run starts immediately — no menu, no lobby.
2. Run the loop. Metres tick up as long as you stay near the racing line.
3. **Pass a ghost** — it ignites orange, you get +50 m and a point of Heat.
4. Heat multiplies everything you earn and drains in about three seconds, so the only
   way to hold it is to keep passing.
5. After 30 seconds you're snapped back to the line. Go again.

The track reshapes every day, and your best run joins the ghost field.

## Running it locally

```bash
npm install
npm start     # preview, with a local Multiplayer Server started automatically
npm run build # bundle + typecheck
```

The scene uses the `auth-server` SDK branch, which is what provides `isServer()`,
`registerMessages()` and `Storage`. `npm install` picks that up from `package.json`.

Local server storage is written to
`node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json` — delete it to reset
the ghost roster while testing.

## Deploying to a Decentraland World

Worlds are addressed by a Decentraland NAME, so the deploying wallet needs to own one
(100 MANA to mint, or buy an existing one on the Marketplace).

1. Add your World name to `scene.json`, at the root level:

```json
"worldConfiguration": { "name": "yourname.dcl.eth" }
```

2. Fill in `owner` and `contact` in `scene.json`.
3. Deploy:

```bash
npm run deploy -- --target-content https://worlds-content-server.decentraland.org
```

This opens a browser and asks the wallet that owns the NAME to sign, so it has to be run
by you on a machine with your wallet — it cannot be done from a CI or agent session.
Publishing the scene publishes the Multiplayer Server with it; there is nothing else to
host. See [publishing options](https://docs.decentraland.org/creator/scenes-sdk7/publishing/publishing-options).

## Layout

| Path | What it does |
|---|---|
| `src/index.ts` | Branches on `isServer()` — the only file that knows about both sides. |
| `src/shared/track.ts` | Daily loop generation, and projecting a position onto it. |
| `src/shared/codec.ts` | Ghost paths ⇄ 900-byte base-36 strings. |
| `src/shared/messages.ts` | Typed client/server message schemas. |
| `src/shared/config.ts` | Every tunable — run length, Heat, scoring, colours. |
| `src/server/index.ts` | Referee: verified positions, scoring, overtakes, Storage, leaderboard. |
| `src/client/index.ts` | Run loop, local feedback mirror, snap-back restart. |
| `src/client/ghosts.ts` | Ghost avatars, replay, ignition on a pass. |
| `src/shared/look.ts` | Reads each runner's profile so their ghost wears their wearables. |
| `src/client/track.ts` | Track, obstacles and start gate geometry. |
| `src/client/hud.tsx` | HUD, sized for a phone. |
| `design/gdd.md` | The Game Design Document. |

## How it works

**The server is the referee.** It reads verified player positions
(`PlayerIdentityData` + `Transform`) every frame — clients never report their own
position for scoring. It decides progress, overtakes and score, and it is what writes to
`Storage`.

**The client mirrors the maths for feedback only.** It runs the same track projection
locally so a ghost ignites on the exact frame you pass it, instead of up to 200 ms later
when the next server tick lands. The number on the HUD is always the server's.

**The track is derived, not transmitted.** Both sides call `buildTrack(dayIndex())` and
get the same loop from the same integer, so track data never crosses the wire.

**Ghosts are real people.** Each one renders through `AvatarShape` using the runner's
live Decentraland profile, so it wears their actual wearables. You can recognise a friend
on the track by their outfit.

**A ghost is a 900-byte string.** 5 Hz sampling, positions quantised to decimetres and
written as fixed-width base-36. A full 16-ghost roster is 14 KB; a single ghost message
is far inside the ~13 KB transport cap.

## Verified so far

`npm run build` passes bundling and typecheck. The geometry and scoring logic is covered
by a simulation in `design/logic-sim.ts` — 21 checks, all passing. Run it with:

```bash
npx esbuild design/logic-sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js
```

It covers:

- points on the racing line project with zero offset
- one lap accumulates to the loop length, and three laps don't spike at the start-line wrap
- running the loop backwards scores nothing
- the middle of the arena is off-line, so cutting the corner doesn't count
- the codec round-trips within 5 cm, and a ghost is 900 bytes
- a 6 m/s run passes a 4 m/s ghost exactly once and never passes an 8 m/s one
- pacing a ghost inside the 1.5 m deadband doesn't flap the overtake flag
- the track reshapes day to day
- avatar looks round-trip, and malformed ones fall back to a default avatar
- a ghost plus its look is ~1.1 KB against the ~13 KB message cap

**Not verified:** anything about how it feels. The scene has not been run in-world, and
whether Decentraland's floaty avatar movement is enjoyable to race is the biggest open
question in the design.

## Known gaps

Deliberate — the test scene proves the mechanic, it is not the vertical slice:

- **No audio.** Heat is a bar that should be a sound.
- **No particles or camera work.** `ParticleSystem` and `VirtualCamera` are both
  available and unused.
- **Ghost roster is just the top 16**, not mixed by difficulty, so there may be nobody
  passable at your level.
- **No onboarding.** A first-timer has to infer the loop from a sign.
- **Cold start is real.** The first player races an empty track.

## Creator Success checklist

| Requirement | Status |
|---|---|
| GDD at `/design/gdd.md` | ✅ |
| Test scene code in the repo | ✅ builds clean |
| At least one interaction from the core mechanic | ✅ full loop: run, record, replay, overtake, score |
| README linking the deployed scene | ⬜ add your World URL below |
| Scene live in a Decentraland World | ⬜ `npm run deploy` from the NAME owner's wallet |
| Repo shared with Foundation reviewers | ⬜ add `pravusjif`, `popuz`, `baybackner`, `nicoE` |
| V0 application form submitted | ⬜ yours to submit — it carries your declarations |

**Deployed test scene:** _(add the World URL here after deploying)_
