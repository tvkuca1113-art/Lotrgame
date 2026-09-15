# Verification results

Everything below was measured on this build. Where a number is not a valid
measurement of real-world performance, it says so.

- **Build under test:** production build in `dist/` (`npm run build`)
- **Browser:** Chromium 1194 (Playwright), headed, **software rendering
  (SwiftShader)** — this container has no GPU
- **Host:** Linux 6.18 container, 4 vCPU, 15 GB RAM
- **Date:** 2026-09-14

Re-run any of it with:

```bash
npm run verify                     # typecheck + unit and integration tests
node tools/qa/smoke.mjs            # boot, first minutes, save/reload, pause
node tools/qa/smoke.mjs --mobile   # the same on an emulated Pixel 5 with touch
node tools/qa/systems.mjs          # settlement, seasons, retry, endings
node tools/qa/bosswalk.mjs         # all 30 boss arenas
```

---

## 1. Typecheck and build

| Check | Result |
|---|---|
| `tsc --noEmit` (game + tests) | **clean, 0 errors** |
| `tsc --noEmit -p tsconfig.tools.json` (asset pipeline) | **clean, 0 errors** |
| `vite build` | **succeeds** |
| Bundle | `index.js` 354 kB (103 kB gzip), `phaser.js` 1 208 kB (332 kB gzip) |
| `dist/` total | 24 MB (23 MB of it generated artwork) |
| ZIP package | 225 files, 23.3 MB → **19.4 MB**, all CRCs verified |

---

## 2. Automated tests

`npm test` — **137 tests across 10 files, all passing** (~2 s).

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
| `content.test.ts` | 4 | structural validation of the whole content layer, counts, and the boss-per-stage rule |

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
| Player moves | **pass** — 34 world px in 0.9 s of input |
| **Move and attack at the same time** | **pass** — moved 9 px while the swing was in its active frames |
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

<!--BOSSWALK-->

---

## 5. Systems verification

`node tools/qa/systems.mjs`. Full output: `qa-shots/desktop-systems-report.txt`.

<!--SYSTEMS-->

---

## 6. Mobile

`node tools/qa/smoke.mjs --mobile` — **emulated** Pixel 5 (393×851, touch, 3×
DPR) in the same Chromium.

<!--MOBILE-->

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
| Frame rate, desktop viewport (1024×640), software SwiftShader | **12–13 FPS** |

**This number is not a valid desktop measurement.** This container has no GPU,
so Chromium rasterises every frame on the CPU. The figure tells you the build
runs and renders; it says nothing about the 60 FPS desktop target or the 30 FPS
mobile floor.

What *can* be stated from this environment:

- The simulation is on a **fixed 60 Hz step with clamped long frames**, so game
  speed, damage, cooldowns and seasons are identical at 12 FPS and at 144 FPS.
  The software-rendered runs above play correctly at 12 FPS.
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

## 9. Known limitations

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
5. **Escort missions** move between safe stops and are recoverable after
   failure, but the escorted cart follows a simple path rather than a full
   pathfinding agent.
6. **The settlement defence challenge** is implemented as an optional,
   manually-started wave mode with capped waves and cosmetic rewards. It is the
   least exercised system in this release.
7. **One locale.** All text is in English, keyed in `src/content/locale`. The
   dictionary is complete and translation-ready; no second language ships.
8. **Audio is synthesised, not composed.** It is original and it works, but a
   generative bed is not the same thing as a written score.
