# replay/ — layer 4: the death replay's pure part ("Witness yourself")

`replay.js`: what is recorded and how it blends — `RP_HZ` (20 snapshots/s), `RP_BEFORE` (10s),
`RP_AFTER` (3s), `RP_KEEP`, `RP_W`/`RP_H` (the box round you that is recorded), `RP_LISTS`,
`RP_NUMS`, `RP_DEEP`, `RP_LERP`, `RP_ANGLE`; `rpClone`/`rpCopy`/`rpLerp`/`rpList`/`rpAt`/`rpFrame`
(snapshots), `rpCut`/`rpPaste`/`rpMerge` (terrain patches).

`clip.js`: saved replays. `clipCrop` cuts a clip to the box round your path (`lim`: your path plus
`DEV.witPad`, where the camera may go; plus `WIT_HX`/`WIT_HY`, a view round that): entities outside
it, patches, fog and burning pixels outside it, sounds outside the span are dropped; `SCENE_KEYS`
(the floor's portals, shop, theme, perk bag…) and `held` come along as `scene`, the background's
pixels as `bg`. `clipSafe` makes anything storable (drops functions and page objects, keeps shared
and circular references), `sfxArgs` is how a sound call is kept (a cast: `SHOT_SND` only),
`clipHydrate` blows a saved clip back to world size, `clipEnc`/`clipDec` + `clipPack`/`clipUnpack`
are the store's format (JSON with `$id`/`$ref`, base64 typed arrays, 3 decimals; gzipped: a 13s
clip is ~0.5–1.5 MB), `clipBytes` an estimate.

The recorder and player are `game/systems/recorder.js` (`recWrap`, `recSfxHook`, `recReset`, `recSample`,
`recFrame`, `rpTerrain`, `drawReplay`, `rpSound`, `rpSoundOff`, `clipKeep`, `clipThumb`, `clipFromSaved`);
the screen is `ui/witness.js` (`Witness`, `RP_SPEEDS`), the gallery and video export `ui/clips.js`,
the store `save/clips.js`.

## How it works

- **Recording:** `recFrame` runs after every stepped `step()`; `recSample` pushes a snapshot to
  `G.REC.snaps`: `rpClone` of every entity of `RP_LISTS` within the box, the player, the ghost,
  `RP_NUMS`, and the burning pixels. Each entity gets a stable id (a WeakMap) so frames blend.
- **Terrain:** `recWrap(G)` wraps `G.tctx`/`G.dctx.putImageData`, so every partial put (dig,
  explode, unDeco, paint, the fire flush) lands in `REC.dirty`; each sample turns those into
  `REC.patches` (the rect's pixels *after*). `REC.tBase`/`dBase` are the pixels as of the oldest
  snapshot; while you live, anything older than `RP_KEEP` is folded into the base. Fog the same way
  (`REC.fogBase` + `REC.fogLog`).
- **Sound:** `recSfxHook` wraps `SFX`'s one-shots (`SFX_REC`) once for the page, so each call made
  while recording (not paused) lands in `REC.sfx` as `[t, name, args]`; `SFX0` keeps the real calls.
  Loops (`SFX.loop`) are tagged, and each snapshot keeps the live ones as `S.loops`
  (`[id, kind, level, x, y, pitch]`).
- At death `REC.deathT`; it samples on for `RP_AFTER`, then `REC.done` and
  `input.current.witness` = the live `Clip` (`{ t0, t1, death }` and the recorder's own arrays).
  `recReset` in `enterLevel` clears it.
- **Playing:** `App` opens `Witness`, which sets `input.current.replay = { t, speed, playing, fog,
  follow, zoom, cx, cy, unit, panelH, loop, clip, full, bio }` (`full`: exporting, drawn on the whole
  screen; `bio`: the hologram's count from the nearest snapshot, which keeps `bio` = `holoCount`). While set, the loop skips `step()`, plays the
  clip's sounds (`rpSound`: one-shots the clock passed, loops as the snapshot had them, heard from
  where you were; silent on a scrub) and calls
  `drawReplay`: it rebuilds terrain on its own canvases (`RT.tC`/`RT.dC`, from the base + patches ≤ t;
  from the base again on a scrub backwards or a new clip), the rock (`RT.mat`: solid where the terrain
  pixel is opaque, which is exactly `W.mat`, `witnessclip` checks it) and the fog (`RT.fog`), builds
  `rpFrame`, **swaps it into the live world, calls the real `draw()`, and swaps the live world back**
  in a `finally`. A saved clip also swaps in its `scene`, its background canvas (`bgC`) and a
  loadout holding its gun, and keeps the camera inside `lim` (zoom ≥ 1). `draw()`
  reads `G.RPV` for the camera, zoom, the play area above the panel, terrain from `RT`, no aim line,
  optional fog, and no HUD. The replay loops by default (`V.loop`, the **Loop** toggle).

## Rules

- **If a creature's sprite reads nested state that changes, add its key to `RP_DEEP`**, or the
  replay shows today's value. A field that should slide goes in `RP_LERP` (angles: `RP_ANGLE`).
  `rpClone` copies own fields and deep-copies only `RP_DEEP` keys; everything else is shared.
- **A new way of changing terrain must go through those two wrapped `putImageData`s**, or the
  replay misses it.
- Snapshots share references (`sp.line` → a web with `owner`), so a saved clip goes through
  `clipSafe` and `clipEnc` (references kept as `$id`/`$ref`). Not built: a "killed by" caption, which
  needs the source plumbed through `hurt`.
- **A new kind of sound call** (a new public `SFX` one-shot) goes in `SFX_REC`, or replays are silent
  for it; one whose arguments are big live objects needs its own case in `sfxArgs`.
- **A new floor-wide field `draw()` reads** (not per-moment) goes in `SCENE_KEYS`, or a saved clip
  played on another floor draws today's.
- Cost measured on a real floor: ~0.1ms per sample, ~8MB for the full 13s with 13 creatures near.
- Tests: `tests/logic/replay.test.js`, `tests/logic/clip.test.js`, `tests/browser/replay.test.js`
  (sandbox; hooks `__lvl.rec`, `rt`, `recSample`), `tests/browser/witnessclip.test.js` (die, save,
  gallery, rename, play, export an MP4, delete).
