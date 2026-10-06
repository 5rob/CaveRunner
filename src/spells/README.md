# spells/ — layer 3: spells, guns, casting

| File | Holds |
|---|---|
| `mods.js` | `MODS` (every spell, a plain object; `off: 1` = kept but never handed out), `FAMILIES`/`FAMILY_OF`/`famCol` (the 8 colour families), `MOD_PRICE`, `MOD_TIER`/`tierOf` (rarity 1–4), `TRIG_KINDS`/`TRIG_VARIANTS` (the trigger variants), `ALL_IDS`, `SHOT_IDS`, `SEED_SHOTS`, `VACUUM_WAIT`, `TIMER_ADD` |
| `spawn.js` | Which spell a floor hands you: `NOITA_SPAWN`, `NOITA_OF`, `floorTier`, `TIER_FLOOR`, `modWeight(id, floor)`, `rollMod` |
| `guns.js` | `makeGun(rnd, lvl)`, `caveGun`, `gunLevel`, `scratchPistol`, `startingGuns`, `GUN_RANGE`, `gunStat`, `gunLvTier`, `RARE_GUN`, `resetGun`, `shuffleOrder`, `gunPrice`, the colours (`gunColor`, `gunAccent`, `GUN_LV_COL`) |
| `cast.js` | **`planCast(g, others)`, the heart of the game**: what one pull of the trigger fires. `blankShot` (every field a shot has), `effRecharge`, `gunPassives`, `MIN_CAST`/`MIN_RECH` |
| `paths.js` | **The flight paths** (v0.0.137): `pathStep(o, dt, env)` moves a shot, a moving field or the aim line's pretend shot by Boomerang (`BOOM_*`), Ping-Pong (`PONG_T`), Spiral Arc (`spiralOff`, `SPIRAL_*`), Orbiting Arc (`ORBIT_*`), Follow Me (`FOLLOW_AHEAD`) and a field's homing, returning extra movement `[ex, ey]` on top of `v·dt`; `hasPath`, `FIELD_SPEED`, `SEEK_ACC` |
| `trace.js` | `tracePath` (flies a shot forward for the aim line), and the flight helpers the bullet loop shares: `driftStep`, `wigTurn`, `bhSp` |
| `advisor.js` | `gunRate`, `buildAdvice` (`SHORTLIST`), `modPreview`/`previewPlan` (a mod card's use-example) |
| `bagsim.js` | The bag screen's pure side: `castGroups`, `pullSteps`, `groupStats`, the trigger-held preview `fireSimNew`/`fireSimStep`/`fireSimGauges`, `statQual`, `gunModDeltas` |
| `collection.js` | The vending machine's collection: `modTiers` (every `ALL_IDS` mod by `MOD_TIER`, the grid's groups), `crystalRoll(rnd, floor, owned)` (a red crystal's unlock: the floor's `modWeight` table minus what you own, then anything you don't, then null). Stored (emptied when you die) by `save/save.js` (`loadCollection`/`saveCollection`) |
| `gunshop.js` | The gun machine's offer: `newOffer`/`rollOffer` (`GUN_OFFER` guns), `shopGun` (the floor's `gunLevel`, or boosted: `BOOST_UP` deeper + `boostGun`), `shopGunPrice`, `rerollPrice(floor, n)`, `boostCost(n)` |

The game side of casting (spawning shots, the bullet loop, fields and beams) is in
`game/systems/` (`gun.js`, `bullets.js`, `fields.js`); a shot's look is `game/render/looks.js`
and `game/systems/shotlooks.js`.

## Rules

- **`planCast(g, others)` mutates `g.idx`**: it walks the slots from where the gun left off.
  Callers that only look (previews, the advisor, `castGroups`, the fire preview) pass a copy.
  It returns `{ shots, defs, start, cost, delay, acts, hp, wrap }`.
