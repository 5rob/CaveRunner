# HANDOVER — CaveRunner

Where things stand, for a fresh session. Read `CLAUDE.md` first (the owner's working style, the
release loop, testing), then the README of the `src/` folder you're working in.

## v0.0.154 — a running DPS graph (5 s, thin red line) across the firing window's top third: RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.153 — a red DPS over the firing window's dummy (direct hits, last 3 s, hidden at 0): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.152 — the Bag's firing window: gun sway, zoomed out, a hologram dummy you that takes hits (homing shows): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.151 — a wall at the far right of the Bag's firing window (trigger payloads show): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.150 — the Bag's mana bar drains with the fire preview: RELEASED on `main` 2026-10-07 (owner's ask; a fix)

## v0.0.149 — THE OWNER'S 12-ITEM LIST: RELEASED on `main` 2026-10-07 (read LIST3.md for each item)

All 12 built by time-boxed agents (worktrees, merged into `list3-small`), every look OK'd from screenshots, one
feedback round done by the manager. `LIST3.md` has each item's files, decisions and the log; CHANGELOG v0.0.149.
In short: dark-zone hologram glitch (3 rates in Dev), modifiers hit only the next spell, Dev panel with tabs +
Spawn level + audit copy, the Bag's firing window and gun row, hold a HUD gun slot to take/drop guns (R/swap menu
archived), mod/perk audit (📌/🗑️/notes, Dev → Copy mod & perk audit), vine facing, trigger ring inside the gauges
(`aimPad`), mod stacks, Aim Assist mod, Discriminate mod, Mini-map perk.

**Waiting on the owner:** playing it on the phone. They said they'll test **Discriminate**, and tune the hologram
glitch rates (`l2dFlkRate`/`l2dFlkTears`/`l2dFlkDrops`) and may paste a Dev report. Known gaps (told the owner):
Discriminate doesn't cover fields, beams or trigger payloads, and its icons are emoji; Aim Assist aims the whole
pull at the target (one aim per pull); the mod card has no example showing the spell *after* the boosted one
coming out plain. Known failing as before: logic `rats`, `spider`, `strata`.

## v0.0.148 — SPEED-UPS, FLAMETHROWER, FIRE IMMUNITY: RELEASED on `main` 2026-10-06 (the owner OK'd it; Pages shows `148 v0.0.148`)

The owner played Level 2 on the phone: frames dropped as a dark zone came into view and with the aliens about.
Their list, all done (CHANGELOG v0.0.148 has the details): drawn at 1.5× (`renderScale`, `game/dpr.js`); the back
wall blurred once a floor; the hologram's blur behind the silk a Dev switch (`l2dHoloBlur`, off); the black's edge
a 3-step banded ramp (`l2dBands`) instead of a per-frame blur; half the aliens (`alCount` 30–60), black with no
skin, a shared eye picture, thinking in 5 groups with tweened moves. Mine, free: per-floor layers made on the
floor's first frame (the hitch when a zone appeared), grow-only canvases, aliens deep in the black not drawn.
Measured at alienperf's spot with the CPU slowed 4×: 114 → 36 ms a frame. Plus the owner's two asks: the
**Flamethrower** mod (`flamer`) and the **Fire Immunity** perk (`fireimm`); browser suite `flamer`; and a
**Dev → All perks** button (`LO.debugPerks`: every perk to fit, the suit usable anywhere).
Known failing, not from this: browser `shop` ("the coin is gone once collected", fails on v0.0.147 too); logic
`rats`, `spider`, `strata` as before. `vendshop` failed once in the full run and passed alone (chance).

**Next, from the owner:** how it runs on the phone (target 60 fps). Further levers if it's still slow: a lower
`renderScale`, fewer aliens, dropping the veins from the shared eye, longer think groups. If the owner had touched `alCount` in Dev, their saved value overrides the new default.

## LEVEL 2 — RELEASED FOR TESTING in v0.0.147 (2026-10-06; read first)

