# Verification results

Everything below was measured on this build. Where a number is not a valid
measurement of real-world performance, it says so.

- **Build under test:** production build in `dist/` (`npm run build`)
- **Browser:** Chromium 1194 (Playwright), headed, **software rendering
  (SwiftShader)** — this container has no GPU
- **Host:** Linux 6.18 container, 4 vCPU, 15 GB RAM
- **Date:** 2026-09-15

Re-run any of it with:

```bash
npm run verify                     # typecheck + unit and integration tests
node tools/qa/smoke.mjs            # boot, first minutes, save/reload, pause
node tools/qa/smoke.mjs --mobile   # the same on an emulated Pixel 5 with touch
node tools/qa/systems.mjs          # settlement, seasons, retry, challenges,
                                   # the defence, the escort cart, endings
node tools/qa/bosswalk.mjs         # all 30 boss arenas
node tools/qa/bosswalk.mjs 3,17    # or just the stages you name
```

---

## 1. Typecheck and build

| Check | Result |
|---|---|
| `tsc --noEmit` (game + tests) | **clean, 0 errors** |
| `tsc --noEmit -p tsconfig.tools.json` (asset pipeline) | **clean, 0 errors** |
| `vite build` | **succeeds** |
| Bundle | `index.js` 387 kB (113 kB gzip), `phaser.js` 1 208 kB (332 kB gzip) |
| `dist/` total | 24 MB (23 MB of it generated artwork) |
| ZIP package | 225 files, 23.3 MB → **19.4 MB**, all CRCs verified |

---

## 2. Automated tests

`npm test` — **176 tests across 14 files, all passing** (~3 s).

| File | Tests | Covers |
|---|---|---|
| `combat.test.ts` | 22 | damage and armour curves, cooldowns, stamina and its regen delay, attack shapes (arc/circle/ring/line), line of sight, status stack caps, poise, and boss fairness rules |
| `rings.test.ts` | 22 | the rank ceiling formula, power scaling, **separate caps for range / cooldown reduction / crowd control**, **slot exclusivity**, support-only support slots, deterministic forge upgrades, duplicates→shards, all six synergies, and **non-recursion** |
| `progression.test.ts` | 14 | the XP formula, the level-30 cap, the **main-path pacing targets**, per-level growth, talents and prerequisites, three loadouts, difficulty profiles |
| `economy.test.ts` | 15 | atomic transactions, no negative balances, no double purchase, full refunds, **one-time rewards across reload**, and a **full-campaign economy simulation** |
| `building.test.ts` | 19 | placement validation (outside / overlap / doorway / unreachable / unique / tier), rotation, free moves, refunds, undo, the settlement tier costs, socket unlock |
| `save.test.ts` | 12 | export/import round-trip, rejection of newer saves, clamping, dropping unknown ids, level recomputation, **exclusivity enforced on import**, boss checkpoints, **v1 → v3 migration** |
| `seasons.test.ts` | 12 | the four-day calendar, season snapshots, the ±15 % damage budget, distinct per-season interactions, and **objective reachability in all four seasons on all 30 stages** |
| `stagegen.test.ts` | 5 | reachability, checkpoint/boss door/exit on every stage, objective counts, determinism, seasonal gating |
| `fixtures.test.ts` | 12 | all 30 boss encounters as data: phases, health curve, attack-to-player-health ratio, rewards, and the named mechanics from the stage table |
| `content.test.ts` | 6 | structural validation of the whole content layer, counts, the boss-per-stage rule, and **every `t('…')` key in the source being present in the dictionary** |
| `replay.test.ts` | 15 | the challenge board's unlock rules, reduced repeat payouts, personal bests, **challenges never touching campaign progress or experience**, the six-boss gauntlet's ordering and timing, cloak unlocks and collection totals |
| `escort.test.ts` | 10 | the cart's leash, wall-following round an obstacle, breaking, self-repair, patching at a stop, and restoration on a retry |
| `fixedstep.test.ts` | 7 | **that a stretch of wall-clock time produces the same simulated time at 144, 60, 30, 12 and 7 FPS**, that a long stall is clamped rather than replayed, that catch-up is limited by the frame clamp rather than a lower step cap, and that a smoothed engine delta cannot slow the simulation down |
| `atlas.test.ts` | 5 | every `frames`, `glyphs`, `rings` and `vfx` frame name in the source exists in the generated atlas |

