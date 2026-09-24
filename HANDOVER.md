# HANDOVER — CaveRunner

A running note for picking the project up in a fresh session. Read `CLAUDE.md` first — it
has the owner's working style, the build/test/publish loop, and the deep per-system notes.
This file is just "where things stand right now" and can be edited freely or deleted once
it's stale.

## Where things stand

- **On-disk version: v59.** Working on `main` (**release channel is `main`** — CI there
  deploys Pages + builds the APK). Recent: v50 big batch, v51–v53 Buzzsaw melee rework, v54
  Matter Eater fix + softer fog + aim crosshair, v55 crosshair "+" + gun-stat rings (see
  **What shipped recently**). After a push, confirm CI green and that
  `https://5rob.github.io/CaveRunner/version.txt` matches.
- **The game now ships as a self-updating Android app** (built this session, working end to
  end). The delivery path changed: pushing to `main` is the release, and the app on the
  phone offers the update. You no longer publish the artifact. See the new **The Android
  app** section in `CLAUDE.md` and `android/README.md`. Details below.
- Working tree is clean apart from `.claude/` (untracked on purpose — it holds an API token,
  never commit it).
- Full test suite is green (`node tests/run.js`), see **Testing** below for two known flakes.
  (The suite covers `index.html` logic/browser only; the Android shell isn't unit-tested —
  its test is the CI build + installing the APK.)

## The Android app (new this session)

- Everything is live: APK at `https://github.com/5rob/CaveRunner/releases/tag/app`, game at
  `https://5rob.github.io/CaveRunner/`, `version.txt` = `v48`. Last CI run on `main` was
  green (both `build-apk` and `deploy-pages`).
- **What it is:** a thin WebView shell (`android/`) that bundles `index.html` + React so it
  plays offline, then checks Pages' `version.txt` on launch and offers to download a newer
  `index.html` and reload. CI (`.github/workflows/android.yml`, on push to `main`) builds the
  APK and deploys Pages; nothing builds on the PC.
- **Owner still needs to (or has just) install the APK once** from the release page (allow
  installs from the browser). After that, game updates never need a reinstall.
- **Gotchas for the next session:** the CDN→local React rewrite lives in *two* places
  (`android/prep-assets.js` and `localize()` in `MainActivity.java`) — keep them in sync and
  never edit the canonical `index.html`'s CDN tags. `android/app/src/main/assets/index.html`
  is git-ignored (CI regenerates it); the React `.js` beside it are committed. GitHub job
  *logs* need auth, but run status / job steps / check-run *annotations* are public — use
  those to diagnose a failed CI run without a token.

## What shipped recently (most recent first)

- **v59 — denser decoration, vine groves, torches through fog.** 3x decoration density, vines in clumps plus 14 overgrown groves per green floor, torch flame leans ~2.5x more, owner dev settings made defaults (zoom 1.35, aggro 0.8, BH pull 50, BH speed 65), Dev panel split into collapsible groups, wall torches and lanterns clear the fog round themselves.

- **v58 — level decoration.** Every theme gets five decorations (60 total, `DECOR`): baked pixels (moss, rubble, beams, pillars, gears, ribs, cracks, fissures, soot) and working props (vines/chains/roots to hang on, icicles and geodes that drop, explosive minecarts, spikes, fire vents, bouncy mushrooms, spore pods, slow/slick/hurting floor zones, noise-making skulls and stones, cover that blocks shots, dark matter, tendrils, lanterns, eyes). Props drop when their rock is blasted away. Theme ambience (spores, frost, embers, dust devils, motes, ash fall). See the v58 note in CLAUDE.md.

- **v57 — Black Hole tuning knobs.** Dig radius now equals the drawn black core (was including the glow). Dev knobs for Black Hole max pull range and travel speed. New Dev-panel button copies all changed dev settings as text to paste to Claude, who then makes them the defaults.

- **v56 — Black Hole rework + visuals.** Black Hole hauls creatures in hard, rolls on through them grinding, swallows enemy shots, purple haze + starry core + mote trail. Portal motes (drawn into the exit, wafting out of the way in). Hand torch flame drags as you move, with a flickering halo and a small second light. Wall torches by portals and room prizes. Background parallax (0.8) and big shadow blotches. Browser tests were run on this PC with playwright-core installed in the session scratchpad + system Chrome (`CAVERUNNER_PLAYWRIGHT` / `CAVERUNNER_CHROME`).