- **Spell kinds.** `shot` (a projectile) and `static` (a field that stays put) take a cast slot,
  so multicasts gather them. `mod` and `util` don't (`util` also carries an `act` string the game
  switches on). `passive` works from anywhere on the gun. **A modifier affects only the NEXT
  spell drawn after it** (the next `shot`/`static`; owner's rule, replacing Noita's "everything
  after it"). Modifiers in a row all land on that one spell; the spell after it is bare. In
  `planCast` the waiting modifiers are handed to each spell as it is drawn (`modsOf`) and
  cleared; a payload does the same with its own `pm`. Modifiers with nothing after them in the
  pull are wasted; a multicast that wraps carries them to the first spell at the front. Timing
  (`d`, `setDelay`), mana, `hp`, `acts`, `multi`, `form` and Add Trigger are unchanged.
- **Copies (the Greek letters) are fiddly** (they are `off: 1` today, code and `spells.test.js`
  checks kept for bringing them back). They push ids into a queue drawn before the gun's own list,
  and must widen `multi` for themselves *and* their originals or the multicast limit eats them.
  They never copy a copy, never expand after a wrap-around, and `multi` is clamped to what the gun
  can produce. Break one and Omega or Myriad runs away.
- **Triggers are variants, Noita-style.** No stand-alone trigger spells: `TRIG_VARIANTS` builds
  `bolt_t`, `arrow_ti`, `void_d`… from a base spell (`trig` = `'hit' | 'timer' | 'expire'`, `draw`,
  `timer`, `mark` = the tile's badge; `base` = the spell it came from). Add Trigger/Timer/Expiration
  (`addTrig` mods) make the next *shot* a carrier. A carrier's payload is `payloadOf(draw)` inside
  `planCast`: a mini-cast isolated both ways from the main pull (depth cap 6, one shared wrap,
  `took` stops a wrap redrawing anything drawn this pull). In the game: `'hit'` fires on first
  contact (`b.struck`) and is lost on plain expiry; `'timer'` fires when `b.timer` runs out and
  flies on; `'expire'` fires on any death; beams release at their end, crystals when they go off.
- **Cast delay vs recharge.** Cast delay adds up in draw order, and a few mods (Buzzsaw's
  `setDelay: 0`) *reset* it rather than subtract, so position matters. Recharge counts every slot.
  `effRecharge(g)` is the one true answer.
- **Flight paths are one function** (`pathStep`, `paths.js`): the bullet loop, `stepFields` (a field with
  a path mod moves) and `tracePath` all call it, so a path changed there changes all three. Its world
  (`PathEnv`: you, the spot ahead of your gun, an orbit's anchor, the creatures) comes from `pathEnv`
  (`game/systems/fields.js`) in the game and from the gun's spot in `tracePath`. An orbit circles your
  gun, or a trigger payload's carrier (`anc`, from `anchorOf(from)`: `from` is passed through
  `firePayload` → `releaseAt` → `spawnShot` → `castField`). A boomerang's life is stretched (to
  `BOOM_MAX` × its flight) until it's back; it's caught (gone) within `BOOM_CATCH`.
- **Enlarge / Shrink** go through `sizeBy` (mods.js): a new radius field on a shot belongs there too.
- **The aim line must stay honest.** Anything that changes how a bullet flies goes in the bullet
  loop (`stepBullets`, `game/systems/bullets.js`) *and* in `tracePath`, or the line lies; there's a
  test per path mod (`tests/logic/aimline.test.js`). Mirrored today: `drag`, `bounceE`, `wig`,
  `vmax`/`accel`, drift (`driftStep`), `reach`, passing through rock for `eat`/`bore`, the Black
  Hole's speed (`bhSp` at spawn *and* in the line, so speed mods still stack). The line only draws
  with the Trajectory Sight perk (`W.pb.trajectory`, `drawAim`); `tracePath` runs regardless.
- **The advisor prices resources.** `gunRate` scales damage by mana sustain *and* health drain,
  so a build that bleeds you dry isn't credited with damage you'd never live to deal. A new mod
  that spends something: make sure `gunRate` sees the cost. `buildAdvice` shortlists
  (`SHORTLIST`) because the editor calls it; if the editor is slow, look there. Its swap tips are
  parked (`SHOW_TIPS = false`, `ui/editor.js`), so the editor calls it with `withTips` false (the
  tips are nearly all its work) and only when the build changes (`useMemo` on the gun's sig: a
  drag re-renders the Bag on every move; `bagspeed` times one).
- **A new spell needs** a `NOITA_OF` entry (its Noita twin, or it never drops; `spells.test.js`
  checks every `ALL_IDS`), a `SPELL_VOICE` entry (`audio/recipes.js`, tested), a `MOD_PRICE`, and
  its flight in `tracePath` if it flies differently.
- **Drops follow Noita's spawn table.** `NOITA_SPAWN` is copied from `gun_actions.lua`; made-up
  spells borrow the nearest twin (`cold`/`battery` have `OURS_*` rows). `floorTier`: floor 1 = tier
  0, floor 10 = tier 6, linear between, >10 = tier 10. **`TIER_FLOOR` gate:** a `MOD_TIER` 4 spell
  (Black Hole, Glitter, Storm, Saw Storm) has weight 0 before floor 4, whatever Noita says.
  `MOD_TIER` is otherwise only for trigger-variant pricing. Sources: the tier list
  https://noita.wiki.gg/wiki/Wand_and_Spell_Tiers; spawn numbers from
  `data/scripts/gun/gun_actions.lua`, projectile numbers from `data/entities/projectiles/deck/*.xml`
  in https://github.com/Jazzer360/noita-data-parsing. wiki.gg blocks curl ("Blocked - wiki.gg"):
  read it with WebFetch, and go to the GitHub files for exact numbers.
- **Spells follow their Noita twin's character** (v95/v96; Black Hole left alone, the owner likes
  it). The kit any spell can use, all through `blankShot`: `drag`, `bounceE` (speed kept per
  bounce, default 0.92), `pit` (dig where it dies on rock), `wig` (`wigTurn`), `vmax`, `accel`,
  `lifeBoom` (explodes when life runs out), `reach` (default 10, muzzle distance), `look` +
  `light`/`lightR` (sprite, trail, glow), `fire`, `tele`, `drift`/`homeR`/`pop` (Pollen), `hidden`
  (not drawn), `sid` (the spell id, for sound). Trigger variants inherit their base's look.
