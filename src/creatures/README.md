# creatures/ — layer 4: creature brains and sprites (pure)

| File | Holds |
|---|---|
| `common.js` | The shared movement pieces — **reach for these first for a new creature**: `roamStep(R, e, dt, rnd, pre, ok)` (a roam spot drifting round home), `turnToward(a, to, max)` (turn-rate limit), `flyMove(e, V, dt, r, solidCell, bounce)` (a free flyer, sub-stepped, bounced off rock), `surfNormal` (smoothed normal + nearest rock), `surfSeat` (sit on a surface: push out of rock nearer than `hold`, else pull in along the normal — stops pixel snagging) |
| `spider.js` | Hämähäkki: `spiderStep` (state `e.sp`, modes `fall`/`surf`/`line`/`shoot`), `spiderSeat`, `spiderAim`, `segNear`, `SPIDER` (body geometry only), `drawSpider` |
| `jelly.js` | Myrkkymeduusa: `jellyStep` (state `e.je`), `jellyBell`, `segHitsBox`/`tentacleTouch` (stings), `jellyPal`, `drawJelly`, and the plant-glow comp `plantGlowFill`, `plantWhite`, `twinkle`/`twNoise` |
| `rat.js` | Rotta and its nest: `ratStep` (state `e.ra`, modes `surf`/`air`/`tunnel`/`path`), `ratFooting`, `ratJump`, `ratSpread`, `pathAt`/`pathLen`, `RAT`, `drawRat`, `drawNest` |
| `classic.js` | Sprites of the bodies not reworked yet: `drawDrone`, `drawCrawler`, `drawBlob`, `drawSkull`, `drawWorm` |
| `alien.js` | The dark zones' alien: `drawAlien` (the sprite), `ALIEN` (geometry), and the brain `alienStep` (state `e.al`, `AlienBrain`), `alienBrain`, `alienBoids` (the pack's three terms), `alienGrid`/`alienNear` (the once-a-frame neighbour buckets) |
| `draw.js` | `drawEnemy(ctx, e, time)`: picks the sprite by `e.k.body`, plus the charged-shot ring |

Each creature's Game side (its part of the enemy loop) is in `game/creatures/` — see its README.
The type tables are `data/creatures.js`; the knob tables are `dev/knobs.js`.

## Adding (or reworking) a creature

The owner reworks the enemies one at a time. A creature is:

1. **Its pure file here**: brain (`<name>Step(e, env, dt)`, state on `e.<kp>`; the world comes in
   through `env` callbacks like `env.solidCell`) and sprite (`draw<Body>(ctx, …)`), plus a line in
   `drawEnemy`. The `creatures` logic suite checks every body has a `draw<Body>(ctx`.
2. **Its Game side** in `game/creatures/<name>.js` and one line in `ACTS` (`game/creatures/README.md`).
3. **Its `CREATURES` entry** (`data/creatures.js`): `name`, `body`, `act`, `col` (`{ a, b, c, eye }`),
   `hp`, `dmg`, `r`, `spd`, `aggro`, … and `kp` (its knob prefix). Add it to `HUNTERS` if it hunts,
   `NATURAL_ONLY` if it keeps to natural zones. A new field the game reads off `e.k` must also be
   copied in `enemyFor` (`data/README.md`).