The owner's brief is **LEVEL2.md**. Built in 8 stages on the `level2` branch: the main session as project
manager, subagents for the big stages (time-boxed, CLAUDE.md "Subagents: keep them short"), the owner approving
every look from phone-size screenshots. **All 8 stages approved and released as v0.0.147** (a minor update, for
the owner to test on the phone). Next: the owner's feedback from playing it, and the open questions below.

Floor 2 is now **Tombs** (the theme renamed from Coal seams), built in `makeLevel` in this order:
1. **The tomb** (`world/tomb.js`): a room list first (types, mirror-symmetric geometric shapes), straight galleries
   and shafts, cut-stone lining; `level.tomb` / `tombRoomAt`. **Its own back wall** `paintTombWall`: courses at the
   rock's scale (7 × 4 px), glyph friezes, pilasters, painted at terrain resolution (`level.bgHi`, drawn in place of
   the quarter-size wall: `G.bgHi`/`G.bgHiOn` in `render/cave.js`, `render/dark.js`; `bgImg` its averaged copy).
2. **Furnishing** (`world/furnish.js`): each room type a painted, mirrored kit, skeletons, unlit candles (owner: dark).
3. **Dark zones** (`world/dark.js`, look `render/dark.js`; Dev "Level 2: dark zones" `l2d*`): 2–3 zones off the main
   route (radius `l2dSize` 120–176 px), rough caves, small tunnels (`tunnels: { pts, w, fits }`), a flat-floored
   chamber, ragged silk-and-dark fringe. Compositing (owner): back wall + hologram blurred, silk multiplied over them,
   everything in front black past a 12 px fade (`l2dTintDepth`); fire lifts the black, silk included (`l2dFireR`, the
   `l2dFire` curve); the torch flickers out 18 px in (`l2dTorchDepth`, 4 px gap back).
4. **Destruction** (`world/destroy.js`, Dev "Level 2: destruction" `l2b*`; the reusable scatter is
   `world/byDistance.js`): 100 blasts in a 100 px ring round the zones, denser and bigger at the edge, anywhere in
   the ring (`l2bInRock`), off the chambers; scorch (`l2bScorch`) and soft radial streaks (`l2bStreak`), soot on the
   back wall, 30% burn and the fire runs out during generation; bones and skulls (`l2bBones`). Pure and seeded.
5. **Loot** (`world/loot.js`): no ordinary creatures; 46 spots (half the usual enemy count, their spawn rules,
   outside the zones) with that creature's gold as a scatter of all three nugget sizes (`scatterGold`, `Coin.sz`),
   12 with a red crystal; each zone's chamber one prize (1000–2000 gold, 4–6 red, 1–3 green; at least one zone green).
   Ground gold is `level.coins` → `W.coins`, kept in the autosave.
6. **Aliens** (`creatures/alien.js` sprite + brain, `game/creatures/alien.js`; Dev "Level 2: aliens" `al*`): 60–120
   per zone plus 2–4 black strays; sizes 0.6–2.4 × leaning small (`alScale`, `alBias`); boids packs on the silk,
   flee fire (`alFleeR`), bite only when you're in the dark, keep off in light; strays sprint home; pupil darts then
   locks on; each its own leg stance and twitch, rounded bumpy tapered legs, purple-blue skin. A live bullet in a
   zone lifts the black a little (`alGlimpse`).

Floor build ~1 s (1.5 s worst, Mac) of the 5 s budget. Pictures: `tools/floorshot.js` (the whole floor as drawn),
`darkshots.js` (HOLO=1), `boomshots.js`, `lootshots.js`, `aliensheet.js`, `alienshots.js`, `alienframes.js`.
Suites: logic `tomb furnish dark destroy loot2 alien level2 bydistance`, browser `tomb darkzone darkperf alien alienperf`.

