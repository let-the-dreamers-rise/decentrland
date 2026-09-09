# Ghost Relay — Game Design Document

**Version:** 0.3 (Creator Success V0 application)
**Format:** Decentraland SDK7, hosted Multiplayer Server, desktop + mobile
**Run length:** 30 seconds
**Team:** individual developer

---

## 1. The game

You walk onto a lit pad and a 30-second run starts immediately. A loop of track runs
away from you, and it is **full of other Decentraland residents** — not bots, not
abstractions, but the recorded runs of everyone who has played, each one wearing the
wearables they actually had on. Passing one is worth more than running clean: the ghost
you pass ignites, you gain Heat, and Heat multiplies everything you earn until it drains
three seconds later.

Thirty seconds ends. You are snapped back to the line. Your run, if it was your best,
joins the field — and from then on other people are racing you.

The design goal is a game that is **excellent at every population**: complete and
competitive with one person online, and richer every week as the cast of ghosts grows.

## 2. Why this shape

Decentraland's population is spread thin across a very large number of scenes. On a
Monday evening the hundred busiest places held 28 concurrent players between them,
against 352 scenes tagged as games. That is not a criticism of the platform — it is the
arithmetic any designer here has to build against, and the platform's own docs give the
same guidance, recommending *"games that are turn based, or that are mostly based on
player versus environment interactions"* over real-time coordination.

Most social designs treat that as a constraint to survive. Ghost Relay treats it as the
material. Because every run is recorded, **the game's liveness does not depend on
concurrency at all** — it depends on cumulative visits, which is a number Decentraland
already produces plenty of. The busiest game here sees ~20 visits a day; twenty visits a
day is a dead lobby and a *thriving* ghost field.

This has a property worth stating plainly for anyone assessing risk: **the game cannot
fail for lack of players, only for lack of quality.** There is no population threshold
below which it stops working, and no ceiling above which it stops improving.

## 3. Is this actually social?

The honest answer is that it is social in the second sense, not the first, and it is
worth being explicit rather than letting the criteria be read charitably.

**It is not** synchronous co-presence. Two people in the scene at once do not need each
other to play, and there is no cooperative mechanic between them.

**It is** social in every other respect that produces retention:

- The opposition is **specific, named people**. You pass *Nadia*, not "ghost 4". Her name
  and her score float above her.
- The opposition is **recognisable**. Ghosts render through `AvatarShape` using each
  player's live profile, so they wear their own wearables. You can spot a friend on the
  track by their outfit, which is a thing you can only do in a world with a shared
  identity layer.
- **Your ghost is out there being raced.** Other people are competing against a version
  of you that ran yesterday. That is a real social stake, and it costs no coordination
  to create.
- **The field is a community artifact.** It is built entirely by visitors, and it grows
  whether or not anyone was ever online at the same time.

If the reviewing criterion is strictly "players interacting in real time", this game
does not meet it, and I would rather say so than argue the point. What I would argue is
that in a world with 28 concurrent players, asynchronous social play is the only kind
that reliably *happens*, and that a game which is 100% social 100% of the time beats one
that is deeply social on the rare evenings two people overlap.

## 4. Why this has to be Decentraland

A ghost-racing game could be built in any engine. This one could not:

- **The cast is Decentraland's identity layer.** Ghosts wear real wearables, pulled from
  each runner's profile. The people you race look like themselves. A wearable someone
  bought is visible to every future player on that track — which is a small, genuine
  argument for owning one.
- **Wallet address is a durable identity.** Ghosts and bests are keyed to it with no
  account system, no login, no email.
- **It runs on the hosted Multiplayer Server**, so there is no infrastructure between the
  scene and the platform, and the server can read verified positions the client cannot
  forge.
- **It sits inside a shared world.** Somebody walking past sees avatars racing a loop,
  which is a better advertisement than any listing copy.

## 5. Core loop

```
  walk onto the pad
          │
          ▼
   30-second run starts, the whole ghost field launches with you
          │
          ▼
   run the loop ──► metres tick up continuously
          │
          ├─► pass a ghost ──► it ignites, +50 m, Heat +1
          │                     Heat multiplies everything you earn
          │
          └─► Heat drains in ~3 s — passing again is the only way to hold it
          │
          ▼
   30 s ends → score banked → snapped back to the line (~2 s)
          │
          ▼
   your run joins the field if it beat your last
          │
          └──────────────► go again
```

| Element | Value | Why |
|---|---|---|
| Run length | 30 s | Short enough that "one more" is never a decision |
| Restart | ~2 s, automatic snap-back | The most important number in the design |
| Loop length | ~150 m, reshaped daily | About 1.5 laps per run, so ghosts stay in sight |
| Ghosts on track | up to 16 | Dense enough that somebody is always passable |
| Overtake bonus | +50 m | ~⅓ of a lap: passing beats raw pace |
| Heat | +1 per pass, max 8, −0.34/s | A streak, not a bank |
| Heat effect | +25% metres per point | Full Heat is 3× — worth chasing, never required |

