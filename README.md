# THE LAST HEARTH: RINGS OF THE NORTH

> You begin with a broken sword and nowhere to sleep. Every ring you recover
> changes how you fight. Every victory brings your future stronghold closer.

A single-player, real-time, 2.5D isometric action RPG that runs in desktop and
mobile browsers. Thirty campaign stages, twelve collectible rings, six chapter
bosses, four changing seasons, and a settlement that grows from a camp into a
small castle.

**This is an unofficial, non-commercial fan project.** See
[Fan-project notice](#fan-project-notice).

---

## Quick start

```bash
npm install          # install pinned dependencies (package-lock.json included)
npm run assets       # generate all artwork into public/assets  (~2-3 min, once)
npm run dev          # development server at http://localhost:5173
```

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build at http://localhost:4173
```

```bash
npm test             # 137 unit and integration tests
npm run verify       # typecheck + tests
npm run package      # zip the production build into dist-zip/
```

`npm run dev` and `npm run build` both run `npm run assets` first, so a fresh
clone only needs `npm install` followed by either command.

### Requirements

- Node.js 20.11 or newer (22.x recommended; the asset pipeline uses Node's
  built-in TypeScript stripping)
- No API key, account, server or network access is needed to play.

---

## What is in the box

| | |
|---|---|
| Campaign | 30 stages across 6 regional chapters, each ending in a mandatory boss |
| Bosses | 30 named bosses; stages 5, 10, 15, 20, 25 and 30 are chapter bosses with multiple phases |
| Character | Levels 1-30, 29 talent points, three talent paths of ten nodes each |
| Weapons | Sword and shield, bow, two-handed axe - each with its own combo and secondary action |
| Rings | 12 identities, ranks 1-10, four wearable slots, two settlement sockets, six synergies |
| Settlement | Camp -> wooden cottage -> stone house -> fortified courtyard -> small castle |
| Seasons | Spring, summer, autumn and winter, four in-game days each, with real gameplay effects |
| Saves | IndexedDB, versioned, with a last-known-good backup and validated JSON export/import |
| Endings | Two, both of which keep your collection, buildings and the ability to keep playing |

---

## Controls

### Desktop

| Action | Default |
|---|---|
| Move | `W` `A` `S` `D` or the arrow keys |
| Aim | Pointer |
| Attack | Left mouse button |
| Weapon action (guard / charged shot / heavy) | Right mouse button |
| Dodge | `Space` |
| Ring power I / II | `Q` / `E` |
| Drink flask | `R` |
| Interact | `F` |
| Inventory | `I` |
| Map / journal | `M` |
| Pause | `Escape` |
| Rotate a building (while placing) | `R` |
| Undo the last placement | `Z` |
| Dismantle the structure you are standing at | `X` |

Every binding can be changed in **Settings**. A **keyboard-only** alternative is
available there too: turn on *Keyboard aiming* and your aim follows your
movement direction, so no pointer is needed.

### Touch

- Left half of the screen is a **virtual movement stick** - press anywhere and drag.
- Right side carries **attack, weapon action, dodge, two ring buttons, heal** and
  a **contextual interact** button.
- You can move and attack at the same time.
- **Left-handed layout**, **aim assistance**, **stick size** and **button size**
  are all in Settings. Every touch target is at least 48 CSS pixels.

---

## How a run works

1. Choose a mission on the campaign map. You can see its objective, recommended
   level, the current season, the seasonal route, the boss, and the exact
   rewards before you commit.
2. Explore the stage, fight through the encounters and finish the objective.
3. Step into the boss arena. A **checkpoint sits immediately before every boss**.
4. Beat the boss, collect the reward, and return home.
5. Improve a ring, a piece of equipment or a building, then leave again with a
   different plan.

**Death costs you nothing you found.** The arena and the boss reset, your flask
refills to its checkpoint charges, and every ring, weapon, coin and building
stays yours. Rewards are granted and marked claimed in a single persisted
transaction, so dying, retrying or reloading can never duplicate anything.

---

## Rings

Twelve original lesser rings, each with an active ability, a smaller support
effect, a home effect, evolutions at ranks 4 and 7, and its own icon and lore.

| Ring | Guaranteed from | Active ability |
|---|---|---|
| Ember | Stage 1 discovery | Burning arc that ignites marked growth |
| Stoneward | Stage 2 boss | Barrier that bursts when broken |
| Windstep | Stage 4 boss | Directional dash with a cutting gust |
| Thornwake | Stage 6 boss | Root patch that holds ordinary enemies |
| Dawnward | Stage 8 boss | Light pulse that disrupts dark wards |
| Venomcoil | Stage 9 boss | Venom bolt with capped stacking poison |
| Frostwake | Stage 11 boss | Freezing cone; hardens marked water |
| Iron Oath | Stage 13 boss | Timed guard that staggers what it blocks |
| Echo | Stage 14 boss | Repeats your next weapon attack, weaker |
| Stormcall | Stage 17 boss | Lightning that jumps between a few enemies |
| Duskveil | Stage 21 boss | Short blink leaving a distracting shadow |
| Last Hearth | Stage 25 boss | Shelter circle that intercepts projectiles |

- **Usable rank** is `min(10, 1 + floor((characterLevel - 1) / 3))`.
- **Power** scales as `1 + 0.06 x (rank - 1)`; range, cooldown reduction and
  crowd control each have their own separate cap.
- Upgrades at the forge are **deterministic** - fixed gold and shard costs,
  and a ring is never destroyed.
- A **duplicate** ring becomes shards with a clear notification, so the
  collection stays readable.
- Four wearable slots: Active I from the start, Active II after stage 5,
  Support I after stage 12, Support II after stage 20. **A support slot grants
  only the support effect**, never the active power.
- **A ring can only be in one place at a time** - one slot, or one settlement
  socket, never both.

### Synergies

Six discoverable pairings, each needing **both rings in the two active slots**:
Ember + Windstep, Frostwake + Stormcall, Thornwake + Venomcoil,
Stoneward + Iron Oath, Echo + Duskveil, Dawnward + Last Hearth. Every synergy
has an internal cooldown and a hard effect cap, and synergy effects are tagged
so they can never re-trigger a synergy, Echo, or a further chain.

---

## Wear it, or build with it

After stage 10 the settlement opens **two ring sockets**. Installing a ring
activates its home effect and visibly changes that part of your settlement - and
that ring cannot be worn until you take it back. Switching is free at home, and
removing a ring never deletes a building or disables a crafting station.

Three rings also grant **ring sight** at authored ruins: Ember reveals heat
traces, Dawnward reveals inscriptions, Frostwake reveals a frozen crossing.
These only ever open optional shortcuts, caches and environmental stories -
**the mandatory route always has an ordinary way through**.

---

## Saves

- Stored locally in **IndexedDB**, in a versioned format, with a
  **last-known-good backup** written on every save.
- **Autosaves** after rewards, purchases, upgrades, building changes and safe
  checkpoints - and never relies on an unload event alone.
- **Reloading during a boss resumes at the arena entrance.**
- **Export** writes a validated JSON file; **import** checks the version, every
  id, every range and every resource, keeps a backup of what it replaces, and
  reports anything it had to repair.
- **New Game never silently erases an existing campaign** - the current save is
  archived to a separate slot you can restore from Settings.
- If saving fails (private browsing, blocked storage), the game keeps running in
  memory, says so plainly, and offers an export.

---

## Difficulty

Story, Adventurer (default) and Veteran. Difficulty changes incoming damage,
enemy health and telegraph length - **never the boss patterns**. You can change
it at any time and keep all progress.

---

## Replay

After the campaign the level cap stays at 30. What opens up:

- A **boss challenge board** and harder replays of existing stages
- **The Six** - a gauntlet of all six chapter bosses with checkpoints between
- Collection goals, personal bests, earned banners and cloak colours
- An exportable image of your stronghold

No energy timers, no paid random rewards, no login streaks, no expiring progress.

---

## Project layout

```
src/
  content/        the replaceable content layer - stages, bosses, rings,
                  enemies, talents, equipment, buildings, and all text
    locale/       every player-facing string, keyed for translation
  systems/        pure-ish game systems: progression, rings, combat, economy,
                  inventory, building, seasons, saves, RNG, input, assets
  world/          stage and settlement generation, isometric rendering
  entities/       player, enemies, bosses, projectiles, effects
  scenes/         Phaser scenes: Boot, Title, Map, Home, Stage, UI, Menu,
                  Result, Ending
  audio/          the Web Audio synthesis engine, sound library and music
  ui/             the shared widget kit
tools/
  art/            the procedural art pipeline (see Assets below)
  qa/             browser verification scripts
tests/            the vitest suite
```

The state machine is explicit: `BOOT, TITLE, HOME, EXPLORING, BOSS_INTRO,
BOSS_FIGHT, STAGE_COMPLETE, PAUSED, DEFEATED, ENDING`, with legal transitions
declared in `src/systems/gamestate.ts`.

Movement, damage, regeneration, cooldowns and seasons all advance on a **fixed
60 Hz step** with long frame delays clamped - never on frame count. The game
pauses on visibility loss and clears stuck input after blur, pointer
cancellation and orientation changes.

### Content is a replaceable layer

Every franchise name, place, character and piece of lore lives under
`src/content`. The systems only read typed definitions from there, so the whole
setting can be re-skinned by replacing that directory - and
`validateContent()` will tell you immediately if anything is missing.

---

## Assets

**Everything shipped in `public/assets` is generated from the code in
`tools/art`.** Nothing is downloaded, traced, or imported from anywhere else;
the pipeline *is* the provenance record, and each PNG carries its licence in a
`tEXt` chunk.

```bash
npm run assets            # regenerate everything (parallel, ~2-3 minutes)
node --experimental-strip-types tools/build-assets.ts --only=ui
```

The pipeline contains:

- a dependency-free **PNG encoder** (indexed and truecolour) and a software
  **rasteriser** with supersampling, so edges are smooth rather than blocky;
- a small **3D skeletal rig and isometric projector**, so every character's
  eight facings come from one consistent pose system rather than eight
  hand-drawn sets;
- a **keyframe animation library** shared across humanoid, quadruped, arachnid
  and wraith rigs;
- generators for **isometric terrain, props, settlement architecture, combat
  effects, ring icons and interface frames**.

Assets are split into bundles. The **core** bundle (~3 MB) loads at boot;
**region** bundles (~2-3 MB each) load when you first travel to that chapter.

**Audio is synthesised at runtime** with the Web Audio API - footsteps, weapon
impacts, ring effects, boss cues, weather ambience and a generative music bed.
There are no audio files. Audio starts only after a real user gesture, each bus
has its own volume control, and the game is fully playable muted.

---

## Verification

Run `npm run verify` for the typecheck and the test suite, and the scripts in
`tools/qa` for the browser checks.

```bash
node tools/qa/smoke.mjs            # boot, first minutes, save/reload, pause
node tools/qa/smoke.mjs --mobile   # the same on an emulated Pixel 5 with touch
node tools/qa/bosswalk.mjs         # open and fight all 30 boss arenas
node tools/qa/bosswalk.mjs 17      # just stage 17
```

Actual measured results are in [`VERIFICATION.md`](VERIFICATION.md).

### Development fixtures

`?fixture=<stage>` opens any stage at its boss door with a fully unlocked
character, so all thirty arenas can be inspected without replaying the campaign.
Fixture mode never reads or writes your save.

```
http://localhost:5173/?fixture=25
http://localhost:5173/?fixture=20&difficulty=veteran&at=entrance
```

`?qa=1` exposes a small inspection handle used by the browser scripts.

---

## Deployment

The production build in `dist/` is a plain static site - HTML, JS and assets,
with no server code, no API and no authentication. It can be served from any
ordinary HTTPS host or static bucket. `npm run package` produces a zip of the
same directory.

Configuration files for common static hosts are in `deploy/`.

> **Note:** no deployment has been performed as part of this delivery. The
> files are prepared; publishing them is a separate step.

---

## Fan-project notice

This is an **unofficial, non-commercial fan project** set in Middle-earth. The
Lord of the Rings and its world were created by J.R.R. Tolkien. This project is
not affiliated with, endorsed by, or connected to the Tolkien Estate,
Middle-earth Enterprises, Embracer Group, or any film or game rights holder.

- **No film footage, film music, actor likenesses, or assets extracted from any
  existing game are used.** All artwork, writing and audio here were created for
  this project.
- The Ashen Regent, the twelve lesser rings, the northern valley, its
  settlement, and every named boss are **original inventions for this side
  story**. The rings are small hearth-craft workings; they are not the One Ring
  and they are not stand-ins for the canonical Great Rings.
- Recognisable peoples and creatures of Middle-earth appear as the setting's
  own: orcs, goblins, Uruk-hai, wargs, trolls, giant spiders, barrow-wights, and
  one Nazgûl encounter.
- Franchise names and lore are confined to `src/content`, so they can be
  replaced wholesale.

See `LICENSE` for the terms covering the code and the generated assets.
