# data/ — layer 2: the tables

| File | Holds |
|---|---|
| `themes.js` | `THEMES` (the 12 floor palettes), `themeFor(floor)`, `DECOR`/`decorFor` (five decorations per theme, indexed like `THEMES`), `AMBIENCE` (per theme *name*: noise bed, drone, one-shot rates) |
| `creatures.js` | `CREATURES` (the 16 types), `CREATURE_IDS`, `ROSTERS` + `rosterFor(floor, rnd)` (who lives on floors 1–10), `enemyFor(id, floor)` (one creature's floor-scaled stats, the `e.k` every enemy carries), `goldScale(floor)` (the floor's gold lift, shared by kill gold and the heal), `healPrice(bought, floor)` (the shop heal: free, then `HEAL_PRICE` × `HEAL_MUL` each time, × `goldScale`), `HUNTERS`, `NATURAL_ONLY` |
| `perks.js` | `PERKS` (31), `PERK_IDS`, `perkBag(owned)` (folds the owned list into one bag of multipliers and flags) |

## Rules

- **A floor's identity is the floor number, not the seed.** `themeFor(floor)` and
  `rosterFor(floor)` depend on the floor alone: floors 1–10 have the same palette and creatures
  on every run. That is the feature (the player learns floor 3). Only past floor 10 does
  `rosterFor` take `rnd`. Don't roll either from the level seed.
- **`enemyFor` copies a fixed list of fields** onto `e.k` (`name`, `body`, `act`, `col`, `hp`,
  `dmg`, `bspd`, `gold`, `range`, `cd`, `tele`, `shots`, `r`, `spd`, `aggro`, `kp`, `glow`). A new
  creature field the game reads off `e.k` must be added there, and to `CreatureKind` in
  `src/types.d.ts`. (Stendari's `fire: 1` is missing from it: a known bug, REFACTOR.md "Found
  along the way".)
- `HUNTERS` (act → 1) is who uses the aggro system; `NATURAL_ONLY` (act → 1) is who spawns and
  stays in floor 1's natural zones (the jelly). `noRoster: 1` keeps a type off every roster (rats,
  nests: they come from nests).
- **Perks:** the game reads one folded bag, `W.pb = perkBag(loadout.perks)` (made by `refreshBag`,
  `game/systems/player.js`); step and draw read `W.pb`, never the owned list. Max health is
  `W.pb.maxHp + loadout.maxBonus` (`maxHp`): the +25 hearts are `maxBonus` and raise the ceiling
  only, never heal. `makeLevel(seed, floor, owned)` skips perks you already hold.
- The aim line is a perk (`trajectory`, "Trajectory Sight"); don't confuse it with `pinpoint`
  (Pinpointer), which auto-aims at the nearest creature.
- A new theme needs an `AMBIENCE` entry (the sound suite checks) and a `DECOR` row.
