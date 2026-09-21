# CaveRunner

A single-file browser game: a jetpack cave shooter with Noita-style wand building.
`index.html` is the whole thing — markup, CSS, React and game loop, no build step.

## How the owner likes to work

**Talk briefly.** Short, concise replies. Minimal technical jargon unless they ask about
something specific — then give them the real mechanism, not a summary. They do ask, and
they want the actual answer when they do.

**Iterate fast, don't plan at length.** They'd rather see the thing working than read a
plan for it. Build the idea, show it, adjust. Don't open a planning session for something
you could just try. Don't ask permission for the obvious next step.

**Don't stress about polish** unless they ask for it. Working beats tidy.

Their words, from the first session:

> This is just a fun personal project, so don't focus on production level
> infrastructure, just keep it simple and focus on just what I ask for. Reduce
> technical jargon to a minimum unless I ask about something specific.

So: do the thing asked, no more. No frameworks, no bundler, no package.json for the
game itself.

They play on a phone through the **installed Android app** (see **The Android app** below),
so **every change has to work at phone width with touch**.

**`node serve.js`** serves the game to their phone over the LAN, for a quick look on the
phone without cutting a full release. They open it on the phone at **http://192.168.86.233:8000/** —
that is the PC's address on their wifi, so it only works while `serve.js` is running on
the PC and the phone is on the same network. If the address stops answering, the PC has
been given a new one: check with `ipconfig` and update the line here.

It answers only for `index.html` — deliberately, because
`.claude/settings.json` in this folder holds an API token, and a plain
`python -m http.server` from the project root would hand that to the whole wifi. Don't
replace it with a general static server.

## The loop we've settled into

1. Make the change in `index.html`.
2. Test it. `node tests/run.js` — see **Testing** below. Add a suite for anything new.
3. Bump the version: `<title>` on line 6 and `const VERSION` near the top of the script.
   This is what the phone's update prompt keys off — see **The version number is not
   optional** below.
4. Update `README.md` — it describes the game for a player, and stays current.
5. Commit, then **get it onto `main`** — that is the release. Pushing/merging to `main`
   triggers CI (`.github/workflows/android.yml`), which deploys the game to GitHub Pages
   and rebuilds the APK. A change isn't delivered until it's on `main`. (Working on a
   branch and merging is fine; the workflow only runs on `main` because Pages needs the
   default branch.)
6. That's it — the owner opens the app and it offers the update. **You don't publish the
   artifact any more.** (The old artifact `https://claude.ai/artifact/2rarFzJoTseCKXhTPwMyLT`
   and `serve.js` still work as a fallback, but the app is the delivery path now.)

