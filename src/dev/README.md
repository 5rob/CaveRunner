# dev/ — layer 1: the Dev panel's knobs

`knobs.js` holds everything the ⚙️ Dev panel tweaks (the panel itself is `ui/devpanel.js`):

- `DEV` — the live values; the game reads them every frame, so a change shows at once.
- `DEV_DEFAULTS` (plain knobs), `DEV_META` (one row each: key, group `g`, label, min/max/step,
  optional `type: 'color' | 'slider'`), `DEV_GROUPS` (the collapsible sections, in order).
- `devSet(k, v)` writes through to localStorage (`DEV_KEY` = `caverunner-dev`); `devReport()`
  is the text behind **Copy all dev settings to clipboard**.
- Range knobs: `rangeKnobs(group, rows)` registers `k+'Lo'`/`k+'Hi'` and two rows each; `kr(k, rnd)`
  rolls one (`spr` is the same, the spider's name for it); `kru(k, u)` is the value at fraction `u`
  (for looks rolled once per creature that should still update live).
- Colour knobs: `colourKnobs(group, rows)` (A = `k+'Lo'`, B = `k+'Hi'`, `'#rrggbb'`); `kcol(k, u)`
  blends A→B; `jcol(k, u)` blends then applies the jelly's master `jeHue`/`jeSat`/`jeBri` sliders
  (use `jcol` for any jelly colour).
- Witness (`g: 'witness'`): `witPad` (how far past your path a saved replay keeps, so how far its
  camera may stray, world units, 80) and `witKbps` (the exported video's bitrate, 6000).
- Level (`g: 'level'`): `due1` (floor 1's repay time, minutes), `enemies` (creatures a new level
  gets on floor 1, `ENEMY_COUNT`) and `enemiesUp` (more each floor, 12), `lvlReward` (what selling
  pays on top of the debt, 1000). Player: `runnerPx` (the astronaut's pixel size in world units, 1;
  0 smooth), `runnerLine` (its dark outline). Rats: `raBrood` (rats a nest holds in all, 4–6).
- The menus' pointer (`g: 'menuptr'`): `ptrStart`, `ptrReach`, `ptrSize`, `ptrLine`, `snapR`, `snapPull`,
  `snapHit` (read live by `ui/vendshop.js` and the right `Stick`).
- The tables: `SP_KNOBS` (spider + web lines), `JE_KNOBS`, `JE_COLS` (jellyfish), `RA_KNOBS` (rats
  and nests), `LV_KNOBS` (floor-1 layout, lanterns), `ARCH_KNOBS` (arched vines), `FIRE_KNOBS`.

## Rules

- **The owner pastes a Dev report → those numbers become the new `DEV_DEFAULTS`** (or the range
  table's default min/max). Then check which tests leaned on the old default and pin the knob
  they were written for (`tests/logic/devsettings.test.js` covers the report itself).
- **Every creature knob is a min/max range, rolled fresh at each use** (the owner's rule: no two
  bursts, bites or shots quite alike; min = max for a fixed number). A new creature gets its own
  `rangeKnobs` table *and* a `DEV_GROUPS` entry; its keys share a prefix that the creature carries
  as `kp` (see `creatures/README.md`).
- **Every localStorage touch is wrapped in try/catch**: it throws in a private window and doesn't
  exist under Node (the logic suites load this file). A missing store just means defaults, so the
  load at the bottom must stay guarded. The loader accepts hex strings for colour defaults.
- **The knob tables stay in this file** (REFACTOR.md D11): `DEV` is copied from `DEV_DEFAULTS` once,
  right after the tables register, so a table in a creature's own module would register too late.
- A blank field in the panel restores `DEV_DEFAULTS[k]`. Group open/shut state is localStorage
  `caverunner-devgroups` (all shut by default).
