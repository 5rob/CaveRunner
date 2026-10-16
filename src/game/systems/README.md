# game/systems/ — one frame of the simulation, by job

**grem branch (CaveRunner Grem, v2.0.0):** cut from this folder as unused by Grem Mode: `ambience.js`, `bullets.js`, `enemies.js`, `fields.js`, `fire.js`, `fog.js`, `guide.js`, `gun.js`, `level-entry.js`, `lightning.js`, `particles.js`, `pickups.js`, `plantglow.js`, `player.js`, `props.js`, `recorder.js`, `save-run.js`, `shoplights.js`, `step.js`, `terrain.js`, `vend.js`, `webs.js`. Anything below that still names them describes `autobattler` / `main`, where they live on.

Plain functions taking `(W, G, …)` / `(W, …)` (`game/README.md` has the shapes). `step.js` runs
the frame; most of its parts live with their system.

| File | Holds |
|---|---|
| `shotlooks.js` | What a shot sheds: `shotTrail`, `shotBounce`, `shotDeath`, `shotGrind`, `glowDot`, `rnd` |
| `shops.js` | The shop's vending machines (`SHOPS`: x, icon, hue, label; three machines left to right: guns, mods, perks (swapped in v0.0.142); another machine is a `SHOPS` entry and a `SHOP_MENUS` line in `ui/modshop.js`): `shopNear`/`shopUse` (opens `input.current.shopOpen`; checked after the ground pickups so a dispensed mod can be taken), `stepShops` (in `stepPickups`: `input.current.dispense` — a mod, gun or perk — pops out of the chute; anything thrown with a `vy` flies and lands on rock); **crystal machines** (v0.0.138, `takes: 'red' | 'green'`: mods and perks, no menu, `shopNear` skips them): `stepCrystals` (crystals as rocks, `stepNugget` with `CRYS_R`, shoved by you with `shoveNugget`, held by a White Hole's `q.hold`; within `intakeOf` one flies into `SLOT_Y`; `W.machines[k]` queues them, `CYCLE` s of `shakePhase` then `machineRoll` pops a mod off the floor's table, repeats allowed, or a perk never had: perks are one of a kind); **the demo** (v0.0.142): `stepDemo` (in `stepCrystals`) runs `W.demo[k]` while you stand within `DEMO_NEAR` of the nearest crystal machine no real crystal has gone into this run (`LO.fed`, set as one is taken, saved), its crystal on your side; `demoAt(t)` (in / sit / suck / flash / a 2 s gap, `DEMO_LOOP`), `demoPos` (the suck's path into `SLOT_Y`) |

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
  **mod** takes it at once (`LO.bag`, `q.taken`, `PICKUP_COOL`). A **gun** is taken by holding a HUD
  gun slot (v0.0.149, owner): a gun in reach is published as `input.current.gunNear`; `takeGun(W, G, i)`
  puts it in slot i (the slot's old gun stays on the ground in its place, `q.old`; empty-handed, you
  hold it). `dropGun(W, G, i, x, y)` drops slot i's gun at world (x, y) settled onto the floor below,
  or at your feet if that spot is rock or out of sight (`lineOfSight`); the gun in hand going → the
  next one you have. Game wires both onto `input.current` (screen → world through the camera). The
  interact tap on a gun only toasts now; with `input.current.gunMenu` (archived) it still sets
  `input.current.found` → `GunSwap`. A bought gun drops at the plinth, so the same hold takes it. **Dead + interact tap = restart** (`input.current.requestRestart`),
  checked before the pickup handling.
- **Crystals:** a `crystal` pickup is red, or green with `green: true`. You can't take one (v0.0.138):
  it's a body (`stepCrystals`) you push, or drag with a White Hole, into its machine. `LO.crystals`/`LO.greens`
  only hold what an older save carried (nothing spends them now).
- **Jetpack cough:** (`sputterStep` lives in core/util.js since v1.0.38, shared with Auto) below `SPUTTER_FUEL` (0.25) `sputterStep` cuts the jet for 0.04–0.17s at random,
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
