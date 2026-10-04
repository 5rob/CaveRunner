# game/systems/ — one frame of the simulation, by job

Plain functions taking `(W, G, …)` / `(W, …)` (`game/README.md` has the shapes). `step.js` runs
the frame; most of its parts live with their system.

| File | Holds |
|---|---|
| `step.js` | `step(W, G, dt)`: makes `F` and calls, in order: `stepRequests` (clock, Dev asks; New cave, or `newCave` = a floor number, ends the frame), `stepPerks`, `movePlayer`, `atPortal` (fills `pcx`/`pcy`; the exit takes you back to the shop and ends the frame), `aimAndCast`, `stepBullets`, `stepSound`, `stepFields`, `stepPickups`, `stepWarp`, `stepLights`, `stepRepo`, `stepToasts`, `decorStep`, `stepEnemies`, `stepGhost`, `fireFrame`, `stepTrail`, `stepParticles`, `W.best`, `stepTorch`, `stepMotes` |
| `terrain.js` | Questions: `solidCell`, `solidAt`, `boxHit`, `lineOfSight`, `enemyAt`. Changes: `dig`, `unDeco`, `paint`, `explode`, `dropOre` |
| `player.js` | `refreshBag`, `maxHp`, `hurt`, `torchHand`, `jetNozzle` (the backpack's nozzle, `NOZZLE_X`/`NOZZLE_Y`: where the jet flame and its smoke come out), the jetpack's cough `sputterStep`/`SPUTTER_FUEL`, `NO_INPUT`, `lineLetGo`/`LINE_OFF` (hanging from a web line or arched vine: any push mostly across it, or past an end, lets go; `letGo` carries you off), `movePlayer` (stick, jetpack, steering, climbing, the move, footsteps; dead, it runs `corpseStep`: the ragdoll, `world/ragdoll.js`, which you follow), `stepTorch` |
| `gun.js` | `cast` (one pull through `planCast`), `spawnShot`, `releaseAt`/`firePayload` (a trigger's payload), `aimAndCast` (aim, Pinpointer, facing, gun clocks, the trigger) |
| `bullets.js` | `stepBullets` (the bullet loop), `critRoll`, `shove`, `spray`, `explodeCross`, `teleportTo` |
| `fields.js` | `castField` (a path mod sets a field moving), `fireBeam`, `throwEmbers`, `fieldPayload`, `stepFields` (the White Hole's pull, `VAC_PULL`, and its motes), `anchorOf`/`pathEnv` (what `pathStep` reads: you, the spot ahead of your gun, an orbit's anchor moved on) |
| `shotlooks.js` | What a shot sheds: `shotTrail`, `shotBounce`, `shotDeath`, `shotGrind`, `glowDot`, `rnd` |
| `lightning.js` | `jag`, `addArc`, `lightningStep` (a bolt's forks) |
| `enemies.js` | `stepEnemies` (the shared part of the enemy loop, `game/creatures/README.md`), `damageEnemy`, `fireEnemyShot` |
| `pickups.js` | `stepPickups`: ground pickups, shop stock, room prizes, gold, crystals (fly to you like gold, v0.0.137: no card, no tap; a room's green one comes off its altar), the card that shows, the interact tap |
| `props.js` | `decorStep` (anchors, falling, shootable props, drips, plants and web lines under you → `W.zfx`, rustles; with `pOver`, `alertAt`, `shatter`, `popLamp`, `landProp`, `spawnDrip`, `MATERIAL`, `DRIP_RATE`), `blowProp` |
| `fire.js` | The fire's Game side: `fireFrame`, `ignite`, `fireBlast`, `setAlight`, `youAlight`, `fireOut`/`flushFire`, `catchPlant`/`catchArch`/`burnWeb`, `fireList`, `stepTrail` (Levitation Trail) |
| `ambience.js` | `spore`, `puffSpores`, `stepAmbience`, `AMB_RATE`/`AMB_MAX` |
| `particles.js` | `burst`, `goo`, `splat`, `toast`, `stepToasts`, `stepParticles`, `stepMotes` (also a White Hole's `'in'` motes, `q.f` = the field, and crystals' `'breeze'` motes), `crystalMotes`, `stepEliteFire` (the elites' flames, `W.eliteFx`, `ELITE_FX_MAX`) |
| `fog.js` | `fogLit`, `roomSeen`, `seenAt`, `paintFog` |
| `webs.js` | `webNear`, `webDist` |
| `plantglow.js` | `plantGlow` (the jelly's glow on plants, drawn after the fog) |
| `level-entry.js` | `enterLevel(W, G, back, keep)`: makes (or rebuilds a saved) level, resets the world, canvases, fog, sconces (the prize rooms' only: the portals are pads), the recorder; puts back a saved nest's brood; `keep` leaves you (and the stock) where you are for a teleport; `miniEdges` (the map outline cells) |
| `vend.js` | The level vending machines: `vendNear`/`vendLabel`/`vendUse` (via `stepPickups`: the buy machine opens the floor menu, `shopOpen = 'levels'`, `ui/levelshop.js`; the sell machine pays `lvlReward(floor)` and raises `LO.soldTop`), `buyLevel` (the menu's `input.current.buyFloor`, read at the top of `stepWarp`: `lvlBuy(floor)` on the debt), `canSell` (no `bioCount`), `stepWarp` (the teleport: swap at `WARP_SWAP`, held up to `WARP_WAIT` while the worker is still making the level; takes it with `takeLevel`; a sale voids the cave in place and sets the next floor and seed), `stepReveal`/`putRows` (a bought level's rock onto its canvases a band a frame, bottom up, `W.reveal`, `REVEAL_T`; whole-width ImageData rows, so not recorded as patches), `voidCave` (no level: BED above the roof, the roof sealed, ambience off, `preLevel` for the floor up for sale), `voidCave` (no level: BED above the roof, the roof sealed), `stepRepo` (the deadline passed: repossession, the alarm, the fire; `REPO_WARP`/`REPO_ALARM`/`REPO_FIRE`) |
| `shops.js` | The shop's vending machines (`SHOPS`: x, icon, hue, label; three machines left to right: mods, guns, perks; another machine is a `SHOPS` entry and a `SHOP_MENUS` line in `ui/modshop.js`): `shopNear`/`shopUse` (opens `input.current.shopOpen`; checked after the ground pickups so a dispensed mod can be taken), `stepShops` (in `stepPickups`: `input.current.dispense` — a mod, gun or perk — pops out of the chute; anything thrown with a `vy` (that, an elite's crystals) flies and lands on rock) |
| `shoplights.js` | `shopDarkStart` (Game.js, a run with no save; the test page only with `window.__TEST_INTRO`) and `stepLights` (`W.shopLit`, `world/shoplights.js`: the way in crackles until the first tubes, a `tube` click as each tube flickers on, `W.shopLit = null` once all are on) |
| `recorder.js` | The death replay's recorder (snapshots, terrain, fog and every sound) and player (any `Clip`: the live one or a saved one), `clipKeep`/`clipThumb`/`clipFromSaved` (saved clips) (`replay/README.md`) |
| `save-run.js` | `saveRun` (`save/README.md`) |

## Rules

- **Terrain changes draw through `G.tctx`/`G.dctx`** (the recorder's wrapped contexts), and
  `dig`/`unDeco`/`explode` zero `W.fuel` and the fire timer for what they clear. `dig`/`explode`
  count gold-seam pixels and call `dropOre` (gold worth `ORE_GOLD` × floor lift × `W.pb.gold`, spilled as nuggets by
  `spillGold`, fractions kept in `W.oreBank`). Loose gold (`W.coins`) moves by `stepNugget` and
  `collideNuggets` (`world/nuggets.js`) in `stepPickups`, unless it is flying to you (`g.fly`).
- **`W.zfx` is written by `decorStep` and read by the *next* frame's steering** (`slow`, `slick`,
  `climb`, `rev`, `web`, `webMul`, `arch`, `surface`). Climbing = on a climbable and **not** jetting
  (hang, fuel comes back, the stick climbs at `CLIMB`). On a web line or an arch you run *along* it;
  pushing down (not along) lets go (`W.webLetGo`, 0.35s).
- **Props:** `decorStep` checks a thirtieth of the props per frame with `propAnchored`; one that
  lost its rock falls, and `landProp` breaks it, blows it (carts, pods) or settles it. Shootable
  props catch a bullet by setting `b.life = 0` (so payloads still fire); pass-through shots
  (`pull`/`eat`/`bore`) count once via `b.propHit`. Drips each keep their own clock (`pr.dn`/`pr.di`).
- **The bullet loop:** a bullet with `eat` digs its radius every frame it lives, and passes through
  rock instead of dying on it (as `bore` does); the bounce guard skips both. Mirror any flight change
  in `tracePath` (`spells/README.md`). The Black Hole (`b.pull`): pull reach `DEV.bhPull × b.pull / 70`,
  drag grows toward the centre and is capped so it never overshoots, it doesn't die on a creature and
  clears `b.hit` every 0.3s so it grinds, enemy shots in reach bend in and die. A `tele` shot's death
  moves you with `teleportTo` (backs up its track, nudges ±16 until `!boxHit`, else fizzles).
  Vacuum Field warps everything within `r` to its middle once, at `VACUUM_WAIT`, walls ignored.
- **Pickups:** standing by one shows its card; the card's panel floats above the item
  (`input.current.promptBottom`, measured here from the last frame's camera). An interact tap on a
  **mod** takes it at once (`LO.bag`, `q.taken`, `PICKUP_COOL`); on a **gun** sets
  `input.current.found`, which opens `GunSwap` (owner's choice). A bought gun drops at the plinth, so
  the same chooser handles it. **Dead + interact tap = restart** (`input.current.requestRestart`),
  checked before the pickup handling.
- **Crystals:** a `crystal` pickup is red, or green with `green: true` (an elite's drop). Tapping one takes
  every crystal in reach (an elite's pile): reds to `LO.crystals`, greens to `LO.greens`.
- **Jetpack cough:** below `SPUTTER_FUEL` (0.25) `sputterStep` cuts the jet for 0.04–0.17s at random,
  more often the drier it is. `W.p.jet` stays the stick; `W.p.flame` is 0 during a cut and is what the
  flame, smoke, glow, Levitation Trail and jet loop read. A cut: no lift, `vy += DEV.sputDip`, grey
  puffs; `p.cough` briefly stops the rise snap so the dip shows. Jet pitch climbs over 3s held
  (`jetPitch`).
- **Fire (Game side):** `ignite` lights pixels, `FLAMMABLE` plants (vine, myc), web lines and carts;
  `fireBlast` runs in `explode` unless `splash` (`hot` = 0.9 chance); creatures and you catch off
  burning pixels (`e.burn`/`p.burn`, damage in chunks), `FIRE_WET` surfaces put you out; Stillness and
  Thundercloud douse (`fireDouse`) every 0.15s. **Fire must not reveal fog** (`world/README.md`).
- **Lines and vines give** (`world/sway.js`): `decorStep` steps an arch's and a web line's bend
  (`lineSway`: held = `W.zfx.climb` is it and no jet) and a hanging vine's swing; `movePlayer` swings you
  on a hanging vine when the stick isn't pushing across (`W.p.swing`, then the vine follows you).
  Anything that finds a line uses `webNear`/`archNear`/`pOver`, which include the bend and swing.
- **Footsteps:** cadence `|vx|/40` per second on the ground, `land` when falling faster than 200,
  both voiced by `W.zfx.surface`.
- **Motes** (`W.motes`, drawn additive): `drift` (Black Hole trail), `in` (pulled into the exit
  portal), `out` (breathed out of the arrival point).
