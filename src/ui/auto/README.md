# ui/auto/ — layer 6: CaveRunner Auto's screens (branch `autobattler`)

React for the auto-battler (`AUTOBATTLER.md`). The pure parts are in `src/auto/` (the run model, the save);
this folder only shows them and takes the taps.

## Files

- `AutoScreen.js` — (stage 2) the play screen, top to bottom (`.auto`, a flex column, CSS in `style.css`):
  - **play area** `.aplay` (55% of the height): the hub (stage 3a: `auto/hub.js` `hubScene`, opening on the teleport-in, `warm: 0`; the camera follows player 1, `C.w = HUB_W`, pinch out to the whole row) on `.aplaycvs` through `ui/scenecanvas.js`; `hubScene(..., run.tier)` for the prices; the scene kept in a ref for the buttons: the pill stick calls `hubStick` (free roam), A calls `hubExit`
    `runScene` (pinch, drag, tap a player to follow), `titleScene(…, { runners: run.players.length })`;
    ⏸ (`.pausebtn`) opens `ui/pause.js` `PauseMenu` (label `Tier n`; Save / Exit write the run) and holds the scene.
    **Stage 4a (test only, till 4b wires it):** `window.__AUTO_LEVEL = seed` makes `make` open a level instead (`auto/level.js levelScene`, default camera); in a level the pill stick's sideways push (past `DEAD`) goes to `levelHold` (right hurries, left slows, never stops; up does nothing). `tools/levelshots.js` uses it.
  - **context nav** `.anav`: 4 circles (`.anavc`, `data-player`), a player's colour ring (`TITLE_COLS`) and number
    for each player in the run (`.on`), an empty dark circle for a locked one. **Stage 8a:** `NavRow` draws `auto/nav.js` `navRow` (state `nav`, `navStart`): circles (`.anavc`; `data-player` at the top, `data-open` = what a tap opens) for choices (a player's ring and number, the menu glyphs 🔫 🧑‍🚀 ⭐ 📈, a gun's `GunIcon`, the exo glyphs), square tiles (`.aslot.anavs`, the bag's `ItemIcon`, empty ones dim) for slots. Below the top the row's edge is the tapped player's colour; `.sel` (white ring) marks the active gun, and at the top the last tapped player. A slot row (`.anav.slots`) starts at the left and scrolls sideways (`overflow-x: auto`, `pan-x`). `.anav` is a fixed 66px at every level (the layout never jumps); `data-level` on it. Stats shows "Stats — soon" (stage 9).
  - **bag** `.abag`: `BAG_SLOTS` (70) `.aslot`s, 7 across, scrolling up and down (`touch-action: pan-y`). A full
    slot (`.full.k-<kind>`): a gun's sprite (`GunIcon`), a mod's `MODS` glyph, an exo mod's `STAT_PERKS` glyph and
    tint with its tier (I–V), a perk's glyph, gold ● / red ◆ / green ◆; the count (`.acount`) when more than one,
    and always for gold and gems.
    In a level (stage 6 part 2) the screen passes `run` to `levelScene` (its 7th argument): kills' drops go into `run.bag`; the 200 ms poll reads `L.bagV` (+1 per item taken) into a state so the bag redraws while the level runs.
  - **buttons** `.abtns`: B (red pill), the **pill stick** (`PillStick`, `.apill`, owner after stage 4a: the old `<` `>` circles' height and 23px roundness, filling their space), A (green pill). The pill stick works like the old game's left thumbstick (`ui/hud.js` `Stick`): pointer capture, a knob (`.apillknob`, orange edge while it reads "up") that follows the finger, clamped to the pill (a few px up/down); its state `PillState { active, nx, ny, mag, dx, dy }`: dx by the pill's half-width, dy by its half-height (a small push up reads as up), mag their length clamped to 1; letting go resets it. `touch-action: none`; works with a mouse. B goes back one level in the nav (`navBack`; nothing at the top). The nav runs in the hub and in a level, never pausing.
  - The run: `loadAutoRun()`, or `newRun()` saved at once. `where` (hub or level): runScene's `next` swaps at `hubLeft` (to the run's level, healed) and `levelDone` (home, `levelCleared`); saved at each swap.

Tests: `tests/browser/auto-screen.test.js` (stage 8a: the nav, every level, B, the height, in a level too). Nav pictures: `node tools/navshots.js` (`tests/build/autoshots/nav-*.png`). Pictures: `node tools/autoshots.js` (`tests/build/autoshots/`; `ONLY=kl`: the pill stick in the hub mid-jet and in a level; its `o.drag` holds the stick for a shot).

## Rules

- Phone first (412×880, touch); every gesture works with a mouse too.
- The title menu's colours (`.titlemenu`, `.tslot`: dark purple panels, orange edge), not new ones.
- Slots in scrolling areas are `pan-y`; anything you drag gets `touch-action: none` (`.grab`, as the old Bag).
- No game logic here: moves on the run go through `src/auto/run.js`.

**Path blocked (stage 5b):** in a level, when no gun in play can clear the rock ahead (`auto/clear.js`), the pilot stops the team and `AutoScreen` shows `.ablocked` ("Path blocked", pulsing, `style.css`) over the play area; it reads `levelState(S).blocked` every 200 ms. Under `__TEST_TITLE` the level scene is on `window.__autoScene` (for `tools/clearshots.js`).

**LEVEL CLEARED (stage 7):** `runScene`'s `over` paints `art/cleared.js` `clearedText` while `levelClearedAge(S)` ≥ 0 (top at 14% of the play area): the title's letters (`titleLetter`) drop in one by one with bounces, a spark burst and a ring at each landing, a shine sweep, the title's bob, a fade over the last 0.5 s. Knobs Dev → Auto → "Auto: level" (`autoClearT`, `autoClearWait`). Pictures: `tools/clearedshots.js`.

**Enemies (stage 6 part 1):** the level gets `run.tier` (`levelScene`'s 6th argument). While the arena's boss lives, `AutoScreen` shows `.abossbar` (its name and a red bar, `style.css`) across the top of the play area, from `auto/enemies.js` `levelBoss(S)`, polled with the blocked hint (200 ms). Every player fallen (`levelLost(S)`): `next` takes the team home with `levelFailed(run)` (healed, tier unchanged) and saves.
- `icons.js` (stage 8a, owner rounds): `PixIcon` (pixel maps `NAV_ICONS`: the menu's guns/exo/perks/stats, the exo kinds hp/speed/jet/carrot; also the bag's exo mods), `HelmetIcon` (a player's helmet, `art/sprites.js` `helmetIcon` through `pixelSprite`), `GlyphIcon` (a mod's/perk's/gold's/gem's glyph: drawn big, its painted pixels found, scaled to fill a `GLYPH_PX` grid, alpha thresholded; `.apixg` 76% of the tile, `image-rendering: pixelated`, no glow). No emoji in the nav (owner).
