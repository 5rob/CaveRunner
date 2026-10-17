# dev/ — layer 1: the Dev panel's knobs

**grem branch (CaveRunner Grem, v2.0.0):** cut from this folder as unused by Grem Mode: `autouse.js`. Anything below that still names them describes `autobattler` / `main`, where they live on.

**Coal Seams (grem, v2.0.1, step 1 of the design doc):** group `coal` "Coal Seams" on the Grem tab (`coalSupports`, `coalLamps`, `coalCarts`, `coalPicks`, `coalSoot`, `coalCartR`, `coalCartDmg`, `coalLampLight`); Grem's `gremStartLv` (start a Grem run at that level: 2 = Coal Seams). Both reach Copy Dev settings through DEV_META. (v2.0.2) Coal: `coalAmount`, `coalPatch`, `coalVeins`, `coalVeinWLo/Hi` (range), `coalCatch`, `coalSmoulder`, `coalGlints`, colours `coalColLo/Hi`, `coalGlintLo/Hi`; Fire's `fireCoalLo/Hi`. (v2.0.3) `coalRails`, `coalPiles`, `coalChutes`, `coalSpill`; timber `coalSupports` (now the share of the slice in propped patches), `coalSupWLo/Hi`, `coalSupGapLo/Hi` (ranges), `coalSupLone`, `coalSupSparse`, `coalSupRot`, `coalSupBroken`, `coalSupFallen`, `coalSupMaxH`. (C1, not released) Gas pockets: `coalGas` (about this many a screen), `coalGasSize`, `coalGasBoom` (blast radius), `coalGasDmg`, colours `coalGasColLo/Hi` (the whoomph's core, edge). (C2, not released) Stalactites and stalagmites: `coalStalDense`/`coalMiteDense`, `coalStalClus`/`coalMiteClus` (bare share between clusters), `coalStalLenLo/Hi`, `coalMiteLenLo/Hi` (ranges, at `coalStalRoom` units of open height; more space, longer), `coalStalCap`/`coalMiteCap` (longest, a share of the open height). (C3, not released) Cavern ladders and timber: `coalLadders` (about this many a screen), `coalLadLean` (most lean), `coalLadMaxH` (tallest), `coalCavSup` (supports a screen), `coalCavBroken` (share with a snapped post), `coalCavLean` (share that are a lone leaning prop). (C4, not released) Bats: group `bats` "Bats" on the Grem tab: `batRoosts` (roosts a screen), `batsPerRoost`, `batSlotSpacing`, `batTakeoff` (a second), `batFlightMin`/`batFlightMax`, `batMaxSpeed`, `batMaxForce`, `batPerception`, `batSepDist`, `batSep`, `batAli`, `batCoh`, `batWander`, `batZonePull`, `batWallAvoid`, `batScareR`, `batClearMult`; toggles as 0/1 knobs `batScare` (players scare bats), `batDebug` (debug draw); `batBite` (0: harmless). Buttons Reset bats / Scare all bats (Grem's panel only: `DevPanel` prop `bats`).

`knobs.js` holds everything the ⚙️ Dev panel tweaks (the panel itself is `ui/devpanel.js`):

- `DEV` — the live values; the game reads them every frame, so a change shows at once.
- `DEV_DEFAULTS` (plain knobs), `DEV_META` (one row each: key, group `g`, label, min/max/step,
  optional `type: 'color' | 'slider'`), `DEV_GROUPS` (the collapsible sections, in order).