**Confirm the release landed.** CI can fail (a runner hiccup, a bad workflow edit). The
GitHub public API needs no token, so check it: `.../actions/runs?per_page=5` for the run,
`.../actions/runs/<id>/jobs` for which step failed, `.../check-runs/<job-id>/annotations`
for the error text (job *logs* need auth, step names + annotations don't). When green,
`https://5rob.github.io/CaveRunner/version.txt` shows the new `vNN`.

Current version: **v54**. Branch: `main` (release channel is `main`).

### The version number is not optional

The app decides whether to offer an update by comparing its own `VERSION` to a
`version.txt` that CI generates from `index.html`'s `const VERSION`. If you don't bump the
number, `version.txt` doesn't change, and **the phone never prompts** — the owner is stuck
on the old build debugging a bug that's already fixed. So **every release gets a new
number**, in both places:

- `<title>CaveRunner vNN</title>` — line 6
- `const VERSION = 'vNN';` — near the top of the script, drawn on screen in-game, and the
  string the update check parses (`VERSION = 'v(\d+)'`, so keep the `vNN` shape)

The number on screen is how they tell you which build they're looking at. Bump it before
you push to `main`, never after.

## The Android app

The owner plays on an installed Android app instead of the artifact link. It's a thin
WebView shell in `android/`; the game itself is still just `index.html`. Full details in
`android/README.md` — the essentials:

- **It plays offline.** The APK bundles `index.html` + React, so no network is needed.
  `index.html` loads React from a CDN (two `<script>` tags, ~line 399); the app rewrites
  those two URLs to the bundled local copies. This happens in **two** places that must stay
  in sync: `android/prep-assets.js` (build time, the bundled seed) and `localize()` in
  `MainActivity.java` (runtime, each downloaded update). **The canonical `index.html` is
  never touched** — the CDN tags stay, so the artifact / LAN / Pages-in-a-browser all keep
  working. If you ever pin a new React version, change both those rewrites *and* the two
  files in `android/app/src/main/assets/`.
- **Updates come from GitHub Pages**, not the PC. On launch the app fetches
  `https://5rob.github.io/CaveRunner/version.txt`, compares it to its own `VERSION`, and if
  newer offers to download the new `index.html` and reload. Any network, no reinstall.
- **CI does everything** (`.github/workflows/android.yml`, runs on push to `main`):
  deploys Pages (`index.html` + a generated `version.txt`) and builds the APK, attached to
  the `app` release tag. It uses the runner's preinstalled Android SDK and a committed
  `android/debug.keystore` (a fixed debug key so the shell installs in place across builds —
  a debug-signed APK is normal for sideloading). Nothing is built on the PC.
- **You only rebuild/reinstall the shell APK when the shell code changes** (rare). Game
  changes never touch it — they flow through Pages. The bundled `assets/index.html` is
  git-ignored and regenerated by CI, so don't commit it; the two React `.js` beside it *are*
  committed.
- **One-time GitHub settings are already done:** Pages Source = GitHub Actions, and Actions
  workflow permissions = read/write (CI needs write to publish the release and to commit the
  keystore on the first run).

## Layout of index.html

Roughly top to bottom:

| What | Where |
|---|---|
| CSS | in `<style>`, one block, light and dark via `prefers-color-scheme` |
| World constants | `CELL`, `CW`/`CH`, `SHOP_*`, tuning consts (`GRAVITY`, `JET`, …) |
| `DEV` / `DEV_META` / `devSet` | live dev-panel knobs, saved to localStorage (see note below) |
| `THEMES` / `themeFor` | the 12 level palettes; the floor number picks one |
| `CREATURES` / `ROSTERS` | the 16 creature types, and which live on floors 1–10 |
| `rosterFor` / `enemyFor` | a floor's creatures, and one creature's floor-scaled stats |
| `MODS` | the 111 spells, each a plain object |
| `FAMILIES` / `FAMILY_OF` | the 8 colour families the UI groups mods by |
| `MOD_PRICE` / `MOD_TIER` | shop price and rarity 1–4 for every mod |
| `PERKS` / `perkBag` | the 31 perks, and folding an owned list into one effective bag |
| `planCast` | **the heart of it** — works out what one pull of the trigger fires |
| `gunRate` / `buildAdvice` | the build advisor |
| `castGroups` / `groupStats` | the outlines and stat lines in the build screen |
| `tracePath` | simulates a shot for the aim line |
| `makeLevel` | terrain, shop, enemies, pickups |
| sprites | `drawRunner`, `drawEnemy` (one per creature body), `drawGun`, `rr` |
| `Game` | the canvas component: `step(dt)`, `draw()`, `cast()`, bullets, fields |
| React UI | `ModCard`, `GunCard`, `PerkCard`, `Editor`, `GunSwap`, `DevPanel`, `App` |

Everything above `makeLevel` is pure and top-level, which is why the logic tests can
load it and call it directly. **Keep it that way** — if a new mechanic can be a pure
function, make it one.

## Things worth knowing before you change anything

**`planCast(g, others)` mutates `g.idx`.** It walks the slot list from wherever the gun
left off. Callers that only want to look (previews, the advisor, `castGroups`) pass a
copy. It returns `{ shots, defs, start, cost, delay, acts, hp, wrap }`.

**Spell kinds.** `shot` (a projectile) and `static` (a field that stays put) each take a
cast slot, so multicasts gather them. `mod` and `util` are modifiers that don't — `util`
also carries an `act` string the game switches on. `passive` works from anywhere on the
gun. A modifier only affects spells drawn *after* it, which is the whole game.

**Copies (the Greek letters) are fiddly.** They push ids into a queue drawn before the
gun's own list, and they must widen `multi` to make room for themselves *and* the
originals they came from, or the multicast limit eats them. They never copy a copy, they
never expand after a wrap-around, and `multi` is clamped to what the gun can actually
produce. Break any one of those and Omega or Myriad runs away. `spells.test.js` covers it.

**The aim line must stay honest.** Anything that changes how a bullet flies has to be
added to `tracePath` as well as the bullet loop, or the line lies. There's a test for
every path mod. **The line only draws with the `trajectory` perk (v50, "Trajectory Sight",
`pb.trajectory` gates the draw block).** Without the perk you aim by feel; `tracePath` and
its tests are unchanged, only the draw is gated. (Not to be confused with the older
`pinpoint`/`Pinpointer` perk, which auto-aims at the nearest creature.)

**Cast delay vs recharge.** Cast delay accumulates in draw order and a few mods (Buzzsaw)
*reset* it to zero rather than subtracting, so position matters. Recharge counts from any
slot. `effRecharge(g)` is the one true answer.

**The advisor prices resources.** `gunRate` scales damage by mana sustain *and* by health
drain, so a build that bleeds you dry isn't credited with damage you'd never live to
deal. If you add a mod that spends something, make sure `gunRate` sees the cost.

**A floor's identity is the floor number, not the seed.** `themeFor(floor)` and
`rosterFor(floor)` are pure functions of the floor alone. Floors 1–10 hand back the same
palette and the same creatures on every run, and that is the feature, not an oversight —
the player is meant to learn floor 3. Only past floor 10 does `rosterFor` take `rnd`.
Don't be tempted to roll either one from the level seed.

**Perks live in `PERKS` + `perkBag()`, both pure and above `makeLevel`.**
`makeLevel(seed, floor, owned)` carves the two hidden perk rooms and returns `rooms`
alongside the rest of the level; `owned` is how it skips perks the player already holds.
The Game closure reads one folded bag, `pb = perkBag(loadout.perks)`, and both `step()`
and `draw()` read off that rather than walking `loadout.perks` themselves. Max health is
`perkBag(perks).maxHp + loadout.maxBonus` — the +25 hearts are `maxBonus`, and they raise
the ceiling only, never heal.

**Enemy behaviour belongs to the creature.** Every enemy carries `e.k`, its floor-scaled
stats, and `e.k.act` decides how it moves and fights: `shoot`, `turret`, `chase` or
`bomb`. `e.k.body` picks the sprite, `e.k.col` its colours. `enemyShots` carry their own
`dmg`, `col` and `size` — there is no global enemy damage constant any more. The enemy
loop runs backwards because a bomber splices itself out mid-loop. If you add a creature,
give it all of those fields and a body that already has a sprite.

**Aggro is line-of-sight to acquire, then sticky (v50).** A `chase`/`bomb` enemy carries
`e.aggro`. It *acquires* aggro only within `reach = k.aggro * sees * DEV.aggro` **and** with
a real `lineOfSight` (the range check is written first so the exact `rayDist` march only runs
for the few enemies close enough to care). Once acquired it **keeps coming** — out of the
initial reach, and round a wall — until you put `reach * DEV.loseAggro` between you, at which
point it drops back to patrol. So you can be spotted, run, and shake it by getting far
enough away, but it won't lose you the instant a wall crosses the line. `hunting` is just
`chaser && e.aggro`. `sees` folds in `1/DEV.zoom` (aggro/fire reach track camera zoom) and
Invisibility. Shooters/turrets still gate *firing* on `lineOfSight + k.range` independently
(they don't use `e.aggro`). **`DEV.aggro`** (v49) multiplies the acquire reach; **`DEV.loseAggro`**
(v50, default 2) is the multiplier from acquire reach to drop reach — both leave firing range
(`k.range`) alone.

**The knob is the bit under the thumb, and the amber ring is a trigger line.** The owner
asked for "the thumb control circles" to be bigger meaning the knobs, not the pads, and a
knob much under 30% of the stick disappears under a thumbprint. `KNOB` is that size and
`AIM_RING` is built from it — `AIM_DEAD * 0.72 + KNOB` — so the amber ring is exactly the
circle the knob's *edge* crosses at the moment the drag starts counting as aiming. It has
to stay a derived number; if you change `AIM_DEAD` or `KNOB` and hardcode the ring, the
circle stops meaning anything. The knob is a white ring with a black fill (v42), and the
amber ring is **dotted** (v44). The old dashed outer `.throw` ring — the edge of the knob's
travel — was removed in v44; the owner found it noise. Don't add a second ring back without
asking.

The stick deliberately has **no `overflow:hidden`**. Four out of five of the knob's radius
travels outwards, so clipping to the rim would slice a bite off it at full deflection.
`.stickclip` holds the wash and the centre line and does the clipping instead, so the knob
can pass the rim as a whole knob.

**The HUD is the thumbsticks now (v46).** The old top-left stack — floor, enemies,
health/fuel/mana bars, equipped-gun name — is gone. `draw()` writes the live stats to
`input.current.hud` (`{hp, low, fuel, empty, mana, recharging, hasGun}`, all 0–1 fractions)
every frame; each `Stick` reads that on its own `requestAnimationFrame` loop and only
re-renders when a value moves by ≥1%, so the gauges animate without churning React. The
**left** stick shows health as an SVG ring round the rim, wiped clockwise from 12 o'clock;
its colour slides green→amber→red with the health fraction via `healthCol(frac)` (v50, on
`mixHex`), so the colour itself reads as danger — independent of the fuel `empty` flag,
which still only reddens the fuel wipe. Fuel is the amber `.jetzone` fill in its top half —
anchored to the centre line (`bottom:50%`), height = fuel fraction, so it drains downward;
it brightens under `.jetting` and goes red under `.dry`. The **right** stick shows mana as
a gold ring the same way (dimmed when there's no gun or it's recharging). The ring geometry
is `GAUGE_R`/`GAUGE_C` + `strokeDasharray`; keep the track circle behind it for legibility.
Only the version (top-left) is still drawn on the canvas; **gold is a DOM readout
(`.gold`) in the gap between the two sticks, just under their tops** (`top:5%`, v48;
`pointer-events:none` so a tap still falls to a stick). It formats with `fmtGold` — a pure
fn above `makeLevel`, covered by `gold.test.js`: a bare number, thousands truncated (not
rounded) to a `k`, then a small `g` (so `1234` → `1.2kg`). It updates because gold changes
already call `input.current.notify()`, which re-renders `App`. The floor
number is painted big and letter-spaced across the shop's back-wall block in `draw()`, a
touch brighter than the wall (`rgba(255,255,255,0.07)`). **Restart moved into the Dev
panel** (`.dbg.restart`, opens the same confirm via `onRestart`), and the Dev button is now
a bare ⚙️ in the top-right (`.devbtn`, class unchanged so the browser tests still find it).
**Death now restarts on a right-stick tap** (v50): the death message reads "Tap the right
stick to restart", and the loop's interact block calls `input.current.requestRestart` (set
by `App` to its `restart`) when `p.dead && interact`, before the near/pickup handling.

**The minimap is drawn on the canvas, bottom-left, ~1/3 the view width.** It is an
`MMW×MMH` offscreen canvas (`miniC`/`mini32`) drawn in the HUD (screen-space) part of
`draw()`. **Rebuilt in v52 for accuracy:** it samples the real `mat` in `MINI_D`×`MINI_D`
(4px) blocks — much finer than the fog grid — and a block is an *outline* cell if a wall
runs through it (it holds **both** rock and open). `enterLevel` precomputes `miniEdgeIdx`
(the list of those cells) per floor; each frame `mini32` is cleared and only the outline
cells whose fog cell is `seen` are painted white (~0.78 alpha), so it fills in as you
explore. The source is finer than the display and blitted with **imageSmoothing on**, so the
walls read as continuous lines rather than the scatter you got detecting edges at the coarse
fog grid (v50–v51). A **yellow dot** (`#ffd23c`) marks the player, mapped from world
`(p.x,p.y)` into the map rect. Height caps at the view height on short screens.

**The Bag button always opens the editor; editing is what's gated (v50).** The deck button
(`.weapon`, class unchanged) is now labelled **Bag** and opens `Editor` anywhere. `App`
passes `canEdit = inShop || Tinker` into `Editor`; when false the editor is **read-only** —
`drop`, gun reorder (`moveGun` in `gunPress`), the advice tips and the Sort button are all
gated, and the footer reads "Viewing only …". Tapping a mod for its info still works. (The
`e`/`tab` key also opens it unconditionally now.)

**Detail cards in the build screen open at the top** (`.pop.top`). The editor's content
reaches the bottom of the screen, so a bottom-anchored card buried the mod bag. Four
separate bugs came from that; don't move it back. One consequence to remember: if the
*selected* gun has very few slots (the starter Pick Axe has one), the sheet above the bag is
short and the bag rides up under the top card — browser suites that tap bag tiles with a
card open should select a roomy gun first (see `buzzsaw.test.js`).

**Starter guns: a weak Scratch Pistol (selected) then a Pick Axe.** `startingGuns()` returns
`[pistol, pickaxe, null, null]` (v51 — the pistol is first/selected, the Pick Axe second, at
the owner's request). The Scratch Pistol is deliberately worse than any floor-1 find (slow
recharge, thirsty, one bolt). The Pick Axe is one slot holding `saw` (Buzzsaw). **Buzzsaw is a melee slice:** `speed: 0`
(no travel), `reach: 5` so it sits just in front of the muzzle (was 10 in v51 — the owner
found it too far), `size: 15` (visual + enemy hit radius). **Reliability (v53):** it carries
`eat: 14`, and the bullet loop's `if (b.eat) dig(b.x, b.y, b.eat)` runs *unconditionally*
every frame it's alive — so it cuts any rock within its radius whether or not its centre is
on rock. That fixed the "only cuts every tenth try" bug, which was `bore` only digging on the
frames the centre point happened to be inside rock. `life: 0.16` per swing; recharge is its
default `rech: -0.17` on the Pick Axe's `1.0` gun recharge, so the swing is ~0.83s.
`setDelay: 0` still zeroes cast delay. (`reach` is a new `blankShot` field, default 10, used
by `spawnShot` and `tracePath`; only Buzzsaw overrides it.) It also carries `hidden: 1` (v53)
— a new bullet flag the draw loop skips, so the slice cuts **without** drawing the big white
circle (which was the round-capped zero-length streak a speed-0 bullet renders). The dig and
the enemy hit-flash are its only feedback now.

**`eat` tunnels through rock (v54 fix).** A bullet with `eat` (Matter Eater `eat:4`, Black
Hole `eat:28`, Buzzsaw `eat:14`) digs its radius every frame *and* — the fix — passes through
rock in the collision check instead of dying on it (`if (b.eat > 0) { dig(nx,ny,b.eat);
continue; }`, alongside the `bore` case; the bounce guard also excludes `eat`). Before, a fast
bolt with Matter Eater moved further per frame (~9u) than its small eat hole (r4) reached
ahead, so mid-frame substeps hit un-eaten rock and it died on the wall — "Matter Eater doesn't
work". `tracePath` already passed through for `eat`, so the aim line was already honest.

**The shop/pickup preview is one panel now (v42), `.buypanel`.** It is **half width**,
centred (`left:25%;right:25%`), and its **bottom edge floats just above the item** rather
than sitting at the screen bottom (v43): `step()` measures the plinth/pickup's on-screen
position from the last frame's `camY`/`unitPx`, stores it as `input.current.promptBottom`
(css px up from the view's bottom, item world y minus 16), buckets it into `sig` so the
panel re-lays-out as the camera settles, and `App` applies it as the panel's inline `bottom`
plus a matching `maxHeight`. It holds the item's card (`ModCard`/`GunCard`/`PerkCard`, all
`ingame`) followed by one `.pbuy` line — `Buy <price>` for shop stock, `Take`/`free` for
anything you pick up. **The stat list (`.prows`) inside the panel gets its own `max-height`
+ scroll (v44, tightened to ~3 rows / 60px in v45)** so a loaded gun or a busy mod can't
make the panel fill the screen; that
scroll box is the one part of the panel with `pointer-events:auto`, the rest stays
click-through so a tap falls to the sticks. A nameless prompt (the heal) has no card, so
`.pbuy` puts its name there instead. The info box no longer floats at the top and there's
no separate `.pickhint` any more.
`.buypanel .pop` strips the inner card's own frame so the panel is the box; it wins over
`.pop.ingame` on source order, so keep the `.buypanel` block *after* `.pop.ingame` in the
CSS. The whole panel is `pointer-events:none`, same as before — buying is still a dead-zone
tap on the right stick. **The mod use-example (`.pdemo`) is dropped when `ingame`** — it's
for the editor, where you're deciding placement; `ModCard` renders it only when not `ingame`.
`.pop.ingame` is still the query in the shop tests, so the inner card keeps that class.

**UI controls fire on `onPointerDown`, not `onClick`.** A click synthesised after a sheet
closes lands on whatever is underneath — that's how the Done button used to restart the
run.

**Mods are taken straight; guns keep the swap chooser (v50).** Standing next to either
shows the buypanel card. An interact tap on a **mod** takes it there and then in the loop's
interact block — pushes `q.id` onto `LO.bag`, `q.taken = true`, `PICKUP_COOL` — no second
screen (a mod has no slot to choose). An interact tap on a **gun** sets
`input.current.found = q`, which opens **`GunSwap`** (the owner asked for this back in v50):
it compares the found gun against your slots and you hold a slot to swap or tap "Leave it".
Buying a gun in the shop drops it as a ground pickup at the plinth, so the same chooser
handles it. The old **`ModFound`** overlay is gone (mods no longer pause the game); the
`Stick` still writes `confirmAim`/reads `confirmAct`, but nothing sets `confirmAct` any more,
so that path is inert — a tap in the dead zone just sets `input.current.interact`.

**The lamp is masked by the fog of war (v40).** The torch lights a bubble around you, but
only where the fog has already been lifted: a cell you have never had line of sight to
stays dark even with the lamp right on it, so the cave ahead is a real unknown. The draw
fog block bakes the visible slab of the overlay every frame — base darkness by fog state
(`seen`), then the lamp brightens the cells `seen` marks as uncovered, brightest at your
feet and fading out to `torchR`. It is NOT a `destination-out` gradient any more; that
version (v38) cleared fog everywhere inside the radius and, on a phone's tall screen, lit
the whole cave so there was no fog left to see — the owner reported it as "fog missing".
The lamp itself does not stop at walls; it is the *reveal* (`fogReveal`, gated by `visPoly`)
that respects them, so ground you have already uncovered round a corner still lights up.
`torchR` is derived from `SIGHT * LAMP_REACH` and breathes with `flick`. Don't turn it back
into a blanket gradient without asking.

**The fog edge is softened and pushed off seen ground (v54).** Two touches in the bake/draw:
(1) a one-cell **dilation** — an unseen cell that borders a seen one (8-neighbour) is baked as
if it were remembered (`dim` + lamp), so the darkness sits a cell further out and you can
actually see the uncovered surface instead of it being right on the edge; (2) a **blur** — the
`FW×FH` fog slab is blurred at source resolution into `fogBlurC` (`blur(0.9px)`, cheap on an
80×200 canvas) and that soft copy is what gets upscaled, so the edge reads as a gradient, not
a hard line. The dilation only changes the *bake*, never the `seen` array (the map memory and
LOS gating are unchanged), so `fog`/`torch` tests still hold. Blur at source (not a
full-screen `ctx.filter`) keeps it affordable on a phone.

**A small aim crosshair (v54): a white dot `DEV.aimDist` out, rotating round you with the
aim.** Drawn in `draw()` right after the gun at `(pcx + ax*DEV.aimDist, gy + ay*DEV.aimDist)`
where `ax/ay` is the aim (or facing) unit vector. `DEV.aimDist` (default 44) is a Dev-panel
row ("Crosshair distance"). This is always on, unlike the perk-gated trajectory line.

**`rayDist` / `visPoly` / `losClear` are exact, and that is the point.** `rayDist` marches
from cell boundary to cell boundary rather than sampling at a fixed step — a fixed step
jumps clean over a one-cell wall — and `losClear` is the same march, which is why a line of
sight and a bullet stop agree. `visPoly` fans `VIS_RAYS` of them out from the player; it
runs every frame in `draw()`, so anything expensive added to it is expensive 60 times a
second.

**An enemy is drawn if the light reaches it.** There is no line-of-sight test on the draw
loop any more, for the same reason the lamp has none. `lineOfSight` is still what the enemy
AI aims and shoots on, so nothing fires through a wall.

**Everything that lights the cave uses one number, `flick`.** The flame, the light's reach
and its brightness all read it, so the cave reads as torchlight rather than as a dimmer
switch. It is clamped to at most 1 because a canvas `globalAlpha` over 1 is silently
ignored — a flicker that overshoots simply stops flickering.

**`SIGHT` is both the reveal radius and the size of the lit bubble (v40).** Line of sight
out to `SIGHT` (200) lifts the fog, and the lamp (`torchR = SIGHT * LAMP_REACH`, ~230) then
lights that lifted ground, so the two move together — bump `SIGHT` and the bubble grows
with it. It stays under `VIEW_W` (360) so the cave beyond the bubble is genuinely dark.
`FOG_DIM` (0.85) is what remembered-but-unlit ground is worth, `FOG_DARK` (0.99) is
never-seen ground — near black, because that darkness *is* the fog of war now. If you widen
`SIGHT` much, the visibility fan spreads and can leak a cell or two round a corner; that is
a `VIS_RAYS` (ray density) tradeoff, not a bug in the reveal.

**The map only gets what was in line of sight.** `fogReveal` takes the fan `visPoly` cast
from the player and skips any cell the fan did not reach in its direction, so ground round
the corner of a wall is never remembered. It runs in `draw()`, every frame. The reach test
takes the *shorter* of the two rays either side of a cell rather than interpolating between
them: interpolating reaches slightly further than either ray and marks cells just past a
corner, which is the one thing this is here to stop.

**The Dev panel (v41) is live-tweak knobs, saved to localStorage.** The **Dev** button sits
by **Restart** in the view (always reachable, not shop-only), and opens `DevPanel`, which
pauses the run but leaves `draw()` running behind a light backdrop so the look-of-it knobs
preview live as you type. `DEV` is a plain mutable object the `Game` reads every frame —
`DEV.zoom` (draw scale), `DEV.torch` (scales the effective `sight`, so reveal and lamp grow
together), `DEV.fogDark`/`DEV.fogDim` (the two fog shades), `DEV.move` (a `WALK`/`JET`
multiplier), `DEV.aggro` (v49, the enemy-aggro-*acquire*-distance multiplier),
`DEV.loseAggro` (v50, default 2, the multiplier from acquire reach to the *drop* reach —
see the aggro note above). `DEV_META` drives the rows; a blank field restores `DEV_DEFAULTS[k]`; `devSet`
writes through to `localStorage` under `caverunner-dev`. Every localStorage touch is wrapped
in try/catch because it throws in a private window and does not exist under Node, where the
logic tests eval this file — a missing store just means defaults, so the load IIFE must stay
guarded. The old **DEBUG** shelf toggle moved into this panel as **All mods** (still class
`.dbg`, still flips `LO.debug`); `cooldown-debug-shop.test.js` drives it through the panel
now. The global key handler early-returns on `input`/`textarea`/`select` targets so typing a
value doesn't also steer the runner.

**Unicode is stored raw** in `index.html` (`·`, `—`, `×`, `Ω`), not as `\uXXXX`. Match the
literal characters when editing with a script, or the edit silently finds nothing.

## Testing

### Write tests into the repo, never the scratchpad

This already went wrong once: every suite was built in the session scratchpad, so when
that session ended the project had no tests at all. They were rescued and committed, but
only because someone noticed.

**Rules:**

- A new test goes in `tests/logic/` or `tests/browser/` from the start. Don't write it in
  the scratchpad "for now" — there is no later, the scratchpad is deleted with the session.
- Commit it in the same commit as the change it covers.
- Throwaway debug scripts (one-off probes, screenshot scratch) can live in the scratchpad.
  If a probe turns out to be worth keeping, move it into `tests/` before the turn ends.
- Don't hardcode machine paths. Logic suites find `index.html` relative to `__dirname`;
  browser suites get Chromium from `tests/chromium.js`. Keep both that way so the suites
  still run on a different machine.
- Don't assume LF, either. A Windows checkout with `core.autocrlf` on hands you `index.html`
  with CRLF, and the logic suites slice the script out on `'<script>\n'`, which then finds
  nothing and every suite fails with a syntax error. They all normalise with
  `.replace(/\r\n/g, '\n')` before slicing now — keep that when adding one.
- Before finishing a session, `git status` — anything untracked under `tests/` is about to
  be lost.

```
node tests/run.js           # everything
node tests/run.js logic     # the fast ones, ~2 seconds
node tests/run.js browser   # Chromium, ~2 minutes, runs one at a time
node tests/run.js advice    # anything matching "advice"
```

**Logic suites** (`tests/logic/`) slice the `<script>` block out of `index.html`, eval it,
and call the pure functions. ~1250 checks. Add to these first — they're fast and they've
caught most of the real bugs.

**Browser suites** (`tests/browser/`) drive the real page in Chromium through
`playwright-core`. `tests/build.js` makes `tests/build/test.html`: the game with React
served from `tests/lib/` and two debug hooks, `window.__in` (the input ref — loadout,
guns, bag, prompt) and `window.__lvl` (the live level — player, enemies, bullets, fields).
If a suite needs to reach something new, add it to the hook in `build.js` rather than
reaching into the game from the test.

`tests/chromium.js` finds Playwright and a Chromium wherever this machine keeps them, so
no suite hardcodes a path; override with `CAVERUNNER_PLAYWRIGHT` and `CAVERUNNER_CHROME`.
The runner skips the browser suites if there's no Chromium to drive. On this environment
it's the preinstalled one at `/opt/pw-browsers/` — don't run `playwright install`.

Two suites are worth knowing about: `everymod.test.js` equips and fires all 108 mods in
the real game and checks each puts something into the world, and `smoke.test.js` plays a
short run and asserts no page errors.

**Measure, don't assert.** This project has a habit of proving things rather than
claiming them — flood-fill the cave to prove tunnels connect, count buried bullets before
and after a bounce fix, screenshot the build screen to check a card fits. It has caught
several things that looked fine. When a test disagrees with you, check which one is
actually wrong; it's been both.

## Where to look when something breaks

- Terrain sealed off or unreachable → `tests/logic/level.test.js` flood-fills 20 seeds.
- A floor looking wrong, or a creature that isn't behaving → `tests/logic/creatures.test.js`
  covers the tables; `tests/browser/creatures.test.js` climbs five floors in the real game
  and checks each one's palette, roster and behaviour.
- Seeing through a wall, or an enemy appearing through one → `tests/logic/vision.test.js`
  (the fan and the line of sight, cheap) and `tests/browser/torch.test.js` (the light read
  off the real canvas: falloff, flicker, shadow, hidden enemy).
- A mod doing nothing → `tests/browser/everymod.test.js` will name it.
- Aim line wrong → the mod is in the bullet loop but not `tracePath`.
- Build screen card covering something → `.pop.top` height cap and the sheet layout.
- Editor slow → `buildAdvice`; it shortlists for a reason (`SHORTLIST`).

## Ideas raised but not built

- **Delayed Spellcast** — a static phenomenon that casts three more spells after a pause.
  The trigger/timer machinery now exists (`payload` on a shot, `firePayload` in the bullet
  loop, v31), so this is a much smaller job than it was.
- Noita spell categories we only partly mined: Material spells (none), and the rest of
  Other (Add Trigger / Add Timer, Divide By N, the Requirement spells).
