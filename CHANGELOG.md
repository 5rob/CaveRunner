# CaveRunner changelog

Newest first, one entry per release (a release = the version on `main`; `src/version.js`). The
rules these changes left behind live in the folder READMEs under `src/`; this is only the history.
Names are as they were at the time (before the refactor Game's state had loose names: `mat` is now
`W.mat`, and so on). Versions before v39: `git log`.

## v0.0.166 — title players saw through rock (no teleports), each on its own clock; burning creatures and vines in the fire's crackle (title and game)
Not yet released (branch `title-dig`, waiting on the owner's OK of the screenshots).
- **Title movement** (`stepRunnerMove`: `runStep`, `flyStep`, `digStep`): running and flying each last a random
  while per player (`runTime`, `flyTime`; switches in `r.switches`); the mine works no longer force a landing, and
  the safety net that popped a player up through rock (a teleport) is gone. **Rock in the way** (a wall ahead past a
  step, a low roof, ground he's aiming into, rock the scroll brings to him) **brings out the Buzzsaw** (`startDig`:
  the `saw` shot on `TITLE_SAW`'s skin, the gun kept in `r.keep`), cutting a `TITLE_DIGR` tunnel (no charred rim,
  `titleCarve(…, false)`) at up to `DIGV` until he's been clear a moment; the blade drawn spinning at the barrel (the
  game's `disc` look); it cuts creatures it reaches. Flying targets (`pickTarget`) are now and then under the floor
  or up in the roof, so they saw tunnels. Floor bumps under a flying player lift him; landing is when his feet reach
  the floor. Counted in `S.digs`, `S.digT`, `S.digWhy`. Tests can hold the players still (`S.still`).
- **Burning creatures in the fire's crackle** (`art/crackle.js` `crackleBody`: about half the burning-pixel squares over
  the body, tongues above, a new flicker each fire tick): the title and the game (`render/actors.js`). On the title
  burning hurts in chunks as in the game, so they flash now and then instead of staying white.
- **Burning vines in the crackle in the game too** (`render/cave.js`, `crackleAt`): a hanging vine's burning tip,
  an arch's two fronts. The title's vines and silk use the same `crackleAt`.
- A rat swarm stops at its zone's end. Suite `slots` (53); pictures `tools/digshots.js`.

## v0.0.165 — the title: four players, twice the creatures, random guns with modifiers, a natural mine slope, slower fire, cut vines and webs hang and swing
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Four players** (`TITLE_RUNNERS`, `S.runners`; `S.runner` is player 1): each on its own clock, easing apart when
  side by side, each its colour (`TITLE_COLS`: blue, red, green, yellow) on the backpack and a stripe over the helmet
  (`paintBody`/`drawRunner`'s new `tint`). Creatures go after their nearest player (rats: a nav field each), gold
  flies to the nearest, any player stops spit and silk.
- **Twice the creatures** (`TITLE_FOES` 24, spawning twice as often, 6 to start).
- **Random guns** (`titleKit`): a random skin from all of `GUN_ART`, one of 23 shots (`TITLE_SHOTS`) and 0–2 of 18
  modifiers (`TITLE_MODS`) worked on it by their own `f` (double / triple: that many at once). Title shots now home,
  accelerate, and chain bolts leap creature to creature; lightning with more shots arcs to more creatures.
  `TITLE_KITS` is gone.
- **The mine works' roof** comes down over a long S-curve (`TIMBER_RAMP` 120, `timberD`) with lumpy rock, not a short
  straight step.
- **Fire at a tenth** (`TITLE_FIRESPEED` 0.1): cell-to-cell spread, plants catching beside fire, burning along vines
  and silk; jumps `TITLE_JUMPP` 0.05 (was 0.5). Burning vines and silk drawn with the burning cells' crackle (the
  fire colours in the terrain grid, a new flicker each tick).
- **Cut lines hang** (owner): an arch or web line that catches (or is blasted) is cut there; each side becomes a rope
  of `TITLE_LINKS` links (`hangPiece`, the game's `tailStep`) swinging down from its end and burning up from the cut;
  an end that doesn't hold (no rock above or beside) falls, as does anything whose rock is blasted away (`p.drop`);
  a long piece gathers up off the ground. An arch's strands drop when it's cut.
- **Players push the vines** as in the game (`stepSway`): hanging vines swing (`vinePush`, `swingStep`), arches
  and web lines give (`bendPush`/`bendStep`); strands ride their arch's bend (`on`). `titleWebAt` is `webAt`.
- Suite `slots` reworked (51 checks); pictures `tools/playershots.js`.

## v0.0.164 — the gun in hand in the body's pixel look; creatures over the shop's machines; title fire jumps, the runner waits
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **The gun in his hand goes through the body's pixel look** (`pixelHeld`, `art/sprites.js`: body then gun as one
  `pixelSprite`, the box grown `HOLD_PAD` for the longest gun): the game (`DEV.runnerPx`/`runnerLine`), the Bag's
  firing window, the title (1 unit, outlined). Ground and icon guns are drawn as they are.
- **Creatures (and shots, beams, silk) drawn over the shop's things**: `drawArrival`, `drawShop`, `drawVend`,
  `drawShops`, `drawDemo` moved before `drawSilk`/`drawEnemies` in `draw` (none of them touch `Math.random`).
- **Title fire jumps** (`spreadFrom`): a burning vine's tip, an arch's or a web line's fronts light any vine, arch or
  web within `TITLE_JUMP` (5) at `TITLE_JUMPP` (0.5) a fire tick. **Web lines burn along** (`catchWeb`, `L.fu` the
  burnt span, `TITLE_WEBFIRE` × `fireArch`), drawn as the silk left with glowing fronts; heat (`titleIgnite`) lights
  them, a blast's own hole still cuts them.
- **The title runner fires only within `TITLE_AIM`** (90 units) at creatures well on screen (`TITLE_VW − 24`):
  they come into view first.
- `tools/heldshots.js`: the screenshots. `slots` logic suite: fire jumps, the aim range.

## v0.0.163 — gun sprites at one scale, the gun in hand twice as big, the squirts turned; the title's fire, runner and lanterns
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **The two squirts** (Green, Pink) turned a quarter clockwise then mirrored (a transpose of their pixels and hand
  point); `tools/gunart-extract.js` makes the same (TURN 13/16: 3, no MIRROR) if it's re-run.
- **One pixel size for every gun sprite** wherever it shows: icons (`gunArtFit`: HUD slots, the Bag's gun row,
  the gun machine, dragging) and the 🖼️ gallery use the scale that fits the biggest sprite (`GUN_ART_MAXW/MAXH`), so a
  pistol is small and a sniper long. In the world they were already one scale (`GUN_ART_PX`).
- **The gun in his hand twice as big** (`GUN_HELD` = 1.1, was 0.55): the game, the Bag's firing window, the title.
  `gunMuzzle` finds each sprite's barrel tip: the gun light's beam, the Bag window's shots and the title's shots
  leave from it.
- **Title**: a safety net pops the runner back onto the floor if his middle ends up in rock or he's well under the
  floor line (the owner saw him stuck shooting from inside it). The fire is drawn as the game draws it: burning cells
  in `FIRE_COLS` (a flicker each tick, embers when nearly spent), the warm wash and glows, `flameAt` specks
  (2.5 a second a burning cell, ≤ 20 a frame) and `fireSmoke` puffs; the old white blobs went.
- **Title lanterns**: each chain hangs from what's really above it, the roof's underside or a frame's cap (`lamp`,
  `HOLDS`), no gap. As in the game (game/systems/props.js): a shot or a blast pops one (`popLamp`: a white spray,
  16 blobs of burning oil that light the fuel they pass through and where they land, the spot itself catches); its
  hold blasted or burnt away, it falls and pops where it lands.

