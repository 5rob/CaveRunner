# CaveRunner changelog

Newest first, one entry per release (a release = the version on `main`; `src/version.js`). The
rules these changes left behind live in the folder READMEs under `src/`; this is only the history.
Names are as they were at the time (before the refactor Game's state had loose names: `mat` is now
`W.mat`, and so on). Versions before v39: `git log`.

## v111 — bigger gold, debt and clock at the top
Released 2026-10-01.

- The top readout is larger and centred: gold 24px (it had been shrunk to 14px by the shop's
  `.purse` rule), debt 18px, settlement clock 16px. The debt shows in full (`-64,000,000,000g owed`),
  not `fmtGold`'s 64B. `topgold` checks it at 360 and 412 wide.

## v110 — the shop heal can be bought again
Released 2026-10-01.

- The shop heal no longer sells out: the first on a floor is free, then 100g, x1.75 each time after
  (`healPrice`, `HEAL_PRICE`/`HEAL_MUL` in `data/creatures.js`), lifted by the floor like kill gold
  (`goldScale`, now shared with `enemyFor`). The count is the heal plinth's `bought`, saved as
  `level.heals`; a new floor's shop starts it at 0. The plinth shows its price (or Free).

## v109 — an hour to pay; standable plinths; bedrock shop floor
Released 2026-10-01.

- The repayment deadline is an hour (`DEADLINE_MS`), shown at the top under the debt too
  ("Settlement due 00:59:59", `DueClock`; blinks in the last five minutes). `countdown` drops the days
  under a day.
- A save with 64B+ gold and no debt (an older page loaded a v107 save, dropped the debt and paid
  out the whole sale) gets the level's price taken back off.
- The shop's floor is bedrock (`BED`, painted as the brick): it can't be dug or blown through.
- Item plinths' feet are one-way ledges (`ledgeUnder`): land on a hidden room's altar with the rock
  dug from under it; the altar stays (and stays standable) once its prize is taken.
- The background hologram's tiles are half as far apart (`PERIOD_X`/`PERIOD_Y` 150 x 171).

## v108 — repossession
Released 2026-10-01.

When the repayment deadline passes (`stepRepo`, `W.repo`, `src/game/systems/vend.js`): the hologram
says REPOSSESSED (also on the shop's back wall, `drawHoloShop`), after 3 s the level is teleported
away with you in the shop (warp `repo`), then the klaxon, red emergency lights pulsing and a ten
second "INCINERATION IN" countdown (also on both machines), then fire jets out of grates in the
shop floor (`drawRepo`, every `REPO_JET`) fill the room and burn you, harder each second, until
you're dead. A deadline that passed while the game was closed goes straight to the alarm.

## v107 — debt of its own, a five-day deadline; gold at the top
Released 2026-10-01.

- A bought level goes on your debt (`LO.debt`), not your gold, so the shop still works. Selling
  pays it off out of the sale; the other 1,000 is yours.
- The repayment deadline: five real days from buying (`LO.due`, the device clock, so it runs while
  the game is closed), counted down in red on the buy machine's screen (`countdown`: "4d 23:59:59",
  then "OVERDUE"). Nothing happens at zero yet.
- Gold moved to the top centre of the screen; the debt shows under it in red ("-64B g owed").
- A v106 save with negative gold loads as gold + the debt.

## v106 — the level vending machines
Released 2026-10-01.

- A run starts with no level: above the shop is solid dark bedrock and the roof is sealed
  (`voidCave`, `src/game/systems/vend.js`). Two tech vending machines on the shop's back wall,
  past the way in and the heal (`VEND_BUY_X`, `VEND_SELL_X`): **BUY LVL N** (64,000,000,000 G on credit:
  gold goes negative) and **SELL LVL N** (64,000,001,000 G, red until `bioCount` is 0, then green).
  Screens are stacked like the background hologram, in its green and red (`src/game/render/vend.js`).