### What the economy simulation found

Walking the entire campaign on the main path only — first clears and their
exploration income, nothing repeated — the settlement track, a full
weapon/armour/boot line and one ring taken to rank 10 initially came to
**22 785 gold against 22 775 earned**: a 0.04 % shortfall.

That is a real progression deficit, so the **exploration income curve was raised**
(`46 + 24·stage` → `60 + 32·stage`) rather than expecting players to repeat
stages. The simulation now passes with a comfortable margin, and it runs on
every `npm test`.

---

## 3. Browser verification — desktop

`node tools/qa/smoke.mjs`, 1024×640, production build.

| Check | Result |
|---|---|
| Boot to title screen | **pass** |
| Canvas fills the viewport | **pass** |
| New Game → control on the ruined road | **pass — 1.8 s** (budget: 15 s) |
| Player moves, and the world scrolls with them | **pass** — 165 world px in 0.9 s of input, camera scrolled 49 px |
| **Move and attack at the same time** | **pass** — moved 85 px while the swing was in its active frames |
| Dodge costs stamina | **pass** — 25 stamina, as specified |
| Ring cast starts a cooldown | **pass** — Ember, 8.0 s |
| Flask heals and decrements | **pass** — 3→2 charges, health 10→52 |
| Save, reload, and the campaign is intact | **pass** — gold survived a full page reload |
| Continue resumes from the checkpoint | **pass** — reopened into `Stage, UI` |
| Pause menu opens and closes | **pass** |
| **Console errors** | **0** |
| **Failed requests / missing assets** | **0** |

---

## 4. Browser verification — all 30 boss arenas

`node tools/qa/bosswalk.mjs` opens every stage through `?fixture=<n>`, walks to
the boss door, fights the boss through its phases with real damage, and confirms
the defeat path. Full output: `qa-shots/bosswalk-report.txt`.

**30/30 arenas verified**, console errors and failed requests: **0**.

Each line is one arena: the boss that spawned, its health, phases entered
out of phases defined, distinct attacks seen, telegraphs counted, hits the
boss landed on the player and damage it dealt. The player is **not** made
invulnerable, so a run only passes if the boss actually connected.