**The skill ceiling** is route choice under Heat pressure: cutting a corner is faster but
leaves the racing line, and metres only count within 5 m of it. So the fast line and the
scoring line diverge. None of that has to be understood to play — it is discovered by
doing.

## 6. Who it is designed for

The core player is someone with a short attention span and a strong pull toward
repeatable loops — the player who runs the same 30 seconds forty times. That shaped
every number above: reward inside seconds, no dead time between attempts, no planning
tax, feedback on every frame, nothing lost by quitting mid-run.

**The alignment that makes this strategically sound:** that player is also the content
pipeline. Forty runs is forty candidate ghosts. Their replay habit is what makes the
track feel populated for the casual visitor next week. Designing for retention and
designing for world liveness are, here, the same task.

**What is deliberately absent:** no energy meter, no lives, no cooldown gates, no loot
boxes, no streak that punishes a missed day. Partly because they are manipulative, and
partly because for this player they backfire — interrupting flow to sell a timer is the
fastest way to lose them.

## 7. Architecture

- **The server is the referee.** It reads *verified* player positions
  (`PlayerIdentityData` + `Transform`), so progress, overtakes and score cannot be
  spoofed. Clients never report position for scoring.
- **The client mirrors the maths for feedback only**, so a passed ghost ignites on the
  exact frame rather than up to 200 ms later.
- **The track is derived, not transmitted.** Both sides call `buildTrack(dayIndex())`.
- **A ghost is ~900 bytes** — 5 Hz samples quantised to decimetres, base-36 — plus a
  ~200-byte packed look. One ghost message is ~1.1 KB against a ~13 KB cap.
- **Storage holds the roster, leaderboard and personal bests**, written at run end only.

The server shuts down when the scene empties, which is fine: everything needed to
restart is in Storage, and there is nothing to simulate while nobody runs.

## 8. Scope

### Built (this repository)

The complete core loop: 30-second runs, server-side recording of verified positions,
ghost persistence and replay as real avatars with real wearables, overtake detection with
a 1.5 m deadband, Heat, distance scoring with off-line rejection, snap-back restart,
persistent leaderboard and personal bests, daily track generation, and a phone-sized HUD.

### V0 vertical slice ($1,000 scope)

1. **Audio.** The pass, the Heat tick, the last five seconds.
2. **Particles and camera.** A burst on the pass, FOV lift as Heat climbs.
   `ParticleSystem` and `VirtualCamera` are both available and currently unused.
3. **Ghost selection.** The roster is currently the top 16; it should be *mixed* — a
   couple just above your level, some far ahead, one of your own — so there is always a
   pass available and always one out of reach.
4. **The first 20 seconds.** A first-timer should be running before reading anything.
   Highest-risk untested part.
5. **A real result beat.** "You passed 4, you were passed by 1" — where the social hook
   belongs.
6. **Instrumented playtest** (§9).

### Not in V0

Wearables and cosmetics of our own, tokens or rewards, LAND, seasons, custom 3D art.
None of them answer the retention question.

## 9. What the V0 playtest measures

> **Hypothesis: recorded players substitute well enough for present players that session
> length stops depending on concurrency.**

| Metric | Bar |
|---|---|
| Runs per session (median) | ≥ 6 |
| Arrival to first completed run | < 45 s |
| Restart rate — runs beginning within 10 s of the last ending | ≥ 70% |
| **Session length with 0 others present vs. 2+** | **within 20% of each other** |
| Day-2 return | any measurable baseline |
| Ghosts added per active player per day | ≥ 1 |

The bolded row is the thesis. If sessions are still much shorter when nobody else is
online, the ghosts are not doing their job and the design is wrong. That is the result
that should decide whether this progresses, and I would rather find it in V0 than later.

## 10. Risks

| Risk | Mitigation / status |
|---|---|
| A reviewer reads "asynchronous" as "not social" | Addressed head-on in §3 rather than left implicit. This is the main assessment risk, not a technical one |
| Cold start — the first player races nobody | A solo run still scores, and the roster seeds from the first session. But the first visit is measurably worse, and that is a genuine cost |
| Avatar movement is floaty; racing may not feel good | The track is wide (5 m each side), obstacles sparse. **Untested in-world — the top open question** |
| Mobile touch racing | Movement-only controls, no precision aiming, no buttons behind menus |
| No speed API in the SDK, so a boost cannot be literal | Verified during development: `movePlayerTo` teleports, `InputModifier` only disables input. Heat is a multiplier plus visual feedback instead |
| 30 seconds may be too short to build tension | One constant; the playtest sets it |
| Leaderboard farming | Server-side scoring, off-line rejection, one ghost slot per player |
| Profile fetch fails or a player has no profile | Falls back to a default avatar; the ghost still races |

## 11. Reference

Source is in `/src`. `design/logic-sim.ts` covers the geometry, scoring and encoding with
21 checks. `README.md` covers running and deploying it.
