# save/ — layer 4: the autosave

`save.js`: `SAVE_KEY` (`caverunner-save` in localStorage), `GUN_DEFAULTS`, `readSave`,
`cleanLoadout`, `cleanGun` (pure, tested), `loadSave`, `clearSave`. Writing the save is
`saveRun` (`game/systems/save-run.js`). `cleanPerks` fits a perk once at most (v129: a second copy in
the suit goes back to the carried ones). The unlock collections have their own keys, untouched by
`clearSave`: `COLLECTION_KEY` (mods: **emptied on death**, `hurt` in `game/systems/player.js`, v129) and
`PERK_COLLECTION_KEY` (perks: kept across runs).

`clips.js`: the saved death replays, in IndexedDB (`CLIP_DB` = `caverunner-clips`; localStorage is
far too small): `clipList` (the gallery's `ClipMeta` cards, newest first), `clipGet` (unpacks one),
`clipPut` (packs it: `clipPack`, gzipped JSON, `replay/clip.js`; `meta.bytes` is the packed size),
`clipRename`, `clipDelete`, `clipName`. Every call resolves (null / false / []) rather than throws.

## Rules

- **Old saves are forgiven**: unknown mod/perk ids are dropped, missing gun fields filled from
  `GUN_DEFAULTS`, `sel` moved to a real gun. **A new loadout field must be added to
  `cleanLoadout`**, or it is dropped on load.
- The save holds the cave's `seed` and the perks owned on entry (`owned`: `makeLevel` reads it, so
  the same seed needs the same list), the alive enemies' `sid`s (tagged by index in `enterLevel`),
  sold stock and taken rooms by index, and the ground pickups whole (guns get swapped on the ground).
- **The cave only comes back when `ver === VERSION`**; after an update, gear + floor + hp survive on
  a fresh cave (the generator may have changed). You always respawn at the floor start (dug terrain
  isn't saved).
- `saveRun` runs every 2s, on floor change, on `visibilitychange` → hidden and on `pagehide`; death
  and Restart call `clearSave()`. `App` loads it once (`useState(loadSave)`) and hands
  `input.current.saved` to the Game, which calls `enterLevel(W, G, back)`.
- **Don't change `LOCAL_URL`'s host** in the Android shell (`MainActivity.java`): the page origin
  (`appassets.androidplatform.net`) is what keeps localStorage across updates and reinstalls.
- Tests: `tests/logic/save.test.js`, `tests/browser/save.test.js` (`pagehide` re-saves on reload, so
  the browser suite forges an old save with `addInitScript`).