## v0.0.162 — the title's creatures, gold and fire are the game's own
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Real creatures**: made by `enemyFor` (floor 1's kinds) in world coordinates and moved by their real brains
  (`jellyStep`, `spiderStep`, `ratStep`, `roamStep`, the rats' `navField`/`navWay` paths), with the game's aggro
  (reach × zoom × `DEV.aggro` × their own roll, on a sightline, kept until `loseAggro`), jellyfish spit, spider
  strings and lines they spin, rat bites (he isn't hurt), burning. Drawn by the game's `drawEnemy`. Rats have no
  nests here, so they don't steal gold. The title's own spider walk and silk drop went (the real spiders spin lines).
- **Real gold**: `spillGold` (25 / 5 / 1 nuggets), `stepNugget` (fall, bounce, roll), `collideNuggets`; pulled to
  him only within `COIN_PULL`, collected at 12, by the game's formula.
- **Real fire**: the title's fire runs `fireStep`'s rule (FIRE_TICK steps, `fireSpread`, `FIRE_UPW`, `FIRE_CATCH`,
  each fuel's burn time); vines and mycelium only (`FLAMMABLE`) burn from the tip at `firePlant`, arches outward at
  `fireArch` lighting their strands. Before, the title faded a whole plant at once (the game was never broken).
- Found: the owner's v0.0.161 Dev report set `fireSpreadHi` 0.2 → 1, so fire in the game spreads ~3× faster
  (moss: 83 px in 5 s against 27). The owner chose to put it back: `fireSpreadHi` 0.2 again.
- Fix (owner spotted it): the title's vine arches drew as straight lines. A title prop kept its world x in `wx`, which
  art/props.js reads as an arch's sideways bend (over 1,000 units off); it's `ox` now. Also the arches' clearance no
  longer flattens them, and their spans are the `arSpan` knob × 0.6 for the narrow screen.

## v0.0.161 — a new title scene (a tour of the real Mossy Caves); every gun wears pixel art; the owner's Dev defaults
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Title scene** (built by a time-boxed agent): one runner who runs along the floor (steps up ledges, drops into
  holes) and jetpacks over walls and gaps; the floor raised ~20 units. It scrolls through Mossy Caves' zones in turn
  (natural moss, timber works, paved brick works with chains, a grove), the theme's colours and the game's plant
  painters. The terrain is a carveable grid (2-unit cells): blasts blow holes, digging shots nick pits, fire shots
  and blasts light moss / timber / plants, which spread and burn out (`TITLE_FIRE` cap). He swaps gun every 3.5–6 s:
  7 real shots (`bolt`, `buck`, `fball`, `zap`, `flamer`, `blast`, `slug`) each with a gun sprite, drawn with the
  game's `drawLook` / `drawBolt`. Only floor 1's creatures: jellyfish, spiders (floor and roof), rat swarms (3–6,
  no nests). Kills drop gold that flies to him and is vacuumed up. The pure step stays in `art/titlescene.js`; the
  drawing moved to `game/render/titledraw.js` (it needs `drawLook`). `slots` suite covers it.
- **Title, owner's feedback rounds 2–3** ("a sideways tour of our actual Mossy Caves level"; the real floor surveyed
  first): zone borders fray by noise instead of a cut; zones are natural moss → the spiders' web caves → the built-up
  layers (low roof, stacked bands, strata.js's timber frames, hanging lanterns) → brick works (lanterns on long chains)
  → the grove (the level's vine arches from `ARCH_KNOBS`, strands). Painted by the level's rules (rock mottle, moss on
  upward faces, grass tufts, rubble, brick ledges, dark blotchy back wall), drips and spores. Creatures only in their
  home zones (`TITLE_HOME`: jellyfish natural only, rats in the works, spiders in the web caves and the layers);
  spiders walk web lines and rock, blasts and fire cut lines, and drop down on silk threads (hang, climb back);
  jellyfish tentacles from the jellyfish knobs.
- **The owner's Dev report (v0.0.159) as the new defaults**: zoom 1.7, torch 0.7, darker outside the torch, quieter
  jetpack and drips, a bigger hologram glow, floor 1 due in a day, 50 enemies +20 a floor, no player outline, the
  menu pointer and snap, 2500 kbit/s video, more web sag, 4–8 built-up nests, bigger caverns, tougher/bigger elites
  in yellow, a dark-violet elite flame, fire spreads faster, the carrot perk's ranges. Tests that measured the old
  numbers are pinned to them (`rats`, `dark`, `furnish`, `tomb`) or updated (`brood`, `deadline`, `ramps`,
  `perkstats`; `creatures` now checks each elite at its own roll).
- **Every gun wears a pixel-art sprite**: the old drawn gun is gone. A gun without a pick gets the `GUN_ART` sprite
  nearest its colour (`gunArtId`, `artForHue`, `artHue` in `art/gunart.js`), so it matches its HUD slot. `drawGun`
  takes the art id (no accent). The 🖼️ gallery's Default tile is gone; the gun machine's hologram is a sprite.
- Fix: on phones under 400 px wide the red debt line is smaller so it clears the ⚙️ (moved left in v0.0.160; `topgold`).

## v0.0.160 — dev mode: hold ⏸ 5 s to show the dev tools; ⏸ and ⚙️ swap places
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- ⏸ is now in the top-right corner, the ⚙️ left of it. ⏸ opens the menu on release; **held 5 s** it toggles dev
  mode instead (`ui/devmode.js`, `caverunner-devshow`; off by default, on for the browser test page).
- Dev mode off hides: the ⚙️, the mod/perk cards' 📌 / 🗑️ / Give Feedback, and the Bag's 💾 save-as-preset.
- `title` suite: ⏸ is pressed down + up now; holding it hides and brings back the ⚙️.

## v0.0.159 — the owner's LIST4: title screen + save slots, pause menu, gun looks, gun presets, coloured gun slots
Released 2026-10-08 (the owner OK'd the screenshots; a minor update). Built by three time-boxed agents on `list4`
(`LIST4.md` has each item's files and decisions).
- **Title screen** (`ui/title.js` `Root`, scene `art/titlescene.js`): shows on every load, the game mounts only after
  Start. A bobbing pixel CAVE RUNNER with a shine sweep over a scrolling cave of jetpackers blasting creatures; a
  menu of **3 save slots** (Floor · gold · guns, or Empty; 🗑️ then "Delete?") and Continue / Start. Per slot: the
  run save and both unlock collections (`slotKey`: slot 1 = the old keys, so the old run is slot 1; slots 2/3 add
  `-2`/`-3`; active slot `caverunner-slot`). Shared: Dev settings, audit, replays, presets. The test page skips it
  (`window.__TEST_TITLE` shows it).
- **Pause menu** (`ui/pause.js`, ⏸ beside ⚙️): Resume, Save (now), Volume (whole game: `SFX.setVolume`, kept in
  `caverunner-volume`), Exit to main menu (saves, reloads onto the title).
- **Bag header** (`BagHead`, `ui/editor.js`): the gun's name in its colour with ✏️ rename (keeps its hue), 🖼️ gun
  look, 💾 save as a named preset (`save/presets.js`, `caverunner-gunpresets`); the page title and gold are gone.
  **Dev → Spawn gun** lists the presets (tap = spawn that gun, `input.current.spawnPreset`; 🗑️ then Delete).
- **27 pixel-art gun looks** from the owner's picture (`art/gunart.js` `GUN_ART`, re-extract with
  `tools/gunart-extract.js`); the gallery `ui/gunart.js` `GunArtPicker`; `gun.art` drawn by `drawGun(…, art)`
  everywhere a gun shows (hand, ground, HUD slots, Bag, firing window), one pixel size `GUN_ART_PX`.
- **HUD gun slots** ringed and tinted in their gun's colour; the held one thicker with a glow (was amber).
- Suites: logic `presets gunart slots`, browser `presets gunart title`.

## v0.0.158 — the machine hints fit their words, centred over their machine
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: both level machines' hint boxes are as wide as their content plus padding (`width:max-content`) and sit
  centred above their machine (`input.current.promptLeft`, the machine's middle on screen, from `pickups.js`;
  `translateX(-50%)`). `vend` checks the centring.

## v0.0.157 — the buy machine: flick to pick a level, no menu
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: the buy machine's full-screen floor menu is gone (`ui/levelshop.js` deleted). At the machine the hint shows
  two options: **Select Level** (the R icon with thin up/down arrowheads, `PickKey` in `ui/hud.js`) and **Tap R to
  Buy**. A right-stick flick up/down picks the floor (`input.current.lvlStep` from `Stick`, `pickStep` in
  `game/systems/vend.js`, `W.pick`; `input.current.lvlPick`); you still aim and fire. Both
  machines' screens show the pick (`pickedFloor`). You can pick up to one floor past what's for sale
  (`pickTop`/`stepPick`, `data/levels.js`): that one is grey (`HOLO_GREY`, "*sell lvl N first"), "Tap R to Buy" dims,
  and a tap says "Sell level N first". The pick resets after a buy or a sale.
- The hint's look (owner's round): background at 25%, outline and words the machine's green (R icons stay
  white), less padding, the whole box at 0.6×. It shows only after 1.5 s with no stick input (or move key) (`PICK_IDLE`,
  `W.stickT`, `prompt.idle`), fading up quickly; any input hides it at once (`.pickhide`). The machine works the
  same with it hidden.
- The sell machine's hint in the same style (one option, `prompt.sell`; red outline and words while it
  refuses, `.red`), with the same 1.5 s wait.
- The thumbstick knobs carry a small L and R in their centres (`.klet`, the hint's R size: 8.4px).
- Tests: `levelpick` (new, logic); `vend` (real stick flicks, grey, limits) and `repo` updated.

## v0.0.156 — circle fields: sparkles instead of a filled disc
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: many area fields on one spot stacked into a solid blob. The circle fields (Stillness, Shielding, Vigour,
  Thundercloud, Glittering Field) lose their filled disc: sparkles (white and the field's colour) rise and fade
  inside (`drawFieldMotes`, `game/render/looks.js`, no state: seeded by the field's spot), and Vigour adds green
  plus signs. The dashed ring and Shielding's turning arcs are thin (0.5) at 10% opacity. The crystals keep theirs.
  Suite `fieldlook` (six Vigours stacked in a sandbox stay see-through).

## v0.0.155 — Follow Me split, Follow Me as a pull, buffs and nerfs; you in the firing window
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- **Follow Me** brings shots *and* fields to you; the new **Follow This** (`followaim`, ↬) holds a field just ahead
  of your gun. The Gravity Gun uses Follow This now (`cleanGun` switches an old save's). On a shot either is a
  **pull**, not a turn (owner: no turning circle): `FOLLOW_PULL` × its strength toward the spot, so it slows, stops
  and comes straight back, never faster than it left (`spells/paths.js`; the aim line follows).
- **Buffs and nerfs** (`buff15` `buff2` `buff5` `nerf75` `nerf50` `nerf20`): every number of the NEXT mod drawn ×
  1.5 / 2 / 5 or × 0.75 / 0.5 / 0.2 — a shot's stats with its mana and delay, a modifier's effect, another buff's ×
  (they multiply); whole-number stats round (`boosted`, `spells/cast.js`). Suite `buffs`.
- **The firing window**: you at the far left drawn exactly as in the game (pixel look, outline, gun at 0.55 and the
  game's gun height), holding the gun on the sway; Follow Me shots come back to you (pulled `GF_FOLLOW_K` × harder
  to fit the window); shots fly their real flight time, slowed.

## v0.0.154 — a running DPS graph in the firing window
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). A thin red line across the top third of the
Bag's firing window, over everything: the dummy's DPS over the last `GF_GRAPH_S` (5) s, a sample every
`GF_GRAPH_DT` (0.1 s), newest at the right, scaled to its peak; gone once nothing has hit for 5 s
(`ui/editor.js` `GunFire`; suite `gunfire`).

## v0.0.153 — DPS over the firing window's dummy
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). A red "N dps" over the hologram dummy's head
in the Bag's firing window: the damage of shots that hit it over the last `GF_DPS_S` (3) s, hidden at 0
(`ui/editor.js` `GunFire`; suite `gunfire`). Blasts near it without a direct hit aren't counted.

## v0.0.152 — the firing window: sway, room, a hologram dummy
Released 2026-10-07 (the owner OK'd the screenshots; a minor update). In the Bag's firing window (`ui/editor.js`
`GunFire`): zoomed out (`GF_ZOOM` 2.2, was 3); the gun sways from aiming near the wall's top to near its bottom every
4 s (`GF_SWAY`, `GF_SWAY_S`), so bounces show; a dummy you at 2/3 size in front of the wall (`GF_DUMMY_K`,
`GF_DUMMY_GAP`), a hologram like the guide (`holoPass`), that takes hits (pierce passes on, hit triggers go off) and
glitches with the guide's tear when hurt, never dying; homing shots steer for it. Suite `gunfire` checks hits.

## v0.0.151 — a wall in the Bag's firing window
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). The firing window has an unbreakable stone wall
at the far right (`GF_WALL`, `ui/editor.js` `GunFire`): shots stop on it or bounce, blasts flash, beams end on
it, and a trigger's payload goes off on its own moment (hit: the wall; timer: in flight; expire: any death) and
flies back out, so you can see what trigger builds do. Suite `gunfire` checks a payload goes off.

## v0.0.150 — the Bag's mana bar
Released 2026-10-07 (owner's ask; a minor update). The thin bar under the Bag's Mana stat now drains and refills
with the fire preview like cast delay's and recharge's: it read the gauge under the row's key (`manaMax`) instead
of `mana`, so it always showed full (`ui/editor.js` `GunStats`). New suite `manabar`.

## v0.0.149 — the owner's 12-item list (LIST3)
Released 2026-10-07 (the owner OK'd the screenshots and a feedback round; a minor update). Built by time-boxed
agents on branch `list3-small`, the tracker is `LIST3.md`.

- **Vines** (LIST3 #7): swinging on a vine you keep facing the way you were unless you push the other way
  (`W.p.steer`, `game/systems/gun.js`).
- **Trigger ring** (LIST3 #8, then the owner's feedback): the right stick fires at a ring just inside its three
  gauge rings, Dev → Player `aimPad` px in (5) (`triggerRing` in `core/consts.js`, `stickTrigger` in `ui/hud.js`;
  suite `trigring`; `interact` updated).
- **Feedback round**: Aim Assist hides the crosshair; Dev's **Spawn level** (any floor, `SpawnLevel`) replaces New
  cave + Floor 2; the copy buttons read "Copy Dev settings" / "Copy mod & perk audit"; the mini-map's open
  spaces dark-mid grey at 80% and its creature dots only where explored; the hologram glitch has its own rate
  for blinking on (`l2dFlkRate`), tearing (`l2dFlkTears`) and cutting out (`l2dFlkDrops`).
- **Fixed**: Dev's Copy report missed a half-typed box (the report was written before the box committed).
  Browser suites updated for the batch (the archived gun chooser via `gunMenu`; tiles found by mod id; a tap
  opens the gun card; Aim Assist exempt in `everymod`). `jelly`, `lightning`, `vendshop` fail on v0.0.148 too.
- **Guns by holding a HUD slot** (LIST3 #5, `ui/gunhold.js`): by a gun on the ground, hold a gun slot (the
  empty one too) and a ring fills round it; at full it takes the gun into that slot and your old one lies
  where it was. With no gun in reach, holding a filled slot lifts its gun out under your finger: drag it and
  let go to drop it there (settled on the floor; at your feet if the spot is rock or out of sight), out of
  your guns; let go over its own slot to cancel. Tapping the gun in hand shows its card (was a hold). The
  right-stick tap → swap chooser is archived (`input.current.gunMenu`). New `gunhold` browser suite;
  `gunpickup`/`interact` updated, `compare`/`teleport` set the archive flag.

- **Discriminate mod** (`discrim`, LIST3 #11): each copy gets its own permanent target. Tap an unset one in
  the Bag → "Set target" → the Bag closes and the aim stick drives Aim Assist's pointer, snapping onto any
  creature, you, or an object (props, pickups); let go on one to set it ("Discriminate → Konna" toast), let go
  on nothing to cancel. A set copy is its own id (`discrim:<kind>:<id>`, `spells/discrim.js`), so copies with
  different targets stack apart and saves keep them; its tile shows the target's little icon. The next spell
  then touches only that kind of thing: it passes through every other creature, you and props, homes/chains/
  pulls only onto the target, and its blasts hurt only the target. It still stops at rock, but never digs,
  blasts or burns it. Not covered yet: static fields, beams and a trigger's payload (they act as normal).
- **Aim Assist mod** (`aimassist`, LIST3 #10): with it on the gun in hand the aim stick drives a thin
  pointer ring out from your gun (like the vending menus' pointer) that snaps onto creatures in sight and on
  screen; on one it turns amber, the gun light swings onto it and the gun fires at it on its own (normal cast
  delay, recharge and mana). No trigger ring on the stick, no aim line; letting go stops. Its own Dev group,
  **Aim Assist** (reach, snap reach/pull/hit, stickiness, fire delay, ring size/line/dot).
- **Audit mods and perks** (LIST3 #6): every mod and perk card you can tap
  (Bag, Exo Suit, a gun card's mods) has a 📌 keep and a 🗑️ trash toggle (one or the other) and a
  Give Feedback button that turns the card into a notes box, prefilled with what you wrote before,
  with Save / Cancel. Kept on the device across runs and deaths (`caverunner-audit`). Dev → **Copy
  audit** copies it all as Markdown for a Claude Code session (Remove / Keep / Notes, each with the
  item's id). `save/audit.js`, `ui/cards.js`, `ui/devpanel.js`. Tests: new `audit` (logic + browser).
- **Collected mods stack** (owner, item 9): the Bag's "Collected mods" grid shows one tile per mod,
  with a small numbered circle top right when you hold 2+ (`.tcount`). Dragging from a stack fits one
  copy (the count drops; the tile goes at 0); a slot dragged back joins its stack; gun slots still hold
  one each. Display only: `LO.bag` still holds one entry per copy, so saves are unchanged
  (`stackBag`/`stackKey` in `spells/collection.js`; the key is the id today, ready for per-copy data
  like a Discriminate target). Suite: `stacks` (browser), `collection` (logic).
- **Mini-map perk** (owner, LIST3 item 12): fitted in the Exo Suit, a see-through box with a thin white outline over the
  gun buttons (their width, from just above them up to half the screen): what you have seen of the floor (rock black 20%,
  air dark-mid grey 80%, owner's feedback), you as a white arrow along the aim, red dots for creatures in explored parts of it, tiny red/green crystals, your pins (an
  off-box pin sticks to the edge its way). Tap: zoom out ×2, ×4, back. `ui/minimap.js`; suites `minimap` (logic + browser).
- **A modifier now affects only the next spell** (owner's decision): `[Damage Plus][Bolt][Bolt]`
  boosts only the first bolt; modifiers in a row all land on the next spell; inside a multicast or a
  trigger payload each spell gets only the modifiers right before it. Timing and mana unchanged.
  `planCast` (`spells/cast.js`); the aim line, bag stats and advisor read its shots, so they follow.
  Tests: new `nextspell`; `cast`, `groupstats`, `advice` updated to the new rule.
- **The Dev panel, tidied** (LIST3 #3):
  - The Dev panel is a dark card with **tabs** (Look, Player, Creatures, World, Level 2: `DEV_TABS` in `dev/knobs.js`),
  each a page of **collapsible groups**: a **tap** opens/shuts a group (was press-and-hold; a scroll gets no tap).
  Each header shows its knob count and how many you've changed; a dot on a tab means something on it changed.
  - The actions (All mods, All perks, Spawn gun, New cave, Floor 2, Restart run, **Copy report**) sit in a grid on top.
  - A **search box** finds knobs by name on every tab. Open groups and the tab are remembered (localStorage).
  - Copy report's text is unchanged. New suite `tests/browser/devpanel.test.js` (also takes the screenshots with
  `CAVERUNNER_SHOTS=<dir>`); `blackhole`, `jelly` updated for tabs and tap.
- **Bag: a firing window** (owner, LIST3 #4). The gun
  buttons moved to a row of four under the collected-mods grid; where they were, a small dark window
  shows the selected gun firing each pull's real shots (the game's own spell looks) in step with the
  slot lights, and it follows the build live as mods are moved (`ui/editor.js` `GunFire`,
  `bagsim.js` `S.shots`; suite `gunfire`).
- **Dark zones: the hologram glitches** (LIST3 #1). In or near a zone
  the hologram behind the silk is on (`l2dFlkBase`) and glitches at random: dropouts, strobing flashes
  brighter than it (`l2dFlkFlash`), torn horizontal slices (`l2dFlkGlitch`), `l2dFlkRate` bursts a second,
  from `l2dFlkNear` px outside a zone; `l2dFlk` 0 turns it off. Random backlight for the silk, aliens
  silhouetted. Pure state machine `world/holoflicker.js` (suite `holoflicker`); `holo.js` `holoKeep` makes the
  layer even while the hologram rests dark. No blur; pictures: `tools/holoflickshots.js` (`V2=1`: four frames
  held by `HoloFlicker.hold`). `darkHides` no longer skips an alien deep in the black while the hologram lights
  the backdrop: it's drawn, so it shows as a silhouette.

## v0.0.148 — Level 2 speed-ups; Flamethrower; Fire Immunity
Released 2026-10-06 (the owner OK'd the screenshots; a minor update). The owner's list, after
playing Level 2 (it dropped frames as a zone came into view and with the aliens about):

- **Drawn at 1.5× and stretched to fit** (`game/dpr.js` `gameDpr`; Dev → Camera & aim, `renderScale`): a phone
  is ~2.6×, so about a third of the pixels to draw.
- **Dark zones** (`render/dark.js`): the back wall blurred once a floor (not every frame); the hologram behind
  the silk blurred only with the new Dev switch `l2dHoloBlur` (off by default); the black's soft edge no longer
  blurred every frame but a banded ramp in `l2dBands` steps (3), made once a floor, with fire's lift taken out
  of it; the per-floor layers made on the floor's first frame (they were made the moment a zone came into view:
  the hitch); the working canvases only grow (a new size every frame was a new canvas every frame).
- **Aliens**: half as many (`alCount` 30–60 a zone); black, without the skin texture; one shared eye picture
  (white, veins, made once) with only the pupil and glint drawn per alien; not drawn at all deep in the black;
  they think in 5 groups, one group a frame, gliding between thinks (`game/creatures/alien.js`).
- Measured (alienperf's spot, software-drawn, CPU slowed 4×): 114 ms a frame → 36 ms.
- **Flamethrower** (`flamer`, a shot mod): a fast spray of short flames the way you aim; they slow, rise, pass
  through creatures and set alight what they touch.
- **Fire Immunity** (`fireimm`, a perk): you never catch fire (`youAlight`); blasts still hurt.
- **Dev → All perks** (owner, to playtest perks): like All mods, every perk in the Exo Suit's grid to fit as
  often as you like, and the suit (and mod editor) usable anywhere while it's on (`LO.debugPerks`, saved).
- Tests: browser `flamer` (new); `perks` (61 perks, Fire Immunity), `dark` (the new knobs); `camera`, `guide`,
  `pixelfx`, `holo` read the canvas's real scale (1.5×, not the screen's); `darkzone` checks the hologram blur
  with its switch on. `shop` ("the coin is gone once collected") fails on v0.0.147 too: not this change.

## v0.0.147 — Level 2: the Tombs
Released 2026-10-06 (every stage's look OK'd by the owner from screenshots; a minor update, for testing).
The owner's brief: LEVEL2.md; the parts and their knobs: HANDOVER.md, "LEVEL 2".

- **Floor 2 is the Tombs** (the theme renamed from Coal seams): an ancient tomb laid out as geometric rooms,
  galleries and shafts in cut stone (`world/tomb.js`), each room furnished by its type with skeletons and
  unlit candles (`world/furnish.js`), and its own carved back wall at the rock's brick scale (`paintTombWall`,
  drawn at terrain resolution: `level.bgHi`).
- **Dark zones** (`world/dark.js`, `render/dark.js`): 2–3 big zones of rough caves and small tunnels under thick
  silk. Inside, the hologram and back wall are blurred behind the silk, everything else is a black
  silhouette past a short fade, your gun light flickers out, and only fire lifts the dark.
- **A wasteland round them** (`world/destroy.js`, the reusable `world/byDistance.js`): 100 real blast holes in a
  ring round each zone, with scorch, soft blast streaks and soot, some burnt out; bones and skulls in the floors.
- **Loot instead of creatures** outside the zones (`world/loot.js`): gold where half a floor's creatures would
  have stood, in mixed nugget sizes, 12 red crystals; a prize in each zone's chamber (1000–2000 gold, 4–6 red or
  1–3 green crystals, at least one zone green). Gold on the ground is saved.
- **The aliens** (`creatures/alien.js`, `game/creatures/alien.js`): hundreds of eyeball creatures on three
  tapered legs, in packs (boids), mostly small with a few big; they flee fire and attack only in the dark;
  black strays outside run home. A passing bullet gives a glimpse of them.
- Dev groups: Level 2: dark zones, destruction, aliens (with bezier curve editors).
- Tests: logic `tomb furnish dark destroy loot2 alien bydistance`, browser `tomb darkzone darkperf alien
  alienperf`; `sound` now hops to floor 14 for its minecart (minecarts came only with floor 2's old decoration).
  Picture tools: `tools/floorshot.js darkshots.js boomshots.js lootshots.js aliensheet.js alienshots.js alienframes.js`.
- `CLAUDE.md`: "Subagents: keep them short" (the owner's rule after long agent runs).

## v0.0.146 — a dark shade under the controls
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A shade under the controls** (owner: so the sticks and buttons stand out): see-through at the map
  button's top, black by the sticks' middles and on down (`.ctlshade`, `shadeAt` in `ui/hud.js`); taps go
  through it; hidden on the map screen.
- Tests: `ctlshade` (new; browser: where it starts and goes black, the sticks still on top; screenshots
  `ctlshade_before.png` / `ctlshade_after.png`).

## v0.0.145 — the way up over the buy machine, the gun light, the teleporter's lightning
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A light on the gun in place of the hand torch** (owner; the torch is archived for creatures later:
  `HAND_TORCH` in `game/systems/player.js`, its code untouched). A steady white cone the way you aim
  (`DEV.beamDeg` 50°), swinging after the aim, reaching `DEV.beamReach` (2.2) × the sight radius and
  uncovering the fog that far along it (`beamFan`; elsewhere the old radius), stopping on rock; a small
  glow round you (`beamNear`); the free hand steadies the gun. No gun in hand (a new run's start): no cone,
  only the glow (owner).
- **A new run's teleporter: no lightning while it charges** (owner), only once you've come through in the
  flash (`render/pads.js`, `introHeld`); the fizz of sparks waits for you too. In the shop hall it reaches only as far as
  the torch did (the hall has its own lights). Dev → Torch & fog: `beamDeg`, `beamReach`, `beamNear`, `beamGlow`.

- **The shop's one hole in the roof is always straight over the buy machine** (owner: so it's obvious
  to find); it was anywhere along the roof. `makeLevel` still makes the old roll, so the rest of each
  seed's cave is the same apart from the route's first stretch up from the hole.
- Tests: `gunlight` (new; logic: the cone's shape and the fan; browser: lit ahead, dark behind, turns
  with the aim, no embers; screenshots `gunlight-*.png`); `torch` (the light holds steady now), `fog` (the
  map reaches the beam's reach); `intro` (no bolts drawn while you're held, bolts after); `shopexit` (new; logic: floors 1–3, every seed, one hole centred on `VEND_BUY_X`; browser: jet
  straight up from the machine into the cave, screenshots `shopexit-*.png`); `level2`'s pinned floor-2
  hashes re-pinned (the shaft moved).

## v0.0.144 — the heal under its light, dust in the cones, the guide's rude line, gun pickup, the arrival
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **The heal** stands centred under its tube (`HEAL_X` 566 → 556, `LIGHT_X[4]`).
- **The guide turns rude only once you walk out of its pool of light** to the right (`guideLitEdge`:
  its section's middle + `poolEdge`, 46), not as you pass it: walking right at full speed it had turned
  rude while still invisible, so it was skipped unseen.
- **Dust in the light cones** (`coneDust` in `render/shoplights.js`), dust-coloured, only ever inside
  a cone; the floor's ambience (floor 1's green spores) no longer spawns or drifts in the shop room.
- **Gun pickup** (`ui/swap.js`, `style.css`; owner): the slot buttons a full-width row of squares at
  the bottom, the two cards splitting the rest equally; the stats one column on the owner's phone, two or
  three across on shorter screens so nothing has to scroll.
- **A new run's arrival** (owner): the teleporter charges for a second (`ARRIVE_T`, `W.intro`; you're
  held, unseen, no torch; light spirals into the pad, the lightning builds, a rising `padCharge` sound),
  then a flash and lightning and you're on the pad (`stepIntro`, `padCharge`/`FLASH_T` in
  `render/pads.js`); a second later the tube over the teleporter flickers on (`LIGHT_WAIT` stays 2 s).
- **A gun's mods as square tiles** (owner): every gun card (the pickup, the gun machine, the Bag's gun
  card, the card by a gun on the ground) shows its slots as the Bag's square mod tiles, empty ones dashed;
  tapping one (not on the ground card) opens that mod's card over everything (`ModPop` in `ui/cards.js`).
  A mod card's examples ("modifiers go to its left"…) are square tiles too.
- Tests: `intro` (new: held while charging, through at 1 s, the tube on a second later; screenshots),
  `gunpickup` (square full-width slots, equal cards), `guide` (logic: the edge; browser: a full-speed walk sees it before it turns rude),
  `shoplights` (the heal under its light; no ambience in the shop; screenshot `shoplights-8-heal-dust`).

## v0.0.143 — the guide's gun: one shot a cast, 0.5 s recharge
Released 2026-10-05 (owner's ask; a minor update). The starter kit's level 5 gun now always casts one
shot (`multi` 1) and recharges in 0.5 s (`GUIDE_GIFTS`' gun takes `multi` and `recharge`; `giveGift` sets them).

## v0.0.142 — empty hands, a free pistol, the crystal machines show how
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A new run starts with no guns and no gold** (`START_GOLD` 0; `App`'s new loadout is four empty
  slots). The Scratch Pistol is `scratchPistol()`; `startingGuns()` stays for the tests, and the browser
  test page still starts with it and 40 gold (`testhook.js`; `window.__TEST_EMPTY` for the real start).
  A save with no guns is a run now (`cleanLoadout` wants a guns array, `sel` 0). No gun in hand draws
  none (`render/actors.js`).
- **The gun machine's first gun is a free Scratch Pistol** while you have no gun (`ui/gunshop.js`:
  "FREE", "Take it"); it stands in front of the offer's first gun, which is still there once you have one.
- **The crystal machines show how** (`stepDemo`/`demoAt`/`demoPos` in `game/systems/shops.js`,
  `drawDemo` in `render/shops.js`): standing within 100 of the nearer one that no real crystal has gone
  into this run (`LO.fed`, saved), a hologram crystal in the guide's look (its pass is now `holoPass`,
  shared) with its own red or green showing through (owner) glitches in on the floor beside it, on your
  side, sits, is sucked into the slot, a flash, 2 s, again.
- **The guide's kit: 2 red crystals** (was 3).
- **The guide waits until it's on screen**: measured at Carrot 0 (the view 225 wide), it jumped out ~27
  in from the right edge with its light mostly off screen. Now its dark spot must be `DEV.guideIn` (50,
  Dev → Guide hologram) in first, or you within `GUIDE_NEAR` (30, was 70); `GUIDE_GONE_X` is gone.
- **Gun and mod machines swapped** (owner): left to right guns, mods, perks.
- Tests: `emptystart` (browser: empty start, the free pistol, the demo with screenshots); `guide`
  (both) and `runner`, `shoplights` logic updated.

## v0.0.141 — a new map, pins, and a guide hologram in a longer hall
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update). The guide greets every
new run, after a death too (owner).

- **The map, rebuilt** (`ui/map.js`, owner: other UI got in the way and the outline lines broke up into
  pixels). A full-screen React screen (`MapScreen`): a picture of the floor as it was made — decoration
  with the rock over it on the floor's dark, a pixel a terrain pixel (`mapPicture` in
  `game/systems/level-entry.js`, into `G.mapC`, at each `enterLevel` and `voidCave`) — fitted to the
  screen's height, under the fog memory (only seen ground shows; it spreads 2 cells into the rock round
  what you saw, `spread`, or walls stayed black), with your helmet where you are, and the shop's machines
  as coloured squares (owner: `MAP_MARKS`; teleporter blue, heal pink, buy cyan, sell violet, mods red,
  guns gold, perks green). The open air is drawn a little lighter than the fog. One
  finger pans, two pinch to zoom (a wheel too). It covers everything but the map button (still under
  your thumb, to shut it) and the pin button. The old canvas map is gone (`drawMap`, `miniEdges`,
  `W.miniEdgeIdx`, `G.miniC`…, `MINI_D`/`MMW`/`MMH`), and with it the loot dots and room outlines.
- **Pins**: on the map screen only (owner), the pin button mirrors the map button on the right (`deckLayout` `pin`). Tap: a grid of pins
  used before (last first; localStorage `caverunner-pins`) and **+** (a box taking one character, an
  emoji counting as one: `firstChar`); hold: drops the chosen pin where you stand (`W.pins`, saved with
  the floor). Pins stand on their spot on the map.
- **The shop hall**: the heal and every machine moved to the far right (`HEAL_X` 566, `VEND_BUY_X` 676 …
  perks at 1156); the teleporter and its sign stay. The light sections run `SHOP_SLOT` apart from the
  teleporter's to the end wall (`LIGHT_X`), each machine the middle of one. **Pools of light** (owner:
  darker between the lights): each tube lights ±30 fading over 16 (`POOL_FADE`, where its cone meets the
  floor), and between pools it's `DEV.shopGap` (0.9) dark, the lit shop too (`shopDark(null, …)`); your
  torch only lifts `DEV.shopTorch` (0.45) of the hall's dark; brighter cones and a pool on the floor
  (`render/shoplights.js`). Dev → Torch & fog has both knobs.
- **The guide hologram** (`world/guide.js`, `game/systems/guide.js`, `game/render/guide.js`): on a new
  run, once the teleporter is off screen the hall ahead snaps on (`lightNear`) and a little see-through
  blue you hovers there, just inside the dark under the tube that snaps on (`guideSpot`: 20 short of the
  first held section's middle; it also jumps out if you come within `GUIDE_NEAR` of it first), invisible until the
  tube over it is lit (`guideShown`: it blinks in with the tube's stutter), in the hologram layer's parallax, waving, distortion bars rolling over it. A speech
  box types the owner's welcome a letter at a time (Dev → **Guide hologram**: `guideCps`, `guideWait`),
  then it throws out the starter kit one thing at a time (150 gold, 3 red + 1 green crystal, Buzzsaw,
  Bolt, Double Cast, a level 5 gun cut to 3 empty slots, not shuffled) and glitches away. Pass through it
  before that: it glitches, types "Rude. Yeh OK have fun!…" and goes, no kit. The hall past it stays dark
  until it's gone (`lightsStep`'s `hold`). New suites: `guide` (logic and browser); `map` rewritten;
  `shoplights` (both) and `shoplayout` follow the new hall.

## v0.0.140 — a red mod machine, a gold gun machine, no Boosted reroll
Released 2026-10-04 (after the owner's OK of the screenshots).

- The mod machine's hue (`SHOPS.mods.hue`) is crystal red `#ff3a4a` (was blue), the gun machine's gold
  `#ffd95a` (was orange; the gold nuggets' own colour, `NUGGET_PAL`): hologram, edge strips, emitter.
- The gun machine's red-crystal **Boosted** reroll is gone (`ui/gunshop.js`: the button, the crystal count,
  the red `Sparks`, `.gboost`). The pure boost helpers in `spells/gunshop.js` (`boostGun`, `boostCost`,
  `shopGun`'s `boost`) stay, unused by the game. `gunshop` checks there's no Boosted button.

## v0.0.139 — the mod machine can repeat
Released 2026-10-04 (logic only: the owner's call in chat).

- The mod machine pops out any mod off the current floor's drop table by its odds (`rollMod`), ones you
  have included, so it may repeat; a new one is unlocked ("Unlocked X"), a repeat just names it. Perks
  stay one of a kind (owner): the perk machine only gives a perk you've never unlocked (`perkRoll`), and
  with none left the crystal gives nothing ("No perks left"). `machineRoll` in `game/systems/shops.js`.
- `crystalmachine` checks both.

## v0.0.138 — crystals are rocks, the machines eat them
Released 2026-10-04 (after the owner's OK of the screenshots).

- **You can't pick crystals up** (`game/systems/pickups.js`: the fly-to-you is gone). A loose crystal is a
  rock: it falls, bounces, rolls and bumps other crystals (`world/nuggets.js` `stepNugget`/`collideNuggets`,
  now taking a radius, `CRYS_R` 8), and walking into it shoves it (`shoveNugget`: out of your box, given
  your speed). A hidden room's green crystal still drops off its altar once you're near.
- **The Gravity Gun drags crystals** (`game/systems/fields.js`): inside a White Hole a crystal is steered to
  its middle and held up (`q.hold`: no gravity), but it moves through `stepCrystals`, so it bumps into rock
  rather than passing through it like other loot.
- **Crystal machines** (`game/systems/shops.js`: `SHOPS[k].takes`, `stepCrystals`, `intakeOf`,
  `machineRoll`, `shakePhase`, `CYCLE` 2.4 s): the mod machine takes red, the perk machine green. One that
  comes within `INTAKE_X` flies into the slot (`SLOT_Y`, `q.into`); each machine works one at a time
  (`W.machines[k]`: `n` queued, `t` into the shake): faster and faster shaking and chase lights, reel
  ticks, then it pops out a new unlock off the current floor's drop table (`crystalRoll`/`perkRoll`, saved
  to the collection; everything unlocked: one you have). Drawn in `render/shops.js` (a slot in the crystal's
  colour, cap lights, the glass flaring).
- **Their menus are archived**: `shopNear` skips a machine with `takes`; `ui/vendshop.js`/`ui/modshop.js` are
  untouched (drop `takes` to bring one back). The gun machine keeps its menu; its Boosted spin needs carried
  red crystals, which only old saves have now.
- Tests: `crystalmachine` (new: sandbox push/hold/drag, the machines); `vendshop`/`perkshop` open the
  archived menus directly; `perks` expects the altar crystal to drop loose.

## v0.0.137 — the Gravity Gun, path mods that work, crystals like gold, burning elites
Released 2026-10-04 (after the owner's OK of the screenshots).

- **No perk column on the play screen** (the Exo Suit tab shows what's fitted): `.perkcol`, `.perkpip`,
  the perk card and `perkTap` are gone; `perkcol.test.js` deleted.
- **Bigger deck buttons** (`ui/hud.js` `deckLayout`): the gun arc sits `DECK_PUSH` (14) px further out
  from the right stick and each button is as big as fits with `DECK_GAP` (6) px between (46 → 62 px on
  a 412-wide phone, max `DECK_MAX` 64); the bag and map match it, the map `DECK_GAP` + 2 above the bag.
- **Crystals are collected like gold** (`game/systems/pickups.js`): no card, no tap; within gold's pull
  (`COIN_PULL × goldPull`) one flies to you through rock; an elite's pile waits `SPILL_WAIT` (`nopull`);
  a hidden room's green crystal comes off its altar as a loose crystal once you're in reach. Their round
  glow is gone: `crystalMotes` (`particles.js`) sheds specks (`'breeze'` motes) that rise and drift on a
  slow cave breeze, and a trail along the way while one flies.
- **Flight paths rebuilt, one shared function** (`spells/paths.js` `pathStep`, used by the bullet loop,
  moving fields and `tracePath`): Boomerang turns for home at half its flight time and is caught (gone)
  back at you; Ping-Pong reverses out `PONG_T`, back half that, on again (it used to flip every frame);
  Spiral Arc is a widening side-to-side swing along the aim (`spiralOff`; it was an offset orbit); Orbiting
  Arc circles what cast it at `ORBIT_R` (your gun, or a trigger's carrier while it lasts, then the spot it
  reached drifting on with its momentum: `anchorOf`/`pathEnv` in `fields.js`, `from` through
  `releaseAt`/`spawnShot`/`castField`).
- **New mods**: **Follow Me** (`follow`, Homing aimed at you; a field hovers `FOLLOW_AHEAD` ahead of your
  gun), **Enlarge**/**Shrink** (`grow`/`shrink`: × / ÷ 1.5 size and every radius, `sizeBy`), **Longer
  Flight**/**Shorter Flight** (`lifeup`/`lifedn`: × / ÷ 1.5 flight time).
- **Static fields move under path mods** (`castField`: `FIELD_SPEED` along the aim, steering with
  `SEEK_ACC`), through rock, still working as they go.
- **Vacuum Field is the White Hole**: a steady pull (`VAC_PULL`, stronger further in, holding things in
  the middle) for 1.2 s, harmless, through walls; creatures, their shots (slowed so they settle), gold,
  loot. No circle: a tiny white-and-blue black hole (`drawWhiteHole`, `render/looks.js`) with specks
  drawn into it (the old portal's `'in'` motes, following a moving hole). `VACUUM_WAIT` is gone.
- **The Gravity Gun**, a third starting gun (`startingGuns`): Follow Me + White Hole. A save from before
  keeps its guns: Dev → Restart run to get it.
- **Elites burn** (`stepEliteFire` in `particles.js`, `drawEliteFire` in `render/actors.js`, over the
  creatures): fire specks from the body, carrying the elite's speed and losing it to air resistance (a
  trail), rising and swinging. **Dev → Elites: flames**: range knobs (rate, length, rise, wavyness and its
  rate, air resistance, size, spawn spread), a gradient editor (`GradEditor`: tap the bar to add a stop,
  drag, pick its colour, delete) and an opacity-over-life B-spline (`RampEditor`: tap to add a point,
  drag, delete), with a live preview (`FlamePreview`). Kept as strings (`DEV.elFxGrad`, `DEV.elFxAlpha`;
  `art/ramps.js`); the Dev store now accepts such strings.
- **The elite's glow is a soft radial gradient** (`drawEnemies`), strongest in the middle and fading to
  nothing at `e.r + elGlowR`: it was a flat disc with a hard rim (the owner: "lose the big circle").
- Suites: logic `paths`, `ramps`; browser `paths` (sandboxed: boomerang, orbit, ping-pong, spiral,
  the Gravity Gun), `elitefx`; `teleport`, `vendshop`, `gunshop`, `perkshop`, `perks`, `cast` updated.

## v0.0.136 — the dark shop, the TELEPORTER sign, gold you can see
Released 2026-10-03 (after the owner's OK of the screenshots).

- **A new run starts in a dark shop** (`world/shoplights.js`, `game/systems/shoplights.js`,
  `game/render/shoplights.js`): the way in crackles blue (and fizzes) while only it and your torch light
  anything; after 2 s the ceiling tube over the teleporter and heal stutters on like a fluorescent tube
  (a click each time it catches, sound `tube`); each time you reach the middle of the last lit section
  the next one flickers on, one vending machine each; the perk section on 3 s (or you leave the shop),
  the rest of the hall comes on in a run. The dark is `drawFog`'s (`fogDark × shopDark`). Every shop now
  has the tubes on its ceiling. Not on a save's reload; the test page only with `window.__TEST_INTRO`.
- **The shop's layout moved along** (`core/consts.js`): the way in's pad centred under its sign
  (`ARRIVAL_X` 66, was 34), the heal just past the sign (`HEAL_X` 124, was 96), then the machines evenly
  spaced, `SHOP_SLOT` (120) apart: buy 210, sell 330, mods 450, guns 570, perks 690 (were 180, 280, 530,
  640, 750), so each light section reveals one. The first section (`FIRST_X` 76) covers the pad, sign and heal.
- **The way in's sign** (`art/sign.js`): "TELEPORTER" painted by hand on a plank nailed at a slant over
  the machine's old "PRINTER" plate (its top and "ER" still showing), the pad centred under the plate.
  "WAY IN" is gone.
- **Gold knocked loose by a kill or a dig waits 0.25 s** (`SPILL_WAIT`, as `nopull`) before it flies to
  you: close by, it used to be taken before it was ever drawn (you heard it, never saw it).
- Suites `shoplights` (logic and browser).

## v0.0.135 — locked perks give nothing away
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The Exo Suit's perk grid hides perks not unlocked yet**: each is a blank dashed tile in its own place
  (no glyph, tint, tier, name or lock), and takes no touch (`pointer-events:none`: no card; a swipe on it
  still scrolls the grid). The grid keeps the perks' own order. Suite `perklocked`.

## v0.0.134 — the vending machines' new screens
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The sell machine is lit from the start**: green "SELL lvl 01" and its price, no fine print. Half a
  second after a level is bought (`SELL_WAIT`) its screen glitches over `SELL_GLITCH` s (bands of the old
  and new screen, torn sideways, a colour-split ghost, white tear lines: `glitch`, `sellScreen` in
  `game/render/vend.js`) to red with "*no biological entities accepted"; and back the same way once sold.
- **Both offers have a new layout** (`deal` screens): "BUY lvl 01" on one line (the verb and number big, "lvl"
  small and leaning), the price in bold under it, fine print small below ("*credit available" on the buy
  machine). Both machines share sizes and positions (the verb's room is SELL's; the price fitted to the sell
  price). The buy machine shows the floor the menu would sell next (`W.floor`).
- **A blocky terminal font** for every machine screen (`art/pixfont.js`: `pixText`, `pixWidth`, `pixHas`;
  glyphs drawn as rects, the same on every phone, no font file). Suite `pixfont`; `vend` checks the sell
  screen's timing.

## v0.0.133 — Restart empties the mods unlocked
Released 2026-10-03.

- **Dev → Restart run starts clean like a death**: `restart` (`ui/app.js`) empties the mods unlocked
  (`collection` and its store); the perks unlocked stay, as on a death. `restart-confirm` checks it.

## v0.0.132 — version numbers are major.minor.patch
Released 2026-10-03.

- **The version is `vX.Y.Z`** (major release, major update, minor update), carrying on from v131 as
  v0.0.132. The app compares an update number, X × 1,000,000 + Y × 1,000 + Z (`tools/build.js` `code`),
  written into the page as `<!-- VERSION = 'v132' -->` and into `version.txt` as `132 v0.0.132`, so the
  app already installed (which reads a plain number) keeps updating. The app's `verNum` reads semver
  first now, and its prompt shows `v0.0.132` (`verLabel`; needs the new APK, optional). Suite `version`.

## v131 — the jet flame comes out of the backpack
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The jetpack's flame and smoke come out of the backpack's nozzle** (`jetNozzle`, `NOZZLE_X`/`NOZZLE_Y`
  in `game/systems/player.js`: behind you, the foot of the pack), not from between your feet; the flame's
  base is slimmed to the nozzle's width (`jetFlame`). `pixelfx` checks it sits on your back's side facing
  either way.

## v130 — the floor menu, levels made ahead, three exits, pixel flames
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The buy machine opens a full-screen floor menu** (`ui/levelshop.js` `LevelVend`, `SHOP_MENUS.levels`,
  the stick pointer like the other machines): each floor's debt, sale price, reward and kill gold. Floor 1
  is always for sale; floor N once N − 1 has been sold this run (`LO.soldTop`, saved; a new run clears it).
  The menu hands back `input.current.buyFloor`; `buyLevel` puts it on the debt and starts the warp.
- **Exponential economy** (`data/levels.js`): the debt starts at a billion (`LVL_BUY`, was 64 billion) × 3
  a floor (`lvlGrow`); the reward on top starts at 1,000 (`lvlBonus`, was `lvlReward`) and doubles a floor
  (`rewardGrow`, 2: 1,000, 2,000, 4,000, 8,000…); kill gold and the heal
  × 1.35 a floor (`killGrow`, `goldScale`, was +30% a floor). A sale always pays the reward and clears
  the debt (an old 64-billion debt can't eat your gold). Old-save mending keeps the old price (`OLD_LVL_BUY`).
- **No freeze at the buy flash** (`game/levelgen.js`): while there's no level, a Web Worker running the
  same bundle makes the floor up for sale; the warp takes it, waiting in the dark up to `WARP_WAIT` if it's
  still coming, or makes it itself if there's no worker. Then its rock goes onto the canvases a band a
  frame from the bottom up (`stepReveal`). Worst frame at the flash with the CPU slowed 4×: 1117 ms → 67 ms.
  A sale no longer makes (and throws away) the next floor's level: the cave is voided in place.
- **No level, no level sounds**: ambience off in `voidCave` (`SFX.setAmbience(null)`), no ambience
  one-shots, the exit's hum silent.
- **Three exits along the top** (`EXIT_X`, `W.portals`, `exits`/`nearExit`), evenly spaced, joined by a
  passage. Floor 2's pinned cave hashes moved (`level2.test.js`).
- **Teleporter pads crackle only when used** (`W.padZap`, `ZAP_T`): going through an exit sets off it and
  the way-in pad.
- **Pixel flames**: the hand torch (`torchFlame`: tongues on their own beats, licks breaking off) and the
  jetpack's flame (`jetFlame`) through `pixelSprite`, the jet smoke through `pixelSoft`, all on the
  player's grid (`DEV.runnerPx`). Suite `pixelfx`.
- **The Exo Suit's perk grid is a ScrollBox** like the Bag's mods: a grab bar, a perk you can fit takes the
  touch (drags without the grid scrolling), the rest let a swipe scroll; a cancelled press opens no card.
  Suite `perkgrid`.

## v129 — vines that trail, Witness fixes, one of each perk, mods reset on death, Dev for floor 2
Released 2026-10-03.

- **A swung vine has a tail** (`world/sway.js` `tailStep`/`vinePt`/`vineJoint`): above the joint
  (`sj`: your grip while held) it's the one straight piece turned by `sw`; below it, `vineLinks` (4)
  verlet links (`tl`/`tq`) hang off the joint under gravity, damped by `vineTailDamp`, so grabbing near
  the top no longer swings the bottom stiff in line. Drawn through `vinePt` (no more canvas rotate);
  `hangX` follows it. The tail is dropped once still, so the vine sleeps.
- **Witness export is the screen's shape**: the copy canvas started 300 × 150 (a new canvas's size), so
  the "size it on the first frame" check never fired and every video was 300 × 150. And while exporting
  the replay draws on the whole screen (`V.full`), not just above the panel.
- **The replay's hologram counts what it counted then**: each snapshot keeps `bio` (`holoCount`, the
  whole floor), and `drawHolo` shows `G.RPV.bio` in a replay (it counted only the creatures recorded
  near you). Older saved clips fall back to the old count.
- **Mods unlocked reset on death** (`hurt` empties `collection` and its store); perks unlocked stay.
- **One of each perk in the suit**: `activePerks` counts a perk once; `cleanPerks` sends a second
  fitted copy back to the carried ones; the Exo Suit grid shows a fitted perk ticked and faded
  (`.xperk.inuse`) and won't fit a second copy.
- **Dev → Level 2: layout & look** (`L2_KNOBS`, `L2_LOOK`, `l2Decor`): every number of floor 2's
  noise cave as a min/max range (rolled on their own generator: at the defaults the caves are exactly
  v128's, pinned in `level2.test.js`), its palette as colour pickers (`themeFor` builds Coal seams
  from them), and a decoration multiplier. **Dev → Floor 2** (`newCave = 2`) goes there.

## v128 — elites drop crystal piles, and a Dev group for them
Released 2026-10-03.

- **An elite drops red and green crystals** (`damageEnemy`): `elRed` reds and `elGreen` greens (3–5
  and 1), thrown out of it; a dropped green is a `crystal` pickup with `green: true` (drawn green,
  saved with the level). **One tap takes every crystal in reach** (an elite's pile), reds to
  `LO.crystals`, greens to `LO.greens`.
- **Dev → Elites** (`ELITE_KNOBS`, `ELITE_COLS`, all min/max): elites per floor (`elCount`, 2–4: replaces
  `ELITE_CHANCE`'s 5%), health, damage, gold reward, red and green crystals, size, tint strength, tint
  and glow colour, glow strength and size. `ELITE_HP`/`ELITE_DMG`/`ELITE_GOLD`/`ELITE_TINT` are gone.
  `makeLevel` still rolls once per creature (so caves are unchanged) and makes elites of the
  `elCount` lowest rolls, the count and each elite's place in the ranges (`k.eu`) hashed from the
  seed. Size and tint follow the knobs live (`eliteLive` in the enemy loop); health and damage are
  set when the floor is made; gold and crystals are rolled when one dies.

## v127 — vines and webs that give
Released 2026-10-02.

- **Web lines, arched vines and hanging vines move** (`world/sway.js`, looks only: no rope physics).
  A line (web line, arch) bends as one damped spring, its bend (`wx`/`wy`) peaking where you touched it
  (`wu`), straight from each end to there (a tent, so it goes taut in a V under you). Web lines sag at
  rest (`L.sag`). Flying through pushes it your way (`bendPush`); grabbing one bounces it
  (`lineSway` in `decorStep`), and held it settles at a dip under your weight. A hanging vine is a
  pendulum (`sw`/`swv`, drawn as the whole vine turned about its root): brushed past it swings;
  held with the stick not pushing across, you swing on it (`movePlayer`, sideways only) and it hangs
  through your hands. Everything that finds a line (`webNear`, `archNear`/`archAt`, `pOver`,
  spiders riding a line) finds it where it's drawn. Only what you touch wakes; it sleeps once still.
- Dev group **Vines & webs: sway** (11 knobs: sag, springiness, settling, push, grab bounce, dip,
  most bend; vine swing pull, settling, push, widest swing).

## v126 — the Carrot stat
Released 2026-10-02.

- **Carrot**, a sixth Exo Suit stat (`STAT_PERKS.carrot`, `pb.carrot` = its level 0–5): it stretches
  the camera distance, the torch's reach, enemy aggro distance and the Trajectory Sight line.
  Each has a Dev min (none fitted) and max (Carrot V) in the new **Carrot** group (`CARROT_KNOBS`,
  `carrotAt(k, level)`); defaults 1→1.35, 1→1.5, 1→1.25, 1→2. `tracePath` takes a `far` stretch.

## v125 — the astronaut, teleporter pads, a steel shop, a steady count
Released 2026-10-02.

- **You're a white-suited astronaut in pixels** (`art/sprites.js`): one `paintBody` from a pose,
  big helmet with a gold-rimmed visor, backpack, chest panel; arms and legs are two bones each,
  knees and elbows solved by `reach` (`runnerPose`: feet from the stride, hands on the gun and the
  torch). Drawn by `pixelSprite` at `DEV.runnerPx` (1 world unit a pixel) on a grid riding with
  you, solid pixels, a dark outline (`runnerLine`); the gun is its own pixel layer on top, aiming as before.
- **The ragdoll has elbows and both hands** (11 joints, `RAG_BRACE`), drawn as the same astronaut
  (`ragPose`; old 8-joint replays get elbows made up).
- **The portals are teleporter pads** (`render/pads.js`): a platform, a blue beam fading upward,
  rising specks, and blue lightning off the pad (the warp's `drawBolt`). No wall torches by them now;
  the way-in motes rise off the pad in blue. "Find the exit pad at the top".
- **The shop is steel** whatever the floor (`shopPanel`: roof with ceiling lights, deck floor, side
  columns; the back wall's panels, rivets and lit rail in `drawTerrain`).
- **Vending machines left to right: mods, guns, perks.**
- **The hologram's count only goes down**: it went back up as nests let new rats out. A nest now
  holds a fixed brood (`nest.left`, Dev `raBrood` 4–6) counted while inside (`bioCount`); the
  autosave keeps it (`brood`). Selling needs the nests emptied or destroyed.
- **Lines don't trap you**: on a web line or an arched vine, any push mostly across it (any way,
  not only down), or along it past an end, lets go (`lineLetGo`, `LINE_OFF`), and the push carries you off.
- Dev: `enemies` / `enemiesUp` (how many a new level gets), `lvlReward` (`lvlSell`), `runnerPx`,
  `runnerLine`, `raBrood`. The Dev panel's group headers open on a **press and hold**
  (`DevGroupHead`), and the jellyfish preview sits inside the Jellyfish colours group.

## v124 — saved death replays, video export, the ragdoll
Released 2026-10-02.

- **Your corpse is a ragdoll** (`world/ragdoll.js`: eight joints, sticks, the rock, floor friction,
  `RAG_SLUMP` so it topples rather than sits), drawn solid with the runner's parts (`drawRagdoll`);
  it used to freeze at 35% alpha. Dead, `movePlayer` runs `corpseStep` and you follow the hip; a
  blast after death throws it (`explode` → `ragPush`). The replay copies it (`rag`, `joints` in `RP_DEEP`).
- **The replay has sound**: `recSfxHook` wraps `SFX`'s one-shots and loops once for the page, the
  recorder keeps `REC.sfx` and each snapshot's loops; `rpSound` plays them as the clock passes.
- **Saved replays**: the live replay is a `Clip` now (`input.current.witness`, `V.clip`); **💾 Save**
  (`clipKeep`) cuts it to the box round your path plus `DEV.witPad` (`clipCrop`), with the floor's
  `SCENE_KEYS`, the gun in hand and the background, packs it (gzipped JSON, `clipPack`: ~0.5–1.5 MB
  for 13s, from ~8 MB) into IndexedDB (`save/clips.js`) with a thumbnail of the death. The Bag's
  third tab **Witness** (`WitnessGallery`) lists them: tap to play full screen (camera held inside
  what was kept), ✏️ Rename, 🗑️ Delete.
- **🎬 Export video** (`exportClip`): plays it once as set up, records the play area and the sound
  (`SFX.stream()`), MP4 straight from `MediaRecorder` or WebM → MP4 with ffmpeg.wasm; saved through
  the app's new bridge (`VideoSaver`, reinstall the APK once) or downloaded in a browser.
- A replay now sees the rock as it was (`RT.mat` from the terrain's pixels), not today's.
- Dev → **Witness (death replays)**: `witPad` (80), `witKbps` (6000).
- The gold no longer shows over the replay.

## v123 — Dev knobs for the menu pointer
Released 2026-10-02.

- Dev → **Menu pointer & snapping** (`g: 'menuptr'`): `ptrStart` (stick push before the ring comes out,
  0.12; a tap under it presses the lit button), `ptrReach` (× the far-corner distance, 1), `ptrSize` (×
  the knob, 1), `ptrLine` (ring px, 0.75), `snapR` (28px), `snapPull` (0.3), `snapHit` (10px). They
  replace `MENU_PTR` and the `SNAP_*` constants.

## v122 — Questions Later; the pointer moves to the right stick, with a snap
Released 2026-10-02.

- New passive mod **Questions Later** (`auto`, ⇶, 70g, tier 2, drops on every floor: `OURS_AUTO`): the
  held gun fires as if the trigger were held (`gunPassives().auto`, `aimAndCast`), aimed where the
  right stick points or the way you face.
- The menus' pointer is the right stick now (`useMenuNav`): it comes out once the stick is pushed
  past `MENU_PTR` (0.12); a plain tap still presses the lit button (`Stick`'s `peak`). A gentle snap
  (`snapTo`): the nearest visible button within `SNAP_R` 28px pulls the ring up to `SNAP_PULL` 0.3 of
  the way to its middle and counts as under it within `SNAP_HIT` 10px.

## v121 — the menus' left-stick pointer
Released 2026-10-02.

- In a vending machine's menu the left stick is a pointer (`useMenuNav`, `menuPointer` in
  `ui/vendshop.js`): dragging it shows a second knob, a 0.75px ring with no fill (`.mptr`), at the
  stick's centre plus its direction × its 0..1 × the distance to the furthest screen corner, held
  inside the window. It lights the `[data-nav]` it's over and presses it on release. The stick
  publishes its centre and size (`StickState.cx/cy/size`). The arrow keys still step.

## v120 — the perk machine, green crystals, the Exo Suit
Released 2026-10-02.

- A third machine (`SHOPS.perks`, a green ✦ hologram, left of the guns): the mods' menu with a
  `perkShop` def (`ui/modshop.js`): a green crystal unlocks a perk you don't have (`perkRoll`;
  kept across runs, `caverunner-perkcollection`), gold (`PERK_PRICE` 200) dispenses a copy that
  pops out as a `perk` pickup. `ShopDef.unlock.name` names the crystal.
- One hidden room a floor, its altar holding a green crystal (`kind: 'green'`, `LO.greens`); the
  heart room is gone. Old saves' perk and heart rooms still work.
- Perks are carried (`LO.perks`) and count only fitted to the Exo Suit's `SUIT_SLOTS` (6,
  `LO.suit`; `activePerks`). A pre-suit save's switched-on perks are fitted (`cleanPerks`).
  Fitting runs `applyPerks` (the extra health comes full, the eye lights the floor, the ghost).
  The perk column shows the fitted ones; the on/off toggle is gone.
- The Bag has tabs along the bottom (`ui/exosuit.js` `Bag`): Guns & Mods (the Editor) and the Exo
  Suit (portrait, stats, six slots, the perk grid; drag to fit, tap for the card).
- Stat perks (`STAT_PERKS`, ids `st_<stat><1-5>`): Max Health, Movement Speed, Jetpack Fuel (`pb.fuel`:
  the tank drains slower), Jetpack Recharge (`pb.refuel`), Gold Vacuum, five levels each, priced
  `STAT_PRICE` 60–650g. The suit (`SUIT_LEN` 11) has a slot per stat beside its row (`fitsSlot`: stat
  perks only there, the rest only in the six). `perkRoll` unlocks a stat's levels in order.
- The top bar shows the crystals as a row of red and green silhouettes under the gold (`CrystalRow`).

## v119 — the gun vending machine, elites, crystals at the top
Released 2026-10-02.

- A second machine (`SHOPS.guns`, the gun sprite as its hologram) with its own menu
  (`ui/gunshop.js` `GunVend`, in `SHOP_MENUS`): three guns of the floor's pool (`LO.gunShop`,
  `spells/gunshop.js`) as slot-machine reels on the left with prices (`shopGunPrice`: `gunPrice` ×
  level), the selected gun's card on the right, and Buy selected / Reroll (gold, `rerollPrice`, ×1.6
  each use on the floor) / Boosted (red crystals, `boostCost` = uses + 1: 1–3 levels deeper,
  `boostGun`). Reels stop one at a time, overshoot, thud (`reelThud`/`reelTick`); a boosted roll
  spins faster with red sparks streaming past. A bought gun pops out of the chute (GunSwap as usual).
- The cave's guns are red crystals now too (12 a floor).
- Elites (`eliteOf`, `ELITE_CHANCE` 5%): ×2.5 health, ×1.5 damage, ×4 gold, gold-tinted with a glow,
  and they drop a red crystal that falls to the floor (thrown pickups now land on any rock).
- The stick navigation is a shared hook (`useMenuNav`); `CrystalIcon` moved to `ui/hud.js`.
- The top bar shows the red crystals you carry, beside your gold.

## v118 — the mod vending machine and red crystals
Released 2026-10-02.

- The shop's plinths of mods (or guns, on even floors) are gone; only the heal is left on one. In
  their place a vending machine in the middle of the room, a flickering ⚙️ hologram on its glass
  (`game/systems/shops.js`, `render/shops.js`). "Tap R to shop" opens its menu (`ui/vendshop.js`):
  the collection (every mod by rarity, empty cells until unlocked), the red crystal button (a
  crystal unlocks a mod you don't own off its floor's drop table: `crystalRoll`), and "Dispense
  selected" (buys a copy, `MOD_PRICE`; it pops out of the machine's chute onto the floor).
- The collection is kept across runs (`caverunner-collection` in localStorage, `loadCollection`).
- The cave's 7 mods are red crystals now (`kind: 'crystal'`, `floor`); carried in `LO.crystals`.
- The menu is generic: a `ShopDef` per machine (`ui/modshop.js`, `SHOP_DEFS`), so a gun or perk
  machine is a `SHOPS` entry and a def. The left stick moves the highlight, a right-stick tap presses it.
- Extra Item in Holy Mountain is gone with the plinths (30 perks); `gunshop` suite removed.

## v117 — a Dev knob for level 1's repay time
Released 2026-10-02.

- Dev → Level layout (floor 1) → "Time to repay level 1 (minutes)" (`DEV.due1`, default 60).
  `dueMs(floor)` in `dev/knobs.js`: floor 1 the knob, the rest keep `DEADLINE_MS`. It sets the
  deadline when you buy the level, so a level already bought keeps its clock.

## v116 — the hologram flashes on a kill
Released 2026-10-02.

- The hologram rests at brightness 0 (`DEV.holoMin`) and a kill (the count going down) throws it up
  to `DEV.holoMax`, fading back over `DEV.holoFade` seconds along a bezier curve
  (`bezierFade` in `core/util.js`; control points `holoC1x`..`holoC2y`, shaped on the Dev panel's
  `FadeCurve`). One multiplier (`holoBright()`, times `holoAlpha`) over the layer, its fog swap and
  its bloom; at 0 none of the three run. Repossessed, it stays lit.
- Software-rendered, the sandbox room: ~19ms a frame lit, 16.7 (the 60fps cap) dark.

## v115 — the hologram, its fog and the glows at the rock's pixel size
Released 2026-10-01.

- The battery: the hologram was made every frame at full canvas resolution (a tilted fill twice
  the view, ~250 scan lines), its fog swap at 1/2 and its bloom at 1/4, about 85% of the drawing.
  Now all three work on one grid of `DEV.holoPx` world units a pixel (default 2, the rock's),
  fixed to the hologram so its pixels slide with it (`holoGrid` in `holo.js`), scaled up crisp.
  At 2 the small words go to pixel squiggles (the number reads); 1 keeps them readable.
- `holoAlpha` 0 now skips the hologram's work entirely (it used to build the layer and hide it).
- `drawGlows` draws the glows into a rock-pixel layer and adds it once (`DEV.pixelFx`: 1 crisp,
  0 smooth; the fog swap too). Glowing particles stay full size.
- Software-rendered, flying through a cave: ~69ms a frame -> ~20ms (24 at `holoPx` 1).

## v114 — a quick Bag with a big gun
Released 2026-10-01.

- The Bag's dmg/s line re-ran the whole build advisor, parked swap tips included, on every render,
  and a drag re-renders per move: with a 26-slot gun one drag cost ~380ms of script on a PC (far
  more on a phone), and taps queued behind it (the "lag closing the Bag"). `buildAdvice(gun, bag,
  withTips)`: the editor passes `SHOW_TIPS` and keeps the result in a `useMemo` on the build's sig.
  The same drag now costs ~50ms. `bagspeed` (browser) times it; `advice` (logic) checks the
  tipless answer matches.

## v113 — steady camera in fast flight
Released 2026-10-01.

- The camera eased 15% toward you *per frame*, so how far it trailed you hung on each frame's
  length: on a phone (uneven frames, the odd dropped one) you jittered against the screen flying
  fast sideways, up to ~10 device px. It now eases by the sim's clock (`W.camT`; 15% per 60th of a
  second, so at an even 60fps it is as before).
- You are drawn nudged under a pixel (`F.snapX`/`snapY`, round `drawJetFlame`/`drawAim`/`drawPlayer`)
  so your place on screen follows your distance from the camera, not the world's pixel rounding.
- `camera` (browser) flies across a sandbox with a jittery, dropping frame clock at 60 and 120Hz.

## v112 — gold nuggets
Released 2026-10-01.

- Gold is nuggets now (`world/nuggets.js`, drawn by `drawNugget`): big 25, medium 5, small 1. Every drop
  (a kill, a rat's load, a nest, a gold seam) goes through `spillGold`/`splitGold`: as many big ones
  as fit, sometimes one fewer, then medium the same way, small for the change; it adds up exactly.
- Loose nuggets have physics (`stepNugget`: fall, bounce, roll downhill, hop pixel steps) and push
  each other apart (`collideNuggets`; one resting on the rock holds still under one on top). The old
  bob and the rat's separate `pop` arc are gone. `sandbox({ ramp: true })` for the browser suite.

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