```
# Stages 1-21 and 24-30 are from one uninterrupted run of the full walk.
# Stages 22 and 23 are from a re-run of those two stages immediately after,
# on the same build plus one fix: their bosses damage the player through
# ground hazards, and the diagnostic counter was not watching that path, so
# the first run recorded dmg=0 and failed working code. Both bosses reached
# defeated=true in both runs.

PASS  stage  1  boss_gritch arena=road_toll hp=320 phases=1/1 attacks=3/3 telegraphs=41 hits=7 dmg=104 defeated=true
PASS  stage  2  boss_kruk arena=mill_yard hp=454 phases=1/1 attacks=1/3 telegraphs=39 hits=9 dmg=108 defeated=true
PASS  stage  3  boss_bellwight arena=barrow_ring hp=618 phases=2/2 attacks=3/3 telegraphs=137 hits=18 dmg=84 defeated=true
PASS  stage  4  boss_greyfang arena=wolf_pass hp=759 phases=1/1 attacks=1/3 telegraphs=65 hits=17 dmg=238 defeated=true
PASS  stage  5  boss_mogrun arena=rootbound_pillars hp=1329 phases=2/2 attacks=3/4 telegraphs=181 hits=25 dmg=457 defeated=true
PASS  stage  6  boss_ssilka arena=web_hollow hp=1091 phases=2/2 attacks=2/4 telegraphs=120 hits=20 dmg=2086 defeated=true
PASS  stage  7  boss_briararcher arena=waystation hp=1183 phases=1/1 attacks=1/3 telegraphs=50 hits=13 dmg=182 defeated=true
PASS  stage  8  boss_norgath arena=mire_shrine hp=1412 phases=2/2 attacks=3/3 telegraphs=194 hits=21 dmg=602 defeated=true
PASS  stage  9  boss_hushcaller arena=grove_wards hp=1507 phases=2/2 attacks=2/3 telegraphs=92 hits=7 dmg=98 defeated=true
PASS  stage 10  boss_ashweb_queen arena=ashweb_throne hp=2447 phases=2/2 attacks=3/5 telegraphs=139 hits=11 dmg=1858 defeated=true
PASS  stage 11  boss_rockjaw arena=quarry_floor hp=1897 phases=2/2 attacks=3/3 telegraphs=172 hits=31 dmg=899 defeated=true
PASS  stage 12  boss_bragg arena=furnace_hall hp=2014 phases=2/2 attacks=4/4 telegraphs=179 hits=16 dmg=458 defeated=true
PASS  stage 13  boss_whitefang arena=ice_bridge hp=2203 phases=2/2 attacks=2/4 telegraphs=115 hits=23 dmg=577 defeated=true
PASS  stage 14  boss_ironecho arena=anvil_hall hp=2398 phases=2/2 attacks=3/4 telegraphs=142 hits=34 dmg=495 defeated=true
PASS  stage 15  boss_durnok arena=chained_deep hp=3567 phases=2/2 attacks=3/4 telegraphs=164 hits=21 dmg=540 defeated=true
PASS  stage 16  boss_karg arena=flooded_ford hp=2756 phases=2/2 attacks=4/4 telegraphs=133 hits=25 dmg=2006 defeated=true
PASS  stage 17  boss_uzg arena=siegeworks hp=2866 phases=2/2 attacks=2/4 telegraphs=82 hits=15 dmg=425 defeated=true
PASS  stage 18  boss_wardrummer arena=bannerfield hp=3126 phases=2/2 attacks=4/4 telegraphs=180 hits=22 dmg=5686 defeated=true
PASS  stage 19  boss_cinderknight arena=ember_watch hp=3287 phases=2/2 attacks=3/4 telegraphs=117 hits=20 dmg=930 defeated=true
PASS  stage 20  boss_varzug arena=red_banner_keep hp=4885 phases=3/3 attacks=4/5 telegraphs=149 hits=22 dmg=2565 defeated=true
PASS  stage 21  boss_glasswight arena=mirror_barrows hp=3610 phases=2/2 attacks=4/4 telegraphs=139 hits=19 dmg=4283 defeated=true
PASS  stage 22  boss_riftkeeper arena=obsidian_pass hp=3834 phases=2/2 attacks=2/3 telegraphs=105 hits=2 dmg=323 defeated=true
PASS  stage 23  boss_paleflame arena=winter_tower hp=4063 phases=2/2 attacks=2/3 telegraphs=104 hits=4 dmg=672 defeated=true
PASS  stage 24  boss_oathbreaker arena=fallen_courtyard hp=4435 phases=2/2 attacks=4/4 telegraphs=151 hits=22 dmg=812 defeated=true
PASS  stage 25  boss_nameless_nazgul arena=black_causeway hp=6205 phases=2/2 attacks=4/5 telegraphs=131 hits=19 dmg=702 defeated=true
PASS  stage 26  boss_gruk arena=siege_trench hp=4637 phases=2/2 attacks=3/4 telegraphs=136 hits=13 dmg=420 defeated=true
PASS  stage 27  boss_cindermaw arena=smouldering_forge hp=4959 phases=2/2 attacks=3/4 telegraphs=109 hits=17 dmg=816 defeated=true
PASS  stage 28  boss_castellan arena=broken_citadel hp=5212 phases=2/2 attacks=4/5 telegraphs=148 hits=24 dmg=1150 defeated=true
PASS  stage 29  boss_oaththief arena=last_beacon hp=5471 phases=2/2 attacks=5/5 telegraphs=134 hits=23 dmg=1010 defeated=true
PASS  stage 30  boss_ashen_regent arena=eclipse_summit hp=7803 phases=3/3 attacks=6/6 telegraphs=131 hits=17 dmg=949 defeated=true

30/30 boss arenas verified
console errors / failed requests: 0
```

---

## 5. Systems verification

`node tools/qa/systems.mjs`. Full output: `qa-shots/desktop-systems-report.txt`.

Desktop: **16 passed, 0 failed**, console errors: **0**.
Emulated Pixel 5: **16 passed, 0 failed**, console errors: **0**.

