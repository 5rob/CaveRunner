# save/ — layer 4: the autosave

`save.js`: `SAVE_KEY` (`caverunner-save` in localStorage), `GUN_DEFAULTS`, `readSave`,
`cleanLoadout`, `cleanGun` (pure, tested; v0.0.155: a gun named Gravity Gun gets `followaim` for an old `follow`), `loadSave`, `clearSave`. Writing the save is
`saveRun` (`game/systems/save-run.js`). `cleanPerks` fits a perk once at most (v129: a second copy in
the suit goes back to the carried ones). The unlock collections have their own keys, untouched by
`clearSave`: `COLLECTION_KEY` (mods: **emptied on death**, `hurt` in `game/systems/player.js`, v129) and
`PERK_COLLECTION_KEY` (perks: kept across runs).

`clips.js`: the saved death replays, in IndexedDB (`CLIP_DB` = `caverunner-clips`; localStorage is
far too small): `clipList` (the gallery's `ClipMeta` cards, newest first), `clipGet` (unpacks one),
`clipPut` (packs it: `clipPack`, gzipped JSON, `replay/clip.js`; `meta.bytes` is the packed size),
`clipRename`, `clipDelete`, `clipName`. Every call resolves (null / false / []) rather than throws.

`audit.js` (LIST3 #6): the owner's audit of mods and perks, localStorage `AUDIT_KEY` (`caverunner-audit`),
kept across runs and deaths, never cleared by the game: `{ 'mod:<id>' | 'perk:<id>': { mark: 'keep' | 'trash' | null,
notes } }`. `loadAudit`/`saveAudit` (try/catch), `cleanAudit` (drops junk and empty entries), `auditToggle`
(keep and trash exclude each other), `auditNotes`, `auditText` (the Markdown "Copy audit" copies: header line,
then Remove (trash) / Keep (pinned) / Notes, empty sections skipped). Tests: `tests/logic/audit.test.js`,
`tests/browser/audit.test.js`.

## Rules

- **Old saves are forgiven**: unknown mod/perk ids are dropped, missing gun fields filled from
  `GUN_DEFAULTS`, `sel` moved to a real gun. **A new loadout field must be added to
  `cleanLoadout`**, or it is dropped on load.
- The save holds the cave's `seed` and the perks owned on entry (`owned`: `makeLevel` reads it, so
  the same seed needs the same list), the alive enemies' `sid`s (tagged by index in `enterLevel`),
  sold stock and taken rooms by index, and the ground pickups whole (guns get swapped on the ground),
  and the map's pins (`pins`: `{ x, y, e }`, v0.0.141). A new run's guide hologram isn't saved: a run
  put back from a save has none (the kit is lost if the app closes before it's handed out).
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
