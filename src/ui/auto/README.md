# ui/auto/ — layer 6: CaveRunner Auto's screens (branch `autobattler`)

React for the auto-battler (`AUTOBATTLER.md`). The pure parts are in `src/auto/` (the run model, the save);
this folder only shows them and takes the taps.

## Files

- `AutoScreen.js` — (stage 2) the play screen, top to bottom (`.auto`, a flex column, CSS in `style.css`):
  - **play area** `.aplay` (55% of the height): the menu's scene on `.aplaycvs` through `ui/scenecanvas.js`
    `runScene` (pinch, drag, tap a player to follow), `titleScene(…, { runners: run.players.length })`;
    ⏸ (`.pausebtn`) opens `ui/pause.js` `PauseMenu` (label `Tier n`; Save / Exit write the run) and holds the scene.
  - **context nav** `.anav`: 4 circles (`.anavc`, `data-player`), a player's colour ring (`TITLE_COLS`) and number
    for each player in the run (`.on`), an empty dark circle for a locked one. Taps do nothing yet.
  - **bag** `.abag`: `BAG_SLOTS` (70) `.aslot`s, 7 across, scrolling up and down (`touch-action: pan-y`). A full
    slot (`.full.k-<kind>`): a gun's sprite (`GunIcon`), a mod's `MODS` glyph, an exo mod's `STAT_PERKS` glyph and
    tint with its tier (I–V), a perk's glyph, gold ● / red ◆ / green ◆; the count (`.acount`) when more than one,
    and always for gold and gems.
  - **buttons** `.abtns`: B (red pill), `<` `>` (dark circles), A (green pill). Taps do nothing yet.
  - The run: `loadAutoRun()`, or `newRun()` saved at once.

Tests: `tests/browser/auto-screen.test.js`. Pictures: `node tools/autoshots.js` (`tests/build/autoshots/`).

## Rules

- Phone first (412×880, touch); every gesture works with a mouse too.
- The title menu's colours (`.titlemenu`, `.tslot`: dark purple panels, orange edge), not new ones.
- Slots in scrolling areas are `pan-y`; anything you drag gets `touch-action: none` (`.grab`, as the old Bag).
- No game logic here: moves on the run go through `src/auto/run.js`.
