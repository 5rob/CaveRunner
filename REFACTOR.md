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
| **Current phase** | Phase 0 — in progress |
| **Branch** | `refactor` (created from `main` at v96, d89c6cd) |
| **Feature freeze** | From the start of Phase 0 until Phase 1 merges to `main` |
| **Last green full suite** | — |
| **Last merged to main** | — |

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

- [ ] **P1.1** Add a dev-only `package.json` (esbuild, eslint) with `node_modules/` in
      `.gitignore`. The game stays one file. This overrides CLAUDE.md's "no package.json"
      rule for tooling only; update that line.
- [ ] **P1.2** Switch `tools/build.js` to **esbuild** on the still-single `src/main.js`
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
- [ ] **P1.3** Add the **undefined-name check**: ESLint flat config with only `no-undef`
      (browser globals + `React`, `ReactDOM`), run by `tests/run.js` before the suites.
      **This matters:** with modules, a missed import doesn't fail the build. It fails only
      when that line runs, maybe mid-game on floor 7.
- [ ] **P1.4** Switch `tests/load.js` to bundle a `src/pure.js` (re-exports every pure
      module) with esbuild in-memory to CJS and return its exports. At first `pure.js` just
      re-exports from `main.js`. Logic suites don't change.
- [ ] **P1.5** Move modules out **in layer order**, one per commit, logic tests green
      each time (see the target layout for what goes where):
  - [ ] core/consts.js
  - [ ] core/util.js
  - [ ] dev/knobs.js
  - [ ] data/themes.js
  - [ ] data/creatures.js
  - [ ] data/perks.js
  - [ ] spells/mods.js
  - [ ] spells/spawn.js
  - [ ] spells/guns.js
  - [ ] spells/cast.js
  - [ ] spells/trace.js
  - [ ] spells/advisor.js
  - [ ] spells/bagsim.js
  - [ ] world/vision.js
  - [ ] world/fire.js
  - [ ] world/nav.js
  - [ ] world/zones.js, veins.js, nests.js
  - [ ] world/strata.js
  - [ ] world/decorate.js
  - [ ] world/level.js
  - [ ] creatures/common.js
  - [ ] creatures/spider.js (knobs + spiderStep/Seat/Aim + drawSpider)
  - [ ] creatures/rat.js
  - [ ] creatures/jelly.js
  - [ ] creatures/classic.js + creatures/draw.js
  - [ ] art/sprites.js
  - [ ] art/props.js
  - [ ] audio/recipes.js
  - [ ] audio/sfx.js
  - [ ] save/save.js
  - [ ] replay/replay.js
- [ ] **P1.6** Full suite green. Merge `refactor` → `main` with a version bump. Owner
      plays it on the phone. **Feature freeze lifts**: new features go into `src/` from
      here, and the rest of the refactor continues in small steps between them.

### Phase 2 — the React UI into `ui/`

Same move-only method. `Game` stays where it is for now.

- [ ] **P2.1** ui/h.js (the `h` helper and hook imports)
- [ ] **P2.2** ui/hud.js (Stick, RKey, gauges, holdPress, deckLayout…)
- [ ] **P2.3** ui/cards.js (GunCard, ModCard, PerkCard, GUN_STATS)
- [ ] **P2.4** ui/editor.js (Editor, GunStats, SlotGrid, ScrollBox, GunIcon, PULL_COL, GS_ROWS)
- [ ] **P2.5** ui/swap.js, ui/witness.js
- [ ] **P2.6** ui/devpanel.js (DevRow, DevPanel, SpawnGun; JellyPreview goes with the jelly or here)
- [ ] **P2.7** ui/app.js (App); `main.js` is now just the mount. Full suite green.

### Phase 3 — take the `Game` closure apart (the big one)

~4,260 lines in one function, sharing ~hundreds of local variables. Do it in this order:

- [ ] **P3.1 Map it first, change nothing.** Write a map of `Game` into this doc (new
      section **Game map**): every closure-level variable and inner function, which system
      it belongs to, and who reads/writes it. Look especially for variables reassigned
      (`let x = …; x = …`), since those can't simply be shared, and for things `draw()` and
      `step()` both touch.
- [ ] **P3.2 One world object.** `game/world.js` `makeWorld()` holds the level-scoped
      state (`mat`, `img`, `dimg`, `seen`, `enemies`, `bullets`, `fields`, `props`, `fire`,
      `p`, camera, timers…). In `Game`, replace the loose variables with `W.x` a few at a
      time. Reassigned `let`s become `W` properties. Commit per group.
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

## Found along the way

Bugs, oddities and "this should be better" spotted mid-move. Don't fix them in a refactor
commit. List them here for after.

- **Pure code below `makeLevel`.** `tracePath` (~7041 in `src/main.js`) sits *between*
  `makeLevel` and `Game`, and `drawGunGlow` (~11388) sits *after* `Game`, among the UI.
  CLAUDE.md used to say "everything above `makeLevel` is pure"; the loader cuts at
  `function Game(` so tracePath is covered, but drawGunGlow isn't reachable from logic
  suites. Mind both when cutting modules in P1.5.
- **Two logic suites read the code as text** (`creatures`: every body has a
  `draw<Body>(ctx`; `rats`: `drawRat`/`drawNest` exist). They now get it from
  `require('../load').source`. Once the code is split, `.source` must be *all* of
  `src/` concatenated, or those checks go false.
- **Browser suites need Playwright on this PC.** None is installed globally; this session
  put `playwright-core` in the scratchpad and set `CAVERUNNER_PLAYWRIGHT` +
  `CAVERUNNER_CHROME` (system Chrome at `C:Program FilesGoogleChromeApplication`).
  `tests/chromium.js` only looks for Linux Chromium paths by default. P1.1's dev
  `package.json` could carry `playwright-core` so this stops being per-session.

## Game map

(filled in by P3.1)

## Session log

| Date | Phase / tasks | What happened | Suite |
|---|---|---|---|
| 2026-09-29 | — | Plan written (this doc). Nothing built yet. | — |