4. **Its knobs, every one a min/max range rolled at each use** (the owner's rule): a
   `rangeKnobs('<group>', rows)` table in `dev/knobs.js` plus a `DEV_GROUPS` entry; read with
   `kr(k, rnd)` (or `kru(k, u)` for a look rolled once per creature as `S.u.*` that should still
   update live). Colours via `colourKnobs`. `SPIDER`/`RAT`/`JELLY` keep only body geometry.
5. **`kp` means "reworked, runs its own step"**: the enemy loop then rolls its aggro reach from
   `kp+'Aggro'` once a second, bites with `kp+'Bite'`/`kp+'BiteCd'`, skips the hover bob, and
   `damageEnemy` sets aggro when you hurt it. `k.glow` (an `'r,g,b'` string) + `kp+'Glow'`,
   `'GlowR'`, `'Flare'` knobs give an additive glow after the fog, `fogLit`-gated.
6. **Replay:** if its sprite reads nested state that changes (like `e.sp`, `e.je`), add the key to
   `RP_DEEP` (`replay/replay.js`), or the death replay shows today's value; a field that should
   slide goes in `RP_LERP` (angles in `RP_ANGLE`).
7. **Sound:** it falls back to its body's voice (`BODY_VOICE`); give it its own via `CREATURE_TONE`
   if wanted.
8. **Tests:** a logic suite on hand-made grids plus a run on real floor-1 caves, and a browser suite
   in the sandbox (CLAUDE.md, testing).

## Rules per creature

- **Every brain must always have a clock running.** If a spider's `decide()` finds nothing to do it
  gets a 0.1–0.3s retry rest; before, arriving left both clocks ≤0 and it froze for good. The logic
  suites run every spider on real caves and fail if any sits still.
- **Spider:** crawls rock and its own web lines only, in bursts and rests. On rock: goal·normal ≥
  `spDot` → ride a line within `spGrab` that way, else shoot one (`spiderAim`, ≤ `spWeb`, rate-limited
  per mode), else walk the tangent. Lines live in `W.webs` and drop when their rock is dug out.
- **Jelly:** a pulse is a thrust along its head (`hd`, turned by `turnToward`) over `jePushT`, only
  when facing within `jePushTol` of the goal; then `exp(-drag·dt)` and a small sink. Roaming it idles
  head-up at the roam spot; hunting it stops pulsing within `jeRange × sees`. `S.shape` = thin at
  speed, flat at rest; `jellyBell` is the outline both sprite and tentacle roots use. Tentacles
  follow the leader with sway and droop, drawn as tapered ribbons (owner likes the tips folding back
  freely: no stiffness), and any segment crossing your box stings (`tentacleTouch`, hunting or not).
  It keeps to natural zones via `env.stay`: the roam spot turns back at the edge, it won't pulse if
  the glide would end outside, and if it's outside (`lost`) it forgets you and heads home. All its
  colours go through `jellyPal(u)` / `jcol`.
- **Plant glow** (the owner's VFX comp): green channel, levels with black point `white × (1 − top%)`,
  **held out where green isn't the strongest channel** (else gold seams and pale flowers set the white
  point), × a linear ramp to `reach`, × `twinkle`, × strength × alpha, in the jelly's glow colour,
  added after the fog on `seen` ground only. `plantWhite` = 99.9th percentile of green over green-led
  pixels with **alpha ≥ 128** (faint anti-aliased edges once pinned it to 255).
- **Rat:** surface crawl like the spider (`surfSeat`); with a way found (`env.follow`) it runs
  **path mode** along `navWay` waypoints in ≤0.8-unit steps — but only with footing (`ratFooting`:
  rock under or beside within `RAT.hold + 5`, or a web line); off it, it falls, and a way that goes
  up or across open air is a jump (`ratJump`). The follow branch is skipped while in the air so a
  jump isn't cancelled. Ceilings are judged by the *nearest* rock (`S.py`), not the averaged normal
  (cracks misread). Falling off an overhang bars that side 1.5s. Job rats don't rest. Roaming rats
  spread out (`ratSpread`). Returns `'home' | 'out' | 'jump' | 'land'`.
- **Alien:** moves only where `walk` allows: open, in its own zone (`S.z` = darkMask value; a stray anywhere),
  on silk or by rock (`surfNormal` within 8); somewhere it shouldn't be, any open cell until it's back. Priority:
  a stray that has seen you sprints to `env.home` → fire within `alFleeR` (runs directly away, 0.4–0.8 s after)
  → in the dark (`env.youDark`) and hunting: comes and bites (`'bite'`, the Game hurts) → hunting in light: backs
  off inside `alKeep` → roam bursts (`alRoamOn`/`Off`, `alSpeed`; a clock always runs). Boids over `env.near`
  (`alBoidR`, `alSep`/`alAli`/`alCoh`) are added to every mode but a stray's sprint. Blocked: slide, else turn aside
  (`dodge`). `rot` = underside to the nearest rock (0 free on silk), `walk` = speed / 120, the pupil darts 0.2–0.8 s
  or stares at you when `env.look`. A stray turns normal (`'home'`) the moment it's in a zone.