- Buying: the screen goes dark, then a flash, a sweep and lightning over the shop roof, and the level
  arrives (`enterLevel(..., 'shop')` rebuilds it from its seed; you and the stock stay put). Selling:
  the same, it goes, the floor number goes up and the next floor's shop and level are made, hidden.
- The exit portal no longer ends the floor: it drops you back in the shop.
- Gold can be negative (save, deck readout: `fmtGold` does k/M/B and a minus sign).
- The browser test page starts with the level bought (`window.__TEST_VOID` for the game's start);
  `__lvl.nextFloor()` replaces walking into the portal in the suites.

## v105 — hologram static, change glitch, silhouettes
Released 2026-09-30.

- The hologram is made once per frame into its own layer (`drawHolo`), which the fog swap and the
  bloom reuse. Static runs through it: fine scan lines crawling down, rolling bands, dropouts (all
  from `W.time` hashes, never `Math.random`).
- When the number changes: a glitch (slices torn sideways, blocks of data dropping out, 0.45 s,
  `holoGlitch`) and the glow flashes brighter.
- Vines, chains, kelp and spider webs in front of the hologram are black silhouettes outside the
  torchlight (the full fog three times over), and don't glow.

## v104 — the hologram ignores the torchlight's dark
Released 2026-09-30. The hologram is darkened only by the fog of war, not by the dark outside your
torchlight: `drawFog` also bakes a fog-of-war-only layer (`fogWarC`), and where the hologram shows
(`holoMask`) the picture takes that one instead. The bloom uses it too. A creature standing in
front of the hologram gets the same treatment there.

## v103 — flat red hologram with bloom; fog reaches the edges
Released 2026-09-30.

- The hologram: flat bright red and see-through, nothing else (no outline colour, no halo, no
  flicker), full brightness, the boxes half the size on the same grid.
- The FX layer (`src/game/render/fx.js`, after the lights): the hologram's bloom. The parts of it you
  can see (not behind rock, the shop wall or fog) are brightened, blurred and added over everything.
  Dev → Hologram & glow: `holoAlpha`, `bloom`, `bloomBlur`, `bloomBright`.
- Everything below the shop floor is black.
- Perks: the column grows to near the top of the screen before starting the next; pips 36px; with a
  perk's card up, tapping another perk shows its card.
- Fixed: the fog's blur faded out at the level's left and right edges, leaving a see-through strip
  down both sides (the sharp edge cells now go back under the blur).

## v102 — perks you can switch off; the hologram glows
Released 2026-09-30.

- The perk icons are a column going up from above the map button, wrapping into a new column
  further in (they used to hide behind the controls). Tap one: the game pauses and its card opens;
  R (a right-stick tap, the r key, or the card's line) switches it off/on (`LO.perksOff`,
  `activePerks`; saved).
- The hologram 3× bigger and drawn as red light: added over the background, black is no light
  (numbers cut out of the lit box), with a glow.

## v101 — the hologram
Released 2026-09-30. A slanted, tiled red "N biological entities detected" hologram between the
background and the rock (`src/game/render/holo.js`, count: `bioCount`), parallaxing halfway; green and
inverted at zero. The background pushed further back (parallax 0.8 → 0.6).

## v100 — refactor Phases 4–5: type checking, notes next to the code
Released 2026-09-30. `index.html` is the same as v99 apart from the version. Same game.

- **Refactor Phase 4**: TypeScript checking (JSDoc, `tsc --noEmit` in the test run, `src/types.d.ts`),
  every file under `src/` checked. Found, not fixed: Stendari's bomb never lights fires; a vent reuses
  `Prop.on` (REFACTOR.md, Found along the way).
- **Refactor Phase 5**: notes moved next to the code (a README per `src/` folder), this changelog,
  CLAUDE.md slimmed. Same game.

## v99 — refactor Phase 3: Game taken apart
`Game` split into `src/game/systems/`, `src/game/render/`, `src/game/creatures/` (the world object `W`,
the context `G`, step's and draw's frame objects, `ACTS`); Game.js 186 lines. The owner's Dev report
became the new defaults (zoom 1.6, torch 0.5, aggro 0.6, Black Hole pull 65 / speed 50, sound levels,
the spider/jelly/rat/fire ranges), so v99 plays a little differently from v98 on purpose. Owner:
"plays great".

## v98 — refactor Phase 2
The UI in `src/ui/`, `Game` in `src/game/Game.js`. Same game.

## v97 — refactor Phases 0–1
`index.html` is built from `src/` by esbuild; the pure code split into modules; the undefined-name
check; dev `package.json`. Same game as v96.

## v96 — every other spell after Noita
All but Black Hole (the owner likes it) got their Noita twin's look and flight: Magic Missile is a
rocket (speed 140, accel 2.6, vmax 780), Blast a bomb on a 1.8s fuse that rolls and rests, rubber
ball, accelerating lances, tumbling cross, skipping saw; new shot fields `vmax`, `lifeBoom`, spell
`accel`; holes where they hit; fire from Explosion/Nuke (`boom` is `fire: 1, embers: 6`); field looks
(`drawFieldLook`); Stillness and the Thundercloud's rain put fire out (`fireDouse`). Old tests using
Slug as "the straight shot" now use Glowing Lance.

## v95 — tier-1 spells after Noita, drips knob, rats on the ground
Bolt, Spark, Buckshot, Spitter, Bubble Spark, Magic Arrow, Digging Bolt, Small Teleport Bolt, Pollen's
look, Brimstone's fire: own sprite, trail, glow and flight (new `blankShot` fields `drag`, `bounceE`,
`pit`, `wig`, `look`, `light`/`lightR`; all mirrored in `tracePath`). Dev → Sound "Drips & trickles"
(`vDrip`). Rats need footing to run a path (they jump or fall, webs still count as ground) and roaming
rats spread out (`raSpread`). Real-floor probe: ~14/16 carriers home in 15s.