- **Where a knob shows (the Dev menu rebuild, not released; `DEV_TABS`/`devTabOf` are gone):** `DEV_PLACES` is every page of the
  full-screen menu: `{ id, side: 'global' | 'level', lv, name, groups, pin?, page? }` (`lv` a `DEV_LEVELS` id; `pin` 'fire' / 'bats' /
  'zones' = the live preview kept still over the page; `page` = the panel's own page, `presets` / `grem`). `DEV_LEVELS` =
  `[id, level number, name]` (the name must be `auto/maps.js floorName`'s; the drop-down shows "2 · Coal Seams"). A group's
  knobs go to the page listing it; `DEV_KNOB_PLACE` (key regex → page) sends single knobs elsewhere (Coal Seams is split that
  way: Coal, Props, Gas, Stalactites, Timber & ladders). `devPlaceOf(m)` = a knob's page. **A new group goes in one page's
  `groups` (a new level: a `DEV_LEVELS` row and its pages)**; `tests/logic/dev-layout.test.js` checks every knob lands on exactly one page.
- `devSet(k, v)` writes through to localStorage (`DEV_KEY` = `caverunner-dev`): since v1.0.94 only the keys that
  differ from `DEV_DEFAULTS` (`devChanged()`), so a device follows every new default for knobs it hasn't touched
  (a store from before v1.0.94 holds every key; it thins out on its next change). `devReport()` lists every
  `DEV_DEFAULTS` key (rows or not: the `zv_*` boxes too; numbers rounded to 6 places).
- **Copy Dev settings** (the panel's button) is `auto/devcopy.js devCopyText()`: `devReport()` + the gun presets
  (Dev → Presets; JSON between `PRESETS-JSON-BEGIN`/`-END` → `save/presetdefaults.js DEFAULT_PRESETS`) + Grem's kit
  (Dev → Grem; `GREM-KIT-JSON-BEGIN`/`-END` → `auto/grem.js GREM_KIT_DEFAULT`), each JSON only when it differs from
  the built-in one. A device that never saved its own presets / kit gets those built-in ones.
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
  camera may stray, world units, 80) and `witKbps` (the exported video's bitrate, 2500).
- Level (`g: 'level'`): `due1` (floor 1's repay time, minutes), `enemies` (creatures a new level
  gets on floor 1, `ENEMY_COUNT`, 50) and `enemiesUp` (more each floor, 20), `lvlBonus` (what selling
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
  and `l2dTop` (120) (kept away from the shop and the exits), `l2dSilk` (× thickness, 1), `l2dDark` (0.94), `l2dBands`
  (v0.0.148, replacing the blurred `l2dEdge`: steps of grey in the edge's ramp, 3), `l2dHoloBlur` (v0.0.148: the silk
  blurs the hologram too, 0 off / 1 on, off: it costs a blur every frame), `l2dHolo` (the hologram's haze through the silk, 0.4), `l2dBack` (how much of
  the silk shows in the dark, 0.3). The hologram glitching in a zone (`world/holoflicker.js`, render/dark.js): `l2dFlk` (on 1 / off 0), `l2dFlkBase`
  (the hologram between bursts, × its brightness, 0.5), `l2dFlkRate` (how often it blinks on bright, flashes a second, 0.9), `l2dFlkTears` (torn glitches a second, 0.75), `l2dFlkDrops` (cut-outs a second, 0.9; owner: each its own rate), `l2dFlkFlash` (a flash's
  brightness × the hologram, 1.6), `l2dFlkGlitch` (how far torn slices jump, terrain px, 10), `l2dFlkNear` (starts this
  many px outside a zone's box, 40).
- Level 2: destruction (`g: 'l2boom'`, `world/byDistance.js` `destructionOpts`; not in the cave yet): `l2bMaxDist` (reach from a dark zone, px, 200), `l2bCount` (explosions, 60), `l2bFire` (% that cause fire, 30), `l2bSizeLo`/`Hi` (size range, px radius, 6–18: `L2B_KNOBS`), `l2bJitter` (± px, 0), `l2bClear` (open air round each, px, 4), and two curves: `l2bDen` (destruction amount by distance, 0..1) and `l2bScale` (size × by distance, 0..2).
- Curve knobs: `curveKnobs(group, p, label, lo, hi, def)` registers `p+'0'` (start y), `p+'C1x'`, `p+'C1y'`, `p+'C2x'`, `p+'C2y'`, `p+'1'` (end y), all `type: 'curve'` (no boxes), and lists it in `CURVES` so the panel draws a `CurveEdit` for it in its group; `kcurve(p)` reads it as a `Curve` (`core/util.js` `bezierAt`). The hologram flash's `holoC*` predate it (fixed ends, `FadeCurve`).
- Sway also has `vineLinks` (links in a swung vine's tail) and `vineTailDamp`.
- Aim Assist (`g: 'aimassist'`, LIST3 #10, `spells/assist.js`, its own block above `DEV_KEY`): `aaStart` (push before the
  pointer comes out, 0.12), `aaReach` (1), `aaSnapR` (40 world units), `aaPull` (0.45), `aaHit` (10), `aaHold` (stickiness, 1.5),
  `aaDelay` (fires this long after snapping on, 0.08 s), `aaSize` (ring px, 26), `aaLine` (1.25), `aaDot` (2).
- Carrot (`g: 'carrot'`, `CARROT_KNOBS`): `caCam`, `caTorch`, `caAggro`, `caAim`, each a min (no Carrot
  fitted) / max (Carrot V) multiplier; `carrotAt(k, W.pb.carrot)` is the value at a level.
- The menus' pointer (`g: 'menuptr'`): `ptrStart`, `ptrReach`, `ptrSize`, `ptrLine`, `snapR`, `snapPull`,
  `snapHit` (read live by `ui/vendshop.js` and the right `Stick`).
- CaveRunner Auto's economy (`g: 'auto'`, its own tab **Auto**, placed before the last tab; `auto/run.js`): `autoGunBase` (the gun
  machine at tier 1, 120 gold), `autoGunGrow` (× each tier, 1.35), `autoExoPrice` (% of the gun price, 60), `autoScrap` (% of a
  gun, exo mod or perk's price, 25), `autoRed` (40), `autoGreen` (150), `autoModGold` (15): scrap gold × `goldScale(tier)`.
- CaveRunner Auto's hub (`g: 'autohub'`, "Auto: hub", same **Auto** tab; `auto/hub.js`, stage 3b): `autoHubRun` (player 1's top run speed on the pill stick, 70), `autoHubJet` (jetpack push × gravity, 2.4), `autoHubWalk` (the others' walk speed to their place in line, 80), `autoHubSpace` (line-up spacing, 16). (`autoHubEase`, `autoHubOff`: gone with the arrow travel.)
- CaveRunner Auto's gold stream (`g: 'autothrow'`, v1.0.45): `autoStreamMedT`/`autoStreamMedN` (at full speed this long, then medium nuggets worth 25), `autoStreamBigT`/`autoStreamBigN` (then big ones from 250), `autoStreamGrow` (big ones double every 1 s); capped at what the machine still wants (`auto/payout.js hubOwed`).
- **Silk (v1.0.61, `firesilk`):** `autoWebFire`, `autoSilkSpread/Jitter/Ash/Cut/Spin/Jump/JumpP` (vines' defaults), `autoSilkSmoke` 10, `autoSilkFlames` 1; the vines keep `autoVine*`, `autoBurnCut/Spin`, `autoFireJump/P`.
- **Fire particles (v1.0.60, `firefx`):** ranges `fxFl*` / `fxSm*` (Lo/Hi), rates, `…ColJit` / `…AlphaJit`, and four shaped strings (`fxFlGrad`, `fxFlAlpha`, `fxSmGrad`, `fxSmAlpha`: `type: 'grad'` / `'ramp'`, edited by `GradEditor({ k })` / `RampEditor({ k, life })` in `groupExtras`).
- **Aim (v1.0.59, `autoguns`):** `autoAimR` 400, `autoAimEdge` 24 (the right-hand strip), `autoAimLeft` 20 (the hail mary off the left).
- **Fire sim (v1.0.58):** group `firelab` (`labJetGap` 0.35, `labJetH` 50, `labJetT` 0.7) at the top of the Fire sim tab; `fireTwinkle` 1 / `fireFlare` 0.06 in `autofire`.
- **Auto colours (v1.0.57):** `autouse.js` is generated (don't edit): `tools/autoknobs.js`, run by every build, lists the knobs Auto's tree-shaken bundle reads (`AUTO_KNOBS`); the panel colours by it. A knob read only through a computed name (`DEV[x]` with x built at run time) shows grey: pass its name as a string somewhere, or accept it. `autoBurnCut` 0.015 / `autoBurnSpin` 2.5 (v1.0.57, `autofire`).
- **Fire sim tab (v1.0.56):** every fire knob on one page under the sim (page `firesim`: `autofire`, the old `fire` group); not on World or Auto any more. New: `autoFireSpread` 0.1, `autoWebFire` 3, `autoVineCatch` 0.25, `autoLeafReach` 5, `autoLeafLight` 0.15.
- CaveRunner Auto's vine fire (group `autofire` since v1.0.56, was `'autodeath'`, v1.0.50; v1.0.53: `autoVineSpread` 5, the flames climb that × faster than it burns away; `autoFireJump` 14 / `autoFireJumpP` 0.3 (0.5 since v1.0.55; v1.0.55: `autoVineSpread` 24, `autoVineJitter` 0.8, `autoVineAsh` 6 the charred end; `autoNavCut` 0.8 / `autoNavGive` 1.2 s, rock steeper than that the autopilot saws, else goes round), the burning stretch lights vines and webs that near at that chance a fire tick): `autoVineFire`, vines and silk burn up in a level at this × the old game's speed (3 since v1.0.51, owner: 1 was still too slow; the title menu keeps `TITLE_FIRESPEED` 0.1).
- CaveRunner Auto's zones by noise ("Auto: level", v1.0.50, `art/titlescene.js titleZoneLook`): `autoZoneWarp` (170, how far x is pushed), `autoZoneScale` (150), `autoZoneRag` (0.8), `autoZoneIsle` (0.12, islands of the next zone), `autoZoneOpen` (1 since v1.0.51: the caves' shapes follow the curves; 0: by x); `autoHardDeep` (90, v1.0.52: blasts bite less over this far above a level's bottom edge; 0 off), `autoHardEdge` (8: none at all there).
- CaveRunner Auto's maps (`g: 'automaps'`, "Auto: maps"; `auto/maps.js`): `autoMapPrice` (the second map's price, 1,000,000 gold), `autoMapGrow` (× each map after, 1), `autoMapStep` (each map starts this many tiers harder, 5).
- CaveRunner Auto's level (`g: 'autolevel'`, "Auto: level", same **Auto** tab; `auto/level.js`, `auto/pilot.js`, stage 4a): `autoLvlMin` (level length, minutes at normal pace, 5), `autoLvlPace` (normal pace × the menu's scroll, 1), `autoLvlHurry` (stick full right, 1.6), `autoLvlSlow` (stick full left, 0.3; never stops), `autoLvlElite` (elite near, 0.4), `autoLvlChest` (chest near, 0.5), `autoLvlEliteR` (120), `autoLvlChestR` (50), `autoLvlBossT` (arena given up after, s, 120: a fallback if the boss can't be reached), `autoLvlEase` (pace change a second, 1.5).
- The tables: `ELITE_KNOBS`, `ELITE_COLS` (elites), `SP_KNOBS` (spider + web lines), `JE_KNOBS`, `JE_COLS` (jellyfish), `RA_KNOBS` (rats
  and nests), `LV_KNOBS` (floor-1 layout, lanterns), `ARCH_KNOBS` (arched vines), `FIRE_KNOBS`.

## Rules

- **Copy Dev settings must hold everything the owner can set in Dev (the owner's rule, 2026-10-16; CLAUDE.md).** A new
  knob in `DEV_DEFAULTS` is in it by itself; a setting kept anywhere else (its own localStorage key, a list, a kit)
  goes into `auto/devcopy.js` with a built-in default in `src/` for the pasted value to replace, and a check in
  `tests/logic/devcopy.test.js`. Device-only on purpose: Dev mode on/off, the open groups and tab, the audit and
  the zone notes (each has its own copy button), volumes, save slots.
- **Applying a pasted copy:** a plain line `(DEV.k): v` → `DEV_DEFAULTS.k` (or its `Object.assign` / table row); a
  range's `kLo`/`kHi` → that `rangeKnobs` row's default min / max; a colour's `kLo`/`kHi` → the `colourKnobs` row's
  A / B; a curve's `p0`, `pC1x`, `pC1y`, `pC2x`, `pC2y`, `p1` → its `curveKnobs(…, def)` as `y0, x1, y1, x2, y2, y3`;
  a zone's `zl_<zone>_<k>` → all zones share `ZONE_KNOBS`' default, so a one-zone change is an `Object.assign
  (DEV_DEFAULTS, { zl_<zone>_<k>: v })` after the zone loop; a `zv_*` box → its entry in the `zv_` `Object.assign`;
  `PRESETS-JSON` → `DEFAULT_PRESETS` and `GREM-KIT-JSON` → `GREM_KIT_DEFAULT`, pasted as they are.
- The last report made defaults on `autobattler`: v1.0.94's (applied in v1.0.95: zone knobs, presets, Grem kit).
- The last report made defaults on `main`: v0.0.159's (applied in v0.0.161; `fireSpreadHi` put back to 0.2 in v0.0.162 at the
  owner's word). Tests that measured the old numbers pin them (`rats`, `dark`, `furnish`, `tomb`).
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
  `caverunner-devgroups` (all shut by default), the tab `caverunner-devtab`.

- CaveRunner Auto's enemies (`g: 'autofoes'`, "Auto: enemies", **Auto** tab; `auto/enemies.js`, stage 6): `autoFoeDmg` (creatures hurt players × their damage, 0.5), `autoFoeElites` (elites a level, 2), `autoBossSize` (4), `autoBossHp` (12), `autoBossDmg` (3); `autoTierHp` (1.45) and `autoTierDmg` (1.15), v1.0.53: health and bite × that a level past 1, compounding (`autoFoe`).
- **Trajectory mods (Part A):** groups `trajorbit`, `trajspiral`, `trajboomer`, `trajpong` on the **Trajectory** tab, every row a `slider` (motion, then `Look:` rows); `TRAJ_GROUP` maps a mod id to its group (the mod card's Edit button, ui/trajedit.js); `devReportOf(g, name)` is one group's Copy Dev settings. Read by auto/traj.js.
- **Trajectory mods (Part B):** groups `trajhoming`, `trajseeker`, `trajnear`, `trajaim`, `trajgrav`, `trajfloat`, `trajflat` on the Trajectory tab, each in `TRAJ_GROUP` (so the card's Edit button works).

- Zones (CaveRunner Auto, Dev → Zones, `ui/zonesim.js`): `ZONE_KINDS`, `ZONE_KNOBS` → `zl_<zone>_<k>` sliders in group `zone_<zone>` (shown in that zone's card, not the tab's list); `zv_<variant>_<zone>` (1 / 0, the cards' can-have boxes, not rows); `autoVegChance`, `autoSpiderMine` (group `autozones`).