**Open questions for the owner** (ask after they've played it):
- How it runs on the phone with a zone and hundreds of aliens on screen (Mac: zone ~+5 ms, aliens ~+1.3 ms a frame).
- The bullet glimpse is faint at the defaults (`alGlimpse`); each alien drops a coin (hundreds a floor);
  strays steer home without pathfinding (one can stick behind a long wall).
- The tomb's own altar room still holds a green crystal outside the zones; should the exit pads keep glowing.
- Minecarts only came with floor 2's old decoration, so they're now first seen on floor 14 (the palette wraps).

Known failures (before level 2 too): logic `rats`, `spider`, `strata` ("workings").

## Where things stand

- **The refactor is done and fully on `main`** (all five phases). The game is modules under
  `src/`, bundled by esbuild into the same `index.html`; every file is type-checked (JSDoc + `tsc`);
  the notes live next to the code (a README per `src/` folder), history in `CHANGELOG.md`.
  `REFACTOR.md` keeps the plan, decisions D1–D21 and the session log.
- **Released: v0.0.147** on `main`, 2026-10-06 (a minor update, for testing): **Level 2, the Tombs** — see the
  section above.
- **Released: v0.0.146** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): a dark
  shade under the controls (`ui/hud.js` `shadeAt`).
- **Released: v0.0.145** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): the
  shop's way up always straight over the buy machine (`world/level.js`, `shopExit`); the hand torch archived
  (`HAND_TORCH`, kept for creatures later) for a light on the gun, a cone the way you aim, only with a gun in
  hand (`render/light.js`, Dev → Torch & fog `beam*`; the owner may paste Dev numbers for it); a new run's
  teleporter keeps its lightning until you've come through. The new caves tip two chance checks (`strata`,
  `rats`) over their bars: measured, not regressions (REFACTOR.md, Found along the way).
- **Released: v0.0.144** on `main`, 2026-10-05 (the owner OK'd it): the heal centred
  under its light, dust (not green spores) only inside the light cones, and the guide turns rude only once
  you walk out of its pool of light to the right (at a run it was skipped unseen); the gun pickup's slots a
  full-width row of squares with the cards splitting the rest; a new run's teleporter charging for a
  second before you come through in a flash, the tube over it on a second later; gun cards' mods as the Bag's
  square tiles, a tap showing the mod's card (a mod card's examples square too).
- **Released: v0.0.143** on `main`, 2026-10-05: the guide's starter gun casts one shot and recharges in 0.5 s.
- **Released: v0.0.142** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): a new run
  starts with no guns and no gold; the gun machine gives a Scratch Pistol free while you have no gun; the
  crystal machines play a hologram demo of a crystal going in (red/green showing through) until a real one
  has (`LO.fed`); the guide's kit has 2 red crystals; the guide jumps out only once its dark spot is
  `DEV.guideIn` (50) on screen; the gun and mod machines swapped (guns, mods, perks). Note: without the
  Pick Axe and Gravity Gun a new run can't dig or drag crystals until it finds the mods (owner's call).
  The browser test page still starts with the old kit (`window.__TEST_EMPTY` for the real start).
- **Released: v0.0.141** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): the
  new full-screen map with pan/zoom, machine squares and emoji pins (pin button on the map screen only:
  `ui/map.js`), the shop's heal and machines moved to the far right with pools of light under the tubes
  and dark between (Dev → Torch & fog: `shopGap`, `shopTorch`), and the guide hologram that welcomes
  **every new run, deaths included (owner)** and hands out a starter kit, or goes off in a huff if you
  walk through it (`world/guide.js`; invisible until the tube over it lights). Not saved: closing the app
  mid-welcome loses the kit. The old map's loot dots and prize-room outlines are gone (owner: picture +
  fog + helmet + pins). The owner may paste Dev numbers for the hall's dark or the guide's typing.
