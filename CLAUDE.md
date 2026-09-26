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

Current version: **v88**. Branch: `main` (release channel is `main`).

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
- **Updates come from GitHub Pages**, not the PC. On launch, on every `onResume`, and every
  2 minutes while open (v67 shell: a `Handler` `poll`, never stacks two dialogs) the app fetches
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
| `MODS` | the spells, each a plain object (`off: 1` = kept but never handed out) |
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

**v75: the map is a toggle, not a corner minimap.** Everything below about `miniC`/`miniEdgeIdx`
still holds, but it is drawn only while `input.current.mapOpen` (the `.mapbtn` / `M` key, which
also pauses), at the very end of `draw()`, over the play area on solid black, fitted and centred.
Suite: `tests/browser/map.test.js` (replaced `minimap.test.js`).
**(Old, pre-v75:) The minimap is drawn on the canvas, bottom-left, ~1/3 the view width.** It is an
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

**A small aim crosshair: a `+` with the centre cut out, `DEV.aimDist` out, rotating round you
with the aim.** Drawn in `draw()` right after the gun at `(pcx + ax*DEV.aimDist, gy +
ay*DEV.aimDist)` where `ax/ay` is the aim (or facing) unit vector — four short strokes (two
vertical, two horizontal) with a gap in the middle (v55; was a dot in v54). Small — arms
`inr:1.25`→`outr:3` world units. Line width is `1.5/unitPx` world units so it's ~1.5 css px
(as thin as the stick lines) at any zoom.
`DEV.aimDist` (default 44) is a Dev-panel row ("Crosshair distance"). Always on, unlike the
perk-gated trajectory line.

**The right stick has three rings (v55): mana, recharge, cast delay.** So you can see which
one is gating your fire. Colours are shared with the bag via `GAUGE_COL` (mana gold `#ffc93c`,
recharge blue `#7ad7ff`, cast delay purple `#c58cff`) — the bag's `cast delay`/`recharge`/`mana`
stats are tinted the same, so a ring and its stat read as one thing. Each ring is a
"readiness" wipe: `1` when ready, dropping to `0` the instant it fires and filling back over
its own time, so the ring that lingers low is the bottleneck. `hud.rech` = `1 - rechT/(effRecharge*pb.rech)`;
`hud.cast` = `1 - delayT/delayMax` (`g.delayMax` is stored in `cast()` when `delayT` is set,
since the effective cast delay varies with mods). The left stick keeps its single health ring.
The `Stick` builds them with a `wipe(r, frac, col)` helper; the three are stacked **flush at
the outer edge** (radii `GAUGE_R`, `GAUGE_R-rw`, `GAUGE_R-2*rw` with `rw=3.2`, so their
strokes touch with no gap). The single left ring is stroke `4.5`.

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

**v56 visuals + Black Hole.** `motes` is one particle list with three kinds: `drift` (Black Hole trail), `in` (spawned round the exit `portal`, pulled to its centre with a sideways sine wobble, fade in from 0) and `out` (breathed out of `arrival`, wafting, fading to nothing by distance `fade`, then killed). Drawn additive. **Black Hole** (`b.pull`): reach is `DEV.bhPull * b.pull / 70` (v57), drag grows toward the centre and is capped so it never overshoots; it does not die on an enemy (`continue` in the hit block) and clears `b.hit` every 0.3s so it grinds; enemy shots within reach bend in and die at `size+6`. It draws its own look (haze + black starry core) and skips the streak. The hand torch flame is `drawFlame` — teardrops whose tip is `leanX/leanY`, a spring toward "opposite your velocity". Its halo and small second light, and the wall `sconces` (built in `enterLevel`: either side of both portals and each room prize), are drawn **after** the fog with `lighter`, so the map lighting is untouched; a sconce only shows once its cell is `seen`. Background parallax is `PARALLAX` (0.8) in `draw()`; the bg image gets big fbm shadow blotches in `makeLevel`. `tests/browser/blackhole.test.js` covers all of it. **v57:** the Black Hole digs only its drawn black core (`eat: 19`, and the draw uses `core = b.eat`, so they cannot drift apart). Two Dev knobs: `DEV.bhPull` (max pull range, default 154) and `DEV.bhSpeed` (travel speed, default 140 — applied as the multiplier `bhSp(sh)` at spawn *and* in the aim line, so speed mods still stack and the line stays honest). The Dev panel's **Copy all dev settings to clipboard** button (`.devcopy`) copies `devReport()` — the changed values with their DEV keys and old defaults. When the owner pastes that, set those numbers as the new `DEV_DEFAULTS`. If the clipboard is blocked (a WebView can refuse), it shows the text in a box to long-press and copy instead. `tests/logic/devsettings.test.js` covers it.

