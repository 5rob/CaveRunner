# auto/ — layer 4: CaveRunner Auto (branch `autobattler`)

The auto-battler's pure parts (`AUTOBATTLER.md`). **Layer 4**: `run.js` takes `TITLE_COLS` from
`art/titlescene.js` (layer 4), so modules here may import layers 1–4 (core, dev, data, spells, world,
art, …), never `game/`, `ui/` or `main.js`. Everything here is pure: the logic suites call it directly.

## Files

- `run.js` — the run model (stage 1).
  - `newRun()` → `AutoRun` `{ tier: 1, players: [newPlayer(0)], bag }`; `newPlayer(i)` → `RunPlayer` (colour
    `TITLE_COLS[i]`, `guns` ×4, `active`, `exo` { hp, speed, jet, carrot } ×5 slots each, `perks` ×6, `hp`, `alive`).
  - The bag: `BAG_SLOTS` = 70 (10 rows × 7), `null` = empty. Items are `BagItem` `{ kind, n, … }`: `gun` (`gun`, never
    stacks), `mod` (`id`, stacks by `stackKey`), `exo` (`cat`, `tier`, stacks by both), `perk` (`id`, stacks by id),
    `gold` / `red` / `green` (stacks without limit). `itemKey`, `bagCount(run, kind)`, `bagAdd(run, item)` (onto its
    stack, else the first empty slot; returns what didn't fit, null if it all did), `spend(run, kind, n)`.
  - Moves (change `run` in place; a refused move returns false and changes nothing): `fitMod(run, bagI, p, gunSlot,
    modSlot)` / `unfitMod`, `fitGun(run, bagI, p, slot)` / `unfitGun`, `fitExo(run, bagI, p, cat, slot)` (only its own
    category) / `unfitExo`, `fitPerk(run, bagI, p, slot)` (refuses stat perks `st_*`: those are exo mods now) /
    `unfitPerk`, `setActive(run, p, slot)`, `addPlayer(run)` (one green gem, at most 4). Fitting onto a full slot
    swaps the old one back into the bag. `scrap(item, tier)` → gold for the whole stack; `scrapAt(run, i)` does it.
  - `exoMod(cat, tier)`; `EXO_CATS`, `EXO_STATS` (hp → hp, speed → walk, jet → fuel **and** refuel, carrot → carrot,
    values from `STAT_PERKS`). `exoBonus(player)`: hp adds; speed/fuel/refuel add their excess (two +8% = +16%);
    carrot adds levels, capped at V. `playerStats(player)`: `perkBag` of the fitted perks with the exo bonus folded in.
  - Prices (Dev tab **Auto**, `dev/README.md`): `autoGunPrice(tier)`, `autoExoPrice(tier)`. Named `auto…`
    because `gunPrice` is already `spells/guns.js`'s.
- `save.js` — the one save: `loadAutoRun(storage?)` / `saveAutoRun(run, storage?)`, key `AUTO_SAVE_KEY`
  (`caverunner-auto-run`), `{ v: AUTO_SAVE_V (1), run }`. `storage` defaults to localStorage (in try/catch); a
  missing, junk or other-version save loads as null. Named `…AutoRun` because `saveRun` is the old game's.

- `hub.js` — the hub strip (stage 3a). `HUB_STOPS` (enter, gun, exo, mod, perk, exit; each its middle x, `HUB_GAP` apart, `HUB_EDGE` from the ends; `hubStopX(id)`: stage 3b's arrow travel and prices hook on these), `HUB_W`, `HUB_ROOM`, `hubFloor(vh)`. `hubScene(vh, seed, n)` = `titleScene` with `opts.hub` (a fixed strip, `TitleHub`: steel floor, roof and end walls `TM.STEEL`, open brick back wall `TM.BWALL` over a steel wainscot `TM.SWALL`; no creatures, no scroll; `S.still`). `hubStep` (titleStep calls it): the players hidden until the enter pad has charged (`HUB_ARRIVE`, then 0.5 s apart, `hubArriveT`: flash, sparks, `H.zap`), then standing on the floor (`r.stand`); a tube over each stop comes on in turn from `LIGHT_WAIT` (`hubTube`: world/shoplights.js `tubeLevel`). `hubCharge` (the pad's charge and flash), `hubState(S)` (`HubState`), `HUB_MACHINES` (hues: gun gold, exo teal `#3fe6d6`, mod red, perk green), `HUB_EXO_GLYPHS` (the exo hologram cycles them, `HUB_EXO_T`). Painter: `game/render/hubdraw.js`. **Free roam (owner, after stage 4a; replaced stage 3b's arrow travel `hubGo`/`hubStandX`, removed with their tests and the `autoHubOff`/`autoHubEase` knobs):** `hubStick(S, { active, nx, ny, mag, dy })` (the pill stick's push, as the old left thumbstick; ignored until player 1 is through) into `H.stick`; `hubMove` in `hubStep`: past `DEAD` the sideways push runs player 1 (up to `DEV.autoHubRun`, eased), pushed up (dy < 0) he jets (`DEV.autoHubJet` × gravity, `r.mode 'fly'`, `r.flame`), gravity brings him down onto the steel floor; the end walls and the roof hold him. The others walk the floor in a line `DEV.autoHubSpace` apart behind him (`DEV.autoHubWalk` × 1.25), facing the way they go, `r.stand` when still. State: `H.lx` (leader's middle), `H.dir` (the way he last ran). `hubAtExit(S)` (by position: player 1 on the floor within `HUB_PAD` of the exit pad's middle), `hubExit(S)` (A at the exit pad: the flash, `H.exitT`; stage 4 starts the level there), `hubExitFlash(S)`. `hubPrice(id, tier)` (gun/exo gold from `autoGunPrice`/`autoExoPrice`, mod 1 red, perk 1 green); the run's tier is `hubScene`'s 4th argument (`H.tier`). Knobs: Dev → Auto → "Auto: hub".

- `level.js` — the level strip (stage 4a). `levelPlan(seed, minutes?)` → `LevelPlan`: a finite `TitlePlan` (the scene's `S.zp`): a flat start pad (`LVL_PADX`), the menu's random zones (`titleZoneAdd`: same order rules) for `DEV.autoLvlMin` minutes at `DEV.autoLvlPace` × `LVL_SCROLL`, the boss arena (`LVL_ARENA` wide, flat, tall), the exit pad (`exitX`), then solid rock (a zone to 1e9: never `Infinity`, zoneIn would loop). Flat zones are moss with `flat: true` (no hills, rubble or ledges). `levelScene(vh, seed, n, plan?)` = `titleScene` with `opts.level` (`TitleLevel`; the scroll ring, its speed `S.pace` × the menu's). `levelStep`: phases `arrive` (hidden till `hubArriveT(i)`, flash, sparks, `L.zap`; `S.still`) → `run` (the pilot's pace; stops at the arena's middle: progress is `levelTeamX(S)` = `S.scroll + LVL_TEAM`) → `arena` (pace 0 till `L.bossDead` or `DEV.autoLvlBossT` s: stage 6 sets it) → `out` (to the exit pad) → `exit` (saws away, everyone walks onto the pad; `levelDone(S)`: stage 4b teleports to the hub). `levelHold(S, push)` (the pill stick's sideways push, -1 … 1; 0 let go), `levelState(S)` (`L.elites`, `L.chests`: stage 6 and 11 fill these), `levelPads(S)` (the painter: `game/render/leveldraw.js`).
- `pilot.js` — pace control (stage 4a), pure: `pilotPace({ x, stopX, elites, chests, hold })` (normal `DEV.autoLvlPace`; an alive elite within `autoLvlEliteR` × `autoLvlElite`; an unopened chest within `autoLvlChestR` × `autoLvlChest`; the stick's push `hold` -1 … 1 through `pilotPush`: full right × `autoLvlHurry`, full left × `autoLvlSlow`, **never 0** (owner); brakes over `PILOT_BRAKE` to 0 at `stopX`, at least `PILOT_CRAWL` till there), `pilotEase(cur, want, dt)` (`autoLvlEase`). Knobs: Dev → Auto → "Auto: level".

Tests: `tests/logic/auto-run.test.js`, `tests/logic/auto-hub.test.js`, `tests/logic/auto-level.test.js`. Pictures: `tools/levelshots.js`.

## Rules

- New code for the auto-battler goes here (pure) or in `ui/auto/` (React). Keep this folder pure.
- Every number the owner may tune is a Dev knob (`dev/knobs.js`, group `auto`, keys `auto…`).
- A new module gets an `export * from` line in `pure.js` and its types in `types.d.ts`; watch for export
  names that clash with the old game's (`pure.js` re-exports everything).
