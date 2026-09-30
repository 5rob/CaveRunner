# replay/ — layer 4: the death replay's pure part ("Witness yourself")

`replay.js`: what is recorded and how it blends — `RP_HZ` (20 snapshots/s), `RP_BEFORE` (10s),
`RP_AFTER` (3s), `RP_KEEP`, `RP_W`/`RP_H` (the box round you that is recorded), `RP_LISTS`,
`RP_NUMS`, `RP_DEEP`, `RP_LERP`, `RP_ANGLE`; `rpClone`/`rpCopy`/`rpLerp`/`rpList`/`rpAt`/`rpFrame`
(snapshots), `rpCut`/`rpPaste`/`rpMerge` (terrain patches).

The recorder and player are `game/systems/recorder.js` (`recWrap`, `recReset`, `recSample`,
`recFrame`, `rpTerrain`, `drawReplay`); the screen is `ui/witness.js` (`Witness`, `RP_SPEEDS`).

## How it works

- **Recording:** `recFrame` runs after every stepped `step()`; `recSample` pushes a snapshot to
  `G.REC.snaps`: `rpClone` of every entity of `RP_LISTS` within the box, the player, the ghost,
  `RP_NUMS`, and the burning pixels. Each entity gets a stable id (a WeakMap) so frames blend.
- **Terrain:** `recWrap(G)` wraps `G.tctx`/`G.dctx.putImageData`, so every partial put (dig,
  explode, unDeco, paint, the fire flush) lands in `REC.dirty`; each sample turns those into
  `REC.patches` (the rect's pixels *after*). `REC.tBase`/`dBase` are the pixels as of the oldest
  snapshot; while you live, anything older than `RP_KEEP` is folded into the base. Fog the same way
  (`REC.fogBase` + `REC.fogLog`).
- At death `REC.deathT`; it samples on for `RP_AFTER`, then `REC.done` and
  `input.current.witness = { t0, t1, death }`. `recReset` in `enterLevel` clears it.
- **Playing:** `App` opens `Witness`, which sets `input.current.replay = { t, speed, playing, fog,
  follow, zoom, cx, cy, unit, panelH, loop }`. While set, the loop skips `step()` and calls
  `drawReplay`: it rebuilds terrain on its own canvases (`RT.tC`/`RT.dC`, from the base + patches ≤ t;
  from the base again on a scrub backwards) and the fog (`RT.fog`), builds `rpFrame`, **swaps it into
  the live world, calls the real `draw()`, and swaps the live world back** in a `finally`. `draw()`
  reads `G.RPV` for the camera, zoom, the play area above the panel, terrain from `RT`, no aim line,
  optional fog, and no HUD. The replay loops by default (`V.loop`, the **Loop** toggle).

## Rules

- **If a creature's sprite reads nested state that changes, add its key to `RP_DEEP`**, or the
  replay shows today's value. A field that should slide goes in `RP_LERP` (angles: `RP_ANGLE`).
  `rpClone` copies own fields and deep-copies only `RP_DEEP` keys; everything else is shared.
- **A new way of changing terrain must go through those two wrapped `putImageData`s**, or the
  replay misses it.
- Snapshots share references (`sp.line` → a web with `owner`), so they don't `JSON.stringify`
  as-is (matters for saving replays, not built yet — nor a "killed by" caption, which needs the
  source plumbed through `hurt`).
- In a replay, `drawFog`'s `visPoly`/`fogReveal` use the *live* `W.mat`, not the rock at the
  replay's time (REFACTOR.md, Found along the way).
- Cost measured on a real floor: ~0.1ms per sample, ~8MB for the full 13s with 13 creatures near.
- Tests: `tests/logic/replay.test.js`, `tests/browser/replay.test.js` (sandbox; hooks `__lvl.rec`,
  `rt`, `recSample`).
