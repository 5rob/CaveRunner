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

They play on a phone through the published artifact, so **every change has to work at
phone width with touch**.

**`node serve.js`** serves the game to their phone over the LAN, for testing before or
instead of publishing. They open it on the phone at **http://192.168.86.233:8000/** —
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
   They asked for this so the published page doesn't get stuck on a cached old build.
4. Update `README.md` — it describes the game for a player, and stays current.
5. Commit and push to the working branch.
6. **Publish it.** They test on their phone, so a change isn't delivered until it's live
   at the link. Republish to the **same URL** every time:
   `https://claude.ai/artifact/2rarFzJoTseCKXhTPwMyLT`
   Pass that as `url`. Publishing without it makes a *second* artifact and they lose their
   link. If this session hasn't published yet, read the artifact first, then publish.

Current version: **v48**. Branch: `claude/compassionate-rubin-fcqsif`.

### The version number is not optional

Their phone caches the page. A build published under the old number can silently serve
them the previous version, and then you're both debugging a bug that's already fixed.
So **every published build gets a new number**, in both places:

- `<title>CaveRunner vNN</title>` — line 6
- `const VERSION = 'vNN';` — near the top of the script, drawn on screen in-game

The number on screen is how they tell you which build they're looking at. Bump it before
publishing, never after.

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
| `PERKS` / `perkBag` | the 30 perks, and folding an owned list into one effective bag |
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
every path mod.

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

**Aggro is line-of-sight only (v44), and scaled by zoom.** `hunting` (whether a `chase`/
`bomb` enemy comes for you) is `dist < k.aggro * sees && lineOfSight(e.x, e.ty, pcx, pcy)`,
so nothing chases you through a wall — break the sightline and it drops back to patrol. The
range check is written first on purpose, so the exact `rayDist` march only runs for the few
enemies already in aggro range, not all ~136 every frame. `sees` also folds in `1/DEV.zoom`
(so aggro/fire reach track the camera zoom) and Invisibility. Shooters/turrets already gate
firing on `lineOfSight`; this brings the movers in line with them.

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
**left** stick shows health as a green SVG ring round the rim (red when `empty`) wiped
clockwise from 12 o'clock, and fuel as the amber `.jetzone` fill in its top half —
anchored to the centre line (`bottom:50%`), height = fuel fraction, so it drains downward;
it brightens under `.jetting` and goes red under `.dry`. The **right** stick shows mana as
a gold ring the same way (dimmed when there's no gun or it's recharging). The ring geometry
is `GAUGE_R`/`GAUGE_C` + `strokeDasharray`; keep the track circle behind it for legibility.
Only the version (top-left) is still drawn on the canvas; **gold is a DOM readout
(`.gold`) in the gap between the two sticks** (`fmtGold`, a pure fn above `makeLevel` and
covered by `gold.test.js`: a bare number, thousands truncated to a `k`, then a small `g`).
The floor
number is painted big and letter-spaced across the shop's back-wall block in `draw()`, a
touch brighter than the wall (`rgba(255,255,255,0.07)`). **Restart moved into the Dev
panel** (`.dbg.restart`, opens the same confirm via `onRestart`), and the Dev button is now
a bare ⚙️ in the top-right (`.devbtn`, class unchanged so the browser tests still find it).

**Detail cards in the build screen open at the top** (`.pop.top`). The editor's content
reaches the bottom of the screen, so a bottom-anchored card buried the mod bag. Four
separate bugs came from that; don't move it back.

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

**A mod on the ground asks before it is taken.** The interact tap sets
`input.current.confirm`; `ModFound` renders the card with **Pick up** / **Leave** and the
game pauses behind it. The two sit left and right of each other, and **neither is lit
until the knob is past the trigger line and pointing at one**: `Stick()` writes
`input.current.confirmAim` (`'take'` left, `'leave'` right, `null` inside the dead zone)
as the drag goes, and `ModFound` lights the button that matches. It publishes its
`{ take, leave }` on `input.current.confirmAct` and the release reads `confirmAim`, so
coming back to the middle before letting go chooses nothing. Two things about it are easy
to break. The overlay is `pointer-events:none` on purpose — the right stick has to stay
live underneath it, and only `.pop.ingame` and `.modfoundbtn` take touches back. And it
stops above the control deck via an inline `bottom` measured in `ModFound`, so the stick
you are being asked to drag isn't sitting in shadow.

**`found` is already taken as a class name.** `GunCard` is rendered with `mark: 'found'`
for a gun on the ground, and `tests/browser/gunpickup.test.js` queries `.pop.found`. So
the mod overlay's classes are all `modfound*`. Reusing `.found` silently restyled every
found-gun card, and it took a browser suite to surface it.

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
multiplier). `DEV_META` drives the rows; a blank field restores `DEV_DEFAULTS[k]`; `devSet`
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