- **Released: v0.0.140** on `main`, 2026-10-04 (the owner OK'd the screenshots): the mod machine glows
  crystal red, the gun machine gold, and the gun machine's red-crystal Boosted reroll is gone.
- **v0.0.139** on `main`, 2026-10-04: the mod machine rolls any mod off the floor's table, repeats
  included; perks stay one of a kind (never given twice; the perk collection is kept across runs, so a
  perk once had never comes from the machine again: ask the owner if that's wrong for later runs).
- **v0.0.138** on `main`, 2026-10-04 (the owner OK'd the screenshots):
  crystals can't be picked up, they're rocks you push or drag with the Gravity Gun; the mod machine eats
  red ones and the perk machine green ones, shakes faster and faster and pops out a new unlock off the
  floor's table (`game/systems/shops.js` `stepCrystals`). Their menus are archived (`takes` on a `SHOPS`
  entry; drop it to bring the menu back).
- **v0.0.137** on `main`, 2026-10-04 (the owner OK'd the screenshots). No perk column on
  the HUD; bigger gun/bag/map buttons; crystals fly to you like gold and shed breeze sparkles; flight
  paths rebuilt in one place (`spells/paths.js`: Boomerang returns, Ping-Pong, Spiral, Orbit round its
  caster or a trigger's carrier) and working on moving fields; new mods Follow Me, Enlarge/Shrink,
  Longer/Shorter Flight; Vacuum Field → **White Hole** (steady harmless pull, tiny white-blue look, specks
  drawn in); the elite glow a soft radial fade, not a disc (owner's first feedback); the **Gravity Gun** as a third starter (old saves: Dev → Restart run); elites burn, with
  **Dev → Elites: flames** (gradient editor, opacity B-spline, length, wavyness, air resistance…). The
  owner may paste Dev numbers for the flames. Not done: flames off creatures' appendages (body only),
  and the flames aren't in death replays. An orbit cast standing on the floor clips the floor (the
  circle is 26 units; your gun is ~13 above your feet).
- **v0.0.136** on `main`, 2026-10-03 (the owner OK'd the screenshots): a new run's dark shop
  lighting up a section at a time (`world/shoplights.js`), the pad centred under a TELEPORTER plank nailed
  over PRINTER, the heal just past it and the machines evenly spaced (`SHOP_SLOT`), and kill/dig gold
  waiting 0.25 s (`SPILL_WAIT`).
- **v0.0.135** on `main`, 2026-10-03 (the owner OK'd the screenshots): in the Exo Suit's
  perk grid a perk not unlocked yet is a blank tile in its place, nothing to tap (`.xperk.locked`).
- **v0.0.134** on `main`, 2026-10-03 (the owner OK'd the screenshots): the sell machine is
  lit green from the start and glitches to red with its fine print half a second after a buy; both
  machines' offers read "BUY/SELL lvl 01" + price + fine print, in a blocky terminal font (`art/pixfont.js`).
- **v0.0.133** on `main`, 2026-10-03: Dev → Restart run empties the mods unlocked, like a
  death (perks unlocked stay).
- **v0.0.132** on `main`, 2026-10-03: version numbers are now **major.minor.patch**
  (`vX.Y.Z`; CLAUDE.md has how the update number keeps the installed app updating). The APK's update
  prompt label is tidier with the new APK (reinstall optional: the old one updates fine, showing
  "132 v0.0.132"). Next release: ask which part to bump if it isn't clearly a minor update.
- **v131** on `main`, 2026-10-03 (the owner OK'd the screenshots): the jet flame and smoke come
  out of the backpack's nozzle (`jetNozzle`), not the feet.
- **v130** on `main`, 2026-10-03 (the owner OK'd the screenshots first): the buy machine's
  full-screen floor menu (`ui/levelshop.js`; floor N for sale once N − 1 is sold this run, `LO.soldTop`), an
  exponential economy (`data/levels.js`: debt 1 billion × 3 a floor, reward 1,000 doubling a floor, kill gold
  × 1.35 a floor; all Dev knobs in Level), the next level made by a Web Worker while the shop stands empty
  (`game/levelgen.js`; flash lag 1117 → 67 ms at CPU ÷4) and drawn in bottom-up, no level sounds without a
  level, three exits along the top, pads that crackle only when used, pixel flames for the torch and jet
  (and blocky jet smoke), and the Exo Suit's perk grid as a ScrollBox. CHANGELOG has the details. Untested
  on the phone itself: the Web Worker in the app's WebView (if it fails, the warp makes the level itself,
  with the old freeze). The owner may paste Dev numbers for the economy.
- **v129** on `main`, 2026-10-03: a swung vine trails below your grip (a tail of verlet
  links, `world/sway.js` `tailStep`/`vinePt`; Dev `vineLinks`, `vineTailDamp`); Witness export fixed (it
  was always 300 × 150: now the screen's shape) and the replay's hologram shows the count of that
  moment (`bio` per snapshot); mods unlocked reset on death (perks stay); one of each perk in the
  suit; **Dev → Level 2: layout & look** (floor 2's cave numbers, palette, decoration; **Floor 2**
  button). The owner may paste Dev numbers for floor 2. Noticed, not fixed: on floor 2, seed 5
  (`makeLevel(5, 2)`) the runner-box flood from the shop doesn't reach the top (v128 too): only
  floor 1 has the "way through" repair.
- **v128** on `main`, 2026-10-03: elites drop a pile of red and green crystals (one tap
  takes the pile) and have a Dev group, **Elites** (count per floor, health, damage, gold, crystals,
  size, tint, glow). The owner may paste Dev numbers for it.
- **v127** on `main`, 2026-10-02: vines and web lines give (`world/sway.js`: one spring per
  line, a pendulum per hanging vine; Dev group **Vines & webs: sway**). v126: the **Carrot** suit stat
  (camera, torch, aggro, aim line; Dev group **Carrot**, min = none fitted, max = Carrot V). The owner may
  paste Dev numbers for either.
- **v125** on `main`, 2026-10-02: the player as a pixel astronaut with jointed limbs
  (`art/sprites.js` `paintBody`/`runnerPose`/`pixelSprite`), the ragdoll with elbows, teleporter pads
  for both portals (`render/pads.js`), a steel shop (`shopPanel`), machines left to right mods/guns/perks,
  a hologram count that only goes down (nests hold a fixed brood, `nest.left`), Dev knobs for the enemy
  count and the level reward, press-and-hold Dev group headers, and any push off a web line or arched
  vine lets go (`lineLetGo`). The owner may paste Dev numbers for
  the astronaut (`runnerPx`, `runnerLine`). The owner's reference picture never arrived in the session:
  the look is from "a white-dressed astronaut, pixel style".
- **v124** on `main`, 2026-10-02: saved death replays (the Bag's Witness tab: play,
  rename, delete), the replay's sound, **Export video** (MP4 with sound into Movies/CaveRunner via
  a new app bridge, `window.CaveApp`: **the APK must be reinstalled once** for saving videos; ffmpeg.wasm
  converts if the phone can't record MP4), and the corpse as a ragdoll (`world/ragdoll.js`).
  `replay/README.md` has how it fits. Untested on the phone itself: MediaRecorder's MP4 in the
  WebView, and the bridge (CI builds the Java; nothing here compiles Android).
- **v123** on `main`, 2026-10-02. v118–v123: three shop vending machines (mods v118, guns v119, perks v120: `game/systems/shops.js`, `ui/vendshop.js`, `ui/gunshop.js`), red/green crystals in place of cave loot, elites, the Exo Suit tab in the Bag with stat perks, the menus' right-stick pointer with snapping (v121–v122, Dev knobs v123), the Questions Later auto-fire mod (v122) (CHANGELOG). v117: a Dev knob for level 1's repay time (`DEV.due1`, minutes). v116: the hologram rests dark and flashes on a kill (Dev → Hologram flash, with a fade-curve editor). Before it, v115 on 2026-10-01 (history in `CHANGELOG.md`). The last three were the
  owner's lag and battery complaints: v113 the camera eases by time, not per frame (it jittered you
  in fast flight on the phone; confirmed fixed); v114 the Bag works out its dmg/s line once per build,
  without the parked swap tips (a drag cost ~380ms with a big gun); v115 the hologram, its fog swap,
  its bloom and the glows draw at the rock's pixel size (`DEV.holoPx`, `DEV.pixelFx`): ~69ms a frame
  to ~20ms software-rendered. The owner may paste a Dev report with the look they settle on.
- **Measuring render cost:** a PC's GPU hides it. Launch Chromium with `--disable-gpu
  --disable-gpu-compositing` and phone size (412x880, dpr 2.625), then time frames with steps
  switched off one at a time; seed `Math.random` in an init script so old and new builds draw the same cave.
- Tests: logic 33/33 and `smoke` green on every Phase 5 commit and on the v100 release; the last full browser run was green
  after re-runs of known flakes (end of P3.5).
- `.claude/` is untracked on purpose (it holds an API token): never commit it.

## What's next: REFACTOR.md → "Found along the way"

- **`shop` browser suite fails on v124 and v125 alike** (not a flake): "the coin is gone once
  collected" (a coin left lying) and so "you keep your mods and gold". Not looked into yet.

That list is the to-do the refactor left (nothing in it was fixed in passing). The main ones:

- **Stendari's bomb never sets anything alight**: `enemyFor` (`src/data/creatures.js`) doesn't copy
  `fire`, so `CREATURES.tuli.fire` never reaches `e.k`. One-field fix, but a gameplay change (bombs on
  floors 6, 7, 9 start fires): the owner's call. Two `@ts-expect-error`s mark the reads.
- **A vent reuses `Prop.on`** as "roaring" (`src/game/systems/props.js`), which also means "the arch I
  hang off" for `propAnchored`. Harmless today; give vents their own field (`roar`).
- **Flaky browser checks** (timing or chance; each passes alone): `jelly` spit group (fails on v96 too),
  `sound` portalOut, `torch` falloff/flicker, `lightning` fork, `trigger` explosion carrier (wall-clock
  waits: make it frame-counted), `fog` "next floor is dark again" and "flying on reveals more",
  `everymod` telecast, `rats`, `save`, `vendshop` arrow-key step, `nuggets` "settle on the floor" (fails on v114 too), `map` "the rest black" (random caves: sometimes the walk up stops low; 5 fails in a row once, then 6 passes), `archvine`, `decor` vine, `t1spells` bubble, `compare`, and the logic `spider` "every roaming spider moves about" on real caves (1 of 119 barely moves since v120's one-room caves: make it seeded or sandboxed). Worth
  making them frame-counted / seeded. `shoplayout` and `perks` logic suites run close to the 30s cap.
- Smaller: `paint()` has no callers, `W.best` is written and never read, a static field cast just before
  the portal carries on to the next floor, a few comments sit above
  the wrong code (listed there).

## The Android app

Live: APK at `https://github.com/5rob/CaveRunner/releases/tag/app`, game at
`https://5rob.github.io/CaveRunner/`. Pushing to `main` is the release; the app offers the update.
Essentials in `CLAUDE.md`, details in `android/README.md`.

## Testing on this machine (Windows PC)

`npm install` once; `node tests/run.js` (everything), `logic`, `browser`, or one filter. Browser suites
find playwright-core in `node_modules/` and the installed Chrome by themselves (never
`playwright install`). A `node serve.js` may already be running from an earlier session
(`EADDRINUSE` on a second one is harmless).

## Ideas raised but not built

- **Delayed Spellcast** — a static that casts three more spells after a pause; the trigger/timer
  machinery exists (`payload` on a shot, `firePayload`), so it's a small job.
- Noita spell categories only partly mined: Material spells (none), Divide By N, the Requirement spells.
- More perks, or Noita's perk reroll (skipped on purpose for now).
- Death replay: a "killed by …" caption (needs the source plumbed through `hurt`). (Saving replays: v124.)
