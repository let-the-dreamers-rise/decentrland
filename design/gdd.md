# Ghost Relay — Game Design Document

**Version:** 0.2 (Creator Success V0 application)
**Format:** Decentraland SDK7, Multiplayer Server, desktop + mobile
**Run length:** 30 seconds
**Players:** designed for exactly one person being online

---

## 1. The thesis

I pulled Decentraland's live Places API on a Monday evening, 21:00 UTC:

| | |
|---|---|
| Concurrent players across the **top 100 places** | **28** |
| Genesis Plaza, the official spawn | 11 |
| Busiest game in the world, right then | 5 |
| Best game by 30-day visits | 611 (~20/day) |
| Game scenes competing for them | 352 |

Every multiplayer design meeting in this ecosystem has to start there. A game that
needs two people in the same place at the same time is a game that is almost never
playable. Decentraland's own docs concede the point — they recommend *"games that are
turn based, or that are mostly based on player versus environment interactions."*

So Ghost Relay does not ask for a second player. It records everyone's run and replays
them. You sprint a 30-second loop against the recorded runs of everyone who came before,
and passing one is worth more than running clean.

> **The world is empty, so the emptiness is the mechanic.** Nobody is online, so I made
> a game where the track is packed with people who were.

The population problem inverts: every run makes the track denser for the next player.
An empty world is a *cold start*, not a *ceiling*.

## 2. Who this is for

The primary player is someone with a short attention span and a strong pull toward
repeatable loops — the player who will run the same 30 seconds forty times. That is a
design constraint, not a demographic note, and it decides almost everything below.

What that player needs, and what it forces:

| Need | What the game does |
|---|---|
| Reward inside seconds, not minutes | 30-second runs. Score climbs continuously while you move. |
| No dead time between attempts | On finishing, the player is snapped back to the line. Downtime is ~2 s, with no menu, no lobby, no queue. |
| No planning tax | The only instruction is "run forwards". Passing a ghost is a reflex, not a plan. |
| Continuous feedback | Metres tick up every frame; a passed ghost ignites orange on the frame you pass it; Heat rises and visibly drains. |
| Never leave empty-handed | Every run banks a score, and a good one becomes a ghost other people race. |
| Novelty each attempt | The ghost field changes whenever anyone plays. The track reshapes daily. |
| Interruptible | Quitting mid-run costs that run and nothing else. There is no session state to lose. |
| Depth for a long sitting | Your own best run becomes a ghost you can chase, and the leaderboard is persistent. |

**What I deliberately did not build.** No energy meter, no lives, no cooldown gate, no
loot boxes, no streak counter that punishes a missed day. Partly because those are
manipulative, and partly because for *this specific player* they are also bad design:
stopping someone mid-flow to sell them a timer is the fastest way to lose them. The pull
here has to come from the loop being short and the score being close.

### The alignment worth noticing

The compulsive replayer is not just the target customer, they are the **content
pipeline**. A player who runs forty times leaves forty candidate ghosts. Their
compulsion is what makes the track feel populated for the casual player who shows up
next week. Designing for them and designing for world liveness are the same task.

## 3. Core loop

```
  walk onto the green pad
          │
          ▼
   30-second run starts, every ghost launches with you
          │
          ▼
   run the loop ──► metres tick up continuously
          │
          ├─► pass a ghost ──► it ignites, +50 m, Heat +1
          │                     Heat multiplies everything you earn
          │
          └─► Heat drains in ~3 s, so passing again is the only way to hold it
          │
          ▼
   30 s ends → score banked → snapped back to the line (~2 s)
          │
          ▼
   your run becomes a ghost, if it beat your last one
          │
          └──────────────► go again
```

### Numbers

| Element | Value | Why |
|---|---|---|
| Run length | 30 s | Short enough that "one more" is never a decision |
| Restart | ~2 s, automatic snap-back | The single most important number in the design |
| Loop length | ~150 m (varies daily) | About 1.5 laps per run, so ghosts stay in sight |
| Ghosts on track | up to 16 | Dense enough to always have somebody to pass |
| Overtake bonus | +50 m | Roughly a third of a lap: passing beats pure pace |
| Heat per pass | +1, max 8 | |
| Heat decay | 0.34/s (~3 s per point) | Fast enough that Heat is a *streak*, not a *bank* |
| Heat effect | +25% metres per point | At full Heat you earn 3× — worth chasing, not required |
| Sample rate | 5 Hz | 150 samples, 900 bytes per ghost |