```
PASS  a full stage can be finished and pays out once
      first clear 1882 gold, replay +708 (38%)
PASS  stages can be entered, left and re-entered without breaking
      visit 1: stage 4, 13 enemies, HUD live
      visit 2: stage 12, 22 enemies, HUD live
      visit 3: stage 4, 13 enemies, HUD live
PASS  the settlement loads and can be walked
      walked 176 world px
PASS  a building can be placed, moved and dismantled for a full refund
      placed for 25 gold, moved for 0, 0 left
PASS  both settlement ring sockets accept and release a ring
      equipped -> slot:active1, then socketed -> socket:0 (active1 now null), socket0=ember socket1=null
PASS  resting advances a day and the season turns after four
      autumn:1 -> autumn:2 -> autumn:3 -> winter:0
PASS  a seasonal route opens only in its own season
      spring=closed  summer=closed  autumn=closed  winter=open
PASS  death and retry keeps loot and does not duplicate rewards
      cache paid 116 gold once; after retry still 116, health 388, flask 3
PASS  a full inventory sends rewards to the stash instead of losing them
      overflow held 1 item in the stash, then reclaimed into the bag (sword_valley, bow_hunting)
PASS  the ending scene offers both choices and each writes an epilogue
      spread -> spread/valley-light/epilogue shown
      concentrate -> concentrate/valley-light,hearth-light/epilogue shown
PASS  the settlement offers the challenge hub only once there is one
      3 stages cleared -> Build, The Northern Valley, Rest until morning, Pause
      campaign finished -> Build, The Northern Valley, Challenges, Rest until morning, Pause
PASS  the challenge hub opens and every tab renders
      board=11 objects  hard=11 objects  gauntlet=17 objects  collection=11 objects  stronghold=12 objects
PASS  the stronghold card renders from the save
      900x560, 1338 lit samples
PASS  a boss challenge pays out without touching campaign progress
      opened at the boss door=true, +110 gold, best=23133ms, scenes=Result
PASS  the settlement defence runs its waves and never risks the settlement
      waves 1,2,3 on the settlement map, up to 7 raiders at once, buildings unchanged (0)
PASS  the escort cart rolls with the player and survives being broken
      idle 0px, escorted 1063px, 1 stop(s) reached and kept, repaired to 418 hp

console errors: 0
```

### The same checks on an emulated phone

```
PASS  a full stage can be finished and pays out once
      first clear 1882 gold, replay +708 (38%)
PASS  stages can be entered, left and re-entered without breaking
      visit 1: stage 4, 13 enemies, HUD live
      visit 2: stage 12, 22 enemies, HUD live
      visit 3: stage 4, 13 enemies, HUD live
PASS  the settlement loads and can be walked
      walked 135 world px
PASS  a building can be placed, moved and dismantled for a full refund
      placed for 25 gold, moved for 0, 0 left
PASS  both settlement ring sockets accept and release a ring
      equipped -> slot:active1, then socketed -> socket:0 (active1 now null), socket0=ember socket1=null
PASS  resting advances a day and the season turns after four
      autumn:1 -> autumn:2 -> autumn:3 -> winter:0
PASS  a seasonal route opens only in its own season
      spring=closed  summer=closed  autumn=closed  winter=open
PASS  death and retry keeps loot and does not duplicate rewards
      cache paid 116 gold once; after retry still 116, health 388, flask 3
PASS  a full inventory sends rewards to the stash instead of losing them
      overflow held 1 item in the stash, then reclaimed into the bag (sword_valley, bow_hunting)
PASS  the ending scene offers both choices and each writes an epilogue
      spread -> spread/valley-light/epilogue shown
      concentrate -> concentrate/valley-light,hearth-light/epilogue shown
PASS  the settlement offers the challenge hub only once there is one
      3 stages cleared -> Build, The Northern Valley, Rest until morning, Pause
      campaign finished -> Build, The Northern Valley, Challenges, Rest until morning, Pause
PASS  the challenge hub opens and every tab renders
      board=11 objects  hard=11 objects  gauntlet=17 objects  collection=11 objects  stronghold=12 objects
PASS  the stronghold card renders from the save
      900x560, 1342 lit samples
PASS  a boss challenge pays out without touching campaign progress
      opened at the boss door=true, +110 gold, best=5250ms, scenes=Result
PASS  the settlement defence runs its waves and never risks the settlement
      waves 1,2,3 on the settlement map, up to 7 raiders at once, buildings unchanged (0)
PASS  the escort cart rolls with the player and survives being broken
      idle 0px, escorted 1078px, 1 stop(s) reached and kept, repaired to 418 hp

console errors: 0
```

