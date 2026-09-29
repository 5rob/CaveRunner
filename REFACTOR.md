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
| **Current phase** | Phase 2 merged to `main` as v98. Phase 3 on `refactor`: P3.1 done (map + determinism probe) |
| **Branch** | `refactor` (created from `main` at v96, d89c6cd) |
| **Feature freeze** | Lifted with P1.6 (v97) |
| **Last green full suite** | 2026-09-29, v98 release (bar `jelly` spit: passed alone on the 3rd try, as on v96) |
| **Last merged to main** | v98 (Phase 2), 2026-09-29 |

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
                        (each creature's own knob table moves to that creature's file)
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
- [ ] **P3.2 One world object.** `game/world.js` `makeWorld()` holds the level-scoped
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
  - [ ] fog: `seen`, `deepFog`
  - [ ] fire: `fire`, `firePlants`, `fireArches`, `fireCarts`, `firePropN`, `firePropLast`, `fireLoop`, `fireN`, `fireVis`
  - [ ] player, camera, clock: `p`, `pb`, `ghost`, `zfx`, `time`, `levelT`, `best`, `camX`, `camY`, `camReady`, `unitPx`, `viewW`, `viewH`, `flick`, `torchR`, `visPts`, `leanX`…
  - [ ] the run's lists: `bullets`, `enemyShots`, `smoke`, `sparks`, … (never replaced)
  - [ ] frame timers and loops private to `step`/`decorStep`/`plantGlow`/`dropOre`
- [ ] **P3.3 Test hooks from the world object.** `window.__lvl` becomes `W` (plus the
      helper functions), set when a test-build flag is on, instead of `tests/build.js`
      string-swapping code into the closure. Keep every name the browser suites use today
      (`__lvl.p`, `.enemies`, `.sandbox()`, `.placeProp()`, `.fog.seen`, `.light.*`…), so
      suites don't change.
- [ ] **P3.4 Pull systems out**, one per commit, each a module in `game/systems/` taking
      `W` (and `dt` or `ctx`). Rough list, which P3.1 will correct:
  - [ ] terrain.js: dig, explode, unDeco, dirty rects, putImageData wrappers (replay needs these!)
  - [ ] fog.js: paintFog, bake, blur, fogLit
  - [ ] level-entry.js: enterLevel, sconces, per-floor precompute
  - [ ] player.js: walking, jetpack + sputter, climbing (vines, webs, arches), hurt, burn
  - [ ] gun.js: cast, spawnShot, releaseAt, payload/triggers, gun ticks
  - [ ] bullets.js: the bullet loop, homing/drift/wig, bounce, teleport, trails (shotTrail/Bounce/Death/Grind)
  - [ ] fields.js: fields and beams
  - [ ] enemies.js: the enemy loop, aggro, contact damage, enemy shots, goo/splat, damageEnemy
  - [ ] pickups.js: pickups, shop stock, coins, ore, rooms, the interact tap
  - [ ] props.js: decorStep, blowProp, landProp, rustle, zfx
  - [ ] fire-frame.js: fireFrame, ignite, setAlight, catchArch
  - [ ] ambience.js: motes, amb particles, spores, dparts, smoke, sparks
  - [ ] camera.js
  - [ ] recorder.js: recFrame, recSample, REC, and drawReplay's rebuild
  - [ ] save-run.js: saveRun
  - [ ] render/: split `draw()` into layers in their current order: background, terrain,
        props, entities, bullet looks (`drawLook`), fog, post-fog glows, HUD, map
- [ ] **P3.5 Creature plugins.** The enemy loop's per-creature branches become a
      registry: `creatures/<name>.js` exports `{ act, knobs, step(e, W, dt), draw(ctx, e,
      W), onHurt?, onDeath? }`, and `enemies.js` dispatches by `e.k.act`. **Adding a creature
      = one new file + one registry line.** Do the same for bullet looks (`drawLook`/
      `shotTrail` → a `LOOKS` table, one entry per look) if it reads better.
- [ ] **P3.6** `Game.js` is left owning: making the world, the loop (step/draw/replay
      switch), and the React `input` bridge. Target < 800 lines. Full suite green. Merge to
      `main` with a version bump; owner plays it.

### Phase 4 — TypeScript, gradually

Catches "wrong field name" and "missing argument" bugs before the phone does.

- [ ] **P4.1** Add `typescript` (dev dep), `tsconfig.json` with `allowJs` + `checkJs`
      off globally. `tests/run.js` runs `tsc --noEmit`.
- [ ] **P4.2** Write the shared shapes once in `src/types.d.ts`: Gun, Shot (blankShot's
      fields), Plan (planCast's return), Enemy, CreatureKind, Prop, Level, World, DevKnobs.
- [ ] **P4.3** Turn checking on per folder (`// @ts-check` or rename to `.ts`, since
      esbuild strips types), in this order: core, data, spells, world, creatures, game, ui.
      Fix real errors. For noise, add a type, not an `any`, where it's cheap.
- [ ] **P4.4** Once a folder is clean, keep it clean: the check is part of the green bar.

### Phase 5 — notes live next to the code

- [ ] **P5.1** Each `src/<folder>/` gets a short `README.md`: what's in it, the rules that
      matter ("planCast mutates g.idx", "the aim line must stay honest", "fire must not
      reveal fog", the owner's rules for that area). Moved from `CLAUDE.md`, and updated to
      new names.
- [ ] **P5.2** `CLAUDE.md` slims to: the owner's working style, the release loop, the
      testing rules, the layer rule, a map of folders → READMEs. Target < 150 lines.
- [ ] **P5.3** Version history paragraphs (v40…v96) go to `CHANGELOG.md`. Anything still
      needed as a *rule* goes to the right folder README.
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