**The skill ceiling** is route choice under Heat pressure. Cutting the corner is faster
but leaves the racing line, and metres only count within 5 m of it. So the fast line and
the scoring line diverge, and holding Heat means committing to passes you can actually
make. None of that has to be *understood* to play — it is discovered by doing.

## 4. Why anybody comes back

1. **Your ghost is on the track being beaten.** Other people race the version of you that
   ran yesterday. That is a genuinely social stake that costs no coordination.
2. **The track reshapes daily.** Route knowledge is worth exactly one day.
3. **The scoreboard is small and close.** With this population, a good run puts you top
   three. In a world of 28 concurrent players, being #1 is actually achievable — the
   thin population is a *feature* for the competitive player.
4. **The field grows.** Come back next week and there are more ghosts, so the same track
   plays differently.

## 5. Architecture

The scene runs on Decentraland's hosted Multiplayer Server, so there is no backend to
pay for or operate.

- **The server is the referee.** It reads *verified* player positions
  (`PlayerIdentityData` + `Transform`), so progress, overtakes and score cannot be
  spoofed by a client. The client never reports its own position for scoring.
- **The client mirrors the maths for feedback only.** It runs the same projection
  locally so a passed ghost lights up on the exact frame, rather than up to 200 ms later
  when the next server tick lands. The score on screen is always the server's.
- **The track is derived, not transmitted.** Both sides call `buildTrack(day)` and get
  the same loop from the same integer.
- **Ghosts are 900-byte strings.** Positions quantised to decimetres, base-36, fixed
  width — a full 16-ghost roster is 14 KB, and one ghost message is far inside the
  ~13 KB transport cap.
- **Storage holds the roster**, one ghost per key, plus a leaderboard and each player's
  best. Written at run end only, never per frame.

The server shuts down when the scene empties, which is fine: everything needed to
restart is in Storage, and there is nothing to simulate while nobody is running.

## 6. Scope

### Built (this repository)

The complete core loop: 30-second runs triggered by standing on the pad, server-side
recording of verified positions, ghost persistence and replay, overtake detection with a
1.5 m deadband, Heat, distance scoring with off-line rejection, snap-back restart,
persistent leaderboard and personal best, daily track generation, and a HUD sized for a
phone.

### V0 vertical slice ($1,000 scope)

1. **Audio.** The pass, the Heat tick, the last five seconds. Heat is currently a bar;
   it needs to be a sound.
2. **Particles and camera.** A burst on the pass and a slight FOV or shake as Heat
   climbs. `ParticleSystem` and `VirtualCamera` are both in the SDK and unused so far.
3. **Ghost selection.** Currently the roster is the top 16. It should be *mixed* — a
   couple just above your level, some far ahead, one of your own — so there is always a
   pass available and always one out of reach.
4. **The first 20 seconds.** A first-time player should be running before they have read
   anything. This is the highest-risk untested part.
5. **A real result beat.** Two seconds of "you passed 4, you were passed by 1", which is
   also where the social hook belongs.
6. **Instrumented playtest** (§7).

### Not in V0

Wearables and cosmetics, tokens or rewards, LAND, seasons, custom 3D art. None of them
answer the retention question.

## 7. What the V0 playtest measures

> **Hypothesis: recorded players are a good enough substitute for present players that
> sessions stop depending on concurrency.**

| Metric | Bar |
|---|---|
| Runs per session (median) | ≥ 6 |
| Time from arrival to first completed run | < 45 s |
| Restart rate — runs that begin within 10 s of the last ending | ≥ 70% |
| Session length with 0 other players present vs. 2+ | within 20% of each other |
| Day-2 return | any measurable baseline |
| Ghosts added per active day | ≥ 1 per active player |

That fourth row is the whole thesis. If sessions are still much shorter when nobody else
is online, ghosts are not doing their job and the design is wrong.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Cold start — the first player races nobody | The roster is seeded by whoever plays first, and a solo run still scores. But the first session is measurably worse, and that is a real cost |
| No speed API in the SDK, so a "boost" cannot be literal | Verified during development: `movePlayerTo` teleports and `InputModifier` only disables input. Heat is a multiplier plus visual feedback instead of acceleration |
| Avatar movement is floaty; precise racing may not feel good | The track is wide (5 m each side) and obstacles are sparse. Untested in-world — the top open question |
| 30 seconds may be too short to build any tension | Tunable in one constant; the playtest sets it |
| Snap-back teleport feels jarring | `movePlayerTo` supports interpolation if the instant cut reads badly |
| Somebody farms the leaderboard with one lucky run | Server-side scoring, off-line rejection, one ghost slot per player |

## 9. Reference

Test scene source is in `/src`; `README.md` covers running it and what to look at.
