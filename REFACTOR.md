# REFACTOR — splitting CaveRunner into modules

**The design doc and progress tracker for the refactor.** Every session working on it reads
this first, works the next unticked tasks, ticks them, and adds a line to the **Session log**
at the bottom. Commit this file with the work it describes.

Read `CLAUDE.md` (owner's working style, the release loop, per-system notes) and `HANDOVER.md`
before this.

---

## Status

| | |
|---|---|
| **Current phase** | **Phase 4** (TypeScript, gradually): P4.1 done (tsc in the test run), P4.2 done (`src/types.d.ts`). P4.3 (`// @ts-check` per folder, D21): core, dev, data, spells, world, creatures, art, audio, save, replay, game, ui: **P4.3 done**. **P4.4 done** (`checkJs` on: all of `src/` is checked). Next: merge Phase 4 to `main` (version bump), then Phase 5. Phase 3 merged to `main` as v99 (P3.6 done, 2026-09-30). Phase 3 recap: P3.1–P3.3 done (map + probe, world object `W`, test hook from `W`). P3.4: terrain, particles, `hurt`, `damageEnemy`, fire, ambience, props, shot looks, lightning, rats, fog queries, casting, `saveRun`, `natural`, `torchHand`, `plantGlow`, the recorder, `enterLevel` out in `game/systems/`, and `step`/`draw` moved whole (`systems/step.js`, `render/draw.js`; Game.js 186 lines). step() split into parts, P3.4 (25)–(33): a frame object `F` (D18) and 21 calls, the parts in their systems (`pickups.js` new). draw() split the same way, P3.4 (34)–(43): its own `F` (D19) and 29 calls, the parts in six `render/` modules by theme. **P3.4 done.** **P3.5 done** (D20: the Game side of each creature in `src/game/creatures/`, an `ACTS` table keyed by act, the loop keeps the shared part; knob tables stay put; no looks table). P3.6: Game.js 186 lines (world, loop, React bridge) |
| **Branch** | `refactor` (created from `main` at v96, d89c6cd) |
| **Feature freeze** | Lifted with P1.6 (v97) |
| **Last green full suite** | 2026-09-30, end of P3.5 (the tree of P3.5 (6)): logic 33/33, browser 44/44 after re-runs (`everymod` telecast, `lightning` fork and `jelly` failed in the run, all known; each passed alone, `jelly` 3 of 5, the same as on the commit before the jelly move) |
| **Last merged to main** | v99 (Phase 3), 2026-09-30 |

---

## 1. Why (in plain words)

CaveRunner started as a small thing to play on the train. It's now **13,300 lines in one
file** (`index.html`, 750 KB). The `Game` function alone is ~4,260 lines (7605–11862), one
closure where everything can touch everything. `CLAUDE.md` has grown into hundreds of lines
of "if you touch X, remember Y". That's the structure living in notes instead of in the code.

It also slows AI-assisted work: no session can read the whole file, so every change starts
with searching and guessing at side effects.

**The goal:** the same game, built from many small files that each do one job, so:
- a change touches one or two small files, not a 13k-line one,
- a new creature / spell / system has an obvious home and a pattern to copy,
- a session only needs to read the part it's working on, plus that part's short notes.

**The engine stays.** Plain JavaScript + canvas + React (for menus), delivered through the
existing Android WebView app. No Godot, no Unity, no app-store work (see **Out of scope**).

## 2. What we start with (the good news)

- **Everything above `makeLevel` (~line 6914) is already pure and top-level**: spells,
  guns, level generation, creature brains, fire, pathfinding, vision, replay, save, sound
  recipes. That's most of the logic, and it splits cleanly.
- **No top-level `let`/`var`**: every top-level name is a `const` or `function`. Only
  object *contents* change (`DEV`, `SFX`), so turning them into module exports is safe.
- **77 test suites** (33 logic, 44 browser) guard behaviour. They are the safety net for
  the whole refactor.
- React is used without JSX (`const h = React.createElement`), so no JSX step is needed.

## 3. Rules for every session

1. **Behaviour doesn't change.** This is a move, not a rewrite. The game plays the same
   after every commit. **Move first, improve later.** If you spot a bug or an ugly bit
   mid-move, don't fix it. Write it under **Found along the way** and carry on.
2. **Small steps, always green.** One module move per commit. `node tests/run.js logic`
   passes before every commit, and the full `node tests/run.js` passes at the end of every
   task group. Known flake: `sound` portalOut (setTimeout timing, passes alone). Re-run it
   alone before calling it a failure.
3. **Tests stay the judge.** Never loosen a test to make a move pass. If a test breaks, the
   move is wrong (or the test reaches into something that moved, in which case fix *how it
   reaches*, not what it checks).
4. **Delivery doesn't change.** The build still outputs **one self-contained `index.html`
   at the repo root**, with the two React CDN `<script>` tags and the literal
   `const VERSION = 'vNN';` exactly as now. The Android shell (`prep-assets.js`,
   `MainActivity.localize()`), CI (`android.yml`), `serve.js` and the version check all read
   that file, and none of them change.
5. **Keep it simple.** The only new tools are **esbuild** (the bundler), **ESLint with just
   `no-undef`** (from Phase 1) and later **TypeScript** (Phase 4). No framework, no JSX, no
   Vite/webpack, no test framework swap.
6. **Keep the notes true.** When something moves, fix any path or name `CLAUDE.md` gives
   for it in the same commit. (Notes move into per-folder READMEs in Phase 5. Until then
   `CLAUDE.md` stays the reference.)
7. **Merging to `main` is a release**: bump the version (`src/version.js` once Phase 0 is
   done), let CI go green, and the owner plays it on the phone to confirm nothing changed.
8. **Tick boxes and log as you go**, not at the end, so a cut-off session leaves an honest
   tracker.

## 4. Target layout

A **layered** tree. A module may only import from its own layer or layers *above it in this
list*, never below. That rule prevents circular imports (esbuild tolerates them, but they
cause "used before defined" crashes at load).

```
src/
  shell.html            the page skeleton: <head>, CDN React tags, a slot for CSS and JS
  style.css             the <style> block, verbatim
  version.js            export const VERSION = 'vNN'   (single place to bump)
  main.js               entry: imports App, mounts it

  core/                 LAYER 1: no imports except core
    consts.js           world size, CELL, physics tuning, SHOP_*, FOG_*, SIGHT…
    util.js             angDiff, turn, mixHex, hexMix, hsvAdjust, rr, small maths
  dev/                  LAYER 1
    knobs.js            DEV_DEFAULTS/DEV_META/DEV_GROUPS, DEV, devSet, devReport,
                        rangeKnobs, colourKnobs, kr/kru/spr, kcol/jcol
                        (the creature knob tables stay here: D11, and P3.5's notes)
  data/                 LAYER 2: tables
    themes.js           THEMES, themeFor, DECOR table, AMBIENCE
    creatures.js        CREATURES, ROSTERS, rosterFor, enemyFor, HUNTERS, NATURAL_ONLY
    perks.js            PERKS, perkBag
  spells/               LAYER 3
    mods.js             MODS, FAMILIES, FAMILY_OF, FIELD_WHAT, MOD_PRICE, MOD_TIER, TRIG_*
    spawn.js            NOITA_SPAWN, NOITA_OF, modWeight, rollMod, TIER_FLOOR
    guns.js             GUN_RANGE, makeGun, caveGun, startingGuns, resetGun, gunPrice
    cast.js             blankShot, planCast, effRecharge
    trace.js            driftStep, wigTurn, tracePath
    advisor.js          gunRate, buildAdvice, modPreview, previewPlan
    bagsim.js           castGroups, groupStats, pullSteps, fireSim*, statQual, gunModDeltas
  world/                LAYER 3
    vision.js           fogReveal, fogStart, nestFog, rayDist, losClear, visPoly
    level.js            makeLevel
    strata.js           strataCave, paveWorks, timberWorks, timberFrame
    decorate.js         decorate, cullDecor, propAnchored, archCurve/Near/At
    veins.js  nests.js  zones.js (boxReach, builtAt)
    fire.js             fireNew/Light/Douse/Area/Near/Step, FIRE_* consts
    nav.js              navField, navWay
  creatures/            LAYER 4: one file per creature: knobs + brain + sprite together
    common.js           roamStep, turnToward, flyMove, surfNormal, surfSeat
    spider.js  rat.js  jelly.js (+ plant glow, JellyPreview's sim part)
    classic.js          the not-yet-reworked bodies: drone, crawler, blob, skull, worm
    draw.js             drawEnemy dispatch
  art/                  LAYER 4
    sprites.js          drawRunner, drawGun, drawFlame, drawTorch, drawSconce, glowAt, drawGunGlow
    props.js            drawProp, drawArch, propGlow, propCol
  audio/                LAYER 4
    recipes.js          SPELL_VOICE, shotSound, creatureSound, FX_VOL, rustleStep… (pure)
    sfx.js              the SFX engine
  save/save.js          SAVE_KEY, readSave, cleanLoadout, cleanGun
  replay/replay.js      RP_* and rp* (pure)

  game/                 LAYER 5 (Phase 3)
    Game.js             thin: owns the world object, the loop, the React bridge
    world.js            makeWorld(): the level-scoped state as one object
    systems/            one file per job, each `(W, dt)` or `(W, ctx)`: see Phase 3
    creatures/          each creature's Game side (its part of the enemy loop), and ACTS (P3.5, D20)
  ui/                   LAYER 6
    h.js                const h = React.createElement, hooks re-exports
    hud.js              Stick, RKey, gauges, deckLayout, fmtGold, healthCol
    cards.js            GunCard, ModCard, PerkCard
    editor.js           Editor, GunStats, SlotGrid, ScrollBox, GunIcon
    swap.js  witness.js  devpanel.js (DevRow, DevPanel, SpawnGun)  app.js (App)

tools/build.js          assembles index.html (see Phase 0)
tests/load.js           gives logic suites the pure functions (see Phase 0)
```

This is a target, not a contract. If a split reads better another way, do that and note
it in the **Decisions** log.

**Size targets when done:** no source file over ~1,000 lines (most under 500), `Game.js`
under ~800, `CLAUDE.md` under ~150 lines.

---

## 5. Phases and tasks

### Phase 0 — build step, no behaviour change (zero new dependencies)

The script moves into `src/`, and a tiny build script glues it back into the exact same
`index.html`.

- [x] **P0.1** Create branch `refactor` from `main`.
- [x] **P0.2** Split `index.html` verbatim into `src/shell.html` (everything but the CSS
      and the main script, with two placeholders), `src/style.css` and `src/main.js`.
- [x] **P0.3** `tools/build.js` (plain Node, no deps): reads those three and writes
      `index.html`. **Acceptance: the output is byte-identical to v96's `index.html`**
      (`git diff --exit-code index.html`). Handle CRLF: compare after normalising, and write
      the same line endings the repo has.
- [x] **P0.4** Put a banner comment in `shell.html` (it ends up in `index.html`):
      "GENERATED from src/ by tools/build.js — edit src/, not this file". The acceptance
      check becomes "identical apart from the banner".
- [x] **P0.5** `tests/run.js` runs the build first, so a green test run always means
      `index.html` is fresh. `index.html` stays committed (CI, Pages, the APK and `serve.js`
      read it and don't change).
- [x] **P0.6** `tests/load.js`: **one loader for all logic suites.** `require('../load')`
      returns an object holding every top-level name defined above `function Game(`
      (sliced from the built `index.html`, with the `ImageData` shim and the `React` stub
      the suites use today). Convert all 33 logic suite headers to use it; suite bodies
      stay untouched (`G.planCast` etc.). Some suites cut earlier (at `const approach` or
      `function makeLevel`). Check cutting at `Game(` works for all of them. In Phase 1
      the loader's *inside* switches to importing `src/`, and no suite changes again.
- [x] **P0.7** `tests/build.js` (the browser test page) keeps working unchanged. It
      string-swaps anchors in `index.html`, which is still identical. Confirm.
- [x] **P0.8** `src/version.js` isn't needed yet (still one file). Instead, have
      `tools/build.js` fill `<title>` from the `VERSION` const, so there's one place to bump.
      Update `CLAUDE.md`'s "bump the version" step to match.
- [x] **P0.9** `node tools/build.js --watch`: rebuild on save (polling `fs.watch` is
      fine), for use with `serve.js` on the phone.
- [x] **P0.10** Update `CLAUDE.md`: "edit `src/`, run the build (tests do it for you)";
      the layout table points at `src/main.js` line ranges. Full suite green. Commit.

### Phase 1 — split the pure code into modules

- [x] **P1.1** Add a dev-only `package.json` (esbuild, eslint) with `node_modules/` in
      `.gitignore`. The game stays one file. This overrides CLAUDE.md's "no package.json"
      rule for tooling only; update that line.
- [x] **P1.2** Switch `tools/build.js` to **esbuild** on the still-single `src/main.js`
      (format `iife`, `charset: 'utf8'`, **no minify**, React as a global) *before*
      splitting anything, and fix what that shakes out:
  - esbuild reprints strings with **double quotes**, which breaks
    `const VERSION = 'vNN';`, and the Android shell and CI regex need that exact shape
    (`VERSION\s*=\s*'v(\d+)'`). Fix: move `VERSION` to `src/version.js`, and have the build
    write a tiny un-bundled `<script>const VERSION = 'vNN';</script>` ahead of the bundle
    (and the `<title>`). Check the bundle doesn't re-declare it.
  - Keep Unicode raw (`charset: 'utf8'`), not `\uXXXX`.
  - `tests/build.js` anchors (`const toast = text => {`, `const [size, setSize] =
    useState(150);`) must still be found. Check they survive reprinting; update the
    anchors if not.
  - Full suite green + play it in the browser. Commit.
- [x] **P1.3** Add the **undefined-name check**: ESLint flat config with only `no-undef`
      (browser globals + `React`, `ReactDOM`), run by `tests/run.js` before the suites.
      **This matters:** with modules, a missed import doesn't fail the build. It fails only
      when that line runs, maybe mid-game on floor 7.
- [x] **P1.4** Switch `tests/load.js` to bundle a `src/pure.js` (re-exports every pure
      module) with esbuild in-memory to CJS and return its exports. At first `pure.js` just
      re-exports from `main.js`. Logic suites don't change.
- [x] **P1.5** Move modules out **in layer order**, one per commit, logic tests green
      each time (see the target layout for what goes where):
  - [x] core/consts.js
  - [x] core/util.js
  - [x] dev/knobs.js
  - [x] data/themes.js
  - [x] data/creatures.js
  - [x] data/perks.js
  - [x] spells/mods.js
  - [x] spells/spawn.js
  - [x] spells/guns.js
  - [x] spells/cast.js
  - [x] spells/trace.js
  - [x] spells/advisor.js
  - [x] spells/bagsim.js
  - [x] world/vision.js
  - [x] world/fire.js
  - [x] world/nav.js
  - [x] world/zones.js, veins.js, nests.js
  - [x] world/strata.js
  - [x] world/decorate.js
  - [x] world/level.js
  - [x] creatures/common.js
  - [x] creatures/spider.js (knobs + spiderStep/Seat/Aim + drawSpider)
  - [x] creatures/rat.js
  - [x] creatures/jelly.js
  - [x] creatures/classic.js + creatures/draw.js
  - [x] art/sprites.js
  - [x] art/props.js
  - [x] audio/recipes.js
  - [x] audio/sfx.js
  - [x] save/save.js
  - [x] replay/replay.js
- [x] **P1.6** Full suite green. Merge `refactor` → `main` with a version bump. Owner
      plays it on the phone. **Feature freeze lifts**: new features go into `src/` from
      here, and the rest of the refactor continues in small steps between them.

### Phase 2 — the React UI into `ui/`

Same move-only method (see **How a move goes** below). `Game` itself isn't taken apart
until Phase 3.

What the code says about this phase (checked at the end of Phase 1):
- `Game` uses **no** UI name, so the UI can leave `main.js` freely. But `App` renders
  `Game`, and a module may never import from `main.js` (`tools/move.js` refuses). So
  **before P2.7, move `Game` as-is into `src/game/Game.js`** (one plain move, its own commit;
  it's layer 5, below the UI). `App` then imports it from there and `main.js` becomes just the
  mount. `tests/build.js`'s hook anchor `const toast = (text) => {` is inside `Game`; it stays
  unique in the bundle wherever `Game` lives, so the test page keeps working.
- Five pure leftovers sit above `Game` in `main.js`: `fmtGold` and `deckLayout` go to
  `ui/hud.js` in P2.2 (only the UI uses them). `sputterStep`, `SPUTTER_FUEL` and `NO_INPUT`
  are used by `Game` only: they go with `Game` into `game/Game.js`.
- `h` and the hooks (`useRef`, `useEffect`, `useState`, `useMemo`) are destructured from the
  global `React` on `main.js`'s first two lines. `Game` uses only `useRef`, `useEffect` and one
  `h('canvas', …)`. Once `Game` is in `game/Game.js` (layer 5) it may not import from `ui/h.js`
  (layer 6), so give `game/Game.js` its own two lines off the global `React` (`const { useRef,
  useEffect } = React; const h = React.createElement;`) and record it as a decision. Until
  then, `main.js` imports them from `ui/h.js` like everything else.
- `JellyPreview` (Dev panel) runs the real `jellyStep`/`drawJelly`: it can import them from
  `creatures/jelly.js` wherever it lands.

- [x] **P2.1** ui/h.js (the `h` helper and hook imports)
- [x] **P2.2** ui/hud.js (Stick, RKey, gauges, holdPress, deckLayout, fmtGold, healthCol, GAUGE_*…)
- [x] **P2.3** ui/cards.js (GunCard, ModCard, PerkCard, GUN_STATS)
- [x] **P2.4** ui/editor.js (Editor, GunStats, SlotGrid, ScrollBox, GunIcon, PULL_COL, GS_ROWS)
- [x] **P2.5** ui/swap.js, ui/witness.js
- [x] **P2.6** ui/devpanel.js (DevRow, DevPanel, SpawnGun; JellyPreview goes with the jelly or here)
- [x] **P2.7** game/Game.js (Game as-is, with `sputterStep`, `SPUTTER_FUEL`, `NO_INPUT`),
      then ui/app.js (App); `main.js` is now just the mount. Full suite green.

### How a move goes (the recipe Phase 1 used; keep using it)

1. `node tools/move.js <folder/file.js> --dry <names or @line ranges>`: shows what moves and
   the imports it needs. If it says "X is still in main.js", move X first or along with it.
2. Look at the comments above each statement in `src/main.js` (`grep -n -B4`): a statement
   takes the comment lines above it, so a section header or a neighbour's comment can travel
   with it. Fix that by hand after the move and say so in the commit.
3. Run it without `--dry`, with `--about "header line\nsecond line"` for a new file.
4. `node tools/same.js`: every top-level statement must be identical to the last commit
   (only order may change). Then `node tests/run.js logic` and `node tests/run.js smoke`.
   If a move adds a top-level name some other module already has (D13), esbuild renames one
   of them: `node tools/same.js --renames` shows whether renames are all that changed.
5. Update the row in CLAUDE.md's **Layout of src/** table, tick the box here, commit (one
   move per commit, `index.html` with it).
6. End of a task group: full `node tests/run.js`. It takes ~15 min; don't run other heavy
   work alongside it (several browser checks are timing-sensitive and fail under load). To
   keep working meanwhile, run it in a snapshot worktree: `git worktree add <scratch>/snap
   HEAD`, link `node_modules` in with a junction (PowerShell `New-Item -ItemType Junction`),
   and **remove the junction (`cmd /c rmdir <snap>\node_modules`) before `git worktree remove`**,
   or the removal can reach through it into the real `node_modules`.
7. A suite that fails: re-run it alone; if it still fails, compare against v96 (a worktree of
   `d89c6cd`, i.e. `main` before P1.6, with `CAVERUNNER_CHROME` set, since old checkouts don't know the
   Windows Chrome path).

### Phase 3 — take the `Game` closure apart (the big one)

~4,260 lines in one function, sharing ~hundreds of local variables. Do it in this order:

What the code says about this phase (checked at the end of Phase 2):
- `Game` is in `src/game/Game.js` (4,330 lines). Above it: `sputterStep`, `SPUTTER_FUEL`,
  `NO_INPUT` and its own React lines (D13). Everything else is one `useEffect` closure: ~28
  `let` lines (most declare several names: `mat, img, start, portal, enemies, …`), ~81 `const`s
  and ~63 inner functions at its top level. Landmarks (Game.js lines, they drift): `toast` ~193,
  `drawReplay` ~318, `enterLevel` ~351, `cast` ~863, `step` ~2042 (~1,100 lines), `draw` ~3140
  (~1,150 lines), the rAF `loop` at the end.
- **The Phase 1–2 tools don't fit here.** `tools/move.js` only cuts top-level statements out of
  `main.js`, and `main.js` has nothing left to move (delete it when Phase 2 merges, per D10).
  `tools/same.js` compares top-level statements, and `Game` is *one* statement, so every Phase 3
  step shows "differs Game" by nature (`x` → `W.x` changes the text). Proof has to come from
  somewhere else: the suites, plus whatever P3.1 decides (see the next point).
- **Worth considering before P3.2: a determinism check** (not decided, the session doing P3.1
  should weigh it): a browser probe that seeds `Math.random`, fixes `performance.now`/the frame
  `dt`, feeds a scripted input, runs N frames on a fixed seed and hashes the world (player,
  enemies, bullets, `mat`) every frame. Same hashes before and after a step ⇒ no behaviour change,
  which is the proof `same.js` gave for moves. Only worth it if it's cheap to make stable.
- **The browser test hook reaches into the closure by name.** `tests/build.js` string-inserts
  `HOOK_LVL` (plus `SANDBOX`) in front of `const toast = (text) => {` inside `Game`, and it reads
  ~60 closure names directly (`get seen(){return seen}`, `mat`, `img`, `dimg`, `portal`, `fire`,
  `ore`, `enemies`…). So when P3.2 turns a loose variable into `W.x`, the same commit must update
  that hook text (rule 3: fix *how it reaches*, not what it checks), or the test page throws on
  load. P3.3 then replaces the string-insert with `window.__lvl = W` behind a test flag.
- The anchor `const toast = (text) => {` must stay unique in the bundle until P3.3 retires it,
  and `const [size, setSize] = useState(150);` (in `ui/app.js`) stays as is.

- [x] **P3.1 Map it first, change nothing.** Write a map of `Game` into this doc (new
      section **Game map**): every closure-level variable and inner function, which system
      it belongs to, and who reads/writes it. Look especially for variables reassigned
      (`let x = …; x = …`), since those can't simply be shared, and for things `draw()` and
      `step()` both touch.
- [x] **P3.2 One world object.** `game/world.js` `makeWorld()` holds the level-scoped
      state (`mat`, `img`, `dimg`, `seen`, `enemies`, `bullets`, `fields`, `props`, `fire`,
      `p`, camera, timers…). In `Game`, replace the loose variables with `W.x` a few at a
      time. Reassigned `let`s become `W` properties. Commit per group.
      How a step goes: `node tools/world.js <names>` rewrites every reference that resolves to
      the closure variable (`x` → `W.x`, shorthand → `x: W.x`); move the declarations into
      `makeWorld()` by hand; fix the same names in `tests/build.js`'s hook text; then
      `node tests/determinism.js` (SAME), logic, smoke.
  - [x] terrain: `mat`, `img`, `dimg`, `ore`, `burrow`, `terrainV` (first: the five inner `W` locals renamed, see the map)
  - [x] level layout: `start`, `portal`, `arrival`, `stock`, `rooms`, `zone`, `sconces`, `floor`, `levelSeed`, `levelOwned`, `roster`, `themeName`, `total`, `miniEdgeIdx`, `matterProps`, `ambKinds`, `plantW`
  - [x] the swapped lists: `enemies`, `pickups`, `props`
  - [x] fog: `seen`, `deepFog`
  - [x] fire: `fire`, `firePlants`, `fireArches`, `fireCarts`, `firePropN`, `firePropLast`, `fireLoop`, `fireN`, `fireVis`
  - [x] player, camera, clock: `p`, `pb`, `ghost`, `zfx`, `time`, `levelT`, `best`, `camX`, `camY`, `camReady`, `unitPx`, `viewW`, `viewH`, `flick`, `torchR`, `visPts`, `leanX`…
  - [x] the run's lists: `bullets`, `enemyShots`, `smoke`, `sparks`, … (never replaced)
  - [x] frame timers and loops private to `step`/`decorStep`/`dropOre`, and the rats' `navYou`
  - Left loose on purpose (D15), for P3.4 to give homes: the canvases and contexts, `pgArt`/`pgC`/`pgCtx` and
    `aimPath` (render scratch), `fireBox` (the fire's dirty rects on the two canvases), `REC`/`RT`/`RPV`/`RP_ARR`/`rid`/`ridN`
    (recorder and replay), `raf`/`last`, `mouse`, `saveTick`/`ro`, `ratOnWeb`, and the constant tables `MATERIAL`,
    `DRIP_RATE`, `AMB_RATE`, `AMB_MAX`.
- [x] **P3.3 Test hooks from the world object.** `window.__lvl` becomes `W` (plus the
      helper functions), set when a test-build flag is on, instead of `tests/build.js`
      string-swapping code into the closure. Keep every name the browser suites use today
      (`__lvl.p`, `.enemies`, `.sandbox()`, `.placeProp()`, `.fog.seen`, `.light.*`…), so
      suites don't change.
What the code says about P3.4 (checked at the end of P3.3):
- `Game.js` is 4,280 lines; the closure has 98 inner functions. The level's state is all on `W`
  (P3.2), so a function that moves out mostly needs `W` plus three other kinds of thing:
  **other closure functions** (`burst` has 13 callers, `hurt` 7, `explode` 6), **closure-only
  objects** (the canvases `tctx`/`dctx`/`bgctx`…, the recorder `REC`/`RT`, `toast`, `mouse`), and
  **`input`**, Game's React prop (`input.current` appears 55 times: loadout, notify, prompt…).
  `node tools/gamemap.js fn…` lists the first two for any function (not `input`: grep for it).
- Suggested shape (decide in the first P3.4 step, record it as a decision): Game makes one
  `G` context next to `W` holding the canvases and contexts, `input`, the recorder, `toast`,
  `mouse`, and each system module exports plain functions `(W, G, …args)`. Systems import each
  other's functions directly.
- **There are call cycles**: `explode` → `fireBlast` → `ignite` → `blowProp` → `explode`. Across
  modules that's a circular import. It's safe at runtime only because every one of them is a
  function called later, never at load; say so in a decision, or keep a cycle inside one module.
- Start with leaves and work up: terrain queries (`solidCell`, `solidAt`, `boxHit`,
  `lineOfSight`, `enemyAt` use only `W`), then particles (`burst`, `goo`, `splat` use only `W`),
  then terrain changes (`dig`, `unDeco`, `dropOre`, `explode`: need `tctx`/`dctx`, the
  recorder's *wrapped* ones: never use an unwrapped context, or the replay misses the change).
  `step()` and `draw()` go last, as the render/ split and the systems' per-frame parts.
- **`draw()` must keep its order**: it calls `Math.random()` at 7 sites from the sim's stream, and
  it writes the fog memory (`fogReveal`) and the camera. The determinism probe fails at once if a
  render split reorders them (which is the point).
- `tests/determinism.js` doesn't play a death replay, the map, the shop, the Bag screen or perks.
  When a step touches those, also run the matching browser suites (`replay`, `map`, `shop`,
  `perks`, …), as P3.2 did.
- How a step goes (as done for steps 1–6):
  1. `node tools/gamemap.js fn…`: what each function calls and uses. Everything it calls must
     already be out, or go in the same move. A cycle goes in one move, split across modules with
     `other.js:name` (D17).
  2. Anything it uses that's neither `W` nor a key of `G` (a closure `const` like `fireBox`):
     declare it above `G` and add it to `G` by hand first. A reassigned `let` (`RPV`, `pgArt`…)
     needs a `G.x` rewrite of all its references (`tools/world.js` could do it with `G` for `W`).
  3. `node tools/system.js <file> --dry [--about "header"] name…`, read what it prints (each
     function's `(W, G)`, every place it's used as a value), then without `--dry`. Read the new
     module: fix the header, and any comment that travelled with the wrong function.
  4. `node tests/determinism.js` (SAME), `node tests/run.js logic` + `smoke`, the related browser
     suites. Tick the box, a session-log line, the CLAUDE.md "game systems" row, commit (`index.html`
     with it). Full suite (snapshot worktree, see **How a move goes** 6) at each checkpoint.
  Watch in the tool: an arrow `const` keeps being an arrow (not hoisted, fine: nothing calls a
  system at load). If `system.js` says "can't tell where X comes from", X is a Game.js top-level
  (`SPUTTER_FUEL`, `NO_INPUT`…): move it into a module first.

- [x] **P3.4 Pull systems out**, one per commit, each a module in `game/systems/` (shape: D16,
      cycles: D17). `node tools/system.js <file> name…` does a move (`--dry` first). Leaves first;
      the list below is corrected as it goes:
  - [x] terrain.js, the queries: `solidCell`, `solidAt`, `boxHit`, `lineOfSight`, `enemyAt` (all `(W, …)`)
  - [x] particles.js: `goo`, `splat`, `burst`, `toast` (all `(W, …)`)
  - [x] `G` made; player.js, first part: `refreshBag`, `maxHp`, `hurt` (all `(W, G, …)`: they read `input`)
  - [x] enemies.js, first part: `damageEnemy`, `fireEnemyShot` (`(W, …)`)
  - [x] terrain.js, the changes: `dig`, `dropOre`, `unDeco`, `paint` (through `G.tctx`/`G.dctx`, the wrapped ones)
  - [x] fire.js and its cycle (D17): the fire's functions, `explode` → terrain.js, `blowProp` → props.js,
        `webNear`/`webDist` → webs.js
  - [x] ambience.js: `spore`, `puffSpores`, `stepAmbience` (+ `AMB_RATE`, `AMB_MAX`): all need only `W`
  - [x] props.js: `decorStep` with `pOver`, `alertAt`, `shatter`, `popLamp`, `landProp`, `spawnDrip`
        (+ `MATERIAL`, `DRIP_RATE`); needs ambience first
  - [x] shotlooks.js: `glowDot`, `rnd`, `shotTrail`, `shotBounce`, `shotDeath`, `shotGrind` (`drawLook` stays in draw())
  - [x] lightning.js: `jag`, `addArc`, `lightningStep`
  - [x] rats.js: `onWebIn`, `ratSolid`, `navFor`, `spawnRat`, `unstick`, `ratFrame` (`ratOnWeb` joins `G`)
  - [x] fog.js: `fogLit`, `roomSeen`, `seenAt`, `paintFog` (the reveal, bake and blur stay in draw())
  - [x] gun.js (`cast`, `spawnShot`, `releaseAt`, `firePayload`), fields.js (`castField`, `fireBeam`, `throwEmbers`,
        `fieldPayload`), bullets.js (`critRoll`, `shove`, `spray`, `explodeCross`, `teleportTo`): one move, a cycle
        (`spawnShot` → `fireBeam` → `releaseAt` → `spawnShot`). The bullet loop and fields' per-frame work stay in step()
  - [x] save-run.js: `saveRun` (`(W, G)`: it reads `input`). Its four value uses are one `saveNow` arrow in Game, so
        `pagehide`'s `removeEventListener` still gets the function it was given
  - [x] enemies.js: `natural` (`(W, …)`; only the jelly's `env.stay` uses it, as an arrow)
  - [x] player.js: `torchHand` (`(W)`)
  - [x] plantglow.js: `plantGlow` (`(W, G, …)`). First, by hand: its scratch `let`s became `G.pgArt`/`G.pgC`/`G.pgCtx`
        (null in `G`, made on first use as before; only plantGlow touched them), and `pgGlow`/`pgGlowCtx` moved up and joined `G`
  - [x] recorder.js: `idOf`, `recReset`, `recSample`, `recFrame`, `rpTerrain`, `drawReplay` (all `(W, G, …)`), and the
        putImageData wrapper as `recWrap(G)`, called as soon as `G` is made (nothing draws on `tctx`/`dctx` before that).
        First, by hand: `RPV` → `G.RPV` (21 references, most in draw()), `rid`/`ridN` and `RP_ARR` (still W's own arrays)
        joined `G`, and `drawReplay(V, draw)` is handed Game's `draw` while draw() lives in Game. `REC`/`RT` stay made in Game
  - [x] level-entry.js: `enterLevel` (`(W, G, back)`). Clean move
  - [x] **step() and draw(): the plan** (worked out at the end of P3.4 (19); steps 1 and 2 done in P3.4 (20)–(24), step 3
        done for step() in P3.4 (25)–(33) and for draw() in P3.4 (34)–(43); **both are split**; `node tools/locals.js src/game/systems/step.js step` and `node tools/locals.js src/game/render/draw.js draw`
        print the facts below). Game.js was 2,494 lines, and they were ~1,100 lines each; now `step.js` is 1,137 lines (step
        41–1137, returns at 52 and 217) and `render/draw.js` 1,182 (draw 34–1182, its return at 1011). What's left in Game's
        closure (186 lines) is setup: the canvases, `REC`/`RT`, `G`, the save timer, resize, the mouse handlers, the rAF loop.
    1. **Prep:** `mouse` (= `input.current.mouse`) and `aimPath` join `G`: with the canvases already keys of `G`, they
       are the only closure names the two still use (`node tools/gamemap.js step draw`). Probe SAME.
       **Done, P3.4 (20)**: `const mouse` moved up next to `aimPath`, both keys of `G`; gamemap then lists only `W`, `G`
       and `G`'s keys for either. `system.js --dry step` then refused on `NO_INPUT` and `sputterStep` (Game.js
       top-levels): they and `SPUTTER_FUEL` went to `systems/player.js` first, P3.4 (21).
    2. **Move each whole first, split after.** `step` → `systems/step.js` as `step(W, G, dt)` with `tools/system.js`, one
       commit, SAME. `draw` → `src/game/render/draw.js` (still layer 5) the same way; `drawReplay` then imports it and
       drops its `draw` argument. A whole move is mechanical and proven by the probe; a split inside a 1,100-line
       closure isn't.
       **step done, P3.4 (22)**: `system.js` moved it clean (no value uses, no comment travelled); the moved body is
       line for line the old one with `G.` in front of `input`, `c`, `mouse`.
       **draw done, P3.4 (23)**: `system.js` into `systems/draw.js`, then moved by hand to `render/draw.js` (its
       `./x.js` imports became `../systems/x.js`, Game.js's and `pure.js`'s lines follow). Body line for line the old one
       with `G.` in front of the canvases, `input`, `RT`, `mouse`, `aimPath`. The loop handed `drawReplay` an arrow for one commit;
       P3.4 (24): `recorder.js` imports `draw` from `../render/draw.js`, `drawReplay(W, G, V)` calls `draw(W, G)` itself.
    3. **Then split in the module, in the same order**, into part functions the top-level `step`/`draw` call one after
       another. Few locals live across parts: in step `dt`, `LO` (loadout), `MHP`, `pcx`/`pcy` (from the portal check on);
       in draw `dpr`, `playPx`, `vw`/`vh`, `pcx`/`pcy`, `TH`, `onView`, and `held`/`ax` (aim → HUD). Hand them in a small
       per-frame object (or recompute where it's cheap and nothing changes them in between). step's two early returns
       (Dev → New cave at the top, the portal after the move) become a part returning `true` → step returns; draw's one
       (`if (G.RPV) return;` before the HUD) stays in the top-level draw.
       - step's parts, by its section comments: requests/perks (Dev asks, max health) → the player (jetpack, steering,
         terrain, footsteps, portal) → aiming and gun ticks → **the bullet loop** (~190 lines, → bullets.js) → sound → static
         fields (→ fields.js) → pickups, gold, interact (a pickups.js) → **the enemy loop** (~245 lines, → enemies.js; P3.5
         takes it apart per creature) → ghost → fire and Levitation Trail → jetpack smoke, torch flicker, motes.
       **step's split, P3.4 (25)–**: the per-frame object is `F = { dt, LO, MHP, pcx, pcy }` (D18), made first thing
       in step; each part takes `(W, G, F)` (each only if used) and reads what it needs with a `const { … } = F;` first
       line, so the moved text stays word for word. Until the last part is out step keeps `const LO = F.LO, MHP = F.MHP`
       (and later `pcx`/`pcy`) for what's still inline. `node tools/part.js` does a cut (header; `--dry` first).
       - [x] P3.4 (25): `stepRequests` (clock, held toast, Dev → New cave returns true, Dev → Spawn gun) and
         `stepPerks` (fills `F.LO`, `F.MHP`; health cap, shield) in step.js, by hand (the return)
       - [x] P3.4 (26): `movePlayer` → player.js (the stick, jetpack and fuel, steering, the move, footsteps; `part.js`),
         `atPortal` (fills `F.pcx`/`F.pcy`, returns true through the exit) in step.js by hand
       - [x] P3.4 (27): `aimAndCast` → gun.js (aim, Pinpointer, facing, every gun's clocks and mana, the trigger)
       - [x] P3.4 (28): `stepBullets` → bullets.js (the bullet loop, and the lightning arcs fading after it)
       - [x] P3.4 (29): `stepSound` in step.js (ear, jet/Black Hole/portal/matter loops, ambience, heartbeat), `stepFields` →
         fields.js (every field at work, the beams fading). Re-grep the lines after each cut: a cut redoes the imports, and a
         shorter import block moves every line under it (the first try at this one cut two lines too low; thrown away)
       - [x] P3.4 (30): `stepPickups` → a new pickups.js (pickups' cooldowns, gold, the card, the interact tap), and the toasts
         counting down → `stepToasts` in particles.js. `decorStep` was a function already: step calls it with `F.pcx`/`F.pcy`
       - [x] P3.4 (31): `stepEnemies` → enemies.js, whole (the enemy loop, Contact Damage, the creatures' shots, spider silk
         and strings, web lines coming down, and `W.p.hitT` fading, which sat at its end); P3.5 takes it apart per creature
       - [x] P3.4 (32): `stepGhost` in step.js (Angry Ghost), `stepTrail` → fire.js (Levitation Trail); `fireFrame` between them
         was a function already
       - [x] P3.4 (33): `stepParticles` (jetpack smoke, smoke, sparks, flashes) and `stepMotes` → particles.js, `stepTorch`
         → player.js; `W.best` stays a line in step between them (nothing else there to go with). **step() is split**: its
         top level is `F` and 21 calls (step.js 156 lines, `node tools/locals.js` shows only `W`, `G`, `dt`, `F`)
       - draw's inner functions `drawLook`, `drawFieldLook`, `drawBolt` go out first (they use only their arguments and
         `W`/`G`), then the layers in their current order: camera, background + terrain, props, portal, smoke, fields, silk,
         enemies, projectiles, beams, arrival, shop, gold, pickups, rooms, trail, sparks, motes, flashes, flame, aim + gun,
         player, torchlight + fog, post-fog glows, HUD, radar, messages, reticule, map.
       **draw's split, P3.4 (34)–**:
       - [x] P3.4 (34): `drawLook`, `drawFieldLook` → `(W, G, …)`, `drawBolt` → `(G, …)` (it only draws, like `recWrap(G)`)
         into a new `render/looks.js`, by a scratch script (the three function texts cut, de-indented two spaces, the four
         call sites given `W, G` / `G`)
       - [x] P3.4 (35): `drawCamera` in draw.js by hand (it fills `F.dpr`, `F.playPx`, `F.vw`/`F.vh`, `F.pcx`/`F.pcy`; D19), then
         `drawTerrain` → a new `render/cave.js` with `tools/part.js` (background, shop wall, rock, burning pixels). `part.js`
         now never imports `VERSION` (D7: its dry run wanted `import { VERSION } from '../../version.js'` in draw.js) and puts
         a new render module's `pure.js` line after the other render lines
       - [x] P3.4 (36): `drawProps` → cave.js (`part.js`, then by hand the theme and `onView` moved in: it fills `F.TH`,
         `F.onView`; draw reads them back with `const { TH, onView } = F;`), `drawPortal` → cave.js
       - [x] P3.4 (37): `drawSmoke` → a new `render/effects.js`, `drawFields` → looks.js, `drawSilk`, `drawEnemies` → a new
         `render/actors.js`, all with `part.js`
       - [x] P3.4 (38): `drawShots` (the creatures' shots, yours, the lightning arcs) and `drawBeams` → looks.js (`part.js`)
       - [x] P3.4 (39): `drawArrival`, `drawShop`, `drawLoot` (gold and pickups together), `drawRooms` → cave.js (`part.js`)
       - [x] P3.4 (40): `drawTrail`, `drawSparks`, `drawMotes`, `drawFlashes` → effects.js, `drawJetFlame` → actors.js (`part.js`)
       - [x] P3.4 (41): `drawAim` → actors.js (`part.js` on the Trajectory Sight block with `R` in `F` for the cut, then by hand
         the aim's four lines moved in and `R` out of `F` again: it fills `F.held`, `F.ax`/`F.ay`, `F.gy`), `drawPlayer` → actors.js
       - [x] P3.4 (42): `drawFog` (the reveal, the bake, the blur) and `drawGlows` (everything lit over the fog, then the sconces)
         → a new `render/light.js` (`part.js`)
       - [x] P3.4 (43): `drawHud` (`part.js`, then its setup lines moved in by hand: it fills `F.cw`), `drawRadar`, `drawMessages`,
         `drawReticule` (`(G)`), `drawMap` → a new `render/overlay.js`; draw's top level tidied (the leftover locals gone, one
         comment per call). **draw() is split**: its top level is `F` and 29 calls (draw.js 1,182 → 96 lines)
    4. Keep the order exactly: draw() draws from the sim's `Math.random` stream and writes fog memory and the camera, and
       step's parts feed each other within the frame. The probe catches any reorder.
  - Learned so far: `G`'s keys must be declared above `G` (a closure `const` further down moves up
    first, as `fireBox` did). A function passed as a callback gets an arrow at each site; for the
    per-frame ones (`visPoly`, `fireStep`, a spider's or jelly's `env`) that is one small allocation
    a call, no behaviour change. The tool takes `//` lines right above a function with it, so a
    section header can travel with the first function under it: read the module after each move.
    **An event listener is the exception to the arrow-per-site:** `removeEventListener` needs the very
    function `addEventListener` got, so a moved function used as one gets a single named arrow in Game
    (`saveNow`) that every value use shares. Check the `--dry` "as a value" lines for `remove…Listener`.
    `system.js` writes only into `systems/`: `render/draw.js` went there first and was moved by hand (its `./x.js`
    imports → `../systems/x.js`, plus Game.js's and `pure.js`'s lines). A new top-level name can make esbuild rename a
    same-named inner local elsewhere (the exported `step` turned `rangeKnobs`' `step` into `step2` in `index.html`, D13)
    and reorder modules in the bundle: a big `index.html` diff with the probe SAME is that, nothing more. Don't `sed -i`
    a doc from Git Bash: it wrote REFACTOR.md back with LF (harmless to the commit, but edit with node or the Edit tool).
    **A part that fills `F`** (draw's `drawProps`, `drawAim`, `drawHud`; step's `stepPerks`): `part.js` refuses lines that
    declare a local used after them, so cut the lines *after* the declarations (a local they use that isn't in `F` yet,
    like the aim's `R`, goes into `F` just for the cut), then move the declaration lines into the part by hand as
    `const x = F.x = …` and read them back in the caller with `const { x } = F;` until the last user is out. Such a part
    can keep a now-unused `const` (drawAim's `ax`, drawHud's `cw`) so its text stays the old one. Git Bash heredocs eat
    `\\` (a scratch script's `/\\n/` came out as `/\n/`): write scripts with the Write tool.
  - The old rough list (P3.1's guess), all done (checked against the code at the end of P3.4); where each part went is noted.
    What's left is P3.5's, not P3.4's: the enemy loop per creature (`stepEnemies` is one function today) and bullet
    looks as a table (`drawLook`/`shotTrail`):
  - [x] recorder: the putImageData wrappers stay in Game until recorder.js (they wrap `tctx`/`dctx`, which the systems reach as `G.tctx`/`G.dctx`): `recWrap`
  - [x] fog.js: paintFog, bake, blur, fogLit (`fogLit`, `paintFog` in systems/fog.js; the reveal, bake and blur are `drawFog` in render/light.js, P3.4 (42))
  - [x] level-entry.js: enterLevel, sconces, per-floor precompute
  - [x] player.js: walking, jetpack + sputter, climbing (vines, webs, arches), the torch (hurt, maxHp, refreshBag are out; `movePlayer`, P3.4 (26); `stepTorch`, P3.4 (33))
  - [x] gun.js: cast, spawnShot, releaseAt, payload/triggers, gun ticks (the ticks and aiming: `aimAndCast`, P3.4 (27))
  - [x] bullets.js: the bullet loop, homing/drift/wig, bounce, teleport, trails (shotTrail/Bounce/Death/Grind are in shotlooks.js; the loop is `stepBullets`, P3.4 (28))
  - [x] fields.js: fields and beams (the per-frame work is `stepFields`, P3.4 (29))
  - [x] enemies.js: the enemy loop (whole, as `stepEnemies`, P3.4 (31); per creature is P3.5), aggro, contact damage, enemy shots (all inside `stepEnemies`; damageEnemy, fireEnemyShot are out; goo/splat are in particles.js); rats (`ratSolid`, `navFor`, `spawnRat`, `unstick`, `ratFrame`) are rats.js, P3.4 (11)
  - [x] pickups.js: pickups, shop stock, coins, ore, rooms, the interact tap (`stepPickups`, P3.4 (30); ore stays with `dropOre` in terrain.js)
  - [x] props.js: decorStep, landProp, rustle, zfx (all in props.js, P3.4 (6) and (8): the rustle and `W.zfx` are written in `decorStep`)
  - [x] fire: done, as fire.js (step 6)
  - [x] ambience.js: spores and amb particles (`spore`, `puffSpores`, `stepAmbience`, P3.4 (7); `decorStep` calls `stepAmbience`); motes, smoke, sparks, flashes are `stepMotes`/`stepParticles` in particles.js (P3.4 (33)); dparts are updated in decorStep
  - [x] camera.js: `drawCamera` in render/draw.js (the camera is eased in draw, P3.4 (35))
  - [x] recorder.js: recFrame, recSample, REC, and drawReplay's rebuild
  - [x] save-run.js: saveRun
  - [x] render/: split `draw()` into layers in their current order: background, terrain,
        props, entities, bullet looks (`drawLook`), fog, post-fog glows, HUD, map (P3.4 (34)–(43): cave.js, effects.js,
        actors.js, looks.js, light.js, overlay.js; D19)
- [x] **P3.5 Creature plugins.** The enemy loop's per-creature branches become a
      registry: `creatures/<name>.js` exports `{ act, knobs, step(e, W, dt), draw(ctx, e,
      W), onHurt?, onDeath? }`, and `enemies.js` dispatches by `e.k.act`. **Adding a creature
      = one new file + one registry line.** Do the same for bullet looks (`drawLook`/
      `shotTrail` → a `LOOKS` table, one entry per look) if it reads better.
      (The paragraph as first written; what the code allows is below, and the shape is D20.)

What the code says about P3.5 (checked at the end of P3.4, f50c758):
- **The loop.** `stepEnemies(W, G, F)` (`systems/enemies.js`, ~245 lines) is one backwards `for` over `W.enemies`
  (a bomber splices itself out mid-loop), then once-a-frame passes: Contact Damage, the creatures' shots, spider silk
  in flight, strings on you, web lines whose rock is gone, `W.p.hitT`. Per enemy, in this order:
  (a) **shared**: the timers (`flash`, `cd`, `touch`), `dx`/`dy`/`dist`, `lx`/`ly`, `sees`, aggro (`HUNTERS`, sticky,
  the `kp` creature's aggro reach rolled once a second), the idle noise;
  (b) **bomb only**: the fuse ticking;
  (c) **the act's move**: `nest` and `rat` do their whole frame (with `chill`/`ty`) and `continue`, skipping all
  below; then an `if/else` chain: `spider`, `jelly`, `turret` (nothing), `hunting` → the classic chase, else the
  classic patrol (chase, bomb, shoot, and any act not named);
  (d) **shared**: `chill` reset, `ty` (the hover bob, none for a `kp` creature);
  (e) **contact**, when hunting and touching: a bomber bursts, splices itself and `continue`s; anyone else bites
  (the `kp` bite knobs, or `k.dmg`);
  (f) **shoot/turret only**: firing, with the turret's wind-up ring.
  The acts are exclusive, so (c)'s branches can become one dispatch at the chain's place without reordering anything.
- **Act and body are two separate axes.** 16 creature types, 8 acts, 8 bodies: the `drone` body is worn by three
  shooters and a turret, `blob` by a chaser, two bombers and a turret, `skull` by two turrets, `crawler` by three
  chasers. Only the four reworked creatures (spider, jelly, rat, nest) are one act = one body = one creature. A
  classic creature has no step of its own: its behaviour is its act (shared by up to five types), its look is its
  body. So the registry is keyed by **act** (what the loop does), and drawing stays keyed by **body**: `drawEnemy`
  (`creatures/draw.js`, layer 4, pure, one line per body) needs nothing from the game and stays as it is.
- **The layer rule.** The branches use layer-5 systems: `hurt`, `burst`, `lineOfSight`, `solidCell`, `puffSpores`,
  `spawnRat`/`ratFrame`, `fireBlast`, `fireEnemyShot`, `W`, `G`. `creatures/` is layer 4, so "`creatures/<name>.js`
  exports `step(e, W, dt)`" can't hold them. The pure brains (`spiderStep`, `jellyStep`, `ratStep`) and sprites stay in
  `creatures/`; each creature's Game side goes to a new `src/game/creatures/` (layer 5). **D20.**
- **Per-creature bits outside the loop**, and where they go:
  - move in P3.5: the (c) branches, the bomb's fuse (b) and burst (e), the shoot/turret firing (f); the spider's
    once-a-frame passes (silk, strings, web lines coming down) as its `frame` hook, at the same place; `drawSilk`
    (render/actors.js: webs, lines being shot, silk, strings, all spider) to the spider's file, still called from
    the same spot in draw; `damageEnemy`'s nest branch (the gold shower, early return) as the nest's `die` hook;
    `systems/rats.js` whole (it *is* the rat's Game side: `ratFrame`, `spawnRat`, `navFor`, `unstick`, `ratSolid`,
    `onWebIn`); `natural` (enemies.js, used only by the jelly's `env.stay`).
  - stay: the jelly's colour ternaries (`e.je ? jcol('jeColBody', …) : e.k.col.a` in `damageEnemy`'s burst and
    `drawEnemies`' bar; a hook each would be more code than the one line), rats' and nests' "bar only once hurt"
    line in `drawEnemies`, the carried-gold drop in `damageEnemy` (any `e.carry`), light.js's creature glow (generic
    on `k.glow`/`kp`, with the jelly's `u`) and plant glow call, `puffSpores` (ambience.js), `plantGlow` (its own
    system), `alertAt` (props.js, via `HUNTERS`), `HUNTERS`/`NATURAL_ONLY` in `data/creatures.js` (`level.js`, layer 3,
    reads `NATURAL_ONLY`), and the player's web climbing (`webSlow`/`webGrab`/`webClimb` in props.js and
    `movePlayer`: your side of a web line, not the spider's).
- **What stays shared in enemies.js**: (a), (d), the contact bite, Contact Damage, the creatures' shots (any
  creature's: `goo`, `drip`, `splat`, `fire` are generic shot fields), `damageEnemy`, `fireEnemyShot`, `hitT`.
- **Knob tables (D11): not safe to move now; they stay in `dev/knobs.js`.** `DEV = Object.assign({}, DEV_DEFAULTS)`
  and the saved-values read run in knobs.js at load, and knobs.js loads before every creature file (they import
  it), so a `rangeKnobs` call from `creatures/spider.js` would come after `DEV` is made: `DEV` would miss those
  keys. Moving them needs `DEV` built differently (say `rangeKnobs` also writing `DEV[k]` and reading the saved
  value itself): a change to how DEV is made, not a move. And `DEV_META`'s order would then follow the bundle's
  module order instead of knobs.js's text. The panel itself wouldn't change (rows are filtered per `DEV_GROUPS`
  group, and a table's rows stay together), but `devReport()`'s copied text (the one the owner pastes) lists the
  changed and unchanged knobs in `DEV_META` order, and the logic tests' bundle (`pure.js`) orders modules
  differently from the game's (`main.js`). Visible, and not clearly safe: left for after the refactor, if ever.
- **Bullet looks as a `LOOKS` table: no.** `drawLook` and `shotTrail` already read as tables: one
  `else if (L === 'x')` branch per look, in the same order in both files. Each branch leans on its function's shared
  opening lines (the unit vector, `s`, the `dot` helper; `chance`), which a table would have to thread into every
  entry, and `shotBounce`/`shotDeath` group looks *by effect* (`orb || chain || rubber || heavy` share one burst,
  four looks share the skipping sparks), which a per-look table would split up or duplicate. More plumbing, not
  clearer. Adding a look stays: a branch in `drawLook`, one in `shotTrail`, and optionally `shotBounce`/`shotDeath`.
- **Proof.** The probe (D14) meets a spider, a jelly and a nest on floor 1 (rats may come out of the nest) and
  walks onto floor 2 for a moment; it doesn't reach a classic creature reliably, nor a nest's death. So each step
  also runs its creature's browser suites: `rats` (nest, rat), `spider`, `jelly` + `archvine` (the zones), and
  `creatures` (climbs five floors: the classic acts) for the classic step and whenever `enemies.js`'s shared part moves.

- [x] **P3.5 sub-tasks** (D20; one commit each, probe SAME + logic + smoke + the creature's suites):
  - [x] P3.5 (1): the registry and its first creature, the nest. `src/game/creatures/acts.js` (`ACTS`), the
        per-enemy object `C` in `stepEnemies`, the dispatch at (c)'s place (the other acts still inline below it),
        `damageEnemy` asking `ACTS[act].die`; `src/game/creatures/rat.js` with `nestMove` and `nestDie`. (The registry
        alone would be empty scaffolding with nothing to dispatch, so it comes with its first creature.)
  - [x] P3.5 (2): the rat: `systems/rats.js` into `game/creatures/rat.js` whole, `ratMove`; Game.js's `onWebIn`
        import follows
  - [x] P3.5 (3): the spider: `spiderMove`, `spiderFrame` (silk in flight, strings on you, web lines coming down,
        once a frame at the same place), `drawSilk` from render/actors.js → `game/creatures/spider.js`
  - [x] P3.5 (4): the jelly: `jellyMove` (tentacle sting, spit) and `natural` → `game/creatures/jelly.js`
  - [x] P3.5 (5): the classic acts → `game/creatures/classic.js`: `classicMove` (hunt or patrol: chase, bomb,
        shoot, and the fallback for an act not in `ACTS`), `bombFuse` (`pre`), `bombBurst` (`contact`), `gunFire`
        (`fire`, shoot and turret); `turret` gets no `move`. The inline chain is gone
  - [x] P3.5 (6): tidy and notes: enemies.js header, CLAUDE.md's creature notes ("adding a creature"), checkpoint
        full suite
- [x] **P3.6** `Game.js` is left owning: making the world, the loop (step/draw/replay
      switch), and the React `input` bridge. Target < 800 lines. Full suite green. Merge to
      `main` with a version bump; owner plays it.
      Checked from the code: Game.js is 186 lines and does exactly that — `makeWorld()`, the
      canvases and `G`, the save resume/timers, resize and the mouse listeners, the rAF loop
      (replay or `step`/`recFrame`/`draw`), the cleanup; App reaches it only through `input`.
      Header comment brought up to date. Owner played the branch ("plays great"); merged as v99.

### Phase 4 — TypeScript, gradually

Catches "wrong field name" and "missing argument" bugs before the phone does.

- [x] **P4.1** Add `typescript` (dev dep), `tsconfig.json` with `allowJs` + `checkJs`
      off globally. `tests/run.js` runs `tsc --noEmit`.
      Done: `typescript` 7.0.2 (the native compiler; `node_modules/typescript/bin/tsc` runs it, ~0.2 s for all of
      `src/`). `tsconfig.json`: `allowJs`, `checkJs: false`, `noEmit`, target `es2022` + lib `es2023`/`dom`/`dom.iterable`
      (a modern WebView), `module: esnext` + `moduleResolution: bundler` (plain `./x.js` imports as written), `strict`
      and `noImplicitAny` off to start, `skipLibCheck`, `types: []` (no stray `@types` from node_modules), include
      `src/**/*.js` + `src/**/*.d.ts`. TS 7 defaults `strict` on, so it's set off explicitly. `src/globals.d.ts`: `React`,
      `ReactDOM` (the UMD tags, `any`: `@types/react` would be a new dependency for `createElement` and four hooks) and
      `VERSION`. `tests/run.js` runs `tsc --noEmit -p .` after ESLint; a report is a failed suite named `types`.
- [x] **P4.2** Write the shared shapes once in `src/types.d.ts`: Gun, Shot (blankShot's
      fields), Plan (planCast's return), Enemy, CreatureKind, Prop, Level, World, DevKnobs.
      Done, written from the real objects (a scratch script dumped the key sets of `MODS`, `makeGun`, `planCast`,
      `CREATURES`, `enemyFor`, `perkBag`, `makeLevel` on floors 1 and 3, `DEV`; the fields the game adds were
      grepped from `src/game/`). Global (no import/export), so a checked file names them straight in JSDoc. Besides
      the list: `Mod` (a MODS entry), `Pt`, `Rnd`, `Pixels`, `CreatureType` (a CREATURES entry), `NestState`,
      `Perk`/`PerkBag`, `Pickup`/`StockItem`/`Room`/`NestSpot`, `FireState`, `DevRow`, `Bullet`, `Player`,
      `GameCtx` (`G`), `StepFrame`/`DrawFrame` (the two `F`s). 58 `any`s, nearly all in `World`/`GameCtx` (the
      particle lists, sound loops, the recorder, App's `input`, the creatures' brains): left for the game, creatures
      and ui folders to narrow when they're checked. `DevKnobs` has an `any` index signature: the range and colour
      tables add hundreds of `xLo`/`xHi` keys, numbers or colour strings, which a type can't tell apart by name.
      `skipLibCheck` is now off, so tsc checks `types.d.ts` itself (a .d.ts is otherwise skipped; lib.dom is clean,
      0.25 s).
- [x] **P4.3** Turn checking on per folder (`// @ts-check` or rename to `.ts`, since
      esbuild strips types), in this order: core, data, spells, world, creatures, game, ui.
      Fix real errors. For noise, add a type, not an `any`, where it's cheap.
      **How (D21):** `// @ts-check` as each file's first line, types in JSDoc (the shapes from `src/types.d.ts`).
      **Behaviour doesn't change, overriding "fix real errors":** only types, JSDoc, casts in comments and
      type-only declarations go in. A real bug the checker finds is logged under **Found along the way**
      (file:line, what, why it's real) and its one line silenced with `// @ts-expect-error <reason>`, not fixed.
      Proof per folder: `index.html` unchanged (JSDoc never reaches the bundle), probe SAME, logic, smoke.
  - [x] core (`consts.js`, `util.js`): clean as soon as it was on; util's helpers got JSDoc parameter types
        (so callers in checked folders are checked against them). 0 bugs, 0 `any`s
  - [x] dev (`knobs.js`): one error, noise: `DEV_META`'s type was inferred from its first rows, so the colour
        rows (no min/max/step) didn't fit. `DevRow[]`/`DevKnobs` on the tables and `DEV`; `RangeRow`/`ColourRow` tuple
        typedefs, so every knob table's rows are now checked (they all fit). 0 bugs, 0 new `any`s
  - [x] data (`themes.js`, `creatures.js`, `perks.js`): clean as soon as it was on. Types on the tables
        (`CREATURES`, `PERKS`, `HUNTERS`, `NATURAL_ONLY`) and functions (`rosterFor`, `enemyFor` → `CreatureKind`,
        `perkBag` → `PerkBag`, `themeFor`, `decorFor`); `Perk` in types.d.ts tightened (its effects are `PerkBag`'s
        fields), `PerkBag.maxHp` optional (perkBag fills it after the literal). **1 real bug** found while typing
        `enemyFor` (not by tsc: nothing reads `k.fire` in a checked file yet): Stendari's fire never lights, logged under
        Found along the way. `CreatureKind` has no `fire`, so the game folder's check will flag the two readers. 0 `any`s
  - [x] spells (`mods`, `spawn`, `guns`, `cast`, `trace`, `advisor`, `bagsim`): two errors when turned on, both noise
        (`TRIG_VARIANTS`' extras inferred as a union with the strings). Typed: `MODS` as `Record<string, Mod>` (so every
        spell's fields and kind are checked against `Mod`, and every modifier's `f(s)` against `Shot`'s fields: all fit),
        the price/tier/family tables, `TRIG_VARIANTS` as tuples, and every exported function (`planCast` → `Plan`,
        `blankShot` → `Shot`, `makeGun` → `Gun`, `tracePath`, `gunRate`, `buildAdvice`, the fire preview's `FireSim`,
        `CastGroup`). types.d.ts: `Gun.mana`/`idx`/`order`/`delayT`/`rechT` optional (the makers build the object and
        `resetGun` fills them in), `Gun.hue` optional (a preview gun has none; `gunHue` hashes the name, by design),
        `Mod.id` optional (filled in after the table). 0 bugs, 1 `any` (`statQual`'s value: a number, or `shuffle`'s boolean)
  - [x] world (`vision`, `fire`, `nav`, `zones`, `veins`, `nests`, `strata`, `decorate`, `level`): three errors when
        turned on, all noise, none a type could fix without touching code, so each got a one-line `@ts-expect-error`
        with its reason: `1 + (R() < 0.4)` in decorate's moss (a boolean as 0/1, on purpose), and the two test hooks set
        as properties on their own function inside its body (`strataCave.last`, `timberWorks.zones`: TS only sees such
        a property when it's set at the top level). Typed every exported function (`makeLevel` → `Level`, `decorate`,
        `cullDecor`, `propAnchored`, `archCurve`/`Near`/`At`, `strataCave`, `timberFrame`, `timberWorks`, `paveWorks`, the fire engine on
        `FireState`, `navField` → a `NavField` typedef, `navWay`, `ratNests` → `NestSpot[]`, `goldVeins`, `boxReach`,
        `builtAt`, the vision functions with a `solidCell` callback type) and the flag tables. types.d.ts: `Spot`,
        `Working`, `Theme`, `Noise2` added; `Prop.arc` was wrong (it is `[x, y]` pairs from the prop, not points),
        `NestSpot.mound` is pixel indices. The arch helpers take `{ x, y, arc }` (decorate calls them on an arch before
        its box is filled in). 0 bugs, 0 `any`s, 3 `@ts-expect-error` (noise)
  - [x] creatures (`common`, `spider`, `rat`, `jelly`, `classic`, `draw`): clean as soon as it was on. Typed every
        exported function; the brains are shapes now (types.d.ts: `SpiderBrain`, `RatBrain`, `JellyBrain` on `Enemy.sp`/
        `ra`/`je` instead of `any`, with `RoamState`/`SurfState` for what `roamStep`/`surfSeat` keep on them), what each
        step is handed (`SpiderEnv`, `RatEnv`, `JellyEnv`), `WebLine` (also `World.webs`), `SpiderShot`, `SolidCell`,
        `CreatureCol`; `PlantGlowOpts` in jelly.js. Typing the spider's brain gave three errors, noise: `mode` narrowed
        after `if (S.mode === 'shoot') return` though `decide()` changes it in between, so `SpiderBrain.mode` is a
        `string` (its values in the comment). 0 bugs, 0 `any`s
  - [x] the rest of layer 4 (`art/`, `audio/`, `save/`, `replay/`; not in the order above, but P4.4 wants every file on):
        one error when turned on, noise: `window.webkitAudioContext` (the old prefixed constructor sfx.js falls back to),
        declared on `Window` in globals.d.ts. Typed the exported functions and tables (the sprites, `drawProp`/`propGlow` on
        `Prop` + `Theme`, `shotSound`, `creatureSound`, `rustleStep`, `cleanGun` → `Gun`, `cleanLoadout` → `Loadout`, `readSave`
        → `SaveData`, the replay helpers) and SFX's public calls. `SFX`'s `safe()` wrapper returned a bare `function ()`, so
        every `SFX.x(…)` call would have been "expected 0 arguments" once game/ is checked: it is typed `<T>(fn: T) => T`, with
        one `@ts-expect-error` (TS can't see that passing `arguments` through keeps the signature). types.d.ts: `Loadout`,
        `SaveData`, `SavedLevel`, `RpSnap`, `RpFrame`, `RpRect`, `RpPatch`; `Prop.u0`/`u1` (a burning arch). 0 bugs; `any`s: save 2
        (`cleanGun`/`cleanLoadout` take whatever the store held), replay 7 (snapshot entities are clones of anything:
        `rpCopy`/`rpLerp`/`rpList`/`rpClone`, and `RpSnap`/`RpFrame`/`RpPatch`'s index signatures), 1 `@ts-expect-error` (noise)
  - [x] game (`src/game/`), in groups, one commit each. types.d.ts's game section narrowed first (one go, before
        any game file was on): `World`'s lists typed (`EnemyShot`, `Field`, `Beam`, `Arc`, `Coin`, `Toast`, `Flash`,
        `Cloud`, `Ring`, `Devil`, `Silk`, `SilkString`, `Sconce`, `Ghost`, `Zfx`; `Particle` for the grab-bag lists
        smoke/sparks/torchP/motes/dparts/amb/burns, common fields + an index signature), sound loops as `SoundLoop`
        (`ReturnType` of `SFX.loop`), `navYou` as `NavCache`; `Player` lost its index signature (every field it gets
        is declared); `GameCtx.input` is `{ current: GameInput }` (App's ref: `StickState`, `Hud`, `Prompt`,
        `Witness`, `ReplayView`), `REC`/`RT` are `Recorder`/`ReplayPlayer`, `RPV` a `ReplayView`; `StepFrame.LO` a
        `Loadout`, `DrawFrame.TH` a `Theme`; new `EnemyCtx` (`C`, D20) and `ActHooks`. `Level`/`World` `img`/`dimg`
        are `ImageData` (makeLevel makes them with `new ImageData`; `Pixels` stays for the pure code that only reads
        them). JSDoc on the functions by a scratch script from the parameter names (`W` → `World`, `G` → `GameCtx`,
        `F` → `StepFrame`/`DrawFrame` by folder, `e` → `Enemy`, `b` → `Bullet`, `pr` → `Prop`, coordinates and
        times → `number`, a table of the odd ones), then checked by hand
    - [x] `world.js`, `Game.js`, `testhook.js`: two errors, noise: `window.__TEST`/`__lvl` (declared on `Window`
          in globals.d.ts), and `W.img`/`W.dimg` as `Pixels` handed to `putImageData` (now `ImageData`, above).
          `makeWorld` → `World`, `G` → `GameCtx`, testHook's `g` a local `TestFns` typedef. 0 bugs, 0 `any`s
    - [x] systems, part 1 (`terrain`, `particles`, `player`, `enemies`, `fire`, `webs`, `fog`, `ambience`, `props`,
          `plantglow`, `lightning`): 34 errors when turned on. Noise fixed by a type: the script's guesses (`growBox`'s box
          and `splat`'s enemy shot weren't a `Bullet`), optional parameters callers leave off (`goo`'s size/colour,
          `flameAt`'s speed, `shatter`'s count, `sputterStep`'s rnd, `explode`'s splash/hot, `fireBlast`'s hot), and
          types.d.ts fitted to what the code stores: `Prop.fall`/`warn` booleans, `heard` a 1, `climb` (an arch's rolled
          climb speed), `Bullet.struck` a 1, `jetSt.gap`. Three one-line `@ts-expect-error`, noise: a boolean counted as
          0/1 (ambience), `flushFire`'s `[box, context, pixels]` rows read as a union, and a vent reusing `Prop.on` as
          "roaring" (logged, below). **Stendari's `k.fire`** (the logged bug) in `fireEnemyShot`: its line sits inside an
          object literal, where esbuild keeps comments (a `@ts-expect-error` there reached `index.html`, and so did
          joining the literal onto one line: esbuild keeps an object's line breaks), so the local `k` is typed
          `CreatureKind & { fire?: number }` with a comment pointing at the entry. 0 new bugs, 0 `any`s
    - [x] systems, part 2 (`gun`, `fields`, `bullets`, `shotlooks`, `pickups`, `recorder`, `save-run`, `level-entry`,
          `step`): ~200 errors when turned on, nearly all one guess of the script's (`shotlooks.rnd(a, b)`'s `b` is a
          number, not a `Bullet`: every call flagged). The rest noise, fixed by a type: `Bullet` split into what every
          bullet has and optional rest (a cluster's pellets and the Angry Ghost's shots are pushed with only the first
          block; the loop reads a missing field as 0), `hit`/`propHit` are `Set`s, `Pickup.cool`, `Devil.snd`,
          `enterLevel`'s `back` a `SavedLevel`, the recorder's pixel copies `Uint8ClampedArray<ArrayBuffer>` (what
          `new ImageData` takes). `World.sconces` stays `any[]` (enterLevel builds `[x, y]` pairs, then maps them to
          `Sconce`s; the pairs span two lines of one array, where a comment would reach `index.html`). Four one-line
          `@ts-expect-error`, noise: `recWrap`'s `[context, 't'/'d']` rows read as a union (3), and `drawReplay`'s
          stand-in `W.fire` (no fuel). 0 bugs, 1 `any` (`sconces`)
    - [x] `render/` (`draw`, `cave`, `actors`, `effects`, `light`, `looks`, `overlay`): 8 errors when turned on, noise
          but for one wrong type of mine: `G.aimPath` is `tracePath`'s flat `x, y, x, y, …` (was `Pt[]`). Fixed by a type:
          `Player.aim.vis` (the aim line's fade), `drawTorch`'s embers are `Particle`s. One `@ts-expect-error`, noise:
          `drawReticule`'s `[width, colour]` rows read as a union. 0 bugs, 0 `any`s
    - [x] `creatures/` (`acts`, `classic`, `jelly`, `rat`, `spider`): 3 errors when turned on. Noise: `unstick`'s `home`
          is the "carrying gold home" flag, not an `Enemy` (the script's guess). **Stendari's `k.fire`** in `bombBurst`
          (`src/game/creatures/classic.js:65`), the logged bug: a statement, so a one-line `@ts-expect-error` pointing at
          the entry. `ACTS` is `Record<string, ActHooks>` (every hook's signature checked against D20's), `onWebIn`
          typed; `Enemy.roam`/`path`/`jobO` narrowed from `any` (`RoamState`, `Pt[]`, `object`). Then the index
          signatures on `Coin`, `Silk`, `Ghost`, `Field` came off (the fields they really get added: `Silk.life`,
          `Field.near`/`dT`/`done`), `Bullet.trail` is `Pt[]`. 0 new bugs, 0 `any`s
  - [x] **game done**: every file under `src/game/` checked. `any`s left in the game section of types.d.ts: 9
        (`Particle`'s index signature, for the grab-bag particle lists; `Shot`/`Bullet.bounceFx`, always null; `sconces`;
        `StickState`'s and `Prompt`'s index signatures and the two legacy `confirmAct`/`confirmAim`, for the ui folder to
        narrow (it did: 4 left after ui); `RP_ARR`'s `any[]`). `@ts-expect-error` in game/: 9 (7 noise, 1 the vent, 1 Stendari in
        `bombBurst`; `fireEnemyShot`'s Stendari line is a typed local instead)
  - [x] ui (`app`, `cards`, `devpanel`, `editor`, `h`, `hud`, `swap`, `witness`): 9 errors when turned on, all noise.
        The Dev panel's jelly preview hands `jellyStep` a stand-in creature: `jellyStep`'s `e` is now
        `Pick<Enemy, 'x' | 'y' | 'hx' | 'hy' | 'r' | 'je'>` (what it reads) and `roamStep`'s just a home. DOM lookups:
        `closest(…)` returns an `Element`, `.dataset` is on `HTMLElement`, so the three `const`s are typed
        `HTMLElement | null` (`closest` is generic: TS infers it from the declared type, no cast). Three one-line
        `@ts-expect-error`: the preview's stand-in vines to `drawProp`, and `document.activeElement.blur` twice (an
        `Element`). Typed every component's props (`input` as `{ current: GameInput }`, so App's bridge is checked
        on both sides; App's own `useRef` gets the type on its `const`), `fmtGold`, `deckLayout`, `healthCol`,
        `holdPress`. `StickState` and `Prompt` lost their index signatures, the legacy `confirmAct`/`confirmAim` are typed.
        React stays `any` (globals.d.ts, P4.1), so `h(Component, props)` calls aren't checked against the props.
        0 bugs, 0 `any`s
- [x] **P4.4** Once a folder is clean, keep it clean: the check is part of the green bar.
      Done: every `.js` under `src/` is on (the three left, `main.js`, `pure.js`, `version.js`, were clean), so
      `tsconfig.json` now has `checkJs: true`: all of `src/` is checked, and a new file is too without anyone remembering
      a first line (checked: a planted error in a new file with no `// @ts-check` fails the run). The `// @ts-check` lines
      stay, now redundant (taking them out of ~80 files is churn for nothing). `tests/run.js` already fails the run on
      a report (`types`, since P4.1). tsconfig's, run.js's and CLAUDE.md's notes on the check say so; CLAUDE.md also
      says where a comment may not go (inside an object or array literal: esbuild keeps it). Totals for P4.3: 1 real
      bug (Stendari's fire, found in data/, silenced where game/ reads it) and 1 oddity (a vent reusing `Prop.on`), both
      logged, not fixed; 16 `@ts-expect-error` lines (14 noise, each with its reason; 1 Stendari; 1 the vent). `any`s
      left besides React/ReactDOM: in types.d.ts `DevKnobs`' index (P4.2), `bounceFx` on `Shot`/`Bullet` (always null),
      `Particle`'s index, `World.sconces`, `G.RP_ARR` and the replay's snapshot shapes; in JSDoc the four replay helpers,
      `cleanGun`/`cleanLoadout`'s input (whatever the store held), `statQual`'s value and `ScrollBox`'s React children.
      `strict` is still off (D21): turning on `strictNullChecks` per folder is the next step up, if wanted

### Phase 5 — notes live next to the code

- [x] **P5.1** Each `src/<folder>/` gets a short `README.md`: what's in it, the rules that
      matter ("planCast mutates g.idx", "the aim line must stay honest", "fire must not
      reveal fog", the owner's rules for that area). Moved from `CLAUDE.md`, and updated to
      new names. Done: 15 READMEs (core, dev, data, spells, world, creatures, art, audio, save,
      replay, game, game/systems, game/render, game/creatures, ui). They don't reach the build or
      the checks: esbuild bundles only what `main.js` imports, `tests/load.js`'s `.source` reads
      only `.js`, ESLint lints `src/**/*.js`, tsc includes `.js` and `.d.ts`; `index.html` unchanged.
- [x] **P5.2** `CLAUDE.md` slims to: the owner's working style, the release loop, the
      testing rules, the layer rule, a map of folders → READMEs. Target < 150 lines. Done: 1,132 →
      148 lines; every rule checked against the old file (`git show 1aa5181:CLAUDE.md`) and found in a
      README, `CHANGELOG.md` or the new CLAUDE.md.
- [x] **P5.3** Version history paragraphs (v40…v96) go to `CHANGELOG.md`. Anything still
      needed as a *rule* goes to the right folder README. Done: `CHANGELOG.md` at the root, v39–v99
      plus an Unreleased entry (Phases 4–5), from CLAUDE.md's vNN notes, HANDOVER's "What shipped"
      and the release commits; the rules in them went to the READMEs in P5.1.
- [ ] **P5.4** Update `HANDOVER.md`; mark this doc **Done** at the top.

---

## 6. Later, only if needed (not part of this refactor)

- **Performance on low-end phones**: draw terrain/fog with the GPU (WebGL, e.g. PixiJS),
  or move fire and rat pathfinding into a Web Worker. Only if a phone actually struggles.
- **Fixed-timestep simulation** (step at a steady 60Hz regardless of frame rate). Makes
  replays exact and physics steadier, but it changes feel, so it's a gameplay change.
- JSX, if `h(...)` calls start to hurt in the UI.

## 7. Out of scope

- Changing engine (Godot, Unity…). Decided: stay on web tech.
- Play Store / App Store release, Capacitor, iOS. The current Android shell and
  self-update stay as they are.
- Any gameplay change, balance change or bug fix inside a refactor commit (log it instead).

---

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Stay on JS + canvas + React UMD; no engine change | Owner's call. The game works, and a rewrite would throw away 96 versions |
| D2 | esbuild, not Vite | One small dependency, fast, enough for bundling one file |
| D3 | Built `index.html` stays committed at the root | Android shell, CI, Pages, `serve.js` and the version check all keep working untouched |
| D4 | `VERSION` written as a literal un-bundled line by the build | The Android shell and CI parse `VERSION = 'vNN'` with single quotes; esbuild would reprint it |
| D5 | Logic suites go through `tests/load.js` | Suites stop caring where code lives, so each move doesn't touch 33 files |
| D6 | The dev `package.json` also carries `playwright-core` (and `globals`, the browser-globals list ESLint needs); `tests/chromium.js` finds an installed Windows Chrome | Browser suites run after one `npm install`, with no per-session scratchpad setup or env vars |
| D7 | `VERSION` is not imported: `src/version.js` is read by the build (and by `tests/load.js`), and the game code uses the global the page's own `<script>const VERSION = 'vNN';</script>` declares (ESLint knows it as a global) | The bundle never declares it, so there is exactly one `VERSION = 'vNN'` in `index.html` for CI and the app to find |
| D8 | esbuild runs with `treeShaking: false` | Otherwise it drops code nothing calls yet (`groupStats`, still tested) |
| D9 | The browser test page copies every top-level name of the bundle onto `window` (`tests/build.js`, names found by parsing with espree, which ships with ESLint) | Browser suites call `MODS`, `DEV`, `resetGun`… from `page.evaluate`; inside the iife those aren't globals any more. Suites stay unchanged |
| D10 | `tools/move.js` does the P1.5 moves: cuts named top-level statements (with the comments above them) out of `main.js`, puts `export` on them, and recomputes the imports on both sides from what each file actually uses; refuses a move whose code still needs something in `main.js` | Each move is mechanical and the same shape; a cycle back into `main.js` can't slip in. Deleted with the v98 release (used for P1.5 and all of Phase 2; `main.js` is now only the mount, so nothing is left for it) |
| D11 | In Phase 1 every knob table (`SP_KNOBS`, `JE_KNOBS`, `RA_KNOBS`, `JE_COLS`, `LV_KNOBS`, `ARCH_KNOBS`, `FIRE_KNOBS`) stays in `dev/knobs.js`, not in its creature's file | `DEV` is copied from `DEV_DEFAULTS` once, right after the tables register. A table in `creatures/spider.js` would register *after* that (knobs.js loads first), so `DEV` would miss its keys and the Dev rows would reorder: a behaviour change. Moving them needs `DEV` built after all tables (Phase 3) |
| D12 | Proof a move changed nothing: parse the built bundle before and after, and compare every top-level statement's text (indentation aside): `node tools/same.js [ref]`. After P1.5 all 359 matched the P1.2 bundle exactly; only the order differs (modules first) | Stronger than the suites for a move-only phase: same text in, same behaviour out. The only thing a move can change is load order, and nothing at the top level reads a later module's state (checked for `MODS` in P1.5) |

| D13 | `game/Game.js` declares its own `const { useRef, useEffect } = React; const h = React.createElement;` instead of importing them from `ui/h.js` | Layer rule: `game/` (5) may not import from `ui/` (6). Cost: two top-level `h`s in one bundle, so esbuild prints Game's as `h2`/`useRef2`/`useEffect2` and shifts inner locals already printed `h2` to `h3` (15 statements besides Game). `node tools/same.js --renames` shows every difference is such a rename (identifier tokens only, one consistent map); checked at P2.7 |
| D14 | Phase 3's proof is `node tests/determinism.js [ref]` (default HEAD): the same scripted run on the ref's build (through the ref's own `tests/build.js`) and this tree's, every frame hashed (player, creatures, shots, pickups, particles, fire, random numbers drawn; rock + fog every 30 frames, canvas pixels every 60) | Cheap and stable: an init script seeds `Math.random`, freezes `performance.now` and takes over `requestAnimationFrame`, and the probe pumps 840 frames of exactly 1/60 s in one synchronous go (React can't re-render mid-run). ~6 s a run; `--self` gave identical hashes 5 times out of 5, and a one-number change (a spark speed) was caught at frame 153. It covers the shop, three floor-1 creatures (spider, jelly, nest), digging, fire, damage and the portal to floor 2. Not a suite, a before/after tool like `same.js` |
| D15 | `W` (P3.2) holds the level's simulation state: the level-scoped `let`s, the run's lists, the player, camera and timers. Canvases/contexts, `REC`/`RT`/`RPV` (the recorder and replay), `raf`/`last` and `mouse` stay loose until P3.4 gives them homes (a render context, `recorder.js`) | The canvases are DOM resources, not world state, and `makeWorld()` stays plain data a logic test could make; the recorder is its own system with its own state |
| D16 | **P3.4's shape.** A system is a module in `src/game/systems/` exporting plain functions. A function takes `(W, G, …)` if it needs anything outside the world, `(W, …)` if it needs only the world, and just its own arguments if neither. `G` is one object Game makes next to `W`: what isn't world state (`input`, the canvases and contexts, with the recorder's *wrapped* `tctx`/`dctx`, the recorder `REC`/`RT`, the fire's dirty boxes, render scratch). Systems import each other's functions directly. Where pure code wants a callback (`losClear`, `visPoly`, a creature's `env.solidCell`), the call site passes an arrow, `(cx, cy) => solidCell(W, cx, cy)`. `tools/system.js` does each move (see its header) | `W` stays plain data (D15); `G` keeps the DOM and the React bridge out of it. One rule for every system, decided by what each function uses, so a move is mechanical and the tool can work it out. Plain functions over a closure-per-system factory: step and draw will call across systems freely, and a factory would need every other system's bound functions handed in |
| D17 | **Call cycles between systems are allowed** (`explode` in terrain.js → `fireBlast` → `ignite` in fire.js → `blowProp` in props.js → `explode`), as circular imports. Rule that keeps them safe: a system module does nothing at load time that calls another system; its top level is function declarations, arrow consts and plain data | esbuild bundles everything into one scope (the game's iife, and tests/load.js's CommonJS bundle), so there are no half-loaded modules at runtime; every function in the cycle is only ever called while the game runs, long after all modules have loaded. Keeping the cycle inside one module instead would put an explosion, the fire and the props in one file |
| D18 | **step()'s parts share one per-frame object `F`** (`{ dt, LO, MHP, pcx, pcy }`), made at the top of `step` and handed to every part; a part that fills one in (`stepPerks`: `LO`, `MHP`; the portal check: `pcx`/`pcy`) writes it there. A part reads its fields with a `const { … } = F;` first line. A part that can end the frame (New cave, the portal) returns `true` and step returns | The locals that live across parts are few and never change once set, so one small object a frame is simpler than a different argument list per part, and the destructuring keeps each moved block word for word. Recomputing `pcx`/`pcy` per part would not do: a Teleport Bolt moves you mid-frame and the later parts must still see where you were |
| D19 | **draw()'s parts share a frame object `F` too**, like step's (D18): `{ dpr, playPx, vw, vh, pcx, pcy, … }`, made at the top of `draw`. `drawCamera` fills the view (`dpr`, `playPx`, `vw`/`vh`) and where you are (`pcx`/`pcy`); a later part that sets up something the parts after it use (the theme `TH` and `onView`, the held gun and aim) fills its fields the same way. Parts live in `render/` by theme, each `(W, G, F)` (only what it uses) with a `const { … } = F;` first line. `if (G.RPV) return;` (a replay has no HUD) stays in the top-level `draw` | Same reasons as D18, and the same tool (`tools/part.js`) does the cuts. Nothing in draw changes what these are made from, so a part could recompute them, but reading them off `F` keeps every moved block word for word (and `TH`/`onView`/the aim are more than a line each) |
| D20 | **P3.5's shape: creature plugins keyed by act, in `src/game/creatures/`.** A creature's pure brain and sprite stay in `creatures/<name>.js` (layer 4). Its Game side (its part of the enemy loop, its hooks) is `src/game/creatures/<name>.js` (layer 5, beside `systems/`), exporting plain `function` declarations. `src/game/creatures/acts.js` holds `ACTS`: act → `{ move, pre?, contact?, fire?, die?, frame? }`, one line per act, and `stepEnemies`/`damageEnemy` call a hook exactly where its inline branch sat: `pre` before the move (bomb's fuse), `move` at the old `if/else` chain (returns true when the creature did its whole frame: today's `continue` for nest and rat), `contact` inside the touching check (true = it's gone: the bomber), `fire` after contact (shoot, turret), `die(W, e)` in `damageEnemy` after the splice (true = skip the normal coin: the nest), `frame(W, G, F)` once a frame after the creatures' shots (the spider's silk). The per-enemy hooks take `(W, G, e, C)`: `C` is one object `stepEnemies` makes per frame and refills per enemy (`dt`, `pcx`, `pcy`, then `i`, `dx`, `dy`, `dist`, `sees`, `hunting`), read with a `const { … } = C;` first line so a moved branch stays word for word (as D18). A file may hold two acts (`rat.js`: `rat` and `nest`). Adding a creature: its pure file (brain + sprite, a `drawEnemy` line for its body), its game file, one `ACTS` line, its knob table in `dev/knobs.js` (D11) | The layer rule: the branches use layer-5 systems, so they can't live in `creatures/` (layer 4), and the pure halves shouldn't move down to layer 5 (the logic suites and the Dev panel's jelly preview use them). Keyed by act, not by creature or body: act and body are separate axes (four acts are shared by 11 classic types, eight bodies by all 16), and the loop's branches are by act already; drawing stays by body in `drawEnemy`. One signature for every entry of a hook, since a table can't vary the arguments per creature (D16's "only what it uses" is per function, not per table). Function declarations, not `const` arrows: `ACTS` is read at load (plain data, D17) inside an import cycle (enemies.js → acts.js → rat.js → rats/terrain → enemies.js), and a hoisted function is always there, where another module's `const` might not be made yet |
| D21 | **P4.3: `// @ts-check` + JSDoc, not renaming to `.ts`.** Each checked file starts with `// @ts-check`; parameter and variable types are JSDoc comments naming the shapes in `src/types.d.ts` (global, no import); no inline casts (`/** @type {X} */ (expr)`): esbuild keeps a comment inside an expression, so it would show in `index.html` (Found along the way); a statement-level `@type` or a narrow `@ts-expect-error` instead. `tsconfig.json` keeps `checkJs` off, so a folder is on when its files carry the line (P4.4: once every file was, `checkJs` went on). A `@ts-expect-error` can't go inside an object or array literal either (esbuild keeps that comment, and keeps a literal's line breaks, so joining it onto one line changes `index.html` too): type the local instead. `strict` stays off (null checks and implicit `any` would be a rewrite's worth of noise); it can be turned on per folder later | Every tool and doc names `.js` paths: `tools/build.js` bundles `src/main.js`, `tests/load.js` bundles `src/pure.js` and walks `src/` for `.js` (`.source`), `tools/system.js`/`part.js`/`gamemap.js`, `pure.js`'s ~80 `export * from './x.js'` lines, every import in `src/`, the layout table in CLAUDE.md and this doc. A rename ripples through all of them for no gain the checker doesn't already give. esbuild drops statement-level comments, so JSDoc never reaches `index.html`, and the proof that a step changed nothing is simply that `index.html` didn't change. Cost: JSDoc is wordier than TS syntax, and without inline casts a few spots need a type on a declaration or a `@ts-expect-error` |

## Found along the way

Bugs, oddities and "this should be better" spotted mid-move. Don't fix them in a refactor
commit. List them here for after.

- **Pure code below `makeLevel`.** `tracePath` (~7041 in `src/main.js`) sits *between*
  `makeLevel` and `Game`, and `drawGunGlow` (~11388) sits *after* `Game`, among the UI.
  CLAUDE.md used to say "everything above `makeLevel` is pure"; the loader cuts at
  `function Game(` so tracePath is covered, but drawGunGlow isn't reachable from logic
  suites. Mind both when cutting modules in P1.5. **Resolved in P1.5:** tracePath is in
  `spells/trace.js`, drawGunGlow in `art/sprites.js`, both reachable by the suites now.
- **Two logic suites read the code as text** (`creatures`: every body has a
  `draw<Body>(ctx`; `rats`: `drawRat`/`drawNest` exist). They now get it from
  `require('../load').source`. Once the code is split, `.source` must be *all* of
  `src/` concatenated, or those checks go false. **Done in P1.4** (`.source` walks `src/`).
- **Browser suites need Playwright on this PC.** None is installed globally; this session
  put `playwright-core` in the scratchpad and set `CAVERUNNER_PLAYWRIGHT` +
  `CAVERUNNER_CHROME` (system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`).
  `tests/chromium.js` only looks for Linux Chromium paths by default. P1.1's dev
  `package.json` could carry `playwright-core` so this stops being per-session.
  **Resolved in P1.1** (D6).
- **`jelly` browser suite is flaky on this PC**, independent of the refactor: run on the
  untouched v96 `index.html` it failed 11 checks, then 1 (the spit / drip / spore-puff
  group: the jelly never gets to spit). Same pattern on the built file. Probably timing in
  the sandbox hunt. Treat like the `sound` flake: re-run before calling it a failure, and
  worth fixing after the refactor. Also fails the same way on v96 from `main`, run in a
  worktree with this PC's Chrome (P1.2), and passed once in a full run (P1.5 spells).
- **`no-undef` can't see a missing import of a name that is also a browser global** (`name`,
  `close`, `status`…): it would quietly resolve to the `window` one. No top-level game name clashes
  with one today (checked in P1.3). `tools/move.js` lints with no globals at all, so moves are safe.
- **More load-sensitive browser checks.** Seen failing in full runs while other work was
  loading the PC, passing alone every time: `torch` ("falls off into the dark…", "the brighter
  frames are the ones with the taller flame"), `lightning` ("a fork hits a creature off to the
  side", already a known flake), `trigger` ("a trigger carrying an explosion blows it up where
  it hits"), `save` ("killed creatures stay dead"), `archvine` ("no jelly swims deep into a
  built-up zone"). Worth a look after the refactor: they measure timing or random outcomes.
  `rats` (browser) failed 3 times in ~23 runs of the P1.5 build ("a rat bites you", "they come
  out of the hole onto the floor") and 0 in 26 runs of v96. Not the split: every top-level
  statement of the P1.5 bundle is identical to the P1.2 bundle's (see D12). Most likely chance
  (random rat moves over a fixed frame count); if it keeps showing, bisect P1.2 (esbuild's
  reprint) against v96.
  P1.6 run: `fog` "flying on reveals more" ("186 -> 154 cave cells") failed once in the full
  run, passed alone. The P1.6 bundle is statement-identical to P1.5's, so chance/load again.
  End of Phase 2: `decor` "a vine holds you where you grabbed it" (y 1381 → 1356) failed once
  in the full run, passed alone; a new name on the list. `torch` "brighter frames…" again.
  P3.4 (after the fire): `jelly` (browser) "saturation 0 greys it out" failed once in the full run, passed 3 of 3
  alone. A new name: it reads the Dev panel's jelly preview canvas, which no P3.4 move touches.
- **`trigger` "a trigger carrying an explosion blows it up where it hits" is flakier than the list says.** P3.4 (13):
  failed 6 of 13 runs alone on that step's tree, 1 of 4 on the commit before it (code checked identical, probe SAME).
  The test waits in real time (50 × 25 ms) for the bolt to cross a 450-wide sandbox and hit the far wall; when it
  fails the carrier was born (`peak` 1) and never let go (`flash` 0), i.e. it hadn't hit anything in time or expired
  first. Worth making frame-counted rather than wall-clock after the refactor.
- **`fog` "the next floor is dark again"**, new on the list: failed once in the full run at P3.4 (19) (`floor` 2 → 3 fine,
  `caveLit` 1 vs a baseline of 0), passed 3 of 3 alone. It puts you in the portal and waits 500 ms of wall clock before
  counting lit cells, so under load a frame or two more of play can reveal a cell. The probe (SAME) goes through the
  portal and `enterLevel` on every step. Worth frame-counting too.
- **`t1spells` (browser) "bubble flies with its own look and leaves a glowing trail"**, new on the list: failed once
  at P3.4 (28) (`glow` 0), passed 3 of 3 alone right after. Chance, not the cut: the bubble's fizz is `chance(6)` a
  second, over 40 frames (~0.67 s) that is none at all about 2% of the time, and the browser suites don't seed
  `Math.random`. Worth more frames, or counting the pop too, after the refactor.
- **`jelly` (browser) "the plant glow lights up a vine beside a jelly"**, new on the list: failed once (vine lit 49.98 →
  48.83) on P3.4 (30)'s tree, in a run comparing the spit flake against P3.4 (31); the spit group failed 3 of 4 there
  and 3 of 4 on (31), so (31) changed nothing.
- **`W.best` is written every frame and reset per floor, and read by nothing** (the P3.1 map lists `draw` as a
  reader; it isn't any more, or never was). Left in step, where it was.
- **Misplaced comments (left as they were, moved with their code).** A second copy of
  planCast's opening comment sits above `blankShot` (`spells/cast.js`); tracePath's opening
  comment sits above `DRIFT_DRAG` (`spells/trace.js`); `ROOM_HW`'s line carries the trailing
  comment "gold per vein pixel dug out", which belongs to `ORE_GOLD` (`world/level.js`);
  GunStats' comment ("A gun's stats, one per line…") sits above `PULL_COL` (`ui/editor.js`).
  Two were fixed because a move would otherwise have carried them to the wrong file: the
  jellyfish sprite comment (was above `drawRat`, now above `drawJelly`) and the `---- sprites ----`
  header (was above `rr`, now above the sprites).
- **Pure code still in `main.js`** after P1.5: `sputterStep`/`SPUTTER_FUEL` (the jetpack,
  Phase 3 player), `NO_INPUT`, `fmtGold`, `deckLayout` (the HUD, Phase 2). They stay in its
  `export { … }` list until they move (the Phase 2 notes say where each goes). **Resolved in
  Phase 2:** `fmtGold`/`deckLayout` are in `ui/hud.js`, the other three in `game/Game.js`.
- **Found in P3.1 (the Game map):** `paint()` (Game.js ~845) has no callers. `total` is set by
  `enterLevel` and read by nobody. `enterLevel` empties every list but `fields`, `beams` (and
  `toasts`, on purpose), so a static field cast just before the portal carries on on the next
  floor at the same coordinates. In a replay, `draw()`'s `visPoly`/`fogReveal` use the *live*
  `mat` (today's rock), not the rock at the replay's time. `draw()` changes the world (fog
  memory, camera, `Math.random` draws), see the map.
- **The `shoplayout` logic suite takes ~26 s of its 30 s cap** (`LOGIC_CAP` in `tests/run.js`),
  and `perks` ~24 s. Not the refactor (the loader costs ~0.15 s), but on a busy PC they could
  time out. If one does, re-run it alone; worth making them lighter after the refactor.
- **`jelly` (browser) spore-puff group** ("a pulse puffs spores out of it", and the four after it), new on the list: failed once in the P3.5 checkpoint's full run (`puffN` 0), passed in 8 runs alone after it. The jelly suite on 3d04c5b (before the jelly move) passed whole 2 of 5 and on the P3.5 (6) tree 3 of 5, both failing only on the spit group and "saturation 0". The probe counts every random draw, spore puffs included, and was SAME at each step.
- **`damageEnemy` looks up `ACTS[act]` with no fallback, `stepEnemies` with `|| ACTS.chase`.** Same behaviour as before for every act (only `nest` has `die`); noted in case an act ever gets a `die` and an unknown act is expected to share `chase`'s.
- **`fireEnemyShot` has one caller now** (`gunFire`, game/creatures/classic.js). Left in enemies.js as the plan said: it reads only generic creature fields (`shots`, `bspd`, `dmg`, `fire`), so any act could fire it.
- **Found in P4.3 (data): Stendari's bomb never sets anything alight.** `enemyFor` (`src/data/creatures.js:123`) copies
  a fixed list of fields from the creature type onto `e.k`, and `fire` isn't among them: `CREATURES.tuli.fire` is 1,
  `enemyFor('tuli', 6).fire` is `undefined` (checked in node). So `bombBurst`'s `if (k.fire) fireBlast(…)`
  (`src/game/creatures/classic.js:60`) never runs, and `fireEnemyShot`'s `fire: k.fire` (`src/game/systems/enemies.js:31`)
  is always `undefined`, though CLAUDE.md's v86 note lists "creature `fire: 1` (Stendari's bomb blast)" as a fire
  source. The fix is one field (`fire: c.fire || 0`) in `enemyFor`, a gameplay change (bombs on floors 6, 7 and 9
  start fires), so it's the owner's call. `CreatureKind` (types.d.ts) says what `enemyFor` really returns (no `fire`), so
  those two lines will need a `@ts-expect-error` when the game folder is checked. **Done in P4.3 (game):** `bombBurst`'s
  line has one (`src/game/creatures/classic.js:64`); `fireEnemyShot`'s read sits inside an object literal, where a comment
  would reach `index.html`, so its local `k` is typed `CreatureKind & { fire?: number }` with a comment pointing here
  (`src/game/systems/enemies.js:28`). When the bug is fixed: add `fire` to `CreatureKind` and drop both.
- **esbuild keeps a comment that sits inside an expression** (P4.3, data): a JSDoc cast `/** @type {X} */ (expr)` came
  out in `index.html` as `(
 /** @type {X} */
 expr
)`. Same code, but the "`index.html` unchanged" proof breaks.
  Statement-level JSDoc (`/** @type */` above a `const`, `@param` above a function), a comment on an arrow's parameter
  and `// @ts-expect-error` lines are all dropped. So P4.3 uses no inline casts (D21).
- **`drawFields` ends with `G.ctx.globalAlpha = 1;` twice** (render/looks.js): one was the line after the old inner
  `drawFieldLook` declaration. Harmless; left as it was.
- **A vent reuses `Prop.on` as "roaring"** (P4.3, game: `src/game/systems/props.js:218`, `pr.on = ph > 2.6`). On an
  arch strand `on` is the arch it hangs off, and `propAnchored` (`src/world/decorate.js:562`) reads `if (pr.on) return
  !pr.on.fall && !pr.on.gone`, so a vent is counted as anchored (never dropped) while it roars, and only checked in its
  quiet part of the cycle; `decorStep` also sets `pr.on = null` when a prop falls. Harmless today (vents have their own
  anchor and get checked a moment later), but one field meaning two things. `Prop.on` stays typed as the arch; the vent
  line has a `@ts-expect-error`. Fix after the refactor: a vent field of its own (`roar`).

## Game map

Made in P3.1 from `src/game/Game.js` at v98 (4,330 lines; line numbers drift). The read/write
lists come from a scope-aware pass (eslint-scope): "writes" means the variable itself is
reassigned (`x = …`), not its contents; arrays and objects only mutated in place count as
reads. `tools/world.js` (P3.2) uses the same analysis for the `x` → `W.x` rewrite.

**Shape.** `Game({ input })` = `useRef` + one `useEffect(() => { … }, [])`. At the effect's top
level: ~30 `let` lines, ~80 `const`s, ~95 inner functions, then the save-load block (484),
listeners, and the rAF `loop` (4290); it returns only the cleanup. Every closure name is
private: the only ways in are `input.current` (the React bridge) and `tests/build.js`'s
string-inserted `window.__lvl` hook.

### State (closure variables), by system

**Canvases, made once, never reassigned** (render resources: they stay out of `W` in P3.2 and
go to a render context in P3.4): `c`/`ctx` (the page canvas), `terrain`/`tctx` (rock),
`decoC`/`dctx` (decoration layer), `bg`/`bgctx`, `fogC`/`fctx`/`fogImg`, `fogBlurC`/`fbctx`,
`miniC`/`mctx`/`miniImg`/`mini32` (map), `pgGlow`/`pgGlowCtx` (1942). `tctx.putImageData` and
`dctx.putImageData` are **wrapped by the recorder** (210) so every partial put lands in
`REC.dirty`: whatever does terrain in P3.4 must keep going through those two.

**Level-scoped, reassigned by `enterLevel`** (these `let`s must become `W.x`):

| Names | Written by | Read by |
|---|---|---|
| `mat`, `img`, `ore`, `start`, `portal`, `arrival`, `stock`, `zone`, `rooms`, `sconces`, `miniEdgeIdx`, `matterProps`, `ambKinds`, `plantW`, `burrow`, `deepFog`, `levelSeed`, `levelOwned`, `roster`, `themeName`, `total` | `enterLevel` only | terrain fns, `step`, `draw`, `saveRun`, rats, fire, `plantGlow`; `roster`/`themeName` only by the test hook; `total` by nobody |
| `enemies`, `pickups`, `props` | `enterLevel`, `drawReplay` (swap) | nearly everything (`enemies`: 20 functions) |
| `dimg` | `enterLevel` | `unDeco`, `fireOut`, `flushFire`, `plantGlow`, recorder |
| `seen` | `enterLevel`, `drawReplay` (swap) | fog fns, recorder, `step`, `draw` (and `draw` writes its *contents*: `fogReveal` runs there) |
| `fire` | `enterLevel`, `drawReplay` (swap) | `dig`, `unDeco`, `ignite`, `fireFrame`, `explode`, `decorStep`, `step`, `draw` |
| `zfx` | `enterLevel`, `decorStep` (a new object each frame) | `fireFrame`, `decorStep`, `step` (steering reads last frame's) |
| `ghost` | `enterLevel`, `step`, `drawReplay` | `step`, `draw`, recorder |
| `levelT`, `best` / `camReady` | `enterLevel` + `step` / `draw` | `step`, `draw` |
| `floor` | the save-load block (484), `step` (the portal's `floor++`) | ~10 functions |
| `firePropN` | `enterLevel`, `fireList` | `fireList` |

**Run-scoped objects and arrays, never reassigned** (emptied in place with `.length = 0`):
`p` (the player), `bullets`, `enemyShots`, `smoke`, `sparks`, `flashes`, `toasts`, `coins`,
`fields`, `beams`, `arcs`, `torchP`, `motes`, `burns`, `webs`, `silk`, `strings`, `dparts`,
`amb`, `clouds`, `rings`, `devils`, `fireVis`, `aimPath`, `navYou`, `jetSt`, `bhLoops`,
`plantsNow`, `rustle`, `REC`, `RT`, `mouse` (= `input.current.mouse`). **Identity matters:**
`RP_ARR` (203) holds twenty of these arrays by reference and `drawReplay` splices recorded
contents *into* them and back; `ratOnWeb = onWebIn(webs)` captured `webs`. They can move into
`W` as the same objects, but must never be replaced by new ones.

**Frame-to-frame state private to one function** (reassigned, but only by its user):
- `step`: `jetLoop`, `beatT`, `wasEmpty`, `portalLoop`, `matterLoop`, `wasJet`, `stepT`,
  `lastNear`, `portalAcc`, `leanVX`, `leanVY`, `smokeAcc`, `flickN`, `torchT`, `torchAcc`,
  `webCheck` (and `webLetGo`, also read by `decorStep`). The loops are also stopped by the cleanup.
- `decorStep`: `plantsLast`, `decoFrame`, `dripHurt`.
- `fireList`/`fireFrame`: `firePlants` (also swapped by `drawReplay`, read by `draw`),
  `fireArches`, `fireCarts`, `firePropLast`, `fireLoop`, `fireN` (read by `draw`, recorder).
- `plantGlow`: `pgArt`, `pgC`, `pgCtx` (made lazily). `dropOre`: `oreBank`. `idOf`: `ridN`.
- `dig`/`explode`: `terrainV` (the rock's change count; `navFor` reads it).
- `refreshBag`: `pb` (the perk bag; read by 9 functions).
- `loop`: `raf`, `last`. `drawReplay`: `RPV` (read by `draw`).

**Shared between `step` and `draw`** (matters most for P3.4):
- `step` writes, `draw` reads: `time`, `flick`, `leanX`, `leanY`, `glowN`, `levelT`, `ghost`.
- **`draw` writes, `step` reads**: the camera `camX`/`camY` (eased toward you *in `draw`*,
  0.15 a frame), `unitPx` (css px per world unit), `viewW`/`viewH` (read by `fireFrame`,
  `stepAmbience`, `puffSpores`), `camReady`. `step` sees last frame's camera. `torchR` and
  `visPts` are draw-only (plus the replay swap and the test hook).
- **`draw` changes the world**: `fogReveal(seen, …)` runs in `draw` (the fog memory), and
  `draw` calls `Math.random()` at 7 sites (bullet looks, flame, beams), from the same stream as
  the sim. A render split must keep the draw order, or the rest of the run rolls differently
  (the determinism probe shows it at once).
- `drawReplay` swaps 20 of these (`enemies`, `pickups`, `props`, `fire`, `firePlants`, `seen`,
  `ghost`, `time`, `flick`, `leanX`, `leanY`, `glowN`, `fireN`, `camX`, `camY`, `unitPx`,
  `torchR`, `visPts`, `viewW`, `viewH`, plus `p`'s fields and the `RP_ARR` contents), calls
  the real `draw()`, and swaps back in a `finally`. With `W` it's a save/restore of `W`
  properties, same semantics.

### Functions, by system (line: name, and who calls it)

- **Level entry / save**: 351 `enterLevel` (load block, `step`'s portal and New cave), 440
  `saveRun` (interval, `pagehide`, hidden, `step`), 167 `refreshBag`, 169 `maxHp`.
- **Recorder / replay**: 207 `idOf`, 218 `recReset` (`enterLevel`), 226 `recSample`, 277
  `recFrame` (`loop`), 295 `rpTerrain`, 318 `drawReplay` (`loop`).
- **Fog**: 456 `fogLit` (`draw`), 467 `roomSeen` (`draw`), 477 `paintFog` (`enterLevel`, `step`),
  1943 `seenAt` (`plantGlow`). The reveal itself is inline in `draw` (3994).
- **Input / page**: 495 `saveHidden`, 500 `resize`, 511–522 `mMove`/`mDown`/`mUp`/`mLeave`.
- **Terrain queries**: 530 `solidCell`, 532 `solidAt`, 533 `boxHit`, 544 `lineOfSight`, 545 `enemyAt`.
- **Terrain changes**: 794 `dig`, 818 `dropOre`, 831 `unDeco`, 845 `paint` (no callers), 1499
  `explode`. All go through the wrapped `putImageData`.
- **Particles / feedback**: 554 `goo`, 561 `splat`, 570 `burst` (13 callers), 193 `toast`,
  1016 `jag`, 1036 `addArc`, 1121 `glowDot`, 1123 `rnd`.
- **Player**: 158 `torchHand`, 576 `hurt`, 1361 `youAlight`, 1567 `pOver`; steering, jetpack,
  climbing and the torch are inline in `step` (2080–2220, 3057).
- **Enemies**: 610 `fireEnemyShot`, 623 `damageEnemy`, 1357 `setAlight`, 1570 `alertAt`; the
  enemy loop is inline in `step` (2738–2982), each creature's branch inside it.
- **Rats**: 652 `ratSolid`, 655 `onWebIn`, 657 `navFor`, 671 `spawnRat`, 682 `unstick`, 698 `ratFrame`.
- **Gun / casting**: 863 `cast`, 944 `spawnShot`, 996 `firePayload`, 1003 `releaseAt`, 1040
  `lightningStep`, 1078 `fireBeam`, 1106 `spray`, 1230 `throwEmbers`, 1239 `explodeCross`, 1246
  `critRoll`, 1247 `shove`, 1252 `castField`, 1266 `teleportTo`, 1284 `fieldPayload`. The bullet
  loop is inline in `step` (2263–2451), fields 2480–2556.
- **Shot looks (v95)**: 1124 `shotTrail`, 1192 `shotBounce`, 1204 `shotDeath`, 1221 `shotGrind`;
  `drawLook` is inline in `draw`.
- **Fire**: 1294 `growBox`, 1295 `fireOut`, 1308 `flushFire`, 1316 `catchPlant`, 1322
  `catchArch`, 1329 `burnWeb`, 1339 `ignite`, 1367 `fireBlast`, 1374 `flameAt`, 1377 `fireSmoke`,
  1383 `fireList`, 1390 `fireFrame` (`step`).
- **Props / decoration**: 1580 `shatter`, 1585 `blowProp`, 1597 `popLamp`, 1614 `landProp`, 1626
  `spawnDrip`, 1641 `decorStep` (`step`; ~280 lines: props, plants, webs, `zfx`).
- **Ambience**: 1922 `spore`, 1926 `puffSpores`, 1991 `stepAmbience` (`decorStep`).
- **Webs**: 186 `webNear`, 191 `webDist`. **Plant glow**: 1944 `plantGlow` (`draw`). **Zones**: 110 `natural`.
- **The frame**: 2042 `step(dt)` (~1,100 lines), 3140 `draw()` (~1,150 lines: camera, bg,
  terrain, props, entities, looks, fog 3982, post-fog glows 4042, HUD 4119, radar 4154, map
  4235), 4290 `loop`.

### Hazards for P3.2

- **Five inner variables are already called `W`**: `drawReplay` (319) and `loop` (4296) call
  `input.current.witness` `W`; `fireFrame` (1407) a web line; the steering branch an arch
  (2132) and a web line (2145). The 1407 one sits next to a `fire` reference, so `fire` →
  `W.fire` there would silently read the web. Rename those locals first, in their own commit.
  `tools/world.js` refuses any reference an inner `W` would capture.
- **Inner names shadow closure names** all over (`best` ×8, `k`, `e`, `L`…). A text replace
  would hit the wrong ones; `tools/world.js` resolves each reference to its declaration.
- The hook text in `tests/build.js` goes in front of `const toast` (193), above most of the
  closure: it names functions declared later (`hurt`, `dig`, `recSample`…: hoisted `function`s,
  fine) and reads `let`s through getters. `W` has to exist before line 193.
- Shorthand properties (`RP_ARR = { bullets, … }`, `drawReplay`'s `keep = { enemies, … }` and
  its destructuring restore) need `name: W.name`; the tool writes that.
- No `src/` module has a top-level `W`, so esbuild keeps Game's `W` as `W` in the bundle (the
  hook text depends on that).

## Session log

| Date | Phase / tasks | What happened | Suite |
|---|---|---|---|
| 2026-09-29 | — | Plan written (this doc). Nothing built yet. | — |
| 2026-09-29 | Phase 0, P0.1–P0.10 | Branch `refactor`. `src/shell.html` + `style.css` + `main.js`; `tools/build.js` (byte-identical to v96 bar the banner; `{{VERSION}}` fills the title; `--watch`); `tests/run.js` builds first; `tests/load.js` feeds all 33 logic suites (finds top-level names by resolving every identifier; `.source` for the two text checks). CLAUDE.md updated. Not merged. | logic 33/33; browser 44/44 bar `sound` portalOut + `jelly` (both fail on v96 too) |
| 2026-09-29 | Phase 1, P1.1 | Dev `package.json` (esbuild, eslint, globals, playwright-core), `node_modules/` already ignored. `tests/chromium.js` finds Windows Chrome; browser suites run with no env vars. | logic 33/33, smoke ok |
| 2026-09-29 | Phase 1, P1.2 | Build is esbuild (iife, utf8, no minify, no tree shaking). `VERSION` → `src/version.js` + an un-bundled `<script>` line. `tests/build.js` anchors now match esbuild's print (`const toast = (text) => {`) and it exposes the bundle's names on `window`; `tests/load.js` unwraps the iife. `sound`/`jelly` fail the same on v96 from `main` (checked in a worktree); `save`/`archvine` failed once under load, pass alone. | logic 33/33; browser 42/44 (the two known) |
| 2026-09-29 | Phase 1, P1.3 | `eslint.config.js` (flat, only `no-undef`, browser globals + React/ReactDOM/VERSION); `tests/run.js` runs it over `src/` first and counts a report as a failure. Checked it catches a planted undefined name. | logic 33/33 |
| 2026-09-29 | Phase 1, P1.4 | `src/pure.js` (VERSION + `export * from main.js`); main.js got an `export { … }` list of the 346 names the old loader found above `Game`. `tests/load.js` bundles pure.js to CJS in memory and runs it with stubs for React/ReactDOM/document (main.js now runs to its mount line); `.source` = all of `src/`. Same 348 names, same types, before and after; `index.html` unchanged (iife drops exports). | logic 33/33 |
| 2026-09-29 | Phase 1, P1.5 | All 31 moves, one commit each via `tools/move.js`, logic suites + names check + `smoke` before every commit. Extra: `COL` joined `core/consts.js` (guns and sprites need it). Knob tables stay in `dev/knobs.js` (D11). `main.js` 12,816 → 5,767 lines (Game, UI, and 5 pure leftovers). Full runs on snapshots at the end of spells and world, and at the end: only known/load flakes, each passing alone. Bundle statements identical to P1.2's (D12). | logic 33/33; browser 43/44 (`sound`, as v96) after re-runs |
| 2026-09-29 | handover | Docs made ready for the next session: Phase 2 notes worked out from the code (`Game` has to move to `game/Game.js` before `App` can leave `main.js`; where the pure leftovers and `h`/hooks go), a **How a move goes** recipe, `tools/same.js` (D12's check as a tool, tried both ways), the P1.5 parent box ticked, test timings in CLAUDE.md, HANDOVER status. | logic 33/33 |
| 2026-09-29 | Phase 1, P1.6 | Owner play-tested the branch (plays the same as v96). Committed the last session's uncommitted handover docs + `tools/same.js` first. Full suite on a snapshot; `src/version.js` → v97; merged `refactor` → `main` and pushed (the release). This time `sound` passed and `fog` ("flying on reveals more", a new one) failed once, passed alone. | logic 33/33; browser 44/44 after re-runs (`jelly` spit flaky, as v96) |
| 2026-09-29 | Release check | CI run 36533355733 green (deploy-pages, build-apk); `version.txt` = v97. `main` merged back into `refactor` (same commit). | — |
| 2026-09-29 | Phase 2, P2.1 | `ui/h.js` (`h` + the four hooks). move.js hoisted the sputter comment (the first comment in `main.js` once the hooks left) to the top as a "file header"; put back by hand. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.2 | `ui/hud.js` (Stick, RKey, GAUGE_*, healthCol, holdPress, deckLayout, fmtGold). The two lines "The same detail card is used by the build screen and by the shop…" sat above `holdPress` but describe the cards: moved back above `GUN_STATS` by hand. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.3 | `ui/cards.js` (GUN_STATS, GunCard, ModCard, PerkCard). Clean move. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.4 | `ui/editor.js` (Editor, GunStats, GunIcon, SlotGrid, ScrollBox, PULL_COL, GS_ROWS, LIVE_BAR, SHOW_TIPS). GunStats' comment still sits above `PULL_COL` (moved with it, see Found along the way). | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.5 (1/2) | `ui/swap.js` (GunSwap). Clean move. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.5 (2/2) | `ui/witness.js` (Witness, RP_SPEEDS). Clean move. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.6 | `ui/devpanel.js` (JellyPreview, DevRow, DevPanel, SpawnGun). JellyPreview went here, not with the jelly: it's a React component (needs `h`, layer 6). DevRow's comment sat above JellyPreview's; moved down to DevRow by hand. | same 359/359, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.7 (1/2) | `game/Game.js` (Game as-is, with SPUTTER_FUEL, sputterStep, NO_INPUT). Its `ui/h.js` import swapped by hand for its own two React lines (D13). `same.js` then reports 343/359 identical, the other 16 renames only (`h2->h3` in 15 of them, and in Game also `h->h2`, `useRef->useRef2`, `useEffect->useEffect2`), plus the two new lines: shown with the new `node tools/same.js --renames`. `main.js`'s `export { … }` list is gone (nothing pure left in it), so its "pure part of this file" comment went too. | same: renames only (D13), logic 33/33, smoke ok |
| 2026-09-29 | Phase 2, P2.7 (2/2) | `ui/app.js` (App). `main.js` is now the two imports and the mount line, plus a two-line header comment. CLAUDE.md's "code is `src/main.js`" lines and the layout table updated. | same 361/361, logic 33/33, smoke ok |
| 2026-09-29 | Phase 2 done | Full suite at the end of P2.7: `decor`, `torch` failed in the run and passed alone; `jelly` spit passed 1 of 3 alone (as at P1.6 and on v96). Not merged: the owner play-tests Phase 2 first. `main.js` 5,767 → 6 lines; `game/Game.js` 4,330, `ui/` 8 files, 5–418 lines. | logic 33/33; browser 44/44 after re-runs (`jelly` flaky, as v96) |
| 2026-09-29 | handover | Phase 3 notes written from the code (closure shape, landmarks, the test hook reads closure names so P3.2 must update it in step, why `move.js`/`same.js` don't fit, a determinism check to weigh in P3.1). HANDOVER flakes list + next steps; CLAUDE.md branch line. | — |
| 2026-09-29 | Release v98 | Full suite on a snapshot of the v98 commit: only `jelly` spit failed (passed alone on the 3rd run, as on v96). `tools/move.js` deleted (D10). `src/version.js` → v98, merged `refactor` → `main`, pushed. CI run 36542142525 green, `version.txt` = v98; `main` merged back into `refactor`. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-29 | Phase 3, P3.1 | **Game map** written (from a scope-aware pass over the closure). Determinism probe built and kept: `tests/determinism.js` (D14), stable 5/5 and catches a one-number change. Where `W` stops is D15. No code changes. | probe SAME |
| 2026-09-29 | Phase 3, P3.2 (1) | `game/world.js` `makeWorld()`; `const W = makeWorld()` first in the effect. Five inner locals named `W` renamed (`wit`, `ln`, `ar`). Terrain group to `W` with the new `tools/world.js` (65 references); hook text in `tests/build.js` follows. `W` keeps its name in the bundle. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.2 (2) | Level layout group to `W` (17 names, 129 references). `tools/world.js --drop` now takes the old declarators out too and prints their starting values. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.2 (3) | `enemies`, `pickups`, `props` to `W` (119 references); `drawReplay`'s swap is now `enemies: W.enemies` in `keep` and in the destructuring restore. The probe doesn't play a replay, so `replay` (browser) was run too. | probe SAME, logic 33/33, smoke ok, replay ok |
| 2026-09-29 | Phase 3, P3.2 (4) | `seen`, `deepFog` to `W` (36 references). `makeWorld` now calls `fogStart()` (pure) where the closure did. | probe SAME, logic 33/33, smoke ok, replay ok |
| 2026-09-29 | Phase 3, P3.2 (5) | Fire group to `W` (9 names, 78 references), its comment moved with it. `fire` (logic + browser) and `replay` run too. | probe SAME, logic 33/33, smoke ok, fire ok, replay ok |
| 2026-09-29 | Phase 3, P3.2 (6a) | The player group: `p`, `pb`, `ghost`, `zfx` to `W` (511 references, `p` is most of them). Two stale closure comments trimmed to point at `W`. `replay`, `perks` run too. | probe SAME, logic 33/33, smoke ok, replay ok, perks ok |
| 2026-09-29 | Phase 3, P3.2 (6b) | Clock, camera and torch to `W`: `time`, `levelT`, `best`, `camX`/`camY`/`camReady`, `unitPx`, `viewW`/`viewH`, `flick`, `torchR`, `visPts`, `leanX`/`leanY`, `glowN` (216 references). Their step-private helpers (`leanVX`, `flickN`, `torchT`…) wait for the timers group. `replay`, `torch` run too. | probe SAME, logic 33/33, smoke ok, replay ok, torch ok |
| 2026-09-29 | Phase 3, P3.2 (7) | The run's 21 lists to `W` (same arrays; `RP_ARR` and `ratOnWeb` now take them from `W`). Their comments moved to `world.js`. `replay`, `spider`, `blackhole` run too. | probe SAME, logic 33/33, smoke ok, replay ok |
| 2026-09-29 | Phase 3, P3.2 (8) | The last group: step's timers and sound loops, `decorStep`'s counters, `oreBank`, `navYou` (26 names) to `W`. What stays loose is listed under P3.2 (D15). `sound`, `jetpack`, `rats` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.2 done | Full suite on a snapshot of 7f9bfe5: only `jelly` spit failed, passed alone on the 3rd run (as on v96/v98). | logic 33/33; browser 44/44 after re-runs |
| 2026-09-29 | Phase 3, P3.3 | `src/game/testhook.js`: `testHook(W, g)` puts `sandbox`, `placeProp`, Game's functions and the old names (`seed`, `theme`, `rec`, `rt`, `fog`, `light`, `world`) on `W` and Game sets `window.__lvl = W` when `window.__TEST` is set. `tests/build.js` no longer inserts code into the closure: it adds a `<script>window.__TEST = true;</script>` before the bundle (the `__in` anchor in App stays). The `const toast` anchor is retired. CLAUDE.md points at `testhook.js`. | probe SAME, logic 33/33, smoke, donebutton, restart-confirm, decor, replay ok |
| 2026-09-29 | Phase 3, P3.3 done | Full suite on a snapshot of 24976eb: `jelly` spit and `lightning` "a fork hits a creature off to the side" failed, both passed alone (jelly on the 2nd run). Stopped here as planned: P3.4 next, Phase 3 not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-29 | handover | P3.4 notes written from the code (what a moving function needs, a `G` context to decide on, the explode/fire/prop call cycle, a leaves-first order, what the probe doesn't cover). The P3.1 mapping script kept as `tools/gamemap.js` (`node tools/gamemap.js fn…` = what a function needs). | — |
| 2026-09-29 | Phase 3, P3.4 (1) | Shape decided (D16: `(W, G, …)` / `(W, …)` plain functions in `game/systems/`, a `G` context for what isn't world state) and the cycle rule (D17). `tools/system.js` does a move: cuts the functions out of the closure, gives each `W`/`G` by what it uses, rewrites every call (a callback becomes an arrow), redoes both files' imports, adds the `pure.js` line. First move: the terrain queries to `terrain.js`. Game.js's unused `PLAYER_HP` import dropped. `torch`, `perks`, `teleport` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (2) | `particles.js`: `goo`, `splat`, `burst`, `toast`. `tools/system.js` can now send names of one move to several modules (`file.js:name`, for the fire cycle). `jelly` (spit, splat) run too. | probe SAME, logic 33/33, smoke ok, jelly ok |
| 2026-09-29 | Phase 3, P3.4 (3) | `const G = { input, canvases and contexts, REC, RT }` right after the recorder (D16). `player.js`: `refreshBag`, `maxHp`, `hurt`. `perks`, `shop`, `save` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (4) | `enemies.js`: `damageEnemy`, `fireEnemyShot`. `rats`, `creatures`, `lightning` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (5) | `terrain.js` gets the changes: `dig`, `unDeco`, `paint` (`(W, G, …)`, drawing through `G.tctx`/`G.dctx`, the wrapped ones) and `dropOre` (`(W, …)`). `system.js` now also reads an existing module's own imports. `replay`, `buzzsaw`, `teleport` (ore) run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (6) | The fire in one move (18 functions): `fire.js` (`fireFrame`, `ignite`, `fireBlast`, `fireOut`, `flushFire`, `setAlight`, `youAlight`, catching plants/arches/webs, `fireList`…), `explode` → `terrain.js`, `blowProp` → `props.js`, `webNear`/`webDist` → `webs.js` (the cycle, D17). `fireBox` joins `G` (its `const` moved up above `G`). `fire`, `archvine`, `decor`, `spider`, `replay`, `blackhole`, `pollen`, `trigger`, `rats` run too (`rats` "they come out of the hole" failed once, passed alone twice: a known flake). Game.js 4,280 → 3,803 lines. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 checkpoint | Full suite on a snapshot of efaeb42: only `jelly` (browser) failed, "saturation 0 greys it out"; alone it passed 3 of 3 (the spit/spore group failed twice of those, the known flake). Stopped here as planned: terrain, particles and fire are out; next the ambience and props. Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-29 | Phase 3, P3.4 (7) | `ambience.js`: `spore`, `puffSpores`, `stepAmbience`, `AMB_RATE`, `AMB_MAX` (all `(W, …)`). Clean move. `decor`, `jelly` run too (`jelly` spit/spore group failed 2 of 3 alone, passed the 3rd: the known flake). | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (8) | `props.js` gets `decorStep` with `pOver`, `alertAt`, `shatter`, `popLamp`, `landProp`, `spawnDrip`, `MATERIAL`, `DRIP_RATE` (`decorStep`, `popLamp`, `landProp` are `(W, G, …)`). Header rewritten. props.js ↔ fire.js is now a two-way import (D17). | probe SAME, logic 33/33, browser 44/44 (all, first try) |
| 2026-09-29 | Phase 3, P3.4 (9) | `shotlooks.js`: `glowDot`, `rnd`, `shotTrail`, `shotBounce`, `shotDeath`, `shotGrind`. `rnd` is now a module-level import in Game.js; `sputterStep`'s own `rnd` parameter shadows it, as before. `t1spells`, `spelllooks`, `buzzsaw` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (10) | `lightning.js`: `jag`, `addArc`, `lightningStep`. Clean move. `lightning`, `spelllooks` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (11) | `rats.js`: `onWebIn` first (pure), then `ratOnWeb` (made once from `W.webs`, same as before) moved up above `G` and into it by hand, then `ratSolid`, `navFor`, `spawnRat`, `unstick`, `ratFrame`. `navFor`'s comment had travelled with `onWebIn`: put back. `ratSolid` as a callback is an arrow at its two sites. `rats`, `spider` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (12) | `fog.js`: `fogLit`, `roomSeen`, `seenAt` (`(W, …)`), `paintFog` (`(W, G)`: `fogImg`). `fog`, `map`, `torch`, `replay`, `jelly` (plant glow) run too; `jelly` spit flaked 2 of 4, glow checks passed every time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (13) | Casting in one move (13 functions, a cycle): `gun.js`, `fields.js`, `bullets.js`. A scratch check stripped the `W, G` plumbing and found every moved line verbatim in the old closure. `everymod`, `trigger`, `blackhole`, `teleport`, `t1spells`, `spelllooks`, `pollen`, `lightning`, `buzzsaw`, `perks` run too. `trigger` "a trigger carrying an explosion…" flaked: 6 of 13 runs alone here, 1 of 4 on the commit before (see Found along the way). | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 checkpoint | Full suite on a snapshot of 4620bf6: only `trigger` "a trigger carrying an explosion…" failed, passed alone 3 of 3. Stopped here: Game.js 3,803 → 2,792 lines. Next (easy first): `saveRun`, `natural`, `torchHand` (only `W`); `plantGlow` (its `pgArt`/`pgC`/`pgCtx` `let`s to `G` first); the recorder (`rid`/`ridN`, `RPV`, `RP_ARR`); `enterLevel`; then `step`/`draw`. Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-29 | Phase 3, P3.4 (14) | `save-run.js`: `saveRun` (`(W, G)`). The tool made a separate arrow at each value use, which would have left `removeEventListener('pagehide', …)` removing nothing: one `saveNow` arrow in Game now serves all four (noted under Learned so far). `save` run too. | probe SAME, logic 33/33, smoke ok, save ok |
| 2026-09-29 | Phase 3, P3.4 (15) | `natural` to `enemies.js` (`(W, …)`), header extended. `archvine`, `jelly` run too: `jelly` spit failed 3 of 5 alone here and 3 of 4 on the commit before (the known flake). | probe SAME, logic 33/33, smoke ok, archvine ok |
| 2026-09-29 | Phase 3, P3.4 (16) | `torchHand` to `player.js` (`(W)`), header extended. `torch` (failed once, passed alone twice: known flake), `replay` run too. | probe SAME, logic 33/33, smoke ok, torch ok, replay ok |
| 2026-09-29 | Phase 3, P3.4 (17) | `plantglow.js`: `plantGlow`. Its `pgArt`/`pgC`/`pgCtx` `let`s became `G` properties by hand first (a scripted rewrite of the 19 references inside it, the only place they were used), `pgGlow`/`pgGlowCtx` joined `G`. `jelly` run too: every glow check passed; spit flaked (known). | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 (18) | `recorder.js`: `idOf`, `recReset`, `recSample`, `recFrame`, `rpTerrain`, `drawReplay`, plus the putImageData wrapper as `recWrap(G)` (by hand, called right after `G`). Prep by hand, checked SAME on its own: `RPV` → `G.RPV`, `rid`/`ridN`/`RP_ARR` into `G`, `drawReplay` takes `draw` as an argument. `replay` (43/43), `fire`, `save` run too. | probe SAME, logic 33/33, smoke ok, replay ok |
| 2026-09-29 | Phase 3, P3.4 (19) | `level-entry.js`: `enterLevel` (`(W, G, back)`). Clean move. `save`, `newcave`, `map`, `fog`, `shop`, `replay`, `creatures` run too. | probe SAME, logic 33/33, smoke ok |
| 2026-09-29 | Phase 3, P3.4 checkpoint | Full suite on a snapshot of cdb5c90: `jelly` spit (known) and `fog` "the next floor is dark again" failed; `fog` passed alone 3 of 3 (new on the flake list, Found along the way). Game.js 2,792 → 2,494 lines. The step()/draw() split planned under P3.4, not started; `tools/locals.js` added for it (each local's span and a function's own returns). Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-30 | Phase 3, P3.4 (20) | step()/draw() prep: `mouse` (its `const` moved up above `G`) and `aimPath` join `G`. `node tools/gamemap.js step draw` now lists only `W`, `G` and `G`'s keys. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (21) | `SPUTTER_FUEL`, `sputterStep`, `NO_INPUT` (Game.js top-levels only step() uses; `system.js` can't take them) moved by hand to `systems/player.js`, under a "the jetpack" header. | probe SAME, logic 33/33, smoke ok, jetpack ok |
| 2026-09-30 | Phase 3, P3.4 (22) | `step.js`: `step(W, G, dt)`, whole (1,097 lines). Clean move; a scratch diff (`G.input`/`G.c`/`G.mouse` back to bare names) found the body identical to the old one. Game.js 2,473 → 1,355 lines. `replay`, `map`, `shop`, `perks`, `torch`, `fog`, `jetpack`, `spider`, `blackhole`, `rats`, `interact` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (23) | `render/draw.js`: `draw(W, G)`, whole (1,149 lines), by `system.js` into `systems/` and then moved to `render/` by hand (imports re-pointed). A scratch diff (the `G.` taken off the old closure names) found the body identical. The loop's `drawReplay(W, G, rv, () => draw(W, G))` is the tool's arrow. Game.js 1,355 → 186 lines. `replay`, `map`, `shop`, `perks`, `torch`, `fog`, `spelllooks`, `blackhole`, `fire`, `jelly`, `creatures`, `lightning` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (24) | `drawReplay(W, G, V)` imports `draw` (`render/draw.js`) and calls it itself; the loop's arrow is gone. `tools/locals.js` takes a file now (`node tools/locals.js src/game/render/draw.js draw`), since step/draw left Game.js. `replay`, `map`, `shop`, `perks`, `torch`, `fog` run too, all first time. Steps 1–2 of the step()/draw() plan done; the split (step 3) not started. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (25) | step()'s split begins: the frame object `F` (D18) made first in step; `stepRequests` (returns true for Dev → New cave) and `stepPerks` (fills `F.LO`, `F.MHP`) cut out by hand, in step.js. `tools/part.js` added for the rest (tried with `--dry` on the player part). `newcave`, `spawngun`, `perks` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (26) | `movePlayer` (the stick, jetpack and fuel, steering, the move against the terrain, footsteps: 141 lines) → player.js with `tools/part.js`; `atPortal` by hand in step.js (it fills `F.pcx`/`F.pcy`; true through the exit). `jetpack`, `archvine`, `decor`, `spider`, `fog`, `save`, `newcave` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (27) | `aimAndCast` (aim, Pinpointer, facing, the gun ticks, the trigger: 41 lines) → gun.js with `tools/part.js`. `perks`, `buzzsaw`, `everymod`, `cooldown-debug-shop` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (28) | `stepBullets` (the bullet loop and the arcs fading: 187 lines) → bullets.js with `tools/part.js`; header rewritten. `everymod`, `trigger`, `blackhole`, `teleport`, `t1spells`, `spelllooks`, `pollen`, `buzzsaw`, `lightning` run too; `t1spells` "bubble … glowing trail" failed once, passed 3 of 3 alone (chance, see Found along the way), the rest first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (29) | `stepSound` (25 lines, in step.js) and `stepFields` (75 lines) → fields.js with `tools/part.js`; fields.js header. `sound`, `everymod`, `spelllooks`, `fire`, `teleport` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (30) | `stepPickups` (176 lines) → new `pickups.js` with `tools/part.js` (its `pure.js` line too); `stepToasts` (one line) → particles.js. Watch out in Git Bash: a one-line argument starting with `//` gets a slash eaten or added (MSYS path conversion), which put a `///` in particles.js' header for a moment: `MSYS_NO_PATHCONV=1`. `shop`, `interact`, `gunpickup`, `perks`, `teleport`, `restart-confirm`, `rats`, `shopcard`, `compare` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (31) | `stepEnemies` (243 lines: the enemy loop whole, Contact Damage, enemy shots, silk, strings, web lines, `hitT`) → enemies.js with `tools/part.js`; header. `creatures`, `spider`, `rats`, `lightning`, `perks` run too, first time; `jelly` spit failed 3 of 4 here and 3 of 4 on the commit before (the known flake). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (32) | `stepGhost` (20 lines, in step.js) and `stepTrail` (12 lines) → fire.js with `tools/part.js`; fire.js header. `perks`, `fire`, `replay` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (33) | `stepParticles` (31 lines) and `stepMotes` (45) → particles.js, `stepTorch` (33) → player.js, with `tools/part.js`; the top-level step tidied (the leftover `LO`/`MHP`/`pcx`/`pcy` locals gone, one comment per call). **step() is split**: step.js 1,137 → 156 lines. `jetpack`, `blackhole`, `replay` run too, first time; `torch` failed 4 of 10 here ("falls off into the dark", "brighter frames… taller flame", "only falls away with distance") and 3 of 12 on the commit before (same names): the known flake. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 checkpoint | Full suite on e5b7c1b (step() split): only `jelly` failed, "saturation 0 greys it out"; alone it passed once, then failed twice on the spit group (known). The probe against 630e6e9, the commit before the split, is SAME too. Stopped here: draw()'s split is next. Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-30 | Phase 3, P3.4 (34) | draw()'s split begins: its inner `drawLook`, `drawFieldLook`, `drawBolt` → new `render/looks.js` (scratch script; `rnd` goes with them). `spelllooks`, `t1spells`, `blackhole`, `everymod` run too, first time; `lightning` failed once, passed 2 of 2 alone (known flake). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (35) | The frame object `F` for draw (D19); `drawCamera` by hand in draw.js, `drawTerrain` → new `render/cave.js` with `tools/part.js`. `part.js`: never imports `VERSION` (D7), render modules' `pure.js` lines go with the render ones. `replay`, `torch`, `fog`, `fire`, `shop`, `map` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (36) | `drawProps` (fills `F.TH`, `F.onView`; the two lines moved in by hand after `part.js`) and `drawPortal` → cave.js. `decor`, `fire`, `replay`, `newcave` run too, first time; `archvine` "no jelly swims deep…" failed once, passed 2 of 2 alone (known flake). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (37) | `drawSmoke` → new `render/effects.js`, `drawFields` → looks.js (header now says it holds layers too), `drawSilk`, `drawEnemies` → new `render/actors.js`, with `tools/part.js`. `spider`, `creatures`, `rats`, `jetpack`, `everymod` run too, first time; `jelly` spit/spore group failed 3 of 4 (the known flake; passed whole once). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (38) | `drawShots` (71 lines: enemy shots, bullets, arcs) and `drawBeams` → looks.js with `tools/part.js`; looks.js header. `spelllooks`, `t1spells`, `blackhole`, `lightning`, `everymod`, `pollen`, `trigger` run too, first time. `jelly` passed whole 1 of 9 (spit group mostly, spores once); on (37) 1 of 4, failing on the spit, the plant glow and "saturation 0": the known flake, no draw code in any of those checks moved. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (39) | `drawArrival`, `drawShop`, `drawLoot` (gold + pickups), `drawRooms` → cave.js with `tools/part.js`. `shop`, `shopcard`, `gunpickup`, `interact`, `perks`, `teleport`, `save` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (40) | `drawTrail`, `drawSparks`, `drawMotes`, `drawFlashes` → effects.js, `drawJetFlame` → actors.js, with `tools/part.js`. `jetpack`, `blackhole`, `fire`, `replay`, `perks` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (41) | `drawAim` (the aim's setup moved in by hand after `part.js`: fills `F.held`, `F.ax`/`F.ay`, `F.gy`) and `drawPlayer` (runner, gun, torch, crosshair, shield, ghost) → actors.js. `perks`, `jetpack`, `replay`, `buzzsaw`, `interact`, `cooldown-debug-shop` run too, first time; `torch` failed 3 of 8 (falloff / flicker checks, the known flake; 4 of 10 at (33)). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (42) | `drawFog` (59 lines: `visPoly`, `fogReveal`, the bake and blur) and `drawGlows` (75 lines) → new `render/light.js` with `tools/part.js`. `fog`, `torch`, `replay`, `map`, `fire`, `decor`, `creatures`, `t1spells` run too, all first time; `jelly`'s glow checks passed both runs, its spit group failed both (the known flake). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 (43) | `drawHud` (fills `F.cw`, setup moved in by hand), `drawRadar`, `drawMessages`, `drawReticule`, `drawMap` → new `render/overlay.js` with `tools/part.js`; draw's top level tidied, header rewritten. **draw() is split**: draw.js 96 lines, `node tools/locals.js` shows only `W`, `G`, `F`; render/ 1,397 lines in 7 files. `perks`, `shop`, `shopcard`, `map`, `replay`, `spawngun`, `restart-confirm`, `donebutton` run too, all first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.4 checkpoint, **P3.4 done** | Full suite on a snapshot of 95d6ea6 (draw() split): `lightning` "a fork hits a creature off to the side" and `torch` "the brighter frames are the ones with the taller flame" failed, both known flakes; each passed 2 of 2 alone. The old rough list checked against the code: props.js (`decorStep`, rustle, `zfx`), ambience.js and enemies.js (`stepEnemies`) were already done, ticked; P3.4 ticked. Next P3.5 (the enemy loop per creature, bullet looks as a table). Note: `git worktree remove` left `.git/worktrees/snap` behind (read-only folders, "Permission denied"); deleted by hand after the junction was gone. Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-30 | Phase 3, P3.5 plan | "What the code says about P3.5" written from `stepEnemies` and the creature code: the per-enemy order (shared, bomb fuse, the act's move, shared, contact, firing), act and body are separate axes, the branches need layer-5 systems. Shape D20 (`src/game/creatures/<name>.js` + `ACTS` in `acts.js`, hooks `(W, G, e, C)` called where each branch sat). Knob tables stay in `dev/knobs.js` (DEV is built at knobs.js's load; `devReport` order would follow bundle order). Bullet looks: no table (the chains already read one branch per look; bounce/death group by effect). Six sub-tasks. Docs only. | — |
| 2026-09-30 | Phase 3, P3.5 (1) | `src/game/creatures/acts.js` (`ACTS`) and `rat.js` (`nestMove`, `nestDie`), by hand. `stepEnemies` makes `C` once a frame and refills it per enemy; the nest's `if … continue` became `if (A && A.move) { if (A.move(…)) continue; } else if (k.act === 'rat') …` (the rat's standalone `if` joined the chain: the acts are exclusive). `damageEnemy`'s `if (e.nest)` became `ACTS[e.k.act].die`: the same thing, since only nests carry `e.nest` and every nest has it (level.js, the `rats` suite). In the bundle `ACTS` is a `var` after the two hoisted functions. `rats`, `creatures` run too, first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.5 (2) | `systems/rats.js` into `game/creatures/rat.js` whole (a scratch script: new header and imports, the body after them checked identical by `diff`), `systems/rats.js` deleted; `ratMove` (`ratFrame`, then `chill`/`ty`, true) and `rat: { move: ratMove }`. Game.js takes `onWebIn` from there, `pure.js` loses the line. enemies.js header says where each act's part is. `rats`, `spider`, `creatures` run too, first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.5 (3) | New `game/creatures/spider.js` by a scratch script: `spiderMove` (the branch, de-indented, `const { … } = C, k = e.k;` first; returns nothing, so the shared part runs after it as before), `spiderFrame` (the three once-a-frame passes, called from `stepEnemies` at their old place as `for (const a in ACTS) { … frame … }`), `drawSilk` from render/actors.js (draw.js imports it from there, same spot). `spider: { move, frame }` in `ACTS`. Headers of enemies.js, actors.js, draw.js follow. `spider`, `creatures`, `replay`, `rats`, `archvine` run too, first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.5 (4) | New `game/creatures/jelly.js` by a scratch script: `jellyMove` (the branch, de-indented, `const { … } = C, k = e.k;` first; returns nothing) and `natural` from enemies.js. `jelly: { move: jellyMove }`; enemies.js drops eight imports it no longer uses. `archvine`, `creatures` run too, first time; `jelly` failed "saturation 0" in the first run, then passed whole 2 of 3 (the spit group once: known flakes, and neither the Dev preview nor anything the spit checks read moved). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.5 (5) | New `game/creatures/classic.js` by a scratch script: `classicMove` (the hunt-or-patrol chain), `bombFuse` (its `k.act === 'bomb'` test dropped: the table decides), `bombBurst` (its `continue` → `return true`), `gunFire` (its `shoot \|\| turret` test dropped, same reason). `ACTS` gets `chase`, `bomb`, `shoot`, `turret`; `A = ACTS[k.act] \|\| ACTS.chase` is looked up at the top of the loop body (a lookup, nothing else), and the loop calls `pre`, `move`, `contact`, `fire` where the branches were. The probe hardly meets a classic creature, so a scratch copy of it (not kept) put twelve floor-5 ones (chase, bomb incl. Stendari, shoot, turret) round you in a sandbox for 600 frames: SAME against HEAD, and it did catch a planted change (a bomber's burst count). `creatures`, `fire`, `lightning`, `perks`, `blackhole` run too, first time. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 3, P3.5 (6), **P3.5 done** | enemies.js' header and `stepEnemies`' comment say what's shared and where each act's part is (comments only: `index.html` unchanged); CLAUDE.md's creature note gets "Since P3.5 … Adding a creature"; HANDOVER's status. Checkpoint full suite on this tree: `everymod` telecast, `lightning` fork and `jelly` (the spore-puff group, new on the list) failed; alone `everymod` 1 of 1, `lightning` 2 of 2, `jelly` whole 3 of 5 here vs 2 of 5 on 3d04c5b (before the jelly move), both failing only on the spit group and "saturation 0" (Found along the way). `git worktree remove` again left `.git/worktrees/snap` (deleted by hand after the junction). P3.5: `stepEnemies` 245 → ~110 lines; `src/game/creatures/` 5 files. Not merged. | logic 33/33; browser 44/44 after re-runs |
| 2026-09-30 | Owner change (not a refactor move) | The owner's Dev-panel report made the new defaults: 90 values in `src/dev/knobs.js` (`DEV_DEFAULTS`: zoom 1.6, torch 0.5, aggro 0.6, bhPull 65, bhSpeed 50, sound levels; the spider, jelly, rat and fire range tables; `jeHue` 26, `jeSat` 1.4). **Plays differently**, so the determinism probe's baseline moves with this commit: compare later steps against it, not against 98ed736. Tests that silently leaned on an old default now pin the knob they were written for (not loosened): logic `fire` (spread), `jelly` (turn rate, droop, master sliders for the blend checks), `rats` (jump speed/reach, chase rests), `spider` (hunting bursts/rests, roaming rests on the real-cave check); browser `spider` (web slow, string range), `jelly` (plain colours for the red-bell check), `torch` (`DEV.torch = 1`); `devsettings`, `jetpack` and browser `jelly`'s ↺ check read `DEV_DEFAULTS` instead of a hardcoded number. CLAUDE.md's BH and aggro defaults updated. | logic 33/33; browser spider, jelly, rats, fire, archvine, blackhole, torch, fog, map, sound, smoke, creatures, decor, replay ok (jelly spit group: the known flake, same rate at HEAD) |
| 2026-09-30 | Phase 3, **P3.6 done**, Release v99 | Owner play-tested the branch ("plays great"). Game.js checked against P3.6: 186 lines, owns making the world, the loop and the React bridge; its header comment updated. Sanity runs on this tree (the full suite was green at the end of P3.5, and 7c96c5e ran its touched suites). README: the spider/web slow ×0.8 → ×0.7 (the new defaults). `src/version.js` → v99, merged `refactor` → `main` (merge commit, as v98), pushed. | logic 33/33, smoke ok |
| 2026-09-30 | Release check | CI run 36657455557 green (deploy-pages, build-apk) on fa3ff66; `version.txt` = v99. `main` merged back into `refactor` (fast-forward, same commit). | — |
| 2026-09-30 | Phase 4, P4.1 | `typescript` 7.0.2 dev dependency, `tsconfig.json` (choices under P4.1), `src/globals.d.ts`; `tests/run.js` runs `tsc --noEmit -p .` after ESLint (checked it fails the run on a planted error in a `// @ts-check` file). No file is checked yet. CLAUDE.md Testing says how it runs. `index.html` unchanged. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.2 | `src/types.d.ts` (the shapes, under P4.2), `skipLibCheck` off so it is checked itself (a planted unknown name in it fails the run). No `.js` changed; `index.html` unchanged. CLAUDE.md's layout table gets a row. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 core | D21 decided (`// @ts-check` + JSDoc, files stay `.js`). `core/consts.js`, `core/util.js` checked: clean at once; JSDoc parameter types on util's helpers (`mix`/`approach`/`clamp` as `@type` on the arrow consts; `hexRgb`/`hexArr` gained parentheses round their one parameter to carry the type: esbuild prints them the same). `index.html` unchanged. 0 bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 dev | `dev/knobs.js` checked. One error (noise: `DEV_META` inferred from its first rows); `DevKnobs`/`DevRow[]` on the tables, `RangeRow`/`ColourRow` typedefs for the knob tables' rows, types on `kr`/`kru`/`kcol`/`jcol`/`devSet`. `index.html` unchanged. 0 bugs, 0 new `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 data | `data/` checked: clean at once; types on its tables and functions (`perkBag` needed `PerkBag.maxHp` optional). A first try cast perkBag's return with `/** @type {PerkBag} */ (P)` and `index.html` changed: esbuild keeps comments inside expressions, so no inline casts (D21, Found along the way). Found while typing `enemyFor`: Stendari's `fire` never reaches `e.k` (logged, not fixed). `index.html` unchanged. 1 bug, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 spells | `spells/` checked (7 files): two errors, noise (`TRIG_VARIANTS`' extras). JSDoc on the tables (`MODS` as `Record<string, Mod>` checks every spell and every modifier's `f` against `Mod`/`Shot`: all fit) and every exported function; local typedefs `CastGroup`, `FireSim`; `NOITA_SPAWN`, `GUN_RANGE`, `TRIG_VARIANTS` as tuples. `Gun`'s filled-in-later fields and `hue`, and `Mod.id`, made optional in types.d.ts (what the code really builds). `index.html` unchanged. 0 bugs, 1 `any`. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 world | `world/` checked (9 files): three errors, noise, each silenced on its line with `@ts-expect-error` and a reason (a boolean as 0/1 in decorate; two test hooks set on their function inside its body). JSDoc on every exported function and the flag tables; types.d.ts gets `Spot`, `Working`, `Theme`, `Noise2`, and `Prop.arc` fixed (pairs, not points). `index.html` unchanged. 0 bugs, 0 `any`s. Stopped here: creatures, game, ui are the next job. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 creatures | `creatures/` checked (6 files): clean at once. JSDoc on every exported function; types.d.ts: the three brains (`SpiderBrain`, `RatBrain`, `JellyBrain`, replacing `Enemy.sp/ra/je: any`), their `*Env`s, `WebLine` (`World.webs` too), `SpiderShot`, `RoamState`, `SurfState`, `SolidCell`, `CreatureCol`. The spider brain's `mode` is a `string` (a literal union narrowed wrongly across `decide()`: 3 errors, noise). `index.html` unchanged. 0 bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 layer 4 | `art/`, `audio/`, `save/`, `replay/` checked (7 files): one error, noise (`webkitAudioContext`, declared in globals.d.ts). JSDoc on the exported functions and SFX's public calls; `safe()` typed to keep its function's signature (one `@ts-expect-error`). types.d.ts: `Loadout`, `SaveData`, `SavedLevel`, the replay's `RpSnap`/`RpFrame`/`RpRect`/`RpPatch`, `Prop.u0`/`u1`. `index.html` unchanged. 0 bugs, 9 `any`s (save 2, replay 7). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 game (1) | types.d.ts's game section narrowed (World's lists, `GameInput`, `Recorder`/`ReplayPlayer`, `EnemyCtx`, `ActHooks`, `SoundLoop`, `NavCache`; `img`/`dimg` as `ImageData`), then `world.js`, `Game.js`, `testhook.js` checked: two errors, noise (the test page's `window` hooks; `Pixels` to `putImageData`). `index.html` unchanged. 0 bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 game (2) | systems part 1 checked (`terrain`, `particles`, `player`, `enemies`, `fire`, `webs`, `fog`, `ambience`, `props`, `plantglow`, `lightning`): 34 errors, all noise but Stendari's known `k.fire` (typed on the local, since its line is inside an object literal: a comment there, or joining the literal onto one line, changed `index.html`). types.d.ts fitted (`Prop.fall`/`warn`/`heard`/`climb`, `Bullet.struck`, `jetSt.gap`); 3 `@ts-expect-error` (noise). Logged: a vent reuses `Prop.on`. `index.html` unchanged. 0 new bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 game (3) | systems part 2 checked (`gun`, `fields`, `bullets`, `shotlooks`, `pickups`, `recorder`, `save-run`, `level-entry`, `step`): ~200 errors, nearly all one wrong guess of the JSDoc script's (`rnd(a, b)`); the rest noise, fixed by types (`Bullet`'s optional part, `hit` a `Set`, `Pickup.cool`, `Devil.snd`, `SavedLevel`, `Uint8ClampedArray<ArrayBuffer>`), 4 `@ts-expect-error` (recWrap's rows, the replay's stand-in fire). `index.html` unchanged. 0 bugs, 1 `any` (`World.sconces`). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 game (4) | `render/` checked (7 files): 8 errors, noise (`G.aimPath` is flat numbers, `Player.aim.vis`, `drawTorch`'s embers as `Particle`s; one `@ts-expect-error` for a `[width, colour]` row union). `index.html` unchanged. 0 bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 game (5) | `game/creatures/` checked (5 files): 3 errors, one the logged Stendari bug (`bombBurst`, a one-line `@ts-expect-error`), two a wrong guess (`unstick`'s `home` is a flag). `ACTS` typed with `ActHooks`; `Enemy.roam`/`path`/`jobO` and `Coin`/`Silk`/`Ghost`/`Field`'s index signatures narrowed away. **game/ done.** `index.html` unchanged. 0 new bugs, 0 `any`s (9 left in the game section, listed under P4.3). | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.3 ui | `ui/` checked (8 files): 9 errors, noise (the jelly preview's stand-in creature: `jellyStep` takes what it reads; `closest()` results typed `HTMLElement` on their `const`s; 3 `@ts-expect-error`). Props typed on every component; `StickState`/`Prompt` index signatures and the legacy confirm hooks narrowed. **P4.3 done** for every folder. `index.html` unchanged. 0 bugs, 0 `any`s. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 4, P4.4 | Every file under `src/` checked (`main.js`, `pure.js`, `version.js` were clean), so `tsconfig.json` has `checkJs: true`: all of `src/` is checked and a new file is too (checked with a planted error in a new, unmarked file). The `// @ts-check` lines stay, redundant. tsconfig, tests/run.js, CLAUDE.md (Testing, the layout row), HANDOVER say so; CLAUDE.md also: no comment inside an object/array literal. The Stendari entry says where its two reads are silenced. **Phase 4's tasks done**; not merged. `index.html` unchanged. | probe SAME, logic 33/33, smoke ok |
| 2026-09-30 | Phase 5, P5.1 | A README.md in each src/ folder (15): what each file holds and that area's rules, moved from CLAUDE.md in today's names (`W.mat`, the system or render module a function lives in). Every backticked name in them checked against src/. CLAUDE.md not trimmed yet (P5.2). Docs only: `index.html` unchanged. | logic 33/33, smoke ok |
| 2026-09-30 | Phase 5, P5.3 | `CHANGELOG.md`: one entry per release v39–v99, newest first, plus Unreleased (Phases 4–5). Docs only. | index.html unchanged |
| 2026-09-30 | Phase 5, P5.2 | CLAUDE.md 1,132 → 148 lines: the owner's working style (their words intact), the loop, version, Android essentials, a folder → README map with the layer rule, editing and testing rules (sandbox, no waiting forever, flakes pointer, the type check, D21). Section-by-section check against the old file; two rules added to READMEs in the pass (Pollen, the inert confirm path). Docs only. | logic 33/33, smoke ok |