## v94 — rarity gate
`TIER_FLOOR`: tier-4 spells (Black Hole, Glitter, Storm, Saw Storm) can't drop before floor 4 (owner
saw a Black Hole in the floor-1 shop).

## v93 — nest burrows are real tunnels
Open holes hidden only by the fog (`nestFog`) until you dig a sightline in; no more rock paint over
them (v88–v92 painted it and gated drawing on `burrowShut`). Carried gold drawn at ground-coin size.

## v92 — rats have 1 health
Any hit kills one, on any floor.

## v91 — the death replay loops
On by default, with a Loop toggle (`.wloop`) beside Fog.

## v90 — death replay, "WITNESS YOURSELF"
A button on the death screen replays the 10s before the death and 3s after through the real renderer:
scrub bar (red tick = death), play/pause, .25/.5/1/2×, fog toggle, drag to pan, pinch/wheel zoom,
Follow, Close. Only a box round you is recorded (~0.1ms a sample, ~8MB for 13s). Talked about next:
saving replays, a "killed by …" caption.

## v89 — rats find their way; the R prompt
Rats pathfind (`navField`/`navWay`, path mode), holes are solid to walk over (`ratSolid`), safety nets
for the rare wedge (~95–100% of carriers home within 20s, was ~65%). The Buy/Take text became a thin
white circle with an R (`RKey`, owner's design).

## v88 — rats, nests, lanterns, split rooms
Nests (a mound, a winding tunnel, a hidden room) through floor 1's built-up zones and a few natural
ones. Rats bite, knock gold out of you and fetch loose gold home (triple bite when you're broke; a dead
nest drops 60 + its stash). Wall and hanging lanterns in built-up zones pop into burning oil when shot.
Heart and perk rooms in different zone types (coin toss). Route fix: a BFS link when the spine alone
can't reach the top (seed 7).

## v87 — zoned floor 1, arched vines
Floor 1 mixes the natural cave with v85's layered one (Dev → Level layout: zone size, share,
raggedness); jellies keep to the natural zones. Long leafy vines arch between ceiling spots, with
strands; hang, climb along, push down to drop; they burn.