---

## 6. Mobile

`node tools/qa/smoke.mjs --mobile` — **emulated** Pixel 5 (393×851, touch, 3×
DPR) in the same Chromium.

**10 passed, 0 failed**, console errors: **0**.

```
PASS  boot completes and the title screen appears
PASS  canvas is present and sized to the viewport
      time to control: 1.1s
      active scenes: Stage, UI
PASS  New Game gives control on the ruined road within 15 seconds
      right 179px
      best 179 world px, net 179 px, camera scrolled 73 px
PASS  player moves with keyboard/touch and the world scrolls
      attacked while moving 54px, phase=move
PASS  simultaneous movement and attack
      19.9 FPS (mobile, software GL)
PASS  measure frame rate over 5 seconds
      dodge cost 25, ring cd 8.0s, flask 1, healed to 52
PASS  ring cast, dodge and flask all respond
      gold after reload: 4321
PASS  save and reload restores the campaign
      resumed into: Stage, UI
PASS  Continue resumes the campaign from the saved checkpoint
PASS  pause menu opens and closes without errors

console errors: 0
failed requests: 0
```

> **Emulation, not a physical phone.** These runs use Chromium's device
> emulation: a real viewport, a real touch input pipeline and real touch events,
> but desktop-class CPU and a software GPU. They verify that the touch layout,
> the virtual stick and simultaneous move-and-attack all work. **They are not a
> measurement of performance on phone hardware**, and no run on a physical
> handset has been performed.

---

## 7. Performance

| Measurement | Value |
|---|---|
| Frame rate, desktop viewport (1024×640), software SwiftShader | **7.1 FPS** |
| Frame rate, emulated Pixel 5, software SwiftShader | **19.9 FPS** |

**This number is not a valid desktop measurement.** This container has no GPU,
so Chromium rasterises every frame on the CPU. The figure tells you the build
runs and renders; it says nothing about the 60 FPS desktop target or the 30 FPS
mobile floor.

### What the frame-rate work found

The claim that a fixed step makes game speed independent of frame rate was
**false in the shipped build until this pass**, and the measurement is worth
recording because it is not something the unit tests could have caught.

`tools/qa/probe-delta.mjs` instruments the step accumulator in the production
build and compares simulated time against the clock:

| | before | after |
|---|---|---|
| Real frame interval | 314 ms | 284 ms |
| Delta the step loop received | **16.7 ms** | 284 ms |
| Simulated / elapsed | 133 ms / 2486 ms — **5 %** | 2233 ms / 2517 ms — **89 %** |
| Player moved / expected | 25 px / 470 px | 422 px / 476 px |

The cause was feeding the accumulator the frame delta the engine reports.
Phaser smooths and clamps that towards the target frame time, so a slow frame
still reports about 16.7 ms and the simulation quietly ran at a fraction of
real speed. The step now derives its own delta from a monotonic clock.

On the mobile profile (23 FPS, 42 ms frames — inside the clamp) the same probe
reports **2083 ms simulated over 2072 ms elapsed and 394 px moved of 392
expected**, so the pacing is exact whenever frames stay under the clamp.

The residual 11 % on desktop is the deliberate 250 ms frame clamp doing its
job at roughly 3 FPS: below that the game slows down rather than spiralling.

What *can* be stated from this environment:

- The simulation is on a **fixed 60 Hz step with clamped long frames**, so game
  speed, damage, cooldowns and seasons keep real-time pace at any frame rate
  down to the 250 ms clamp — measured above, not merely designed for.
- Ground is baked once into a batched render texture; only actors, props and
  effects are depth-sorted per frame.
- Enemy counts are bounded, effects are pooled with a per-quality budget
  (18 / 46 / 90 live sprites), and weather scales down or off.
- Render scale, particle quality and seasonal effects are all adjustable.

**Not verified:** the 60 FPS desktop target and the 30 FPS mobile floor. Both
need a run on real hardware, which this environment cannot provide. Treat them
as design targets, not results.

---

## 8. Playtesting

The brief is right that an automated victory is not evidence a fight is
enjoyable, and this needs stating plainly:

