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

Tests: `tests/logic/auto-run.test.js`.

## Rules

- New code for the auto-battler goes here (pure) or in `ui/auto/` (React). Keep this folder pure.
- Every number the owner may tune is a Dev knob (`dev/knobs.js`, group `auto`, keys `auto…`).
- A new module gets an `export * from` line in `pure.js` and its types in `types.d.ts`; watch for export
  names that clash with the old game's (`pure.js` re-exports everything).
