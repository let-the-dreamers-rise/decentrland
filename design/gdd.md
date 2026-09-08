# Nightwire — Game Design Document

**Version:** 0.1 (Creator Success V0 application)
**Format:** Decentraland SDK7 scene, desktop + mobile client
**Session length:** 90-second rounds, played back to back
**Players:** 1 to ~15 in a scene; designed to get better with every extra person

---

## 1. One paragraph

Nightwire is a co-op arena game about charging a Core before the round runs out. Nodes
light up around a small arena and you charge them by standing on them. Solo, you can
keep the Core ticking over. But every third wave puts up a **linked pair** — two nodes
that only charge while somebody is standing on *both at the same time* — and those are
worth three times as much. The fastest way to a high round is not to run faster. It is
to be standing on the other end of somebody else's wire.

---

## 2. Why somebody plays this once

The first 20 seconds have to teach the whole game without a tutorial.

- You spawn at the edge of a lit arena. There is one obvious thing in the middle (the
  Core) and a ring of pads around it.
- Two pads are amber. Amber is the only colour that reads as "go here".
- You walk onto one. A column grows out of it. It completes, the Core gets taller, a
  number goes up. That is the whole grammar, learned in about four seconds.
- Then a magenta pair appears with a beam between them, and it does not charge. The
  beam is the explanation: two ends, and you are one of them.

No text tutorial, no UI to read before playing. The HUD carries a round timer, the Core
fill, and one line of state.

## 3. Why somebody comes back tomorrow

This is the question Creator Success asks, so it gets its own section rather than being
folded into "features".

1. **The daily grid.** Node positions are rotated from a seed derived from the UTC day,
   and the day's grid has a name (Ember, Halide, Cobalt…). The arena is recognisably the
   same place, but the routes through it change every day. A regular player builds
   route knowledge that is worth exactly one day.
2. **A round is 90 seconds, and rounds never stop.** There is no lobby and no queue. The
   cost of "one more" is low enough that the natural exit point is when your friends
   leave, not when the round ends.
3. **The link nodes are a reason to bring somebody.** A solo player can always play, but
   they can visibly see the score they are leaving on the table. That converts into
   "come stand on this with me", which is the invite mechanic doing its own marketing.
4. **Streaks and a daily best** (V0 scope, see §7). Playing the daily grid at all extends
   a streak; the streak is the thing you do not want to drop.

The honest risk here is that 1 and 4 are *habit* hooks, and only 3 is a *social* hook.
The design bets on 3 being the strong one, and the V0 playtest is built to test that
specifically (§8).

## 4. Core loop

```
    round starts (90s, Core at 0v)
              │
              ▼
    a wave of nodes lights up  ◄──────────────┐
              │                               │
       run to a node                          │
              │                               │
    stand on it — a column charges            │
              │                               │
    ┌─────────┴─────────┐                     │
    │                   │                     │
  solo node         linked pair               │
  charges alone     needs both ends held      │
    │                   │                     │
    └─────────┬─────────┘                     │
              ▼                               │
    Core gains voltage × chain multiplier ────┘
              │
              ▼
   Core full → the round ends early, everyone wins it together
   timer out → the round ends at whatever voltage you reached
              │
              ▼
   12-second intermission, next wave of the same daily grid
```

### Moment to moment

| Element | Value | Reasoning |
|---|---|---|
| Solo charge time | 1.4 s | Long enough to be interruptible, short enough that a wave is not a chore |
| Link charge time | 1.0 s | Coordinating is already the hard part; do not also tax it on time |
| Solo node value | 6v | |
| Link node value | 18v | 3× — the pair should feel like the thing worth organising around |
| Chain window | 5 s | Charge again within 5 s and the multiplier steps up, max ×5 |
| Wave timeout | 12 s | A wave nobody can finish retires itself, so a solo player is never stuck |
| Round target | 100v | Reachable solo with a good chain; comfortable with three players |
| Round length | 90 s | Short enough to re-enter casually on mobile |

### The chain multiplier is the skill ceiling

Voltage is `base × multiplier`, and the multiplier only survives if the next charge lands
within 5 seconds. That turns the arena into a routing problem: the greedy move (nearest
node) and the correct move (the node that keeps the chain alive through the *next* two
waves) come apart. With more players, the routing problem becomes a division-of-labour
problem, which is where the social play actually lives — not in the link nodes alone,
but in people silently agreeing who takes which half of the ring.

## 5. Social design

Three layers, deliberately ordered from "works with strangers" to "works with friends":

1. **Ambient (0 coordination).** More players in the scene means more nodes light per
   wave. Other people are visibly making the Core rise. Strangers help you without
   either party doing anything.
2. **Structural (needs presence, not conversation).** Linked pairs cannot be completed
   alone. This is the only hard gate in the game, and it is intentionally solvable by
   walking, not by talking — which matters on mobile, where typing is expensive.