- **What was done:** every one of the 30 boss encounters was opened and fought
  to completion in the real build, with telegraph counts, phase transitions,
  attack variety and the defeat path recorded per fight. Stage 1's first minutes
  were driven end to end, including the tutorial beats.
- **What was not done:** no human sat down and played this. Feel, pacing,
  readability under pressure, and whether the 4–6 hour first campaign holds up
  are **unvalidated**. The mission durations in the stage table are design
  targets, not measured playthrough times.

The numbers most likely to need a human pass are the boss telegraph windows
(0.42–1.6 s), the stage encounter counts, and the mission length targets. They
are all data in `src/content`, so they can be tuned without touching code.

---

## 9. What this verification round found

Fourteen defects were found and fixed while producing the results above: ten in
the game and four in the verification harness itself. They are listed because
the pattern matters more than the count.

**In the game**

| Defect | What a player would have seen |
|---|---|
| `cleanup()` cleared Phaser's own plugin listeners off the scene emitter | The second mission of any session was a dead scene |
| The fixed step was fed the engine's smoothed frame delta | The game ran at 5 % speed on slow hardware |
| The HUD scene was never laid out after building its touch controls | The virtual stick's hit area stayed 10×10 px — unplayable by touch on first load |
| `update()` ran during the async `create()` | The scene used the previous run's destroyed player and map |
| The per-frame step cap disagreed with the frame clamp | Time was dropped even when the clamp allowed catch-up |
| The run clock used the same smoothed delta | Personal bests recorded a fraction of the real duration |
| The HUD removed 1 of the 14 listeners it put on the stage's emitter | A stopped HUD threw inside the next stage's `create()` |
| `EndingScene.chosen` and `TitleScene.started` were never reset | A second playthrough's ending choice was ignored |
| The pause menu removed *every* listener for the resize event | After one pause, the HUD stopped relaying out on resize |
| Three nine-slice frames were not in the atlas | Nine page errors, one per challenge-hub row |

Six of the ten are the same misunderstanding in different clothes: **Phaser
reuses scene instances, and its event emitters outlive the scenes that
subscribe to them.** None of them are visible in a single mission on fast
hardware, which is exactly why they survived until the suite covered leaving a
stage and coming back.

**In the harness** — recorded separately because each would have produced a
confident result backed by nothing:

- two dead dynamic imports whose 404s were counted as the game's console errors;
- a leftover process holding the test port, so two runs produced empty logs
  while the pass looked like it had run;
- per-frame damage that rounded to zero for the lowest-health boss, so the test
  could not kill a boss the game kills fine;
- `bossDamageTaken` not counting ground-hazard damage, so two hazard-based
  bosses reported zero damage and failed working code.

The first boss walk of the day reported **30/30 arenas green while the game was
unplayable past the first mission**. That is the cautionary result of this
round: a suite that only ever starts fresh proves only that the game starts.

---

## 10. Known limitations

1. **No real-hardware performance data.** See section 7.
2. **No human playtest.** See section 8.
3. **Not deployed.** `deploy/` holds ready configurations for six hosts, but
   nothing has been published and there is no preview URL.
4. **Boss mechanic depth varies.** Every boss has its own attack set,
   telegraphs, phases and arena, and each of the named mechanics from the stage
   table is implemented as a hook. The most elaborate ones — rotating safe
   sectors, alternating fissures, redirecting a ballista bolt, the Iron Echo's
   delayed repeat — are functional but would benefit from a tuning pass with a
   player in the chair.
5. **The escort cart** steers around obstacles by wall-following rather than
   by a full pathfinding agent. It is verified to travel over 1000 px while
   escorted, to stay put when abandoned, and to keep its stops after being
   broken and repaired, but a deliberately maze-like arena could still stall
   it longer than a pathfinder would.
6. **The settlement defence** is verified for its first three waves in both
   profiles - raiders spawn, the settlement is never damaged, and the run pays
   out - but no run has played all eight waves through to the reward.
7. **Ring synergies and talent interactions** are covered by unit tests rather
   than by play. The rules are enforced and non-recursion is proven, but
   whether a given pairing is *satisfying* is unvalidated.
8. **One locale.** All text is in English, keyed in `src/content/locale`. The
   dictionary is complete and translation-ready; no second language ships.
9. **Audio is synthesised, not composed.** It is original and it works, but a
   generative bed is not the same thing as a written score.
