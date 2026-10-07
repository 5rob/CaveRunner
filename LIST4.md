# LIST4 — the owner's 5-item list (started 2026-10-07)

**A fresh session: read this first, then CLAUDE.md and HANDOVER.md.** Same way as LIST3: the main session
is project manager, the big items go to time-boxed agents on worktree branches merged into the batch
branch **`list4`**, every look goes to the owner as 412×880 screenshots and waits for their OK before `main`.

Status: `todo` · `agent` (running, branch named) · `review` (screenshots sent) · `ready` · `released vX.Y.Z`.

## The list (owner's words, shortened)
| # | Item | Who | Status | Notes |
|---|------|-----|--------|-------|
| 1 | Bag (gun mod screen): title → the gun's name in its colour + ✏️ rename; gold → 💾 save button: saves gun + mods as a named preset, listed under Dev → Spawn gun (tap = spawn it, can delete) | agent B | released v0.0.159 | merged (0f9093e): `BagHead` in ui/editor.js, `save/presets.js` (`caverunner-gunpresets`), `spawnPreset`; suites `presets` (logic+browser); shots sent. ✏️/💾 work in a view-only Bag too |
| 2 | Pixel-art gun sprites recreated from the owner's picture (~30 guns, many colours); 🖼️ button next to 💾 opens a gallery, the pick becomes that gun's art everywhere | agent A + manager (header merge) | released v0.0.159 | merged (a146479 + 9ab1250): 27 sprites `art/gunart.js` (re-extract: `tools/gunart-extract.js`), `drawGun(…, art)`, `gun.art`, `GunArtPicker` ui/gunart.js; one pixel size `GUN_ART_PX` 0.46; suites `gunart`; shots sent |
| 3 | Pause menu in play: Save (this run), Volume slider (whole game), Exit to main menu | agent C | released v0.0.159 | merged (334daca): `ui/pause.js`, ⏸ top right beside ⚙️; `SFX.setVolume`, `caverunner-volume`; Exit = save + reload; suite `title` |
| 4 | Title screen: animated action background ("surprise me"), big fancy title, menu: 3 save slots (each with delete), Start | agent C | released v0.0.159 | merged (334daca): `Root` in `ui/title.js` mounts `App` only after Start; scene `art/titlescene.js` (pure stepper); slots `slotKey` in save.js, `caverunner-slot`; test page skips the title (`__TEST_TITLE` shows it); suites `slots` (logic), `title` (browser) |
| 5 | HUD gun slot circles coloured like their gun's name | agent B | released v0.0.159 | merged with #1; held slot = thicker ring + glow in its colour (was amber) |

## Decisions (manager's, tell the owner)
- Save slots hold the run **and** the slot's mod/perk collections; the old single save becomes slot 1.
  Dev settings, the audit, death replays, gun presets and pins' defaults stay shared.
- Exit to main menu saves first.
- Gun art: a gun with no art picked keeps the drawn gun of today.

## Log (newest last)
- 2026-10-07: list received; branch `list4`; agents A, B, C started in parallel.
- B done (items 1, 5), merged, shots sent. A done (item 2), merged; 🖼️ moved into B's header (name ✏️ … 🖼️ 💾 Done); shots sent.
  Logic `strata` fails on HEAD too (known); `rats`/`spider` chance.
- C done (items 3, 4), merged (pure.js conflict only), shots sent. All 5 in review; full browser run started.
- Full browser run: jelly, lightning, nuggets, torch failed; alone all pass except jelly's spit (known flake). Waiting on the owner.
- 2026-10-08: owner approved all five; released as v0.0.159.