**v58 level decoration: pass 2 (bakes) and pass 3 (props).** `DECOR` (one list of five per
theme, indexed like `THEMES`) drives it; `decorate(mat, img, dimg, bgImg, floor, seed, keep)`
is pure, sits above `makeLevel`, runs at the end of it on **its own RNG** (so seeds still make
the same caves/enemies/loot), and returns `{ props, amb, baked }`. Three sorts of entry:
`bake` paints pixels — onto rock in `img` (moss, cracks, fissures, pickaxe heads; dig erases
them for free), into `dimg`, a full-size **non-colliding decoration layer** drawn between the
background and the rock (rubble, beams, pillars, gears, ribs; `unDeco` in `dig`/`explode` wipes
it), or darkening `bgImg` (soot). Only `algae` touches `mat`, and only ROCK→BRICK (still solid —
the logic test checks the solid/open shape never changes). `amb` is a theme-wide particle kind
spawned round the camera in `stepAmbience`. Everything else is a **prop**: a plain object
`{ id, k (kind), st (style), x, y, l, t0, r, b (box about x,y), anc, hang, side, ... }`, **never
in `mat`**, so enemies fly and you walk straight through props — they only act via box overlap.
`cullDecor` drops overlapping props and keep-out spots at load. **Anchors:** `decorStep` checks a
thirtieth of the props per frame with `propAnchored` (the anchor cell or either neighbour); a
prop that's lost its rock gets `fall` and drops; `landProp` breaks it, blows it (carts, pods) or
settles it (floor things). Player effects go through `zfx` (`slow`, `slick`, `climb`, `rev`),
written by `decorStep` and read by the **next** frame's steering: climbing happens when on a
climbable and **not** jetting (hang + fuel regen; stick climbs at `CLIMB`). Shootable props
(`cover`, carts, pods, stones, salt spikes) catch bullets in `decorStep` by setting `b.life = 0`
(so payloads still fire); pass-through shots (`pull`/`eat`/`bore`) count once via `b.propHit`.
`drawProp` draws before the fog; `propGlow` (lamps, vents, shards, eyes, matter, lava) adds
light after it, only on `seen` cells — except the eyes, which fade as you approach
(`eyesAlpha`). Snow's "cushions falls" isn't built — the game has no fall damage.
Tests: `tests/logic/decor.test.js`, `tests/browser/decor.test.js` (hooks: `__lvl.props`,
`dparts`, `amb`, `clouds`, `rings`, `zfx`).
**v59:** every entry's count is `n * DECOR_DENSITY` (3). Hanging plants (`PLANTS`: vine, myc, root, kelp)
never come alone: each placement brings a `clump` of 1–3 more, and `GROVES` (14) patches per
floor get 14–25 plants at a distance uniform in 0..r (so densest in the middle) plus the
`overgrow` bake (moss into rock, grass, drapes, leaves, the odd flower) with a chance that fades
to nothing at 1.5r. `cullDecor` lets plants overlap each other, nothing else. Plant length is
capped so none hangs into the shop. **Torches do NOT clear fog (v61, reverting v59's `torchFog`):** clearing
fog round them gave away every prize room on arrival. Wall torches, lanterns and every glowing
prop/particle drawn after the fog are gated by `fogLit(x, y)` — its fog cell or any 8-neighbour
`seen`, the same one-cell soft edge the fog bake uses — so a torch shows exactly when loot at the
same spot would. `fog`/`decor` browser suites check rooms and cave torches start hidden. **Dev panel groups:**
each `DEV_META` row has a `g`; `DEV_GROUPS` gives the collapsible sections (`.devghead[data-g]`),
all shut by default, open state kept in localStorage `caverunner-devgroups`.

**v60 triggers are Noita-style variants.** No stand-alone trigger spells: `TRIG_VARIANTS`
(below `MOD_TIER`) builds `bolt_t`, `arrow_ti`, `void_d` etc. from a base spell, adding
`trig` ('hit' | 'timer' | 'expire'), `draw`, `timer`, `mark` (the tile's corner badge). Add
Trigger/Timer/Expiration (`addTrig` mods) make the next *shot* a carrier. In `planCast` a
carrier calls `payloadOf(draw)` on the spot: a mini-cast with its own mods/multicasts/nested
triggers, isolated both ways from the main pull (depth cap 6, one shared wrap, and `took` stops
a wrap redrawing anything drawn this pull). In the game: 'hit' fires on first enemy/rock/prop
contact (`b.struck`) and is **lost on plain expiry**; 'timer' fires when `b.timer` runs out
and the carrier flies on; 'expire' fires on any death; beams release at their end, crystals when
they go off (`fieldPayload`). **Greek letters are `off: 1`** — `ALL_IDS`/`SHOT_IDS` skip them;
their planCast code and `spells.test.js` checks are kept for bringing them back. Summon
Platform/Wall were deleted (v60).

**Sound (v64): all procedural, Web Audio, no files.** Pure part above `makeLevel`: `SPELL_VOICE`
(spell id → theme voice; trigger variants use `MODS[id].base`), `shotSound(sh)` (recipe from a
shot's *final* stats: pitch from speed/size, vol from dmg×count, dur from size, plus flags
`wob` homing-ish, `grit` explode/bore/eat/cluster, `bright` pierce/crit, `boing` bounce, `n` pellet
flam), `BODY_VOICE`/`CREATURE_TONE` + `creatureSound(k)`, `AMBIENCE` (per theme *name*: noise
bed, drone Hz, one-shot `ev` rates) and `AMB_EVENTS`. Shots know their spell via `sid` in
`blankShot`. The engine is the `SFX` IIFE: lazy `AudioContext` made in `SFX.unlock()` (App's
`grab` on pointerdown + keydown), master compressor, two buses (sfx `DEV.vol`, ambience
`DEV.vol*DEV.amb`, both Dev-panel rows in the **Sound** group). `out(x,y)` does distance
attenuation, pan and far-muffle relative to `SFX.ear` (set each step), drops sounds past `HEAR`
or over `MAX_VOICES` (your own cast and UI sounds are priority). Every public call is wrapped by
`safe()`: an error is pushed to `SFX.stats.errors` and swallowed — sound must never break the
game; the tests assert that list stays empty. Loops (`SFX.loop('jet'|'void')`) must be `set()`
every frame or `SFX.tick()` (called every frame, even paused) fades them — that's how pause and
dead Black Holes go quiet; Game keeps `jetLoop` and `bhLoops` (Map bullet→loop, max 3). Ambience
is `setAmbience(themeName)` in `enterLevel`; `tick()` starts it once unlock finishes (resume is
async). Hooks are one-liners at the events (`SFX.cast` in `cast()`/`releaseAt`, `SFX.boom` in
`explode`, `hit`/`rock`/`bounce` in the bullet loop, `SFX.creature(k, 'alert'|'idle'|'fire'|
'charge'|'hurt'|'die'|'bite'|'fuse')` in the enemy code, `SFX.ui(...)` for pickups/shop/hurt/portal).
**v65 foliage + prop sounds.** `rustleStep(st, dt, touching, entered, speed)` (pure, tested) is
the anti-spam: entering a plant / grabbing rustles now, moving inside rustles every
`(0.42-0.24*s)*rand` s, still = silent, and every rustle starts a random pause (≥0.16s), so a
clump can't machine-gun. `decorStep` collects `plantsNow` (climb props whose `st` is in
`PLANTS`) and compares with `plantsLast`. `SFX.rustle(x,y,str,style)` rolls count/timing/pitch/Q
of its leaf crackles and swish each call (`RUSTLE` ranges per plant style). `blowProp`: minecart
→ `explode` (boom) + `SFX.debris`, pod → `SFX.pop`. `boom` now rolls pitch/length/tail too.
Rule the owner set: repeated sounds should be **randomised per play**, not one fixed recipe.
**v66 fills in the rest: `SFX.fx(name, x, y, a)`** — one table (`FX`) of small, per-play
randomised recipes with per-name minimum gaps (`FX_GAP`); `SFX.FX_NAMES` lists them and the
browser suite plays every one. Portals: `portalIn` when you enter the exit, `portalOut` ~0.26s
later at `arrival` (from `enterLevel`, so a new run gets it too), and a positional `'portal'`
loop humming at the exit. `'matter'` loop at the nearest dark matter (`matterProps`).
Footsteps: `stepT` in step() after `p.onGround` (cadence `|vx|/40` per s), `land` when
`fallV > 200`; both take `zfx.surface` (set by the standing zone's `st`; `surfaceHit` voices
rock/snow/ice/slime/puddle/ash/glass/log/acid). Props: `shatter` by `MATERIAL[pr.st]`,
`coverHit`, `iceCreak` (icicle shake), `propLand`, `skulls`, `resonate` (stones), `ventWarn`/
`ventFire` (on state change), `shroom`, `lash` (tendril out), `eyes` (once per prop), `sparks`,
`steam`, drip particles carry `snd` (`drip`/`sizzle`/`splash`) played on landing. Combat/other:
`crit` (in `critRoll`), `chainhop`, `split`, `cluster`, util acts (`refresh`, `drain`, `gspend`,
`saws`, `warp`), `fizzle`/`absorb` for enemy shots, `healtick`, `shieldUp`, `ghost`,
`coinland`, `ready` (held gun finishes a recharge ≥0.45s, `g.rechLen`), `switch`, `ignite`,
`whirl` (dust devils), UI `open`/`close` (Editor, GunSwap), `place`, `prompt` (card comes up).
**v67 volume knobs:** besides `vol`/`amb`, the Sound group has `jetVol`, `vSpell`, `vBoom`, `vHit`,
`vEnemyFire` (creature fire/charge/fuse + enemy-shot fizzle/absorb), `vEnemy`, `vWorld`, `vStep`, `vUi`.
Each one-shot passes `knob(key)` as `out()`'s 6th arg (`vol`); loops pick theirs by kind in `set()`;
`fxVolKey(name)` (pure, table `FX_VOL`) maps each `SFX.fx` name, default `vWorld`. A new fx sound
that isn't world/props needs a `FX_VOL` entry. **To add a spell:** give it a `SPELL_VOICE` entry (the logic test fails otherwise). New creature:
it falls back to its body's voice. New theme: add an `AMBIENCE` entry (tested). Tests:
`tests/logic/sound.test.js`, `tests/browser/sound.test.js` (plays every voice, BH loop lifecycle).

**Jetpack cough + pitch (v67).** `sputterStep(st, dt, fuel, on)` (pure, above `makeLevel`,
`tests/logic/jetpack.test.js`) cuts the jet out for 0.04–0.17s at random below `SPUTTER_FUEL`
(0.25), more often the drier it is, with a gap after each. `p.jet` is still the stick (physics,
ignite sound); `p.flame` is `0` during a cut and is what the flame, smoke, nozzle glow,
Levitation Trail and the jet loop's volume read. A cut: no lift (gravity), `vy += DEV.sputDip`
(Dev → Player, "Jet sputter drop", default 45) and grey puffs (`smoke` entries with `c`/`a`);
`p.cough` briefly stops the "rising beats a fall instantly" snap so the dip isn't erased. The
jet loop's filter pitch is `× jetPitch(jetSt.onT)` — 1 → 1.7 over 3s held (`set(level,x,y,pitch)`).
`tests/browser/jetpack.test.js` checks it in a sandbox.

**Autosave (v63).** `SAVE_KEY` (`caverunner-save`) in localStorage. `readSave`/`cleanLoadout`/
`cleanGun` are pure, above `makeLevel`, and forgive old saves: unknown mod/perk ids are dropped,
missing gun fields filled from `GUN_DEFAULTS`, `sel` moved to a real gun. `App` loads it once
(`useState(loadSave)`) into the loadout and hands `input.current.saved` to `Game`, which calls
`enterLevel(back)`. The save stores the cave's `seed` and the perks owned on entry (`owned` —
`makeLevel` reads it, so the same seed needs the same list), plus alive enemy `sid`s (tagged
by index in `enterLevel`), sold stock and taken rooms by index, and the ground pickups whole
(guns get swapped on the ground). **The cave only comes back when `ver === VERSION`**; after an
update gear + floor + hp survive on a fresh cave, since the generator may have changed. You
always respawn at the floor start (dug terrain isn't saved). `saveRun()` runs every 2s, on
floor change, `visibilitychange`→hidden and `pagehide`; death and Restart call `clearSave()`.
In the Android app the page origin is fixed (`appassets.androidplatform.net`) and DOM storage
is on, so localStorage survives game updates and in-place APK reinstalls — **don't change
`LOCAL_URL`'s host or the save is orphaned**. If you add a loadout field, add it to
`cleanLoadout` or it is dropped on load. Tests: `tests/logic/save.test.js`,
`tests/browser/save.test.js` (note: `pagehide` re-saves on reload, so the browser suite forges
an old save via `addInitScript`).

**v68 dev + tweaks.** Minecart blast radius 60 (was 30). Enemy Radar marker is the perk's red
tint (`PERKS.eradar.tint`), not `COL.enemy` purple. **Dev → Spawn gun** (`.dbg.spawngun`) closes
the Dev panel and opens `SpawnGun` (`.spawnpanel`, pauses via `spawnOpen`): a level box
(`.spawnlvl`, defaults to the current floor via `input.current.floor`) and a Spawn button
(`.spawngo`) that sets `input.current.spawnGun = level`; `step()` then drops `caveGun(level, rnd)`
(pure: `makeGun(rnd, lvl)` at the entered level, capped 10, no rare roll) just in front of
you. **Trajectory line fades with the push:** `R.vis = min(1, TR.mag / AIM_DEAD)` (mouse/keys = 1),
multiplied into the line's alpha. Tests: `gunshop` (logic), `tests/browser/spawngun.test.js`.

**v69 gun levels (the owner's rule: no cave-height influence).** `gunTier`/`FLOOR_TIER` are gone.
`makeGun(rnd, lvl)` takes a **level 1–10**; `gunLvTier(lvl)` = `(lvl-1)/9`. Each stat has a
`[worst, best]` in `GUN_RANGE`, and `gunStat` rolls a fraction `u1*(1-t) + u2*0.1*t` of the way
from best to worst: level 1 = anywhere in the range, level 10 = the best tenth. `multi` chance
`0.1+0.4t`, `shuffle` chance `0.5(1-t)`. Cave guns: `gunLevel(floor, rnd)` = the floor's level
(capped 10), or with `RARE_GUN` (0.2) a uniform level from floor+1 to 10. Shop guns are the floor's
level. `g.lvl` is saved with the gun; `gunAccent` (sprite colour) and the GunCard glyph use
`GUN_LV_COL[lvl-1]`; starter guns have no `lvl` and keep the family colour. Tests: `gunshop`.

**v70.** `GUN_RANGE` widened by the owner: slots 2–25 (makeGun's cap clamp is 25), delay and
recharge 1.5–0.01s, mana 50–1000, regen 10–500, spread 20–0, speed 0.5–2. Prop drips no
longer share one accumulator phase: each keeps `pr.dn` (countdown) / `pr.di` (a random
interval, 0.3–1.7× the mean from `DRIP_RATE`); `pr.acc` is still written as the swell
fraction the drip sprite reads. Drip sounds (`FX.drip`, ambience `drip`) about 1/3 and 1/2 as loud.

**v71 bag screen rebuild (owner's layout).** Top row `.btop`: `GunStats` (`.gstats`, one
`.gsrow[data-stat]` per `GS_ROWS` entry — label in `GAUGE_COL`, value coloured
`healthCol(statQual(k, v))`, a `<u class=up|down>` delta from `gunModDeltas(g)`) beside a 2×2
`.gtabs` grid of square `.gtab` buttons (name + `GunIcon`, a small canvas using `drawGun`).
Then `SlotGrid`: `.slotRow` (the scroll box) > `.mgrid` (CSS grid, square tiles). Slots never
regroup; each tile carries `data-pull` from `pullSteps(g)` (pure: filled slots in cast order,
tagged with their pull, built on `castGroups`; null when shuffled), never-cast mods get
`.cold`. A `.pulse` overlay walks the steps at `DEV.bagAnim` slots/s (Dev → Bag screen),
colour `PULL_COL[pull]`; earlier steps of the same pull stay lit (`trail`). SlotGrid owns its
own interval so the Editor/`buildAdvice` don't re-render per tick. The bag is `.bag` > `.mgrid`.
The per-pull outlines/stat lines (`.grp`, `.glab`, `.fx`) and the family legend are gone
(`groupStats` is still pure and tested; `bulletgfx.test.js` was dropped). The advisor stays,
tips on one side-scrolling line. `castGroups` now allows 64 pulls (was 16 — 25-slot guns).
Tests: `tests/logic/bagui.test.js`, `tests/browser/grouping.test.js` (rewritten for the grid).
**v72:** advisor tips parked — `SHOW_TIPS = false` (above `GunStats`) hides the `.tip` buttons; the
`.diag` dmg/s line still shows. The bag gets the freed height (`.bag` flex 1.5 vs `.slotRow` 1).
`advice.test.js` checks the diag and that no tips show; restore its tip checks from git (v71) when un-parking.
**v73 fire preview.** The walking light is replaced by a live "trigger held" sim: `fireSimNew(gun)` /
`fireSimStep(S, dt)` / `fireSimGauges(S)` (pure, above `makeLevel`) replay the Game's `cast()` +
per-frame gun tick on a *copy* (planCast, cast delay, `effRecharge` after a wrap — both count down
together, mana drain/regen, 0.12s retry when starved; no perks). `S.lit = {slots, pull, t}` is the
pull just fired (trailing non-casting modifiers trimmed). Editor keeps one sim in a ref, rebuilt when
`gsig` (sel + slots + multi/shuffle/delay/recharge) changes; `SlotGrid` steps it in rAF at
`DEV.bagSpeed` × real time (Dev → Bag screen, key renamed from `bagAnim`) in 0.01s sub-steps and
re-renders only when `S.lit` changes; `GunStats` has its own rAF writing the three `.gsbar i[data-live]`
widths (cast delay / recharge / mana, `LIVE_BAR`) straight to the DOM. Only those three rows have
bars (owner: none on stats that aren't firing resources/timers).
**v75 see-through deck.** `.view` is `position:absolute;inset:0` and `.controls` floats over its
bottom with no background (pointer-events only on `.stick`/`.dbtn`). App measures the controls'
height into `input.current.ctlH`; `draw()` scales and frames the camera to `playPx = c.height -
ctlH*dpr` (the area above them) but still draws/culls the full canvas; toasts and radar markers
use `playPx` too. The toolbar is gone: `deckLayout(W, size, n)` (pure, above `makeLevel`) places
round `.dbtn` buttons — the four guns (`.slot`, `GunIcon` inside, `.on` = held, hold for card) on
an arc centred on the right stick from the gap between the sticks, clockwise over the top to near
the right edge; the bag (`.weapon`, 🎒, `aria-label="Bag"`) mirrors the last gun on the left; the
map (`.mapbtn`, 🗺️) sits above it. All gauge rings are thin (`sw` 1.6, spacing `rw` 3.2). Left
stick: health ring outside, fuel ring (`GAUGE_COL.fuel`) inside it, red track when dry — the
`.jetzone` fill is gone. Sticks/knob have no fill. Gold sits at the bottom of the gap (`bottom:5%`).
**v79 grab bars on the bag screen grids.** `ScrollBox({ cls, drop })` (above `SHOW_TIPS`) wraps the slot grid
(`.slotRow`) and the mod bag (`.bag`): a `.sbwrap .<cls>W` wrapper takes the sheet sizing (`.slotRowW`/`.bagW` hold
the flex/min-height/margins now), the scroll box fills it with 26px right padding, native scrollbar hidden, and a
`.sbar` strip down the right edge you tap (jump) or drag (thumb keeps your grip) — pointer events, so touch
and mouse both work; the thumb tracks `scroll` + a ResizeObserver. Empty slots (`.tile.hole`) are
`touch-action:pan-y` so a swipe that starts on one scrolls natively; mods stay `none` (they drag). The inner
boxes keep the `.slotRow`/`.bag` classes, so every `.bag .tile` / `.slotRow .tile` selector still works.
Suite: `tests/browser/scrollbar.test.js` (real touch via CDP `Input.dispatchTouchEvent` —
`synthesizeScrollGesture` with touch doesn't scroll in this headless Chrome, don't trust it).
**v76 the spider (Hämähäkki, `act: 'spider'`, `body: 'spider'` → `drawSpider`).** Pure part above
`makeLevel` (after `losClear`): `surfNormal(x,y,R,solidCell)` (average direction from the rock cells in a
disc to the centre = smoothed normal, plus `d`/`px,py` = nearest rock and the way out), `spiderSeat` (push
straight out of rock nearer than `SPIDER.hold`, else pull in along the normal — this is what stops pixel
snagging), `spiderAim`, `spiderStep(e, env, dt)` (state on `e.sp`: mode `fall|surf|line|shoot`). Bursts
(`S.on`) and rests (`S.rest`); `decide()` at each burst start: goal = player when hunting, else a roam spot
drifting round home. On rock: goal·normal ≥ `DEV.spDot` → ride a line within `spGrab` heading that way, else
shoot a line (`spiderAim`, ≤ `spWeb`, rate-limited by `spRoamWeb`/`spHuntWeb`), else walk the tangent. Lines
live in the Game's `webs` (anchors `a0/b0` drawn, `ain/bin` points inside rock checked a few per frame — dig
one out and the line drops, riders fall). `silk` = strings in flight, `strings` = stuck to you (`ax,ay`
anchor + offset on the player); `tied = DEV.spSlow ^ strings.length` multiplies all steering; a string past
`spSilkMax` snaps. **Every tunable is a Dev knob in the Spider group (`DEV.sp*`)** — the owner asked for that;
`SPIDER` keeps only body geometry. Tests: `tests/logic/spider.test.js` (hand-made grids: bumps, ledge, gap,
dig-out), `tests/browser/spider.test.js` (sandbox: land, string, slow, snap, bite). Hooks: `__lvl.webs/silk/strings`. **v77 fix:** a spider must always have a clock running — if `decide()` finds nothing to do it gets a 0.1–0.3s retry rest; before, arriving left `on` and `rest` both ≤0 and it froze for good (~40% of floor-1 spiders). The logic suite now runs every spider on three real floor-1 caves for 40s and fails if any sits still.
**v78: web lines are vines, and every spider knob is a range.** `decorStep` checks the player against `webs` (`webDist`
from the hands, `p.y + WEB_HAND`, and the centre): each line touched multiplies `zfx.webMul` (its own rolled
`L.slow`), and the nearest within `L.grab` becomes `zfx.web` + `zfx.climb`, so `climbing` latches it like a vine
(hang, fuel back). The steering branch for `zfx.web` runs you *along* the line (stick · line direction ×
`L.climb`) and springs your hands onto it; pushing down (not along) sets `webLetGo` 0.35s and drops you.
`tied` = product of each string's `s.slow` × `zfx.webMul`. **Owner's rule: every spider Dev control is a min/max
pair and each use rolls a fresh number between them** — `SP_KNOBS` (above `DEV_KEY`) generates `k+'Lo'`/`k+'Hi'`
defaults and two Dev rows each; `spr(k, rnd)` is the roll. Rolled per use: burst length/rest/speed/arrive/dot per
burst, grab/reach per decision, line speed + web cooldown per shot, max lines per new line, roam radius/drift when
the roam spot turns back, aggro reach once a second per spider, silk range/speed/cooldown per string shot, bite
damage/cooldown per bite, slow + snap length per string stuck on you, and slow/grab/climb once per web line (stored
on it, so a line doesn't flicker). Adding a spider knob: add a row to `SP_KNOBS` and read it with `spr`.
**v81: the jellyfish (Myrkkymeduusa, `meduusa`, `act: 'jelly'`, `body: 'jelly'` → `drawJelly`) replaced
Heikkohiisi on floors 1–2, and the reusable creature pieces.** Owner is reworking every enemy one at a time, so
the shared parts are now modules — **reach for these first when reworking the next creature:**
- `rangeKnobs(group, rows)` registers a creature's min/max Dev knobs (`SP_KNOBS`, `JE_KNOBS` use it; add a
  `DEV_GROUPS` entry too). `kr(k, rnd)` rolls one (`spr` is the same function, kept for the spider's code);
  `kru(k, u)` is the value at fraction u — for looks rolled once per creature (`S.u.*`) that still update live.
- `roamStep(R, e, dt, rnd, pre)` — the roam spot drifting round home (spider and jelly both use it).
- `turnToward(a, to, max)` — turn-rate limit. `flyMove(e, V, dt, r, solidCell, bounce)` — free flyer moved by
  its velocity in sub-steps, pushed out of / bounced off rock via `surfNormal`.
- **`kp` on a creature** (`'sp'`, `'je'`) = "reworked, runs its own step". The enemy loop then: rolls its aggro
  reach from `kp+'Aggro'` once a second, uses `kp+'Bite'`/`kp+'BiteCd'` for contact damage, skips the hover
  bob (`e.ty = e.y`), and `damageEnemy` sets aggro. `HUNTERS` (act → 1) is who uses the aggro system (was a
  hardcoded `chase||bomb||spider` in three places). `k.glow` (rgb string) + `kp+'Glow'/'GlowR'/'Flare'` knobs
  = an additive glow after the fog, gated by `fogLit`, flaring with `e.je.shape`.
- **Enemy shots take optional `goo`, `drip`/`dripG` and `splat`/`splatV`** (any creature can use them):
  `goo` draws a glob, `drip` sheds falling particles per second, `splat` bursts on rock/player (`splat()`,
  `goo()` in the Game; the particles are `sparks` with their own gravity `g`).
**The jelly** (`jellyStep`, pure, state on `e.je`): heading `hd` = its head, turned by `turnToward`. A pulse is a
thrust along the head over `jePushT` adding up to the rolled push speed, only when the head is within
`jePushTol` of where it's going; then `exp(-drag·dt)` damping + a small sink. Roaming goal = roam spot (idle
near it, it rights itself head-up); hunting goal = you, no pulses once within `jeRange × sees`, and the Game
spits from the head when `S.inRange && S.aimed` and it has line of sight. `S.shape = 1 - (1 - v/vref)^jeThin`
(thin at speed, flat at rest, weighted thin). `jellyBell(r, shape, squash)` is the outline both the tentacle
roots and the sprite use. Tentacles: `jeTents` × `jeVerts` world points, follow-the-leader at a fixed spacing
with sway + droop, drawn as one tapered ribbon each (owner liked the tips folding back freely — no stiffness).
~36 knobs in Dev → Jellyfish.
**v82: tentacles sting, and colour knobs.** `segHitsBox` (exact line-through-box, Liang–Barsky) + `tentacleTouch(S,
box)` (pure): in the jelly branch, any tentacle segment crossing your box stings (`jeBite`/`jeBiteCd`, shared `e.touch`
cooldown with the bell), hunting or not. **Colour knobs:** `colourKnobs(group, rows)` is `rangeKnobs` for colours —
each part a colour A (`k+'Lo'`) and B (`k+'Hi'`) as `'#rrggbb'` strings, `type: 'color'` in `DEV_META` (DevRow shows a
colour picker + ↺ reset; the DEV loader accepts hex strings for string defaults). `kcol(k, u)` = `hexMix` of A and B;
each jelly is at its own `S.u.col`. `JE_COLS` (Dev → Jellyfish colours) → `jellyPal(u)` = { top, body, rim, edge, inner,
loops, shine, tent, glow, spit, spitEdge, spitShine, drip, drip2 }, read by `drawJelly`, the spit (colours copied onto
the shot: `col/edge/shine/dripCol/dripCol2/glow`), the glow, its health bar and death burst.
**v83: jelly colour preview + master sliders.** `JellyPreview` (a canvas component, its own rAF while the Dev panel is
open) sits above the Jellyfish colours header, `position:sticky` so it stays in view while you scroll the colour rows.
It runs the real `jellyStep`/`drawJelly` in a walled box (roam spot forced round the middle), with a mini spit/drip/
splat and the glow, all read from DEV each frame. Master sliders `jeHue` (°), `jeSat`, `jeBri` (×) — `type: 'slider'`
rows (range input + value + ↺) — act after the A/B blend through `hsvAdjust`; `jcol(k, u)` is blend-then-adjust and is
what `jellyPal`, the glow, health bar and death burst read (use `jcol`, not `kcol`, for any new jelly colour).
**v84: spore puffs + plant glow.** On a `'pulse'` the Game calls `puffSpores(e)`: `jeSpores` spores (made by `spore(x,
y, r)`, the one maker the ambience also uses) from across the rim, kicked back along `hd + π` ± `jeSporeSpread` at
`jeSporeSpd`; the kick is `q.kx/ky`, fading by `exp(-q.kd·dt)` in `stepAmbience`, after which they drift like any spore.
Only near the camera (amb particles die off-view). **Plant glow** is the owner's comp (they're a VFX compositor):
`plantGlowFill(out, art, w, h, o)` (pure) = green channel, levels with black point `white × (1 − top%)`, **held out where
green isn't the strongest channel** (else the gold seams (255,210,60) and pale flowers set the white point and the moss gets
nothing), × linear ramp to `reach` (glow radius × `jePlantReach`), × `twinkle(x,y,t,size)` (two drifting layers of
`twNoise`, contrast-pushed), × strength × art alpha, in `jcol('jeColGlow')`; added with `lighter` after the fog, only on
`seen` ground. White point: `plantWhite(...)` = 99.9th percentile of green over green-led pixels with **alpha ≥ 128** (faint
anti-aliased edges come back as junk like 0,255,0 and once pinned it to 255), measured per floor in `enterLevel` from
`img`+`dimg` (`plantW`). In the Game, `plantGlow(e, TH)` composes the art per jelly: rock (`img`) over the decoration
layer (`dimg`), plus the `PLANTS` props in reach drawn at terrain resolution into `pgC` and read back. The Dev preview runs
the same comp on its own mossy ledge + two vines, and puffs spores too. Knobs: Dev → Jellyfish (`jeSpore*`, `jePlant*`). Tests: `tests/logic/jelly.test.js` (pulses, drag, turn limit, shape, hunting,
walls, tentacles, real floor-1 caves), `tests/browser/jelly.test.js` (sandbox: spit, drips, splat, damage, glow).
**v80: Noita spawn table, teleport bolts, vacuum, gold seams, glow, map marks.**
`modWeight(id, floor)` is Noita's own spawn data now: `NOITA_SPAWN` (Noita action id →
[spawn_level, spawn_probability] strings, copied from `gun_actions.lua`) and `NOITA_OF` (our id →
its Noita twin; made-up spells borrow the nearest twin, `cold`/`battery` have `OURS_*` rows).
`floorTier(floor)`: floor 1 = tier 0, floor 10 = tier 6, linear between (weights interpolate),
>10 = tier 10 (max of the 10 and 6 odds). **A new spell needs a `NOITA_OF` entry** or it never
drops (`spells.test.js` checks every `ALL_IDS`). `MOD_TIER` is still the 1–4 rarity used for
trigger-variant pricing, not for drops. **Teleport Bolt / Small Teleport Bolt** (`tele`,
`teleshort`): shots with `tele: 1` (through `blankShot`/`spawnShot`); when the bullet dies (rock,
creature, expiry) `teleportTo(b)` backs up its track and nudges ±16 until `!boxHit`, else fizzles.
**Vacuum Field** reworked to Noita's: `life 0.33`, `r 64`, at `VACUUM_WAIT` (0.13s) it warps
enemies, bullets, enemy shots, coins and pickups within `r` to its centre once (`f.done`), walls
ignored. **Gold seams:** `goldVeins(mat, seed, floor)` (pure, own RNG) marks ROCK only, above the
shop, near open cave; `makeLevel` paints them after `decorate` and returns `ore`. `dig`/`explode`
count ore pixels cleared and call `dropOre` → coins worth `ORE_GOLD` × floor lift × `pb.gold` per
pixel, fractions carried in `oreBank`. **Gun glow:** `drawGunGlow` (radial glow + streaks, before
the gun sprite) on ground guns without `q.old`; `GunSwap.take` sets `found.old = true` on the gun
you swap out; the save keeps `old`. **Map:** background `rgba(0,0,0,0.8)`; `fogLit` pickups as
dots (mods green, guns yellow, `old` guns a hollow ring); rooms with any `seen` cell (`roomSeen`,
`ROOM_HW/HH`) outlined yellow, X when `taken`; the player dot has a white rim. Minecart blast 105.
Tests: `goldveins` (logic), `spells` (spawn table), `tests/browser/teleport.test.js` (bolts,
vacuum, ore, swap flag), `map.test.js` (dots, rooms, see-through).
Sources: tier list https://noita.wiki.gg/wiki/Wand_and_Spell_Tiers, spells
https://noita.wiki.gg/wiki/Teleport_Bolt and https://noita.wiki.gg/wiki/Vacuum_Field. The spawn
numbers came from `data/scripts/gun/gun_actions.lua` in https://github.com/Jazzer360/noita-data-parsing
(raw: `raw.githubusercontent.com/Jazzer360/noita-data-parsing/HEAD/data/scripts/gun/gun_actions.lua`).
wiki.gg blocks curl/raw page fetches ("Blocked - wiki.gg"), so read it with WebFetch; for exact
numbers, go to the GitHub copy of the Lua file.
**v85 floor 1 is a layered cave (`strataCave`), and timber is structural (`timberFrame`).** Only floor 1
(`layered = floor === 1` in `makeLevel`); other floors keep the old noise cave until the owner tailors each one.
`strataCave(mat, rnd, {vn, fbm}, shopExit)` (pure, above `makeLevel`) builds layers bottom-up: each corridor's roof
is `floor - headroom` (never under the squeeze floor), the next layer's top is its own wavy `line()`, ≥5 rows thick.
Walls (dead ends), then holes: every wall-bounded stretch gets a hole up (so all of it joins the top; a stretch that
can't get one loses a wall), extras make loops. Two **vaults** (a layer made 38 rows thick, gentle 46px rise) hold the
hidden rooms — `makeRoom` uses `strata.vaults` instead of random spots. **Old workings** level a stretch of corridor
floor and roof (28px ramps), paved after smoothing (`paveWorks`). A slope pass lifts roofs where the corridor is steep
(box needs height + rise); both the steep vault step and teeth-on-a-slope once sealed off half a cave. Then caverns
(broken strata islands, stalactites), rock bubbles. Returns `routePath` (tube per corridor stretch + per hole) and
`points` like the old route. Ledges/frames/floating platforms are skipped on floor 1 (they read as hovering).
Knobs: Dev → **Level layout (floor 1)**, `LV_KNOBS` min/max ranges, rolled with the level's seeded `rnd` (so a seed +
the same knobs = the same cave). Dev → **New cave** (`.dbg.newcave`, `input.current.newCave` → `enterLevel()`).
**Owner's rule: unreachable pockets are fine — digging is for that.** The main route is still guaranteed.
`timberFrame(mat, set, R, T, xa, xb, y, old, fy, maxH)` measures posts' floor and roof and refuses unless the posts
stand on level ground and the roof bears on the cap (wedges fill small gaps). Floor 2's `beams` bake uses it too
(that was the "hovering beams" bug: posts sized from one column's roof). `timberWorks` puts gallery sets at
`lvPost` spacing and **propped patches** (`lvPropZones`, mostly round a working) where natural tunnels get sets too
(max 36 tall); outside patches galleries lose `lvPropRot` of their bays and caves have none. Owner tuned density:
"3x" was far too dense — keep patch density ~1× post spacing, more patches instead. Tests: `tests/logic/strata.test.js`
(layers, rooms, level paved timbered galleries, no timber piece without rock above and below, patchiness, knobs,
timberFrame on hand-made grids), `tests/browser/newcave.test.js`. `strataCave.last` / `timberWorks.zones` are test hooks.
**v86 fire (burnable vegetation and timber).** `makeLevel` returns `fuel` (Uint8Array per terrain pixel:
`FUEL_GRASS`/`FUEL_MOSS`/`FUEL_WOOD`, 0 = none). It's written as things are painted: `decorate(..., fuel)`'s
`tset`/`dset` stamp the current `FU` (set around the moss/rubble-moss/beams/pickaxe-haft/overgrow bakes, 0 for all
else), and `timberWorks(..., fuel)` marks all its timber. Moss is on rock pixels (`img`), grass/timber on open ones
(`dimg`, walk-through). Pure engine above `makeLevel`: `fireNew(fuel)` → `{fuel, t (Uint16 ticks left), list}`,
`fireLight`, `fireArea(F,x,y,r,chance)`, `fireNear(F,x,y,r)`, `fireStep(F,dt,out)` at `FIRE_TICK` (20Hz): each
burning pixel tries every spot within 2px (`FIRE_NB`: up 1, side 0.9, down 0.35, ring two out ×0.3) at
`fireSpread × FIRE_CATCH[kind] × weight`; spent fuel → `out(i)`; capped at `FIRE_MAX`. Game: `fire` state,
`fireOut` (erases `dimg` / chars `img`, dirty boxes flushed once a frame), `ignite(x,y,r,chance)` (pixels + plants
in `FLAMMABLE` (vine, myc) + web lines + carts), `setAlight(e)`/`youAlight()` (`e.burn`/`p.burn` secs, damage in
chunks via `burnAcc`), `fireBlast` (in `explode()` unless `splash`; `hot` 5th arg = 0.9 chance, else `fireBoom`),
`fireFrame(dt)` in `step()` (plants catch/burn up by `firePlant` px/s and drop, webs/carts catch, creatures and you
catch off burning pixels and spread it, `FIRE_WET` surfaces put you out, flames = glow `dparts`, smoke, `'fire'`
crackle loop at the nearest blaze, `whoosh` fx). **dig/unDeco/explode zero `fuel`/`t`** for what they clear.
Sources: shots with `fire: 1` (`blankShot`/`spawnShot` carry it — fball, fbolt, meteor, missile + variants),
creature `fire: 1` (Stendari's bomb blast; `fireEnemyShot` copies `k.fire`, so a shooter can spit fire), vents,
minecarts (`blowProp` → hot explode), Levitation Trail. Draw: burning pixels drawn **before** the fog (so unseen fire
stays hidden) and brightened + glows after it only on `seen` cells — **owner: fire must not reveal fog.** Knobs:
Dev → Fire (`FIRE_KNOBS`, ranges). Tests: `tests/logic/fire.test.js`, `tests/browser/fire.test.js` (sandbox; hooks
`__lvl.fire`, `ignite`, `setAlight`, `youAlight`, `dimg`; `sandbox()` clears fuel).
**v87 floor 1 is zoned: built-up and natural, and arched vines.** `makeLevel` builds **both** caves on floor 1:
the natural noise cave into `mat`, `strataCave` into its own buffer `lay`, then stitches — `zone[i] = 1` (built-up)
takes `lay`. `zone` is a big fbm (`lvZoneSize`) thresholded at the `lvZoneShare` quantile (so the share is what's
asked), its edge warped by `lvZoneRag` px (Dev → Level layout); the 4 smoothing passes melt the seam. `built(x, y)`
(terrain px) inside `makeLevel`, `builtAt(zone, wx, wy)` (world units, pure) outside; `level.zone` is returned
(null on other floors). `strataCave` takes `N.ok` and puts workings and vaults only where it's true, so they survive
whole; `works`/`vaults` are then filtered again. Natural zones get the old blobs, side worms, ledges, frames and floats
(gated per position by `!built`); built-up zones keep strata's own `routePath`. **The main route (spine) worms are cut
only in natural zones** — their built-up stretches go to `spineBuilt` and are cut (as a narrow r≤7 shaft) only if
`boxReach` (pure: runner-box flood, `.top` = reached y ≤ 40) says the shop can't reach the top without them. The same
pass digs any hidden room the flood doesn't reach to the nearest reached cell. Timber's tunnel patches take `ok` too.
**Jellies are natural-only** (`NATURAL_ONLY` by act): spawn re-rolls a built-up spot but keeps the rolled kind for the
next spot (cap 300 waits), so the floor's mix holds. `jellyStep` takes `env.stay(x, y)` (the Game passes `natural`
when `zone`): `roamStep(..., ok)` turns the roam spot back at the edge; from inside it won't pulse if the glide end
(`min(gd, 160, v/drag)` + current drift `v/drag`) is outside; if it's outside (`lost`) it forgets you and heads home.
**Arched vines** (`ARCH_KNOBS`, Dev → Arched vines, all ranges): in `decorate` (after groves, green floors only,
natural zones only via its new `zone` arg) clusters of arches between two `ceilNear` spots; `archCurve` (pure, parabola
sag so length ≈ `arSlack` × chord) walked at half-pixel steps must be open + natural, with `arClear` px open below its
lowest point. An arch is a `k: 'climb'` prop with `arc` (points relative to x, y), `anc` + `anc2` (both must hold —
`propAnchored`), `alen`, `thick`; its strands are ordinary vine props with `on` (the arch) and `u` (where on it) and no
`anc` (`propAnchored` → the arch's state; the staggered anchor check now runs on `anc || on`). `cullDecor` checks an
arch's *curve* (not its big box) against keep-outs and non-climb props, and drops strands of dropped arches.
`archNear`/`archAt` are pure. In the Game: `decorStep` latches `z.arch` within `arGrab` (it beats a strand's
`z.climb`), the steering branch `climbing && zfx.arch` runs you along the local tangent (`arClimb`), push down (not
along) = `webLetGo`. `drawArch` in `drawProp`. Fire: `fireArches` (listed by `fireList()`, which now also notices a
same-length swap and runs from `ignite` too), `catchArch(pr, u)`, burns both ways at `fireArch` px/s, lighting strands
as `u0..u1` passes them. Tests: `tests/logic/zones.test.js`, `tests/browser/archvine.test.js` (sandbox with the new
`sandbox({ roof: true })`), strata/decor updated.
**v88 rats, nests, lanterns, split rooms.** `RA_KNOBS` (Dev → Rats & nests, all ranges). **Nests:** `ratNests(mat, rnd,
zone, keep, nb, nw)` (pure, own RNG from the seed, floor 1 only, run in `makeLevel` after the rooms/roof) finds an up- or
side-facing surface with 22px open in front, a room (`r` 5-7px) 20-34px into solid ROCK, a tunnel back with a sine bend
(so no sightline; `cut` r1.6 — thinner than the runner), a mound of earth at the mouth (`mound`, tinted after colouring).
Returns `nests` (on the level); each becomes an enemy `k.act === 'nest'` (`CREATURES.pesa`) with `e.nest = { path (world,
room → mouth), mouth, t, stash, max }`. **The burrow is hidden behind paint:** after `decorate`, every open pixel of room +
tunnel (bar the last 4px) is painted on `dimg` in the neighbouring rock's colour, so it reads as rock through the fog's soft
edge; dig/explode wipe `dimg`, and the Game draws a nest or a tunnel-mode rat only where that paint is gone (`burrowShut`).
Built-up layers are too thin to bury a room deep, which is why it's paint and not depth. **Rats** (`CREATURES.rotta`, act
`rat`, kp `ra`, never on a roster): `ratStep(e, env, dt)` (pure, state `e.ra`, modes `surf|air|tunnel`) — surface crawl
like the spider via the shared `surfSeat` (spiderSeat now calls it), bursts/rests, falls off ceilings (`RAT.ceil`), jumps at
a goal that's up off the surface and within `raJumpR` trying higher arcs until one clears the rock (`env.jump === false`
while roaming), tunnel mode follows the nest path (`pathAt`/`pathLen`); returns `'home'|'out'|'jump'|'land'`. Game:
`spawnRat(nest)` (nest branch in the enemy loop, when `dist < N.wake`, timer up and fewer than `N.max` alive with
`home === nest`), `ratFrame` picks the goal in order: carrying → home; loose coin within `raSmell` → coin; hunting → your
feet; else `roamStep` round the mouth. Bite (hunting, nothing to fetch): `raBite` (× `raBroke` if gold is 0), and unless
broke a coin of `raSteal` pops out (`pop: 1` bouncy physics, `nopull` so it doesn't fly straight back to you). Reaching
a coin → `e.carry`; `'home'` → `stash += carry`. `damageEnemy`: every dead enemy gets `e.dead` (rats check `home.dead`),
a nest drops `raNestGold` + stash, a rat drops its carry. Far rats (`dist > wake×1.3`) sleep. **Lanterns:** `decorate`
(zone given) places `lvLamps` of them in built-up zones: wall `lantern` and new ceiling `hanglamp` (`len`, chain). Lamps
(not caps) are shootable (`feels`); hurt / falling → `popLamp`: glass, and 16 `ember` dparts that `ignite` fuel they pass
and where they land (and set you alight). **Rooms:** on zoned floors `makeRoom(want)`; `heartBuilt` is a coin toss, perk
takes the other; rooms carry `built`. **Route fix:** after the spine cut, if `boxReach` still can't reach the top, a BFS
from the reached region to the exit room's reach digs the shortest link (seed 7 had only been reachable through a hidden
room's tunnel). Tests: `tests/logic/rats.test.js`, `tests/browser/rats.test.js` (sandbox).
**v74 Pollen nerf.** Pollen has `drift: 1`, `homeR: 80`, `pop: 6` (no `eat`). `driftStep` (pure, above
`tracePath`, consts `DRIFT_*`) damps its speed and, once slow, floats it up. It only homes after
locking (`b.lock`: nearest creature within `homeR` with `lineOfSight`), then speeds back to
`DRIFT_CHASE`. Generic homing is skipped for drift shots; `tracePath` mirrors it. `pop` =
`explode(x, y, pop, splash)` on rock/enemy contact — with `splash` set, enemies take that damage
and it never hurts you. A Borer/Eater mod still tunnels (checked before the pop).
Tests: `projectiles` (logic), `tests/browser/pollen.test.js`.

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

**No test may wait forever.** `tests/run.js` kills any suite past a hard cap (`LOGIC_CAP` 30s,
`BROWSER_CAP` 120s) and reports TIMED OUT. Inside a suite, every wait-until loop needs a frame or
try limit and must fail rather than spin. (v59: `torch` hung 25 minutes because the new default
zoom 1.35 pushed its sample points off screen and its sampler waited for an on-screen read
forever; it now pins `DEV.zoom = 1`. Any suite that measures in world units on the canvas
should do the same.)

### Test mechanics in a sandbox (the owner's rule, v61)

**A test of one simple mechanic — a prop, a spell, a creature, a pickup — runs in a sandbox,
not in a generated cave.** The owner asked for this after the mushroom and minecart tests kept
failing on cave layout (an overhang, a slope, rock in the way) rather than on the mechanic.
Random terrain round the thing under test is noise; take it out.

- `__lvl.sandbox()` (in `tests/build.js`) carves a clean room into the live level: open air, a
  flat brick floor, no enemies, props, loot or shots, fog lifted, the player standing on the
  floor. It returns `{ x, y, l, r }` — centre x, the floor's top y, the room's edges.
- Put the test object at a known spot in it: `__lvl.placeProp(proto, x, room.y)` copies a real
  prop (take `proto` off a real floor so its shape is honest) and anchors it to the floor. For
  enemies, pickups or fields, push them into the live arrays at known coordinates the same way.
- Set the player (and gun) up exactly — a known gun (`g.slots = ['bolt']`), a known position —
  then act and measure the outcome. `decor.test.js`'s mushroom and minecart checks are the
  pattern to copy.
- If a sandbox needs something new (a wall, a ceiling, a pit), add an option to `sandbox()` in
  `build.js` rather than digging terrain by hand in the test.
- Still pin `DEV.zoom = 1` if the test reads the canvas, and still cap every wait.

**Keep generated-level tests for what is about generation** — tunnels connecting, a floor's
palette and roster, where decoration lands, fog on a fresh floor, the smoke run. Those are
meant to see real levels. Everything else: sandbox. When an existing test is flaky because of
the cave round it, move it onto the sandbox rather than loosening its numbers.

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
  Other (Divide By N, the Requirement spells).
