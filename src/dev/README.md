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
- Torch & fog also has the shop hall's `shopGap` (how dark between its ceiling lights, 0.9) and `shopTorch`
  (how much of that your torch lifts, 0.45), v0.0.141 (`world/shoplights.js` `shopDark`, `render/light.js`).
- Torch & fog's gun light (v0.0.145): `beamDeg` (cone width, 50°), `beamReach` (× the sight radius, 2.2; in
  the shop hall it reaches only the old torch's distance), `beamNear` (the glow round you, × the torch's
  reach, 0.5), `beamGlow` (how bright the beam itself shows, 0.5). `torch` still sets the sight radius.
- Guide hologram (`g: 'guide'`, v0.0.141, `world/guide.js`): `guideCps` (its box types this many letters a
  second, 30), `guideWait` (the pause after each box, s, plus a little per letter, 1.4) and `guideIn` (v0.0.142: how
  far inside the screen's right edge its dark spot must be before its light comes on, world units, 50).
- Witness (`g: 'witness'`): `witPad` (how far past your path a saved replay keeps, so how far its
  camera may stray, world units, 80) and `witKbps` (the exported video's bitrate, 6000).
- Level (`g: 'level'`): `due1` (floor 1's repay time, minutes), `enemies` (creatures a new level
  gets on floor 1, `ENEMY_COUNT`) and `enemiesUp` (more each floor, 12), `lvlBonus` (what selling
  floor 1 pays on top of the debt, 1,000; it was `lvlReward`, renamed in v130), `lvlGrow` (the debt × per floor, 3; floor 1's is `LVL_BUY`, a
  billion), `rewardGrow` (the reward × per floor, 2: 1,000, 2,000, 4,000…), `killGrow` (kill gold × per floor, 1.35: `goldScale`). Player: `runnerPx` (the astronaut's pixel size in world units, 1;
  0 smooth), `runnerLine` (its dark outline). Rats: `raBrood` (rats a nest holds in all, 4–6).
- Elites (`g: 'elite'`, `ELITE_KNOBS` + `ELITE_COLS`): `elCount` (per floor), `elHp`, `elDmg`, `elGold`, `elRed`,
  `elGreen`, `elScale`, `elTintAmt`, `elGlow`, `elGlowR`, `elTint` (colour). Each elite sits at one roll `k.eu`
  in the looks and toughness ranges (size and tint update live); the rewards roll when it dies.
- Elites: flames (`g: 'elitefx'`, `ELITE_FX_KNOBS`, v0.0.137): `elFxRate`, `elFxLife` (length of fire), `elFxRise`,
  `elFxWave`/`elFxWaveHz` (wavyness), `elFxDrag` (air resistance), `elFxSize`, `elFxBody` (spawn spread), all
  ranges rolled per particle; `elFxGrad` (colour over life) and `elFxAlpha` (opacity over life) are **strings**
  (`art/ramps.js`) shaped on the panel's `GradEditor` and `RampEditor` (`type: 'grad' | 'ramp'` rows draw nothing
  themselves). The store accepts a string knob when its default isn't a colour.
- Sway (`g: 'sway'`): `webSag`, `bendK`/`bendDamp`/`bendPush`/`bendGrab`/`bendDip`/`bendMax` (web lines and
  arches), `vineGrav`/`vineDamp`/`vinePush`/`vineMax` (hanging vines): `world/sway.js`.
- Level 2 (`g: 'level2'`, v129): `L2_KNOBS`, since Level 2 stage 2 the tomb's layout (`world/tomb.js`
  `tombPlan`, rolled on the tomb's own generator; terrain px): `l2Rooms` (rooms it tries to fit, 70–80),
  `l2Big` (share of large ones), `l2SmallW`/`l2SmallH`/`l2BigW`/`l2BigH` (sizes, rolled per room), `l2Gap` (rock
  between rooms), `l2Hall` (gallery height) and `l2Shaft` (shaft width), per corridor, `l2Ledge` (a shaft ledge
  every…), `l2Loops` (extra links), `l2Course`/`l2Block`/`l2Mason` (the cut stone: course height, block length,
  depth into the rock), `l2Furn` and `l2Bones` (the room kits' furniture and skeletal remains, ×; Level 2 stage 3,
  `world/furnish.js`). `l2Decor` is now × all of floor 2's kits (0 = a bare tomb). The noise-cave knobs it had before went with floor 2's noise cave, `L2_LOOK` (its palette, colour
  pickers, defaults = Tombs; `data/themes.js` `themeFor` builds the theme from them), `l2Decor`
  (× decoration, `decorate`). Changes show on the next cave; **Floor 2** on the panel goes there.
- Level 2: dark zones (`g: 'l2dark'`, Level 2 stage 4, `world/dark.js`, `game/render/dark.js`): `l2dCount` and `l2dSize`
  (ranges, `L2D_KNOBS`: how many, 2–3; radius px, 60–88), `l2dSpace` (apart, 120 px + half their sizes), `l2dShop` (140)
  and `l2dTop` (120) (kept away from the shop and the exits), `l2dSilk` (× thickness, 1), `l2dDark` (0.94), `l2dEdge`
  (soft edge, fog cells of blur, 1.2), `l2dHolo` (the hologram's haze through the silk, 0.4), `l2dBack` (how much of
  the silk shows in the dark, 0.3).
- Level 2: destruction (`g: 'l2boom'`, `world/byDistance.js` `destructionOpts`; not in the cave yet): `l2bMaxDist` (reach from a dark zone, px, 200), `l2bCount` (explosions, 60), `l2bFire` (% that cause fire, 30), `l2bSizeLo`/`Hi` (size range, px radius, 6–18: `L2B_KNOBS`), `l2bJitter` (± px, 0), `l2bClear` (open air round each, px, 4), and two curves: `l2bDen` (destruction amount by distance, 0..1) and `l2bScale` (size × by distance, 0..2).
- Curve knobs: `curveKnobs(group, p, label, lo, hi, def)` registers `p+'0'` (start y), `p+'C1x'`, `p+'C1y'`, `p+'C2x'`, `p+'C2y'`, `p+'1'` (end y), all `type: 'curve'` (no boxes), and lists it in `CURVES` so the panel draws a `CurveEdit` for it in its group; `kcurve(p)` reads it as a `Curve` (`core/util.js` `bezierAt`). The hologram flash's `holoC*` predate it (fixed ends, `FadeCurve`).
- Sway also has `vineLinks` (links in a swung vine's tail) and `vineTailDamp`.
- Carrot (`g: 'carrot'`, `CARROT_KNOBS`): `caCam`, `caTorch`, `caAggro`, `caAim`, each a min (no Carrot
  fitted) / max (Carrot V) multiplier; `carrotAt(k, W.pb.carrot)` is the value at a level.
- The menus' pointer (`g: 'menuptr'`): `ptrStart`, `ptrReach`, `ptrSize`, `ptrLine`, `snapR`, `snapPull`,
  `snapHit` (read live by `ui/vendshop.js` and the right `Stick`).
- The tables: `ELITE_KNOBS`, `ELITE_COLS` (elites), `SP_KNOBS` (spider + web lines), `JE_KNOBS`, `JE_COLS` (jellyfish), `RA_KNOBS` (rats
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