3. **Tactical (rewards actual coordination).** Keeping a ×5 chain alive across a wave
   boundary needs somebody already standing near the next node. Voice or text helps but
   is never required; pointing an avatar at a pad is enough.

Failure states are shared and blameless: the Core just ends lower. There is no mechanic
for one player to cost another player their score, which is a deliberate choice for a
public, drop-in space where the person next to you is a stranger.

## 6. Mobile-first constraints

The scene is designed against the Decentraland Mobile App first, and desktop inherits it.

- **No precise aiming.** The core interaction is proximity, not a click or a raycast.
  Everything is playable with a movement stick alone.
- **Node radius is 1.6 m**, generous enough for touch-stick drift.
- **Flat, primitive geometry.** The whole scene is built from engine primitives with
  emissive materials — no downloaded meshes, no textures, so it streams instantly on a
  phone and stays well inside the mobile triangle budget.
- **HUD is three lines, centred, large type.** Nothing in a corner where a thumb sits.
- **Round state is legible from colour alone** — amber = go, magenta = needs two, cyan =
  charged — so the game is playable on a small screen without reading.
- **Boundary walls are 0.7 m** so they never occlude the third-person camera.

## 7. Scope

### Already built (this repository — the application test scene)

- The full core mechanic: proximity charging, charge decay when you step off, per-wave
  node selection, chain multiplier, round timer, Core fill and win condition.
- Linked pairs with the two-player gate and the beam that explains it.
- Deterministic daily grid: node rotation and every wave's layout derive from
  `(UTC day, round, step)`, so all clients agree without syncing layout.
- Multiplayer via `MessageBus`: charge completions are broadcast by a single owning
  client (lowest address on the node), and the lowest address in the scene acts as host
  for round transitions and a 1 Hz state heartbeat.
- HUD, arena, and the daily grid name.

### V0 vertical slice (what the $1,000 scope would deliver)

1. **Persistence.** Streaks, personal bests and the daily leaderboard need a server;
   currently everything is session-scoped. This is the single biggest gap between the
   test scene and a game with a reason to return.
2. **Onboarding wave.** A scripted first wave for a first-time player: one solo node,
   then a link pair with a bot-free hint, so the two-player rule is learned rather than
   discovered by failing.
3. **Audio.** Charge, complete, chain-up, Core-online. The chain multiplier especially
   needs a sound to be felt rather than read.
4. **Wave composition tuning.** Wave shapes currently come from a shuffle. V0 replaces
   this with hand-authored wave archetypes (sprint / split / squeeze) that the seed
   picks between, so the difficulty curve inside a round is designed rather than random.
5. **Proper end-of-round beat.** A results moment with per-player contribution, which is
   also the natural place to surface "you charged 4 links with @someone".
6. **Instrumented playtest.** See §8.

### Explicitly not in V0

Cosmetics and wearable rewards, LAND deployment, seasons, any token or reward mechanic,
custom 3D art, cross-scene progression. All of them are plausible later; none of them
answer the retention question, so none of them belong in the first funded slice.

## 8. What the V0 playtest is trying to learn

The V0 slice exists to test one hypothesis:

> **Linked nodes convert solo players into pairs, and paired players play longer.**

Measured as:

| Metric | What it tells us | Rough bar for "keep going" |
|---|---|---|
| Median session length, solo vs. 2+ concurrent | Whether other people actually lengthen sessions | 2+ sessions ≥ 1.5× solo |
| Link completions per round at 2+ players | Whether the gate is discovered without a tutorial | ≥ 60% of link waves completed |
| Rounds per session | Whether "one more" works | median ≥ 3 |
| Day-2 return on the daily grid | Whether the daily hook has any pull at all | any measurable non-zero baseline |
| Wave timeouts per round | Whether players are ever stuck or confused | < 1 |

If linked nodes turn out *not* to lengthen sessions, the correct response is not to add
content. It is to move the social gate earlier and make it the first thing a player
meets, and re-test.

## 9. Risks

| Risk | Mitigation |
|---|---|
| A player arrives alone and hits a wall on link waves | Every link wave also lights one solo node, and waves time out after 12 s |
| Empty scene at off-peak hours | Solo play is complete and scored; the game never blocks on population |
| MessageBus state drift on a busy scene | Layout is derived, not synced; only completions and a 1 Hz heartbeat travel. V0 moves round state to a server alongside persistence |
| Proximity charging feels imprecise on mobile | 1.6 m radius, charge decays rather than resetting, so a brief drift off the pad is recoverable |
| The chain multiplier is invisible to new players | V0 adds audio and a larger chain readout; currently it is a HUD number only |

## 10. Reference

Test scene source lives beside this document in `/src`. `README.md` explains how to run
it and what to look at first.