- **v55 — crosshair "+" and gun-stat rings.** The aim crosshair is now a `+` with the centre
  cut out (four thin strokes), as thin as the stick lines. The right stick shows three
  concentric rings — mana (outer), recharge, cast delay — each a readiness wipe that empties
  on fire and refills over its own time, so the ring lingering low is the bottleneck. The
  bag's cast-delay / recharge / mana stats are colour-coded to match (`GAUGE_COL`: gold /
  blue / purple).
- **v54 — Matter Eater fix, softer fog, aim crosshair.**
  - **Matter Eater** (and any `eat` bullet) now tunnels *through* rock: the collision check
    digs and continues on `eat` like it does on `bore`, so a fast bolt can't outrun its small
    eat hole and die on the wall. (Reminder: the mod must sit *before* the shot to affect it.)
  - **Fog softened & pushed off seen ground:** one-cell dilation of the visible region in the
    bake (unseen cells bordering seen ones read as remembered), plus a cheap source-resolution
    blur (`fogBlurC`) so the edge is a gradient. `seen`/LOS unchanged, so tests still pass.
  - **Aim crosshair:** a small white dot `DEV.aimDist` (default 44) out, rotating round the
    character with the aim. New "Crosshair distance" Dev-panel row.
- **v53 — Buzzsaw reliability + closer reach.** The melee slice only dug on frames its
  centre point was inside rock (`bore`), so at most distances the 15-radius slice overlapped
  the wall but never cut — "cuts every tenth try". Now it carries `eat: 14`, which digs its
  radius every frame it's alive regardless of the centre, so it reliably cuts anything within
  range. Pulled it in closer with a new `reach: 5` field (default 10 for every other shot;
  `blankShot`/`spawnShot`/`tracePath` all honour it). Also added a `hidden: 1` bullet flag so
  the slice no longer draws the big white circle — the draw loop skips hidden bullets.