- **Gun levels (the owner's rule: no cave-height influence).** `makeGun(rnd, lvl)` takes a level
  1–10; `gunLvTier(lvl) = (lvl-1)/9`; each stat has `[worst, best]` in `GUN_RANGE` and `gunStat`
  rolls level 1 anywhere in the range, level 10 in the best tenth. Cave guns are the floor's level,
  or with `RARE_GUN` (0.2) a level from floor+1 to 10; shop guns the floor's. `g.lvl` is saved and
  colours the gun (`GUN_LV_COL`); starter guns have no `lvl`.
- **Starter guns:** since v0.0.142 a new run starts with **none** (and 0 gold, `START_GOLD`): the gun machine gives a
  `scratchPistol()` free while you have no gun (`ui/gunshop.js`). `startingGuns()` (the old start, kept for the tests
  and the browser test page) = `[Scratch Pistol (selected), Pick Axe, Gravity Gun, null]`
  (the Gravity Gun, v0.0.137: `['follow', 'vacfield']`, a White Hole hovering ahead of your gun) (owner's
  order). The pistol is deliberately worse than any floor-1 find. The Pick Axe holds one Buzzsaw
  (`saw`): a melee slice, `speed: 0`, `reach: 5`, `size: 15`, `eat: 14` (digs its radius every frame,
  whether or not its centre is in rock), `hidden: 1`, `setDelay: 0`.
- **Pollen** (`drift: 1`, `homeR: 80`, `pop: 6`): `driftStep` damps it and, once slow, floats it
  up; it homes only after locking on (`b.lock`: the nearest creature within `homeR` in line of
  sight); `tracePath` mirrors it. `pop` = a small `explode` with `splash` on contact (never hurts
  you); a Borer/Eater before it still tunnels (checked before the pop).
- **`eat` tunnels through rock**: a bullet with `eat` digs and passes through instead of dying on
  the wall (else a fast Matter Eater outruns its hole). The Black Hole's dig (`eat: 19`) is exactly
  its drawn core.
