# game/creatures/ — layer 5: each creature's part of the enemy loop

The pure brains and sprites are in `src/creatures/` (its README has the full "adding a creature"
recipe). Here is what needs the running game (terrain, you, sound, particles).

| File | Holds |
|---|---|
| `acts.js` | `ACTS`: act → `{ pre, move, contact, fire, die, frame }`, one line per act (REFACTOR.md D20) |
| `classic.js` | The acts the not-yet-reworked creatures share, whatever their body: `classicMove` (hunt or patrol: chase, bomb, shoot), `bombFuse` (pre), `bombBurst` (contact), `gunFire` (fire: shoot, turret; a turret has no move) |
| `spider.js` | `spiderMove` (the crawl, the string shot), `spiderFrame` (once a frame: silk in flight, strings on you, web lines whose rock is gone), `drawSilk` (a part of draw) |
| `jelly.js` | `jellyMove` (the swim, the tentacles' sting, the spit), `natural` (where a jelly may swim) |
| `alien.js` | `alienMove` (the brain's env, the bite only in the dark; returns true: no shared bite), plus once a frame the alien bucket grid and the fire points (burning cells sampled to ~400, blasts, burning bodies) and whether you're in the dark; far aliens (>700) think every 4th frame |
| `rat.js` | `ratFrame` (goal picking + safety nets), `spawnRat`, `navFor`, `unstick`, `ratSolid`, `onWebIn`, and the hooks `ratMove`, `nestMove` (lets rats out), `nestDie` (the gold shower) |

## How the enemy loop calls them

`stepEnemies` (`game/systems/enemies.js`) runs the shared part for every enemy — timers, aggro,
the hover bob, the contact bite, Contact Damage, enemy shots — and calls the act's hooks exactly
where its old inline branch sat:

- `pre(W, G, e, C)` before the move (a bomber's fuse); `move(W, G, e, C)` the act's move — `true`
  = it did its whole frame; no `move` = it stays put (a turret); `contact(W, G, e, C)` when hunting
  and touching you, before the shared bite — `true` = it's gone; `fire(W, G, e, C)` after contact;
  `die(W, e)` in `damageEnemy` after the splice — `true` = no ordinary coin; `frame(W, G, F)` once
  a frame after the enemy shots.
- `C` is one object `stepEnemies` refills per enemy: `dt`, `pcx`, `pcy`, `i`, `dx`, `dy`, `dist`,
  `sees`, `hunting`. A hook reads it with `const { … } = C;`.
- An act missing from `ACTS` gets `chase`'s hooks (`damageEnemy` has no such fallback: only `nest`
  has `die` today).
- **Hooks are `function` declarations**, not `const` arrows: `ACTS` is built at load inside an
  import cycle, and a hoisted function is always there (D17, D20).
- **Act and body are separate**: four classic acts are shared by 11 creature types; drawing goes
  by body (`drawEnemy`). The loop runs **backwards** because a bomber splices itself out mid-loop.
- Enemy behaviour belongs to the creature: `e.k` (from `enemyFor`) carries its stats, `e.k.act`
  how it moves and fights, `e.k.body` its sprite, `e.k.col` its colours. Enemy shots carry their
  own `dmg`, `col`, `size` — there is no global enemy damage.

## Aggro (the shared part)

For `HUNTERS` (chase, bomb, spider, jelly, rat): aggro is **acquired** only within
`reach = k.aggro × sees × DEV.aggro` (× the rolled `kp+'Aggro'` for a reworked creature) **and** on
a real `lineOfSight` (range checked first, so the exact march only runs for the few close enough).
Once acquired it's **sticky** — it follows you out of reach and round walls — until you put
`reach × DEV.loseAggro` between you. `sees` = `1/DEV.zoom` (reach tracks camera zoom; ×0.4 with
Invisibility). `hunting = chaser && e.aggro`. Shooters and turrets gate *firing* on
`lineOfSight` + `k.range` on their own; `DEV.aggro`/`loseAggro` leave `k.range` alone.

## Per creature

- **Enemy shots** can carry `goo` (a glob), `drip`/`dripG` (falling particles per second),
  `splat`/`splatV` (a burst on rock or you) and `fire` — any creature can use them
  (`goo()`/`splat()` are `game/systems/particles.js`).
- **Spider silk:** `W.silk` = strings in flight, `W.strings` = stuck to you; each string's rolled
  `slow` multiplies your steering, and one pulled past its snap length breaks. **Web lines are
  vines:** `decorStep` latches the nearest line within its `grab` (`W.zfx.web` + `climb`), you run
  *along* it, pushing down (not along) lets go (`webLetGo`); each line you touch multiplies
  `W.zfx.webMul`. A line's `slow`/`grab`/`climb` are rolled once and stored on it, so it doesn't flicker.
- **Jelly:** spits from its head when `S.inRange && S.aimed` with a line of sight; the spit copies
  its colours (`jellyPal`). On each pulse the Game calls `puffSpores(W, e)` (`systems/ambience.js`).
  `natural` is the `env.stay` it gets on zoned floors. Its plant glow is `systems/plantglow.js`.
- **Rats:** a nest lets one out (`spawnRat`) when you're within `wake`, its timer is up, fewer
  than `max` are out and it has any left (`nest.left`, a fixed brood rolled in `makeLevel` from
  `raBrood`; `bioCount` counts them, so the hologram's number only goes down; the autosave keeps
  each nest's brood plus its rats out, which aren't saved). `ratFrame` picks the goal in order: carrying → home; a loose coin within
  `raSmell` → the coin; hunting → your feet; else roam round the mouth. A bite (`raBite`, ×`raBroke`
  if you have no gold) knocks a `raSteal` coin out of you (`pop` physics, `nopull`). `ratSolid` =
  rock + `W.burrow` (every nest room/tunnel), so rats run over holes and only go in by tunnel mode.
  Nav fields are cached by `navFor` (per nest, per coin, `W.navYou` every 0.4s) and rebuilt at most
  once a second when rock changes (`W.terrainV`). Safety nets (`unstick`): stuck 1.2s → hop; three
  hops → a carrier slips home underground, others give up (`e.giveUp`); also when the nav distance
  hasn't improved by 3 in 4s; in rock or off the map 0.5s → back out of its hole. Far rats sleep.
  Every dead enemy gets `e.dead` (rats check `home.dead`); a nest drops `raNestGold` + its stash.