- **v52 — minimap accuracy + position dot.** The old minimap detected edges on the coarse
  fog grid (16-unit cells), so organic cave walls scattered into loose pixels (only the
  shop's straight walls survived). Now it samples the real terrain in 4px blocks and marks a
  cell as outline if a wall runs through it (both rock and open), precomputed per floor as
  `miniEdgeIdx`, and blits with imageSmoothing on so the walls read as continuous lines. Added
  a **yellow dot** for the player's position. See the minimap note in `CLAUDE.md`.
- **v51 — Buzzsaw melee slice + starter slot order.**
  - **Buzzsaw is now a melee cutter:** `speed: 0` (no travel, sits ~10u in front), `size: 15`
    (3×) and `bore: 12`, so it carves a circular slice into rock/enemies right in front. It
    only digs when its centre is pushed into rock.
  - **Buzzsaw recharge back to default** (`rech: -0.17`; the v50 `rechMul: 0.33` speedup is
    gone). Pick Axe gun recharge set to `1.0`, so the swing is ~0.83s.
  - **Starter slot order swapped back:** `startingGuns()` returns `[pistol, pickaxe, …]` —
    Scratch Pistol first (selected), Pick Axe second.
  - Tests updated: `timing`/`advice` reverted to recharge-bound + bore 12; `cast` and
    `gunpickup` follow the new slot order; `interact` resets the held gun's clocks so the
    slow pistol still reads as firing. Full suite green.
- **v50 — big gameplay/UI batch.** Eleven changes in one go:
  - **Starter guns reworked.** New starter is a **Pick Axe** (one slot, holds Buzzsaw);
    **Buzzsaw** now cuts recharge to a third (`rechMul: 0.33`, was `rech: -0.17`) so it cuts
    fast. The **Scratch Pistol** is now a deliberately weak backup (worse than any floor-1
    find). `startingGuns()` returns `[pickaxe, pistol, null, null]`.
  - **Trajectory aim line is now a perk** ("Trajectory Sight", `sight`/`pb.trajectory`).
    31 perks now. Without it you aim by feel; `tracePath` unchanged, only the draw is gated.
    Distinct from the existing auto-aim `Pinpointer` perk.
  - **Sticky aggro + a new dev knob.** Chase/bomb enemies acquire aggro on line-of-sight
    within reach, then keep chasing (out of reach, round walls) until you're `reach *
    DEV.loseAggro` away. New **Lose aggro distance (×aggro)** row in the Dev panel
    (`DEV.loseAggro`, default 2).
  - **Minimap.** Bottom-left, ~1/3 view width, revealed cave as white outlines over the
    gameplay, everything else transparent. `miniEdge`/`miniC` in the Game closure.
  - **Mod pickups are direct; guns keep the chooser.** A tap takes a mod straight to the bag
    (ModFound overlay removed). Guns still open the **GunSwap** chooser (compare + pick the
    slot to swap) — the owner asked for that to stay after first trying the all-direct
    version. Buying a gun still drops it at the plinth for the chooser.
  - **Death restarts on a right-stick tap** (message + `input.current.requestRestart`).
  - **Health ring colour** slides green→amber→red with health (`healthCol`/`mixHex`).
  - **"Mods" button → "Bag"**, always opens; editing gated to shop/Tinker (`canEdit` into
    `Editor`, read-only footer otherwise).
  - **Shop plinths** extended down to the floor (were hovering).
  - Full suite green (one known flaky: `torch`'s "light moves with it" is flicker-range
    sensitive, passes on rerun). Several browser/logic suites updated for the above.
- **v49 — dev knob for enemy aggro distance.** Added `DEV.aggro` (default 1, range 0.2–5),
  a new **Enemy aggro distance** row in the Dev panel. It's a hand-tuning multiplier on the
  *final* aggro reach for chase/bomb enemies — `dist < k.aggro * sees * DEV.aggro` — layered
  on top of the existing zoom-relative `1/DEV.zoom` (`sees`) scaling, and it leaves firing
  range (`k.range`) alone. Saved to localStorage like the other knobs. See the aggro note
  and the Dev-panel note in `CLAUDE.md`. No new test — DEV knobs live in the `Game` step
  closure (not a pure fn), same as `zoom`/`move`, which are also untested; full suite green.
- **v48 — gold nudged up** to sit just under the tops of the sticks (`.gold` `top:5%`).
- **v47 — gold moved into the deck.** The gold readout came off the canvas (was top-right)
  and is now a DOM element (`.gold`) in the gap between the two sticks, just under their tops. Shows a `g` not the word, and truncates thousands to a `k` (`1234` → `1.2kg`) via
  `fmtGold` (pure, above `makeLevel`, tested by `tests/logic/gold.test.js`).
- **v46 — HUD cleared out, moved onto the thumbsticks.** The whole top-left stack (floor,
  enemies, health/fuel/mana bars, gun name) is gone. Health is now a green ring round the
  left stick, mana a gold ring round the right, each wiped clockwise as it drops; fuel is
  the amber wipe in the left stick's top half, draining down to the centre line. Floor
  number is painted big along the shop's back wall. Version top-left, gold top-right.
  Restart moved into the Dev panel; the Dev button is a bare ⚙️ top-right. `draw()` publishes
  `input.current.hud` each frame and each `Stick` reads it on a rAF loop. See the HUD note
  in `CLAUDE.md`.
- **v44–v45 — scrollable panel stats, line-of-sight aggro, dotted trigger ring.** The pickup
  panel's stat list (`.buypanel .prows`) caps at ~3 rows (`max-height:60px`, tightened from
  156px in v45) and scrolls the rest, so a loaded gun/busy mod can't fill the screen — it's
  the one `pointer-events:auto` part of an otherwise click-through panel. Chasers and bombers
  now need an actual sightline to aggro (`hunting` gained a `lineOfSight` gate), so nothing
  chases through a wall. The right stick's amber trigger ring is dotted, and the old dashed
  `.throw` ring (edge of the knob's travel) was removed.
- **v43 — pickup panel is half width and floats above the item.** `.buypanel` is now
  `left:25%;right:25%` (half width, centred) and its bottom edge sits just above the plinth
  instead of at the screen bottom: `step()` measures the item's on-screen spot and stores
  `input.current.promptBottom`, which `App` applies as the panel's inline `bottom`/`maxHeight`.
- **v42 — unified pickup panel, bolder knobs, zoom-aware aggro.** The shop/pickup info
  card and the buy pill are one panel now (`.buypanel`, grown up from the bottom): the
  item card, then a `.pbuy` line reading `Buy <price>` for stock or `Take`/`free` for
  loot. The mod use-example is dropped from the in-game preview (kept in the editor). The
  stick knobs are white rings with a black fill (stroke 1.5× the ring lines). Enemy aggro
  and firing reaches now scale by `1/DEV.zoom` (via the `sees` factor), so zooming the
  camera in no longer lets off-screen enemies hunt and shoot you.
- **v41 — Dev panel.** A **Dev** button next to **Restart** in the view (always reachable,
  not shop-only) opens `DevPanel`: pauses the run but keeps drawing behind a light backdrop
  so the visual knobs preview live. Holds the **All mods** toggle (the old DEBUG shelf,
  `LO.debug`) and five saved, persisted variables — Camera zoom, Torch fall-off distance,
  Fog of war darkness, Outside-torchlight darkness, Base movement speed. Values live in the
  `DEV` object (read by `Game` every frame), defaults in `DEV_DEFAULTS`, saved to
  `localStorage` (`caverunner-dev`) via `devSet`; a blank field restores the default. See the
  Dev-panel note in `CLAUDE.md`. **Owner confirmed it works.**
- **v40 — fog of war fixed.** The v38 lamp was a blanket radial gradient that cleared fog on
  every cell in its radius, so on a phone the whole cave read as lit ("fog missing"). Now the
  lamp is **masked by the fog**: it only brightens ground line of sight has already uncovered,
  and never-seen cave stays dark. `SIGHT` (200) is both the reveal radius and the lit bubble.
- **v39 — perks + two hidden rooms + ground loot.** 30 Noita-style perks, one per hidden
  perk room; a second room holds a +25 max-health heart (raises the cap, no heal); collected
  perks show as icons above the thumbsticks; cave loot now rests on the ground. `PERKS` /
  `perkBag` are pure and above `makeLevel`; the run reads one folded bag `pb`.

## The owner's loop (from CLAUDE.md — follow it every change)

1. Edit `index.html` (single file, no build step).
2. Test: `node tests/run.js` (browser env vars below). Add a suite for anything new.
3. Bump the version in **two** places: `<title>` (line 6) and `const VERSION` near the top.
4. Update `README.md` if it's a player-facing change (the Dev panel is a dev tool, so v41
   left the README alone — that was deliberate).
5. Commit, then **get it onto `main`** (working branch + merge is fine). That push is the
   release: CI deploys Pages and rebuilds the APK.
6. **Confirm CI is green** (public API, no token needed — see `CLAUDE.md`'s loop section),
   and that `https://5rob.github.io/CaveRunner/version.txt` shows the new `vNN`. Then the
   owner opens the app and it prompts to update. No artifact publish any more (it and
   `serve.js` remain as fallbacks).

Talk briefly, iterate fast, don't over-plan. Every change works at phone width with touch.

## Testing on this machine (Windows PC)

- `node tests/run.js` — everything. `node tests/run.js logic` — the fast pure ones. A single
  suite: `node tests/run.js <name>` (e.g. `perks`, `torch`, `fog`).
- Browser suites need these env vars (bash) or they silently skip:
  - `CAVERUNNER_PLAYWRIGHT=C:/Users/5robm/AppData/Local/Temp/cr-pw/node_modules/playwright-core`
  - `CAVERUNNER_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"`
- Do **not** run `playwright install`.
- **Known flakes** (pass reliably in isolation, occasionally fail under full-suite load —
  re-run the single suite to confirm; all are enemy-geometry / random-seed sensitive, not
  regressions): `everymod` (telecast), `trigger` (double trigger), and `compare` (a
  found gun that happens not to differ in regen, so "less regen is red" finds nothing —
  seen once during the v47 run, green on its own), and `fog` "the next floor is dark again" (~1 in 4-5 runs a new floor spawns with a few cave cells already visible up the shaft; also fails on v56 code, seed-dependent). See `memory/cardfit-known-failure.md`.

## Testing on the phone over WiFi

`node serve.js` serves the live `index.html` (re-read per request, so a reload picks up
edits) at **http://192.168.86.233:8000/** — the PC's LAN address. A `serve.js` is often
already running from a previous session (starting a second one errors with
`EADDRINUSE`, which is harmless — it means it's already up). If the address stops
answering, the PC got a new IP: `ipconfig`, then update the address here and in `CLAUDE.md`.
Keep `serve.js` index.html-only — a general static server would expose `.claude/`.

## Ideas raised but not built (from CLAUDE.md)

- **Delayed Spellcast** — a static phenomenon that casts three more spells after a pause; the
  trigger/timer machinery already exists (`payload` on a shot, `firePayload`).
- More perks, or the Noita perk reroll (the owner deliberately skipped reroll for now).
- Noita spell categories only partly mined: Material spells, Add Trigger/Timer, Divide By N,
  the Requirement spells.