## v86 — fire
Grass, moss, vines, mycelium and timber burn and spread pixel by pixel until the fuel's gone. Lit by
fire spells, explosions (sometimes), minecarts, vents, Levitation Trail (and meant to be Stendari: see
Unreleased). Creatures and you catch fire; puddles, snow, ice, slime put you out. Doesn't reveal fog.
Dev → Fire.

## v85 — floor 1 is a layered cave
`strataCave` (like Noita's Mines: layers, corridors, holes, two vaults for the hidden rooms, old
paved workings) and timber that really holds the roof up (`timberFrame`; fixed floor 2's hovering
beams). Dev → Level layout (floor 1), Dev → New cave. The owner found "3x" timber far too dense.

## v84 — jelly spores and plant glow
Jellies puff glowing spores from the rim on every push; green vegetation near a jelly glows and
twinkles in its colour (the owner's comp: green key → levels → radial ramp → twinkle → × colour → add).

## v83 — jelly preview and master sliders
A live jellyfish box above Dev → Jellyfish colours, and master hue / saturation / brightness sliders.

## v82 — jelly stings, colour knobs
Tentacles sting on touch (even when it hasn't noticed you). A colour A and B for each of 14 parts, each
jelly a blend (`colourKnobs`, usable by any creature).

## v81 — the jellyfish
Myrkkymeduusa replaces Heikkohiisi on floors 1–2: pulse-and-glide swimming with a turn limit, a bell
thin when fast and flat at rest, trailing tentacles, green glow, dripping spit that splats. ~36 Dev
knobs, all ranges. The shared creature pieces became modules (`rangeKnobs`, `kr`/`kru`, `roamStep`,
`turnToward`, `flyMove`, `kp`, `HUNTERS`, goo shots).

## v80 — Noita spawn table and more
Mod drops follow Noita's spawn table (`NOITA_SPAWN`, `NOITA_OF`); Teleport Bolt and Small Teleport
Bolt; Vacuum Field warps everything in reach to its middle; gold seams in the rock drop gold when dug;
never-held ground guns glow; map marks (loot dots, found rooms, X when taken, 80% see-through);
minecart blast ×1.75 (105).

## v79 — grab bars
Down the side of the slot grid and the mod bag (tap to jump, drag); a swipe on an empty slot scrolls.

## v78 — webs are vines; spider knobs are ranges
Web lines latch, hang, climb along, push down to let go, and slow you ×0.8 per line; every spider Dev
control became a min/max range rolled fresh at each use (owner's rule).

## v77 — spiders no longer freeze
A spider that reached its goal with both clocks run out sat still for good (~40% of floor-1 spiders).

## v76 — the spider rebuilt
Hämähäkki crawls rock and its own web lines in darting bursts, shoots lines across gaps (they stay),
bites up close, strings you from range (×0.8 speed a string, snaps when pulled too far). ~23 Dev knobs.

## v75 — see-through controls
Thin rings, fuel a ring inside health (the `.jetzone` fill gone), gun buttons on an arc round the right
stick, bag + map buttons, gold under the sticks (`bottom:5%`), no fills; the corner minimap became a
full-screen map toggle that pauses.

## v74 — Pollen nerf
Drags to a stop and floats up, homes only on a creature within 80, pops a small blast instead of eating
rock.

## v73 — bag fire preview
Slots light at the gun's real firing pace (trigger held); live cast delay / recharge / mana bars. Dev
key `bagAnim` renamed `bagSpeed`.

## v72 — advisor tips parked
Swap suggestions hidden (`SHOW_TIPS = false`; restore `advice.test.js`'s tip checks from v71 when
un-parking); the dmg/s line stays; the bag gets the space.

## v71 — bag screen rebuilt
Stats list (red→green quality, +/- from mods), 2×2 gun buttons with pictures, a fixed slot grid with a
per-pull firing light, scrolling mod bag. The per-pull outlines and family legend went
(`bulletgfx.test.js` dropped); `castGroups` allows 64 pulls (was 16).

## v70 — drips and gun ranges
Drips fall on their own random clocks (`pr.dn`/`pr.di`), quieter (about 1/3 and 1/2). Gun stat ranges
widened by the owner: 2–25 slots, 1.5–0.01s delay and recharge, 50–1000 mana, 10–500 regen, 20–0
spread, 0.5–2 speed.

## v69 — gun levels
Level 1–10 from the floor only (no cave height; `gunTier`/`FLOOR_TIER` gone); level 1 anywhere in the
range, level 10 near-perfect; ~20% of cave guns rare (higher level); guns coloured by level, `Lv N`.

## v68 — dev and tweaks
Minecart blast ×2 (60, was 30); Enemy Radar marker red (the perk's tint, not `COL.enemy` purple); Dev →
Spawn gun; the Trajectory Sight line fades in with the right stick's push.

## v67 — jetpack cough, per-sound volume, live update check
Near empty the jet cuts out in short random bursts (Dev "Jet sputter drop"); jet pitch climbs over 3s
held; a volume knob per kind of sound. The Android shell checks for updates on resume and every 2 min
(needs the new APK once).

## v66 — sound pass 2
Portals, footsteps and landings by surface, prop breaks by material, vents, mushrooms, tendrils,
stones, eyes, dark matter, drips/lava/steam/sparks, crits, chain hops, splits, util spells, enemy shot
fizzle/absorb, recharge-ready click, gun switch, UI sounds. All via `SFX.fx`, randomised per play.

## v65 — rustles and bangs
Plants rustle on grab and when moving through (rate-limited); minecarts bang with debris; pods pop;
explosions randomised.

## v64 — procedural sound
Web Audio, no files: themed spell voices bent by the shot's stats, creature voices by body, per-theme
ambience, jetpack and Black Hole loops, UI sounds, positional pan/falloff; Dev → Sound.

## v63 — autosave
The run saves every 2s and on backgrounding; reopening resumes the floor (the same cave on the same
version, a fresh one after an update; gear kept). Death/Restart wipe it.

## v62 — lightning looks like lightning
A jagged flickering bolt that forks side arcs at nearby creatures and rock.

## v61 — torches no longer clear fog
v59's fog clearing round torches gave away the prize rooms; torches and lanterns now show by the same
rule as items (`fogLit`).

## v60 — Noita-style triggers
Trigger/timer/expiration are variants of existing spells plus Add Trigger/Timer/Expiration; payloads
are isolated mini-casts that can nest. Greek letters switched off (`off: 1`); Summon Platform and
Summon Wall removed.

## v59 — denser decoration
3× decoration, vine clumps and 14 overgrown groves per green floor; torch flame leans ~2.5× more; owner
Dev settings made defaults (zoom 1.35, aggro 0.8, BH pull 50, BH speed 65); Dev panel in collapsible
groups; wall torches cleared fog round themselves (reverted in v61).

## v58 — level decoration
Five decorations per theme (60, `DECOR`): baked pixels (moss, rubble, beams, pillars, gears, ribs,
cracks, soot) and working props (vines/chains/roots to hang on, falling icicles and geodes, explosive
minecarts, spikes, vents, mushrooms, spore pods, slow/slick/hurting zones, noisy skulls and stones,
cover, dark matter, tendrils, lanterns, eyes). Props drop when their rock goes. Theme ambience
particles. Snow "cushions falls" not built (no fall damage).

## v57 — Black Hole knobs
Dig radius = the drawn core (`eat: 19`); Dev knobs for its pull range and speed; the Dev panel's copy
button for pasting settings back to Claude.

## v56 — Black Hole rework and visuals
Black Hole hauls creatures in, rolls on through them grinding, swallows enemy shots; purple haze,
starry core, mote trail. Portal motes; the hand torch flame drags as you move, with a halo and a second
light; wall torches by portals and prizes; background parallax (0.8) and shadow blotches.

## v55 — gun-stat rings and "+" crosshair
Three rings on the right stick (mana, recharge, cast delay), bag stats colour-matched (`GAUGE_COL`);
the crosshair a thin `+` with its centre cut out.

## v54 — Matter Eater fix, softer fog, aim crosshair
`eat` bullets tunnel through rock instead of dying on it; the fog edge dilated one cell and blurred;
a small crosshair dot `DEV.aimDist` (44) out.

## v53 — Buzzsaw reliability
It only dug when its centre was in rock ("cuts every tenth try"); now `eat: 14` digs its radius every
frame. Closer (`reach: 5`, was 10) and no white circle (`hidden: 1`).

## v52 — accurate minimap
Outlines sampled from the real rock in 4px blocks (`miniEdgeIdx`), smoothed; a yellow dot for you.

## v51 — Buzzsaw melee slice
Buzzsaw a melee cutter (`speed: 0`, `size: 15`, `bore: 12`), its recharge back to default
(`rech: -0.17`; v50's `rechMul: 0.33` gone), Pick Axe recharge 1.0; starters back to Scratch Pistol
first, Pick Axe second.

## v50 — big batch
Pick Axe starter holding Buzzsaw; a weak Scratch Pistol; the aim line became the Trajectory Sight perk
(31 perks); sticky aggro with `DEV.loseAggro` (2); a bottom-left minimap; mods taken with a tap (the
ModFound overlay gone), guns keep the GunSwap chooser (owner's call); death restarts on a right-stick
tap; health ring green→amber→red; the Mods button became Bag (always opens, editing gated); shop
plinths reach the floor.

## v49 — aggro distance knob
`DEV.aggro` (then default 1): a multiplier on chasers' and bombers' aggro reach.

## v48 — gold nudged up
Just under the stick tops (`top:5%`).

## v47 — gold in the deck
Off the canvas into a DOM readout between the sticks; `fmtGold` (`1234` → `1.2kg`).

## v46 — HUD onto the thumbsticks
The top-left stack (floor, enemies, bars, gun name) gone: health ring round the left stick, mana ring
round the right, fuel a wipe in the left stick; the floor number on the shop's back wall; Restart into
the Dev panel; the Dev button a bare ⚙️.

## v45 — panel stats capped
The pickup panel's stat list caps at ~3 rows (60px) and scrolls.

## v44 — line-of-sight aggro, dotted ring
Scrollable panel stats; chasers need a sightline to aggro; the right stick's trigger ring dotted; the
dashed `.throw` ring removed.

## v43 — pickup panel floats above the item
Half width, bottom edge just above the plinth (`promptBottom`).

## v42 — one pickup panel
Card and buy line in one `.buypanel`; bolder knobs (white rings, black fill); aggro and firing reach
scale with `1/DEV.zoom`.

## v41 — the Dev panel
Live, saved tweak knobs (zoom, torch fall-off, fog darkness, outside-torchlight darkness, move speed)
and the All mods toggle; pauses but keeps drawing. Deliberately not in the README (a dev tool).

## v40 — fog of war back
v38's lamp was a blanket gradient that lit the whole cave on a phone ("fog missing"); the lamp is now
masked by the fog. `SIGHT` (200) is both the reveal radius and the lit bubble.

## v39 — perks and hidden rooms
30 Noita-style perks, one per hidden perk room; a second room holds a +25 max-health heart (raises the
cap, no heal); perk icons above the sticks; cave loot rests on the ground.
