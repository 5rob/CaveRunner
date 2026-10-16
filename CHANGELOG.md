# CaveRunner changelog

Newest first, one entry per release (a release = the version on `main`; `src/version.js`). The
rules these changes left behind live in the folder READMEs under `src/`; this is only the history.
Names are as they were at the time (before the refactor Game's state had loose names: `mat` is now
`W.mat`, and so on). Versions before v39: `git log`.

## v1.0.102 — Grem Mode: a tapped spot is the autopilot's own goal (branch `autobattler`)
Released 2026-10-16 (owner: "it should work just like the auto movement, but with a temporary position goal").
- v1.0.101 steered him there with a pretend stick: no going round or sawing through rock. Now the tap sets `r.goal` (world x, y) on the runner (`auto/level.js levelWaypoint`); `art/titlescene.js goalStep` puts him in the air and `pickTarget` aims only at it (`goalAim`), so the autopilot's own flight takes him there: rock risen over, dipped under or sawn through as anywhere (a spot inside the rock: he saws to it). Within `GOAL_R` (8) he holds it for `autoCtlWait` s, then the goal is gone and he plays on; not there in `gremWayT` s, the same. Low on fuel he still lands to refill.
- The view centres the tapped spot while he heads for it (`roamStep`; following him instead, the view and he chased each other past it); the others follow him (`levelLead` counts a goal). `levelGoal(S)` for the ring.

## v1.0.101 — Grem Mode: tap a spot to send the player there; tap a chest to open it from anywhere; gun names on the unlocks (branch `autobattler`)
Released 2026-10-16 (owner asked, OK'd the shots); screenshots tests/build/autoshots/grem-waypoint.png (`node tests/run.js grem-tap`), grem-b-play.png (node tools/gremshots.js).
- A tap on the play area that isn't a chest or a creature sends the picked player to that spot (`auto/level.js levelWaypoint`, `L.way`; `wayStep` pushes his stick toward it every frame: walking when it's at his height or below, jetting up to it). A new tap moves it; the stick cancels it. There (or given up after `DEV.gremWayT`, 8 s) he stands, and after the usual idle wait (`autoCtlWait`) the autopilot has him again. A ring in his colour marks the spot (GremScreen's `over`).
- A chest opens at a tap on it from any distance (`auto/chests.js chestAt`, within `DEV.gremChestTapR` 30 units of the tap; `chestOpen(S, chest)`). The old rule stays too: with a chest in reach, the first tap opens it.
- The unlock row shows each gun's name in small text under its picture (`.ggname`).
- Suites `grem-waypoint` (logic), `grem-tap` (browser).

## v1.0.100 — Creatures keep off the players; the Dev panel in Grem Mode (branch `autobattler`)
Released 2026-10-16 (owner asked, both).
- A rat at a player's feet couldn't be shot: a shot starts at the gun's tip, ~18 units out, so a creature nearer than that was behind it (and aimed down, the shot started in the floor). In a level every creature now keeps `DEV.autoFoeKeep` (16) units past its size from each player's middle (`art/titlescene.js keepOff`: pushed out sideways, so a walker stays on its floor, else straight away, else left be); its bite and a bomber's burst reach 4 further (`biteReach`), so they still hurt. Knob in Dev → Auto: enemies (0 = off). Suite `auto-keepoff`.
- Grem Mode: ⏸ held 5 s toggles dev mode as in the normal game; a ⚙️ left of the big ⏸ opens the Dev panel (with its Presets and Grem pages). Suite `grem-dev` (browser).

## v1.0.99 — Grem Mode: no scroll bar under the gun row on a PC (branch `autobattler`)
Released 2026-10-16 (owner asked: Chrome on the PC showed an awkward horizontal scroll bar).
- `.gguns` hides its scroll bar (`scrollbar-width: none`, `::-webkit-scrollbar`); a mouse wheel scrolls the row sideways (`GremScreen.js wheelSideways`). Touch is unchanged.

## v1.0.98 — Grem Mode: the next old floor each level cleared (branch `autobattler`)
Released 2026-10-16 on the branch (owner OK'd); screenshots `node tools/gremseamshots.js`.
- Grem Mode's endless level moves on to the next of the old floors each time a boss falls: Mossy Caves, then Coal Seams, Frozen Deep … Void Hollow, then round from Coal Seams, each with its colours, ambience and creatures (no damage still). The new floor starts just past the boss's arena (`S.looks`, a look per stretch; `auto/level.js levelOnward` adds the next).
- The seam is blended: over `gremSeamW` (160) world units the rock, moss, bricks and back wall fade from one floor's colours into the next's, the edge warped by slow noise (`gremSeamJag` 1) and lightly dithered, so it reads as the cave changing (Dev → Grem Mode).
- Suite `auto-floors` covers Grem's looks.

## v1.0.97 — CaveRunner Auto: the old game's themed floors as levels 2+ (branch `autobattler`)
Released 2026-10-16 on the branch; owner OK'd the screenshots (`node tools/floorshots.js`).
- Level 1 is unchanged (checked: the same run, frame for frame, with the randomness pinned). From level 2 the levels cycle the old game's floors 2..12 as they were before main's custom Level 2 (the Tombs): Coal Seams, Frozen Deep, Ember Halls, Fungal Grotto, Salt Flats, Amethyst Vein, Rustworks, Bone Garden, Drowned Halls, Ash Wastes, Void Hollow, then round again from Coal Seams (`auto/maps.js levelFloor`, by the active map's level; a wipe still sends it back to level 1).
- Each brings its palette (`THEMES`, the scene's `S.theme`, `game/render/titledraw.js`), its ambience, and its creatures: the old `ROSTERS` (floors 2-10 fixed, 11-12 rolled off the level's seed), each as likely, jellyfish only in the natural zones, as the old makeLevel (`S.roster`, `titleKind`); the elites and the boss come off the roster too. The top left names the floor (was the map's name).
- The old classic creatures work in Auto's level (`titlescene.js classicAct`, ported from `game/creatures/classic.js`): shooters (Hiisi, Tappurahiisi, Chaingunner) patrol and fire balls, turrets (Snipuhiisi, Kärpässieni, Jäätiö, Elävät luut) hold station and fire (wind-up first where they had one), chasers (Lohkare, Mato, Hurtta, Kobold, Konna) hunt and bite, bombers (Limanuljaska, Stendari: fire) burst on contact. Their sounds as the old game's (fuse, charge).
- Two Dev knobs (Auto: enemies): **Old floors: hurt × 0.4** (`autoOldDmg`) and **time between shots × 1.5** (`autoOldCd`): Auto can't dodge, and at full strength a starter died in ~40 s on level 2; at these a starter lasts about as long on level 2 as on level 1, harder from there.
- Suite `auto-floors` (logic); screenshots `tools/floorshots.js [out] [levels]`.

## v1.0.96 — CaveRunner Auto: six music tracks and a boss track (branch `autobattler`)
Released 2026-10-16 on the branch; owner approved the mp3s (`node tools/musicwav.js all`).
- Five new tracks in the title's style, each its own mood and tempo: Glowworm (chill, 80 bpm, clean guitar), Afterburner (exciting, 128), Undertow (moody, 92), Surface Light (happy, 116, synth lead), Something Below (suspense, 104). Recipes in `audio/songs.js` (`makeTrack`: chords, 16-step drum and bass patterns, an arpeggio, a lead in the solo's notation, harmonised a third up).
- Colossus (150 bpm) plays during every boss fight, from the boss's arrival until it's down; then the next of the six (Descent first), one per level cleared (`musicPick`, asked every frame in `ui/titlesound.js`). A lost level doesn't move it on. The count is per session.
- `music.js`: each track's tempo, a crossfade between tracks (`Music.play(id)`; the boss's comes in fast), a synth lead, a cleaner guitar, a soft arpeggio. Notes may be flats (`Bb5`). `tools/musicwav.js <id>|all` renders any track to .wav + .mp3 (ffmpeg). Suite `songs`; `title` checks a live switch.

## v1.0.95 — CaveRunner Auto: the owner's Dev settings are the defaults (branch `autobattler`)
Released 2026-10-16 on the branch, from the owner's Copy Dev settings of v1.0.94.
- Mossy caves may have heavy vegetation and spider web (`zv_veg_moss`, `zv_spid_moss` 1); Mossy caves' own vegetation 0.8 patches, 0.55 thick, 0.95 vine length, orb webs ×10 (`zl_moss_*`, an `Object.assign` after the zone loop); Webs zone plants and webs density 0 (`zl_webs_dens`).
- The owner's 22 gun presets are the built-in list (`save/presetdefaults.js`), and their Grem kit the built-in kit (5 tier-5 health exos; Pinpoint, Repel, Gold perks; `GREM_KIT_DEFAULT`): a device that never saved its own gets them.

## v1.0.94 — CaveRunner Auto: Copy Dev settings holds everything (branch `autobattler`)
Released 2026-10-16 on the branch (plumbing, no look change). Owner: the copy should be complete enough to become the defaults, so another device plays the same.
- Copy Dev settings (auto/devcopy.js `devCopyText`) now has every DEV key (the Zones page's check boxes `zv_*` were missing; numbers rounded), the gun presets (Dev → Presets) and Grem's kit (Dev → Grem: player 1's exo mods and perks, the name tags) as JSON when they differ from the built-in ones.
- Built-in defaults for those two: `save/presetdefaults.js DEFAULT_PRESETS`, `auto/grem.js GREM_KIT_DEFAULT` (both empty for now); a device that never saved its own gets them.
- A device now keeps only the Dev knobs it changed (`devChanged`), so it follows new defaults for the rest. Suite `devcopy`. CLAUDE.md and dev/README: the rule that this copy stays complete.

## v1.0.93 — CaveRunner Auto: the volume lock (branch `autobattler`)
Released 2026-10-16 on the branch; owner OK'd the screenshot (`node tests/run.js volume-lock` → tests/build/autoshots/volume-locked.png).
- A press held 4 s without moving on any volume slider (pause menu, title settings) locks all three or unlocks them: locked they're dimmed with a 🔒 and take no touches; kept on the device (ui/volume.js). The press changes no volume.

## v1.0.92 — CaveRunner Auto: Grem round 3 (branch `autobattler`)
Released 2026-10-16 on the branch; owner OK'd the screenshots (`node tools/gremshots.js`).
- Name tags for the 4 players (Dev → Grem), small in each player's colour over his head.
- New guns aren't equipped by themselves; the NEW badge is gone: a fresh unlock glows behind till used once. A joining player still comes with one of the open guns.
- The boss is made off screen and eases in under its name in red (cleared.js letters, red), guns held till the title is gone (`gremBossT`); its health bar as in Auto. GO! at the start (`gremGoT`).
- A joining player teleports in: the start pad's charge on him, then the flash and lightning.
- Gun damage × the creatures' health growth at the level (`gremDmgScale`), so early guns stay viable. Gold bounces `gremGoldWait` (0.6 s) before flying to the team. ⏸ twice the size. The guns unlock in a random order each run (players where they were); Dev → Presets no longer shows prices.

## v1.0.91 — CaveRunner Auto: Grem's chests bigger and glowing (branch `autobattler`)
Released 2026-10-16 on the branch; owner OK'd the screenshots (`node tools/gremshots.js`: grem-c-chest, grem-c-chest-close).
- Grem Mode's chests × `DEV.gremChestSize` (2), with a green light pulsing behind each shut one (`DEV.gremChestGlow` 1): leveldraw.js chestK / chestAt; levelGlow draws the glow additive, then the chest again over it. Normal Auto chests unchanged.

## v1.0.90 — CaveRunner Auto: Grem Mode made gentler (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshots (`node tools/gremshots.js`).
- Players take no damage in Grem (enemies.js levelHurt); the helmets lose their health rings.
- The creatures and the run's pace climb a quarter as fast per level (`DEV.gremHard` 0.25: grem.js gremHardTier, enemies.js gremFoe; kill gold still the level's). Gold drops × `DEV.gremGold` (2), kills and chests.
- No A or B: a tap on the play area opens a chest in reach (hint "Tap to open.", drawHint's new noKey), else picks a target as before. The stick is centred at the bottom, helmets 1-2 left of it, 3-4 right.
- The dark 15% brighter in Grem (`DEV.gremDark` 0.85, titledraw.js titleDark).
- Players 2-4 no longer join by level (knobs gremP2-4 gone): they are unlocks on the gun row, helmet tiles spread among the guns (grem.js gremUnlocks; Dev → Presets prices count along it).

## v1.0.89 — CaveRunner Auto: Dev → Presets drags and gun look (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshots (`node tests/run.js auto-presets` → tests/build/autoshots/presets-*.png).
- Owner: the ⠿ handle on a preset tile drags it onto another's place (the order, so Grem's unlock order). In the editor: a slot's mod dragged onto another slot swaps them, onto the mod grid throws it away (the grid glows red), a mod's grab circle in the grid drags a new one onto a slot; taps work as before. 🖼️ opens the gun look gallery (ui/gunart.js), saved with Save changes. The editor's slots are `data-eslot` now (`data-pslot` is the nav's player circles). Suite auto-presets (browser).

## v1.0.88 — CaveRunner Auto: a White Hole pulls every Discriminate's target (branch `autobattler`)
Released 2026-10-15 on the branch.
- Fix (owner's screenshot: a White Hole with Discriminates rat, gold and green gem never pulled gold): `auto/shotfx.js vacPull` chose what to pull by the first target's kind only (`only.kind`), so a creature first meant no gold or gems. It now checks every target (`targetsOf` / `matchesTarget`); the same for players. Suite auto-discrim.
- Also (looked into, no change): Double Cast on a gun that already casts 2 fires 3; a Switch in front of Follow Me takes it as one of its turns.

## v1.0.87 — CaveRunner Auto: the gun panel's 💾 moved (branch `autobattler`)
Released 2026-10-15 on the branch (owner: no approval needed).
- Owner: the 💾 (dev mode: save the gun as a preset) sat over the stats' PER CAST line; it's now at the firing window's top right (`.agpsave` in style.css).

## v1.0.86 — CaveRunner Auto: a buffed or Enlarged White Hole keeps its core (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshot (tools/whshots.js).
- Owner: Buff and Enlarge already grew a White Hole's reach (`r`: 64 → 128 with Buff ×2, 96 with Enlarge) but its bright core grew with it (`drawWhiteHole`'s core is 5.5% of its radius). `game/render/autolooks.js` now draws the core at a plain hole's size (`WH_REACH`); the rim stays at the reach, and `auto/shotfx.js` spawns sparkles over the reach, as many more as it's wider (up to 4×). Grem Mode too (the same scene). Shot `node tools/whshots.js`.

## v1.0.85 — CaveRunner Auto: Grem Mode, Dev → Presets, White Hole + Follow Me (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshots (tools/gremshots.js).
- **Grem Mode** (owner, for their toddler): GREM MODE on the title (between ⚙ and ▶) opens `ui/auto/GremScreen.js`: no hub, no nav, no bag, no save; one player teleports into an endless level (`auto/level.js` `levelScene(…, grem)`: `levelPlan`'s `endless` has no wall, no blocked zones, nothing after the arena; after each boss LEVEL CLEARED shows and `levelOnward` adds the next stretch and arena, the level + 1, the living healed). Gold is the only drop (kills, chests: `chestRoll`'s `goldOnly`). The gun presets, in order, are locked; the gold collected pays them off one after another (`auto/grem.js`: `gremPrice` = `gremPrice` × `gremGrow`^i, `gremUnlocked`, `gremFill`), each tile's outline filling clockwise (conic gradient); a new one goes to player 1, a tap on an unlocked one equips it. Players 2–4 join at levels `gremP2/3/4` (5, 10, 15), each with one of the unlocked guns, newest first (`gremTeamGun`). The stick takes player 1 over at once (camera on him), back to auto `autoCtlWait` s after it rests; B lets go. A tap on the play area picks the nearest creature (within `gremPickR`): everyone aims at it (`S.pick` in `titleAimPick`), a see-through red ring round it. Everyone down: "Tap A to play again" (a fresh run).
- **Dev → Presets** (`ui/auto/presetlib.js`): the gun presets (`save/presets.js`) as a grid in their (unlock) order; a tap opens the gun editor (GunPanel's stats + firing window, the slots: tap to pick / swap / ✕ empty, the mod grid: a tap puts a mod in, name, ◀ ▶ order, 🗑️, Save changes). 💾 on a gun's panel (dev mode) saves a new preset. `setPreset`, `movePreset`; `ModGrid`'s `onTap`/`note`; `DevPanel`'s `pages`.
- **Dev → Grem** (`ui/auto/gremkit.js`): Grem's player 1 kit (exo tiers, 6 perks; `gremKit*`, localStorage `caverunner-grem-kit`) and the Grem knobs.
- **Fix: a White Hole ignored Follow Me** (owner's screenshot): `art/scenegun.js whiteHole` never copied `follow` onto the field, and `shotFollow` would have capped a still field at 1 unit/s; it now uses `fieldFollow` (as the Circle of Vigour): it comes to its caster and stays with him, pulling what its Discriminates name.
- Owner round 2 (before release): the guns one row scrolling sideways (a new unlock scrolled into view), a fresh unlock flashing NEW till tapped (`fresh`, `.gnew`), the players' helmets with health rings between the guns and the buttons (`GremHelms`, the picked one ringed white): a tapped gun goes to the picked player, the stick steers him. The Dev preset editor takes the whole window (portal, `.apled` fixed; the mod grid scrolls under the panel and slots), its slots stacked in rows of 7 in a framed panel as the main game's grown mod row (`.apledslots`).
- Suite `tests/logic/grem.test.js`; shots `node tools/gremshots.js`.

## v1.0.84 — CaveRunner Auto: three mana mods (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshots (tools/manashots.js).
- Owner asked for more mana mods (picked 3 of 10 ideas; the rest are in HANDOVER): **Recharge Battery** (`rechbat`, passive: mana to full at every reload, -40 max mana; `gunPassives().rechFill`, art/scenegun.js `gunPull`'s wrap), **Mana Spring** (`manaspring`, Vigour's blue twin: players inside get `MANA_TICK` 8 mana a tick in the gun in hand; scenegun.js `vigourCircle` with `mana`, titlescene.js `vigourStep`/`giveMana`), **Mana Burst** (`manaburst`, a modifier: the next spell's `manaB` 30 mana to each player within `MANA_BURST_R` 60 where it ends, however it ends; titlescene.js `manaBurst`, its blue ring autolooks.js `drawBoom`). Suite: auto-mana.

## v1.0.83 — CaveRunner Auto: Switch takes single mods, Discriminates add up, the grown mod row puts the gun panel at the top (branch `autobattler`)
Released 2026-10-15 on the branch; owner OK'd the screenshots (tools/rowupshots.js).
- Owner: a Switch takes turns between the next n single mods (passives not counted), not groups: the one up is drawn as usual (a modifier lands on the next spell), the others passed over for free (spells/cast.js `planCast` `sw`; the pull flashing, auto/preview.js `pvPull`). Suites: switch, auto-preview.
- Owner: several Discriminates on one spell add up (it touches any of their targets): `only.or` (spells/discrim.js `addTarget`, `targetsOf`; `matchesTarget` checks them all; titlescene.js hurts each named player). Suite: discrim.
- Owner: a gun's mod row grown (double tap an empty slot) moves everything up: the gun panel at the top of the screen, the rows above it hidden, the play area faded, the bag taking the room (ui/auto/AutoScreen.js `rowLift`, `.auto.rowup`). Suite: auto-rowup (browser).

## v1.0.82 — CaveRunner Auto: Follow Me + Discriminate on a player follows that player (branch `autobattler`)
Released 2026-10-14 on the branch (a fix).
- Owner: a Vigour circle with Discriminate set on player 1 didn't go to player 1. Discriminate alone only picks who it heals (the circle stays where cast); with Follow Me the circle followed its caster. Now Follow Me follows the Discriminate's player (titlescene.js `fieldFollow`). Suite: auto-vigour.

## v1.0.81 — CaveRunner Auto: the Dev mod grid scrolls (branch `autobattler`)
Released 2026-10-14 on the branch (a fix).
- Owner: the Dev panel's mod grid wouldn't scroll. It sat outside the panel's scrolling body (squeezing the knob list to nothing); it's now the body's first child, scrolling with the knobs (ui/devpanel.js). Suite: auto-modgrid (browser, a real touch swipe).

## v1.0.80 — CaveRunner Auto: the nuke's mushroom cloud, the level-end nuke, webs, joining players, the Switch's flashing (branch `autobattler`)
Released 2026-10-14 on the branch; owner OK'd the screenshots (tools/nukeshots.js, joinshots.js, switchlitshots.js).
- Owner: a good-looking mushroom cloud. `drawMushroom` (game/render/autolooks.js; `S.mush`, `titleMushroom`): a stem of billowing puffs, a cap rolling as a ring of puffs, a dust skirt; white hot → orange → brown → grey smoke, fading over `DEV.autoMushT` (3.2 s). Drawn normally inside the bright pass (that pass adds colours: smoke added up to white). The Nuke shot's cloud is its blast × `autoMushK`; the old ellipse stem and cap are gone.
- Owner: the level ends with the team gathered on the exit pad and one big nuke under it (auto/death.js `exitNuke`; level.js `exitStep`: `L.nukeT` 0.5 s after all stand on the pad's floor, or 6 s after gathering began), the pad blown apart (`L.padGone`, no longer drawn) and a crater, everyone thrown as ragdolls. Knobs (Auto: death): `autoExitNukeR` 90, `autoExitNukeF` 1600, `autoExitNukeWait` 3.5. The head pops (`exitPop`, `autoExitPopGap`, `autoExitPopR`, `autoExitRagT`) are gone.
- Owner: webs popped on. A level makes its columns `AHEAD_LVL` (340) ahead, not 130, and an orb web that would be strung in view is skipped (before: 9 of 40 popped on; now 0, big ones still made). Three suites adjusted for the cave this shifts: auto-zonelab counts in its zone, auto-roam measures from the scroll's furthest (seed 8), auto-control's "straight down" by the dig's depth.
- Owner: a web's centre stayed put when a main line broke. The hub hangs on its spokes as springs (world/orbweb.js `orbHubRest`, `orbSpring`; titlescene.js `orbRig`, `orbSwing`): a spoke gone, it swings to a new rest point away from it and a little lower; the spiral threads ride their spokes (`L.oa`, `L.ob`).
- Owner: new players in the hub only (a green gem onto a player circle is refused in a level), through the enter teleporter: its charge, then lightning and the arc sound (hub.js `hubLate`, `H.at`, `H.late`). The pad off screen: heard from the left edge, and a bluish flash lights the play area from the left, faded out half way across (AutoScreen.js `hubFarFlash`, `H.far`); on screen: the screen's flash.
- Owner: the Switch shows its pairing in the gun's pull flashing: the group it picked lit, the others dimmed with a dashed edge (auto/preview.js `pvPull`, `pv.lit.skip`, `.pulse.skip`).
- Answered: the owner's Vigour gun alternated "Vigour with Follow Me, Discriminate and both Grows" against the Buzzsaw: a Switch takes whole groups, so each Vigour needs its own (Switch, Follow Me, Vigour, Discriminate, Follow Me, Vigour).

## v1.0.79 — CaveRunner Auto: DPS graph keeps its history, Dev performance graphs, view outline (branch `autobattler`)
Released 2026-10-14 on the branch; owner OK'd the screenshots (tools/pvgraphshots.js, tools/fpsshots.js).
- Owner: the gun window's DPS graph mustn't reset on a gun change (to compare). The preview scene is still rebuilt each change, but `PreviewWindow` carries the graph into the new one (`hist`), a dotted line where it changed (`pv.gmark`, `pv.mark`); the graph now holds 10 s (`PV_GRAPH_N` 100). Suite `auto-pvgraph` (drags a bolt off mid-run).
- Owner: an FPS history graph bottom right of the play area, then the other live measures stacked over it in their own colours, no background, **Dev mode only**: fps (yellow under 50, red under 30), worst frame (ms), update and draw (ms a frame, `runScene`'s new `perf` option), shots, particles, creatures, burning cells. 0.25 s buckets, 15 s kept (`auto/fps.js`, `PERF_ROWS`; drawn by AutoScreen.js `perfDraw`). A tap on their place (`.aperf`) hides them (a dim "perf" stays) or shows them. Suite `auto-fps`.
- Owner: the level map (journey box) outlines the part on screen (the camera's view), in the box's purple a little brighter (`#5a4788`).

## v1.0.78 — CaveRunner Auto: Dev → Zones (branch `autobattler`)
Released 2026-10-14 on the branch; owner OK'd the screenshots.
Owner: a Dev page for reviewing the level's zones, like the fire sim's.
- Dev → **Zones** tab (`ui/zonesim.js`, `art/zonelab.js`): a window on one zone made as a level makes it (lit, no creatures), the whole zone fitted to the window (stitched a screen width at a time, `zonePicture`) or Close up (live, drag pans both ways); Respawn; a card per zone kind: Show it plain / heavy vegetation / spider web filled, a "can have" box per variant, a notes box per zone and variant (localStorage `caverunner-zonenotes`); **Copy zone notes** (boxes changed, the page's knobs changed, every note).
- The variants are now per-zone flags (`DEV.zv_veg_<zone>`, `DEV.zv_spid_<zone>`, art/titlescene.js `zoneMay`): heavy vegetation (`Z.veg`, the spider zone's vines look, any zone; `autoVegChance`) and spider web filled (`Z.spid`, was mines only; `autoSpiderMine`). Defaults keep levels as they were (veg: spider zone; spid: mines).
- Owner: "controls in each group for tweaking its layout and looks": each row's **Tweak** opens its sliders (group `zone_<zone>`, dev/knobs.js `ZONE_KNOBS`, read by art/titlescene.js `zk`): Plain: length, roof / floor up or down, roof / floor hilliness, how close the hills are, density, hanging plants how many / long (the grove: its arch knobs too; the spider zone: its boulders); Heavy vegetation: share in patches, thickness, vine length; Spider web filled: orb webs ×. Defaults are the old numbers. The window makes the zone again once the knobs hold still 250 ms.
- Groups `autozones` and `autoorb` on the Zones tab. Suite `auto-zonelab`; shots `tools/zonesimshots.js`.

## After v1.0.77 (tooling, no game change) — the test suite: essentials and an archive
Owner: the whole suite had got slow enough to hold development up. `node tests/run.js` now runs only `tests/essentials.js`
(17 logic + 4 browser suites, quick and never flaky); the rest are archived in place: `related` adds those that name a
`src/` file changed since HEAD, a name runs any suite, `all` runs every one. Logic essentials ~12 s (the full logic set
~4 minutes; ~200 s of that was the old game's cave suites).

## v1.0.77 — CaveRunner Auto: orb webs break apart (branch `autobattler`)
Owner: "full webs suspended on nothing when players break the main lines". Owner OK'd the screenshots (tools/cutshots.js).
- world/orbweb.js `orbHeld` (pure): a frame holds while its rock does; a spoke while its rock or held frame does; the hub while `ORB_HUB` (3) spokes hold; a spiral thread while both ends sit on held spokes. art/titlescene.js `orbSettle` after every orb thread cut or burnt, and every 0.2 s for webs on screen (their rock dug or blasted): what doesn't hold falls as loose silk, spokes still on rock hang from it.
- Fixed: webs were placed with the unmade columns ahead counted as rock, so some spokes hung on air once made; now only real rock (or timber) holds, and a web with any anchor off it isn't strung.
- Suite `orbweb`: orbHeld cases and a hub cleared in the scene.

## v1.0.76 — CaveRunner Auto: just orb webs, and large ones (branch `autobattler`)
Owner: "too many really tall single strands, not enough webs; just webs (spiders still spin their own lines); large ones too". Owner OK'd the screenshots.
- A level's webs and spider zones lose the scenery's straight web lines (the title menu keeps them).
- Orb webs each their own size, `autoOrbRMin` 30 … `autoOrbR` 150 (bigger: more spokes, wider spiral); `autoOrbChance` 0.25, `autoOrbMax` 5 counted over the last screen and a half (the old cap counted all kept, so a zone's first few used it up), hubs kept apart (`S.orbHub`).
- Tests: auto-speed on seed 9 (7's start grew a bump), auto-speed / auto-traj / auto-vigour turn orb webs off; auto-spiderzone counts vines mid-zone and checks the webs are apart.

## v1.0.75 — CaveRunner Auto: the owner's 7 notes after v1.0.74, and the spider zone (branch `autobattler`)
Owner OK'd the screenshots. PM alone.
- After the boss nobody takes off: everyone comes down and runs along the floor to the exit (S.huddle in a level).
- Normal pace by level: `autoLvlPace` 1 at level 1 → `autoLvlPaceTop` 3 by `autoLvlPaceLv` 20 (pilot.js `lvlPace`).
- Bag: a dragged group keeps its layout, green outlines where it lands (`bagGroupPlan`). A bag gun tapped opens in the play area; drag its mods off into the bag (`BagGunView`, `bagGunModOut`).
- Dev mod grid: small grab circles (the rest scrolls), the trigger variants gone.
- Orb webs (world/orbweb.js), the spider zone (`spider`: rocks / vines / beams; levels only) and spider mines (`Z.spid`); knobs "Auto: orb webs".
- Fixed: a flyer waiting for fuel at rock hung in the air for ever (`jetOver`: he lands to refill).

## v1.0.74 — CaveRunner Auto: the owner's 23-note play round (branch `autobattler`)
Released 2026-10-13 on the branch. PM (gameplay, looks) + one agent (bag drag, worktree `../cr-bagdrag`, ~12 min).
- After the boss: guns down (`S.gunsOff`); loot in → straight out to the exit, LEVEL CLEARED shown on the way (`clearedWords`).
- Level exit pad: no teleport; each head pops (death.js `exitPop`, the death blast, nobody hurt) `autoExitPopGap` apart, ragdolls fly `autoExitRagT`, then the hub.
- Pads one at a time (hub.js `padBusy`/`padNext`): the start pad (hub and level; a team steps off in a level, `stepOff`) and the hub's exit pad (`exitQueue`: each walks on, goes in his own flash).
- Borer drills on through rock, Bounce or not (the old game's rule; shots carry `bore`). Vigour keeps to its Discriminate player, never creatures.
- Jellyfish turn faster deeper (`autoJeTurnTier`, cap `autoJeTurnMax`). Tall levels: team height goals (`roamGoal`, `autoRoamT/Hi/Mid/Fly/Run`): 7–18% → 28–55% of the time in the upper two thirds.
- Camera onto the last one down. Teleport beam's flash and lightning fade at the top. Fire keeps `FIRE_PARTS` 200 particles of its own (chunks filled the cap). Spiders' legs cycle by distance (`autoSpStride`).
- HUD "Top N"; version on the title; the stick's knob no longer clipped (clip-path, z-index 4); gold/crystals as their sprites (`NuggetIcon`); Slug ⬣, Bounce Orb ◐, Energy Orb ⚛, Energy Sphere ❂; Static field family orange.
- Dev → Mod grid (`ui/modgrid.js`): every mod, tap for info, hold to put one in the bag.
- Bag drag (agent): double tap an empty mod slot → rows of 7 (pushes the stack up, owner); edge auto-scroll while dragging; hold + slide to pick a group, drag it as one; insert bar between two mods (`insertMod`, `modMoveTo`, `bagGroupMove`, `fitMods`).

## v1.0.73 — CaveRunner Auto: Recoil and Recoil Damper in the red Damage group (branch `autobattler`)
Released 2026-10-13 on the branch. PM alone (owner's audit note: Damper the wrong colour group; owner chose red for both).
- `FAMILY_OF` kick, damper: 'dmg' (were 'upkeep', green); Damper's own col red.

## v1.0.72 — CaveRunner Auto: Double / Triple / Quad Switch mods (branch `autobattler`)
Released 2026-10-13 on the branch. PM alone; owner OK'd the shots.
- New pattern mods `switch2/3/4` (`swN`): of the next 2 / 3 / 4 groups (a spell with the modifiers before it, a carrier with its
  payload) only one casts each pull, taking turns; the others are drawn past free. spells/cast.js planCast `sw`; the turn is per
  switch slot in `g.swc` (replaced, never mutated, so a gun's copy in a sim leaves it alone; rolled back with `idx` via
  `plan.swc0` when the mana's short). Icons: '[n]' glyphs drawn as the digit in a rounded box (art/itemicon.js `inkGlyph`).
  Suite `switch`; `auto-guns` checks a switch over two pulls; shot `tools/previewshots.js <out> f-switch`.
- `auto-wall` (logic) is flaky since the faster pace (seed 5's time varies 55–89 s): re-run alone.

## v1.0.71 — CaveRunner Auto: Discriminate works (hold its tile to pick a target) (branch `autobattler`)
Released 2026-10-13 on the branch. Agent ~17 min, 2 rounds (worktree `cr-discrim`); owner OK'd the shots.
- Hold a Discriminate tile (bag or gun slot, `DEV.autoHoldMs`): a popup of targets with the game's pictures: rats, jellyfish, spiders,
  gold, red crystals, green crystals, P1–P4 (helmets in team colours). The copy becomes `discrimId(target)`, the tile shows its
  target in the corner (`art/discrimicon.js`, `TargetPic`). Shots with it hit only that kind (a player: hurts him via the level's
  hurt, after 0.12 s); a White Hole with it pulls only that (creatures, gold nuggets, red/green pickups, or a player: `autoDiscPull`).
  Set copies register on load (`auto/save.js`). Off GUN_TODO. Suite `auto-discrim`, shots `tools/discrimshots.js`.
- Not yet: homing ignores the target.

## v1.0.70 — CaveRunner Auto: trajectory mods part B (homing, seeker, short-range, auto-aim, gravity, anti-gravity, horizontal) (branch `autobattler`)
Released 2026-10-13 on the branch. Agent ~9 min (worktree `cr-traj`); the owner asked for it to ship when done.
- src/auto/traj.js `trajHome` / `trajAim` / `trajGrav` / `trajLob`: Homing (90 reach, 3 rad/s a copy, after 0.1 s), Seeker (locks one
  creature within 220 till it dies, 10 rad/s), Short-range (nothing till one is within 36, then 16 rad/s), Auto-Aim (first frame at the
  nearest within 170; off GUN_TODO), Gravity 260 down / Anti-Gravity 200 up a copy (launch-angle knob), Horizontal Path (kept level,
  speed and damage knobs). Each its Trajectory knob group + TRAJ_GROUP (the Edit button). spells/mods.js: those mods count themselves
  on the shot (`homN`, `seekN`, `nearN`, `gravN`, `floatN`; the old game ignores them). Suite `auto-traj` (35 checks).
- Gravity's bolt lands on the preview's floor short of the target (`trGravG` / `trGravLob` to tune).

## v1.0.69 — CaveRunner Auto: trajectory mods part A (orbit, spiral, boomerang, ping-pong) and the Dev Edit button on mod cards (branch `autobattler`)
Released 2026-10-13 on the branch. Agent ~12 min (worktree `cr-traj`); owner OK'd the shots.
- `trajStep` (src/auto/traj.js, pure): the old game's pathStep rules with Auto's sizes from knobs (Dev tab Trajectory, a group per
  mod: motion, then Look: trail, glow, tint). Orbit: radius 20, 7 rad/s, through rock (`trOrbRock`). Spiral: 2.5 Hz, widening, capped
  16. Boomerang: turns back at 55 units (`trBoDist`) or 0.35 of its life, caught within 8, through rock coming back. Ping-pong: out
  0.3 s, back half. `spiral` off GUN_TODO.
- Dev mode only: an Edit button on a trajectory mod's card (`src/ui/trajedit.js`, `TRAJ_GROUP`): its knobs as live sliders, Copy
  (just its changed knobs, the Dev report format, `devReportOf`), Reset all, Done. Suite `auto-traj`, shots `tools/trajshots.js`.

## v1.0.68 — CaveRunner Auto: the owner's Dev report as defaults (branch `autobattler`)
Released 2026-10-13 on the branch. PM alone.
- New defaults (src/dev/knobs.js): move 1.2; fireSpread hi 0.6; firePlant 3–7; fireArch hi 9; autoGunBase 100; autoExoPrice 175;
  autoLvlMin 2, autoLvlPace 2, autoLvlHurry 1.75, autoLvlChest 0.75, autoLvlEase 2; autoZoneOpen 0; autoVineFire 1, autoVineSpread 4,
  autoVineAsh 8, autoFireJump 2; autoMoveK 0.75; autoFireSpread 0.2, autoWebFire 4; fireFlare 0.5; labJetH 120; fxSmRate 3,
  fxSmAlpha 0:0 0.159:0.285 0.547:0.342 1:0; autoSilkSpread 3, autoSilkCut 0.1; autoLootExo 7.
- Fix found by it: a hand-steered saw started from a stale screen speed (`r.vx`), sliding him ~20 units at the faster pace.
- Suites that leaned on the old numbers pin the knobs they measure (auto-vinefire, auto-firelab, auto-tall's zone check, auto-level)
  or read them (auto-run, auto-hub × DEV.move); auto-speed measures from the screen's left (the right edge caps him at the pace).

## v1.0.67 — CaveRunner Auto: the gun preview runs the level's own code; Follow Me on every shot; burning vines bright and lighting the cave (branch `autobattler`)
Released 2026-10-13 on the branch. Preview by an agent (worktree `cr-preview`, two rounds, ~25 min), the rest PM; owner OK'd the shots.
- The gun panel's firing window is a small room of the level's scene (`src/auto/preview.js`): the same shot flight, looks, trails,
  lights and speed as a level; GUN_TODO mods do nothing there too. A fresh copy of the gun fires (the real one untouched). Target: the
  hologram of you (an unseen rat takes the hits; dark at rest, lit on a hit, unkillable), 30 units off the right wall (`PV_HOLO_X`);
  DPS number and graph over the top third. Double tap: the window grows over the stats (shooter at the new left; aims at the
  target at any range); again: back. Floor and walls break and grow back cell by cell from the hole's edges (`autoPvRegrow`, 40/s).
  `runScene` option `quiet`. Suite `auto-preview`, shots `tools/previewshots.js`.
- Follow Me works on every shot in Auto (`shotFollow` in art/titlescene.js, the old game's pull: slows, stops, comes back to its
  caster, never faster than it left); off `GUN_TODO`. Suite `auto-follow`.
- Burning vines and webs drawn again over the dark at full brightness (`drawBurnProps(ctx, S, true)`, `drawWebFronts` in
  render/titledraw.js), with their own light, shadowed by the rock, every `autoBurnLightGap` along the burning stretch
  (`burnSpots`), and a warm glow: knobs `autoBurnBright`, `autoBurnLight`, `autoBurnLightR`, `autoBurnLightGap`, `autoBurnGlow`.

## v1.0.66 — CaveRunner Auto: Circle of Vigour works, and with Follow Me stays with its caster (branch `autobattler`)
Released 2026-10-13 on the branch. PM alone, owner OK'd the shots.
- Vigour is cast in a level (`vigourCircle` in art/scenegun.js): it stays on the ground (back with the scroll) and heals a living
  player inside 4 every 0.4 s × his heal perks, to his max (titlescene.js `vigourStep`, the heal tick sound). With Follow Me it
  steers to its caster and stays with him (`fieldFollow`). Drawn with the game's field look: render/looks.js `drawField` (factored out
  of `drawFields`). Off `GUN_TODO`. Suite `auto-vigour`; shots `tools/shotlookshots.js` s9, s10 (a `+` joins mods).

## v1.0.65 — CaveRunner Auto: Questions Later works on the players (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone (owner's note).
- In a level a gun with Questions Later fires with nothing in sight, aimed ahead (`stepRunnerGun`; not in the hub). Off `GUN_TODO`;
  `auto-guns` counts the passive; new suite `auto-qlater`.

## v1.0.64 — CaveRunner Auto: Dev buttons for red and green crystals (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the shots.
- Dev panel (Auto): "+1 red crystal" / "+1 green crystal" put one in the bag a tap (`DevPanel` prop `onGem`). Shots: `tools/devshots.js` (e, f).

## v1.0.63 — CaveRunner Auto: burnt-off vine and silk pieces fall as loose ropes (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd.
- Burnt-off pieces fall as loose ropes (`ropeMake` / `ropeStep` in art/titlescene.js: verlet points, links held, stopped by rock),
  draping and burning away where they lie; suite `auto-firelab` measures the bend.

## v1.0.62 — CaveRunner Auto: the fire sim's window twice as tall, sticking at the top as the page scrolls; spots inset (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the shots.
- Layout (owner): the sim's window and buttons sit outside the knobs (`.firesimtop`); on the Fire sim tab the whole panel scrolls
  (`.devpanel.fsmode`: the header goes up out of the way, the window sticks at the top, open group heads don't stick there).
  The window 420 px tall (was 210); the room is as tall as the window, so the timber spot's mine is half the room (at least
  `MINE_H`).
- Spots (owner): what burns keeps `LAB_IN` (10%) of a spot's width in from each side (`labScene`: x0..x1 inside the spot s0;
  the mine's rock roof still spans it).
- Suite `auto-firelab` (nothing that burns in the 10% margins).

## v1.0.61 — CaveRunner Auto: silk's own fire knobs and smoke; the fire sim keeps what's behind the view (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner approved the shot.
- Silk (owner: separate controls, no smoke seen): group `firesilk` "Fire: webs (silk)": `autoWebFire` moved in, and silk's
  own `autoSilkSpread/Jitter/Ash/Cut/Spin/Jump/JumpP` (the vines' defaults), `autoSilkSmoke` (10 puffs a second a burning strand;
  it burnt too short for the vines' span-based rate) and `autoSilkFlames` (×). stepFire's burning loop picks by `sk`. The
  vines' knobs relabelled "Vines: …".
- Fix: the fire sim culled props and webs left behind the view (`behind`, made for a level's forward scroll): panning right
  and back lost the spots. `S.lab`: nothing culled.
- Fix: a web line cut where its end sits on the floor hung a strand down into the rock; that end now just goes (`cutWeb`'s
  piece: rock just below the anchor). Levels too.
- Suite `auto-firelab` (a strand smokes at `autoSilkSmoke`, burns through by `autoSilkCut` not the vines'). Shots:
  `tools/firesimshots.js <out> <spot> <ms held>`.

## v1.0.60 — CaveRunner Auto: Dev controls for the fire's flame specks and smoke (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the shots.
- New group `firefx` "Fire: flames and smoke" (Fire sim tab). In Auto's rules (`autoOn`) `flameAt`, `fireSmoke` and `titleJet`
  roll their particles from it (`fxPart`, `fxCount`): ranges `fxFlLife/Size/Rise/Side`, `fxSmLife/Size/Grow/Rise/Side` (Lo/Hi);
  `fxFlRate`/`fxSmRate` (× how many); colour over life `fxFlGrad`/`fxSmGrad` and opacity over life `fxFlAlpha`/`fxSmAlpha`
  (shaped on the panel's `GradEditor` / `RampEditor`, now taking their knob: `k`, `life`); randomness `fxFlColJit`/`fxSmColJit`
  (each particle's own shift along the gradient, `p.u`) and `fxFlAlphaJit`/`fxSmAlphaJit` (its own opacity, `p.a`); smoke grows
  at its own `p.g`. Defaults match the old look. The title as before.
- Fix: two gradient editors on one page shared their bar's SVG id (the second showed the first's colours); now `gradbar-<knob>`.
- Suite `auto-firelab` (particles in the knobs' ranges, none at rate 0). Shots: `tools/firesimshots.js` adds fs-d-fx, fs-e-grads.

## v1.0.59 — CaveRunner Auto: players shoot up to the roof, not at the screen's right edge, a hail mary off the left (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone (gameplay, no looks).
- Owner: the short aggro (`TITLE_AIM` 90) kept off-screen creatures safe but left high ones in the tall level unshot. In a
  level the target is now `titleAimPick(S, r)` (pulled out of the runner's gun step): the nearest within `autoAimR` (400,
  roof from the floor), never in the strip `autoAimEdge` (24) down the screen's right side or past it; on the left (owner, same
  round) a hail mary at ones up to `autoAimLeft` (20) past the edge; the boss wherever it is. The title as before.
- Suite `auto-aim`.

## v1.0.58 — CaveRunner Auto: burning pixels twinkle; the fire sim in separate test spots, flame jets while Fire is held (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the shots.
- Twinkle (owner: the fire looked like static noise): the burning pixels' hash added the tick after the multiply, so the
  colour's top bits hardly ever changed. `art/crackle.js` `fireTone(c, r, tick)`: each square breathes at its own pace and
  phase (`fireTwinkle` 1 ×) and flares bright at `fireFlare` (0.06) a tick; used for burning cells (titledraw), vines and
  silk (`crackleAt`) and creatures (`crackleBody`, its squares and tongues now change too). The old game's `render/cave.js`
  keeps its own (not in this branch's build).
- Fire sim room (owner's layout): `art/firelab.js` five spots `LAB_SPOTS` (`LAB_SPOT` = 2/3 of the screen, `LAB_GAP` 50
  between): vines (cave hanging vines + 3 crossing arches with strands), webs (single strands + a dense hatch, all inside the
  spot), timber (a low mine roof, two support frames as genCol's, three hanging lanterns), moss (floor, mound, roof
  underside), grass (tufts). Names stencilled low on the wall (`firelabdraw.js`). `labScene` → `Lab` `{ S, pts, jets, next }`.
- Hold Fire: `labStep(L, dt, hold)` (runScene's new `step` hook) spawns jets across the view every `labJetGap` (0.35 s, at
  random), up to `labJetH` (50) high, about `labJetT` (0.7 s), swelling and dying; `titleJet` shoots flame specks up and lights
  what it reaches. Group `firelab` "Fire sim: flame jets" on the Fire sim tab. `labNearest` gone.
- Suites: `auto-firelab` (spots in order, nothing that burns between them, each spot burns, jets come and go and light the
  grass, twinkle). Shots: `tools/firesimshots.js` (page, spots sheet, jets), `tools/twinkleshots.js`.

## v1.0.57 — CaveRunner Auto: the Dev panel shows what works in Auto; burning vines and webs burn through (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the shots. (A per-material burn time for vines/webs was built and
scrapped by the owner: grass, moss and timber already have theirs, the Fire group's "… burns for (s)".)
- Dev colours (owner: didn't know the panel worked for Auto): `tools/autoknobs.js` (run by `tools/build.js` every build)
  bundles `src/main.js` tree-shaken, drops the knob tables and the panel's UI, and lists each knob read in what's left
  (`DEV.key`, or its name as a string; a range knob by its base) into `src/dev/autouse.js` `AUTO_KNOBS` (328 of 722).
  `devpanel.js`: a row's `.devauto` green bar / `.devold` dimmed; a group's count green (all) / amber (`.devsome`) / grey;
  a key `.devkey` on each tab. Suite `autoknobs` (current, real names, known ones).
- Burn through (owner): a burning vine or silk strand (Auto's rules) burns through at `autoBurnCut` (0.015) a fire tick
  somewhere along its burning stretch; the rest drops (`drop`, still alight), turning at `rv` up to `autoBurnSpin` (2.5 rad/s)
  either way (`rot`, about its middle: `titleTumbleLow` lands it on its lower end; titledraw `tumble`). Suite
  `auto-firelab`; shots `node tools/vinefireshots.js <out> 0 <cut>`.

## v1.0.56 — CaveRunner Auto: Dev → Fire sim page; leaves burn and pass fire on; full fire knobs (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone (no agent: the PM had the fire code loaded), owner OK'd the shots.
- Leaves (owner: they didn't burn): `titledraw.js` draws them alight along the burning stretch and charred past it (where
  `art/props.js` puts them, `LEAFY`); in Auto's rules every point of a burning stretch, leaves too, lights fuel cells
  (moss, grass, timber) within `autoLeafReach` (5) at `autoLeafLight` (0.15) a tick, and jumps to vines and webs as before.
- Fire knobs (owner: full controls): new `autoFireSpread` (0.1, cell to cell and onto plants: was `TITLE_FIRESPEED` in
  levels too), `autoWebFire` (3), `autoVineCatch` (0.25), `autoLeafReach`/`autoLeafLight`; the group `autofire`.
- **Dev → Fire sim** (new tab `firesim`, owner's design): a window on a long still room (`art/firelab.js` `labScene`, `LAB_W`
  1500: vines, arches, webs, moss, a crate, a frame, grass, mixes; `S.lab` = Auto's fire rules, `autoOn(S)`), a worn range
  backdrop (`game/render/firelabdraw.js` `labBack`, through `S.back`; open air see-through, no dark), drag sideways to pan,
  Respawn (a new line-up), Fire (`titleIgnite` at the test object nearest the middle, `labNearest`); under it every fire knob
  (the `autofire` and old `fire` groups, moved off the Auto and World tabs; open by default there). `ui/firesim.js`.
- Fixes from v1.0.55's going-round: it called `jetOver`, whose low-fuel wait held the whole team (even mid-air) on any slope
  (now `jetOver(S, r, false)`: low fuel, he saws); the dry drop nudged a player up any rock he touched (now only when
  stuck in it). `auto-clear` went 1 in 4 failing → 0 in 16.
- Suites: `auto-firelab` (new); `auto-loot` clears other creatures for the full-bag check (more fire, more kills);
  `auto-fuel`'s dry low wall: gets over, never blocked (he may walk it dry, no wait needed). Shots: `tools/firesimshots.js`;
  `tools/devshots.js` adds the fire group. `auto-steer` (browser) flaked 2/5 here, 1/6 on v1.0.55, 0/5 on v1.0.54: watch it.

## v1.0.55 — CaveRunner Auto: vines burn all along; players go round rock before sawing; no spawns past the boss (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone, owner OK'd the vine shots.
- Vine fire (owner: only the end pixel looked alight): the flames already ran up `p.lit` but only the tip was drawn. A burning
  plant or silk strand in a level now has three states: unburnt to `p.lit`, burning `p.lit..p.ch` (drawn alight all along,
  `titledraw.js`), charred and crumbling `p.ch..p.len` (`autoVineAsh` 6, dark with embers, ash falling). The climb doubled
  (`autoVineSpread` 12 → 24) and spurts by noise (`autoVineJitter` 0.8); sideways spread from a point every 6 (at most 16) at
  `autoFireJumpP` 0.5. The title as before.
- Saws (owner: they sawed out the exit pad's ground and couldn't reach the teleporter): before sawing, `navAround` reads the
  rock's average normal (`rockNormal`) against the way on (+x): facing back less than `autoNavCut` (0.8), a floor or slope
  he goes over (`jetOver`, only with open air above), a roof under (only with a gap below); steeper, or tried for `autoNavGive`
  (1.2 s), he saws. Not by hand, not the title. A dry player stuck in rock mid-air drops to land (he used to hold the team
  in a fuel wait forever; `auto-wall` caught it about 1 run in 6).
- Spawns (owner: a jellyfish spawned past the boss wiped a team waiting at the exit): `levelSpawn` gives none once the
  scene's right edge (+ `SPAWN_TAIL` 100) reaches the arena.
- Suites: `auto-exitnav` (new: the normal, the spawn stop, 4 short levels keep the pad's ground), `auto-vinefire` (the
  charred stretch); `auto-tall`'s plant count floor 10 → 6 (the rolls shifted; the "hangs from rock" check unchanged).

## v1.0.54 — CaveRunner Auto: the ground under the exit pad holds (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone.
- Owner: players blasted out the ground under the exit teleporter. The blast's hard line (`deepK(S, y, wx)`) is now the
  level's own, `S.lvl.hardY` = auto/level.js `levelHardY`: `autoHardEdge` over the bottom edge, rising to the exit pad's
  floor over its flat stretch and sloping back down `HARD_RAMP` (50) either side.
- Suite `auto-deep` checks it.

## v1.0.53 — CaveRunner Auto: fire climbs vines and webs and jumps sideways; steeper level scaling (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone.
- Owner: a vine's fire didn't climb till the bit below had burnt. A burning plant now has a flame front `p.lit` (from the
  root) running up `autoVineSpread` (5) × faster than it burns away (`autoVineFire` 3, as before): alight from `lit` to
  the tip, flames and smoke along it. Webs: a lit web line is cut into hanging silk strands (as before), which burn the same way.
- Sideways: in a level the whole burning stretch (a point every 8, at most 8) lights vines, arches and web lines within
  `autoFireJump` (14) at `autoFireJumpP` (0.3) a fire tick (`spreadFrom` takes the reach and chance). The title: as ever.
- Level scaling (owner: a level 10 team one-shot the boss for six levels): the old game's +35% health a floor (level 10:
  ~4×) is gone from Auto; `autoFoe(id, tier)` (auto/enemies.js; the scene's `S.lvl.kind`) is the tier 1 kind with health ×
  `autoTierHp` (1.45) and bite × `autoTierDmg` (1.15) a level past 1, compounding (level 10: ~28× health, the boss 48 → 336
  on a rat). The boss, elites and the trickle all use it. Suite `auto-enemies` checks it.
- `auto-level`: a 3 s window that took in a stop (arena, LEVEL CLEARED) isn't counted as stuck (the faster fire shifted one onto the restart).
- Suite `auto-vinefire` (flames ahead of the burnt part; a vine 12 off and a web line beside catch); shots
  `tools/vinefireshots.js`.

## v1.0.52 — CaveRunner Auto: the bottom of a level holds against blasts (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone.
- Owner: strong guns blasted the cave away and the team ran along the bottom edge. `deepK` (art/titlescene.js): a blast
  (`titleCarve` with its rim) bites × 1 down to `autoHardDeep` (90) above the play area's bottom, easing to 0 at
  `autoHardEdge` (8). Tall levels only (at the old height the band was half the level: `auto-level` stalled); the saw's cut as ever.
- Suite `auto-deep`.
- Tried and dropped (owner: no): a toughness per material (`TITLE_BITE`: dirt gave, iron held).

## v1.0.51 — CaveRunner Auto: caves follow the curving zones, faster vine fire (branch `autobattler`)
Released 2026-10-12 on the branch. PM alone.
- `autoZoneOpen` on (1): another zone's look opens its own cave air (`zoneOpenAt`, pure; genCol carves by it). The
  "stall" didn't reproduce; what showed instead, fixed: a runner sawing below the play area's bottom edge (r.y now kept
  above `S.vh - PH` in tall levels), and after the boss a flyer drifting to the hall's roof out of the camera
  (`S.huddle`, set by auto/level.js in cleared/out/exit: flyers keep to the team's middle height).
- Vines, webs, chains and pads follow the zone they look like (`titleZoneLook` at the roof / floor) and hang from the
  roof as carved (`titleRoof`).
- `autoVineFire` 1 → 3 (owner: still too slow).
- Tests: `auto-tall` checks plants hang from rock and follow the curves; `auto-control` clears plants before its walk
  check, `auto-shotfx` and `auto-perks` pin the runner in line with the creature (the cave's chance moved him off it).
- Found: "Path blocked" with only the starter gun is the rules (the sure wall at `wallX`, then any natural rock, web or
  timber blocks a team that can't clear it); asked the owner. A lone starter player at tier 1 in a tall level dies in
  ~25–60 s in a probe.

## v1.0.50 — CaveRunner Auto: tall levels, curving zones, faster vine fire (branch `autobattler`)
Released 2026-10-11 on the branch. Agents `cr-tall` and `cr-zones` (both a little past the box) + PM.
- Levels are made at the grown play area's height (about twice as tall); with the UI open the camera follows the pack up
  and down (`camPack`, `TitleCam.view/pack`; scenecanvas re-reads the height each frame). The band is `min(vh*0.24, 50)`
  to `vh - min(vh*0.08, 20)`; `bandK` scales roof/floor waves and the winding tunnel above the old height; in tall levels a
  flyer keeps within `TITLE_PACKY` of the team. The hub is unchanged.
- Zones by warped noise (the old game's level.js way): `titleZoneLook(wx, y)` pushes x by a domain-warped fbm field plus
  islands, so a zone's skin, moss and bricks curve across the height. Knobs "Auto: level" `autoZoneWarp/Scale/Rag/Isle/Open`
  (`autoZoneOpen` 0: the caves' shapes still follow x; on, it stalled the autopilot). Tall mines stack up to 5 more tunnels.
- Vines and silk burn up in a level at `autoVineFire` (1) × the old game's speed (was 0.1: too slow to see).
- Suites: `auto-tall`, `auto-zones`, `auto-vinefire`; `auto-control` clears vines in its let-go check. Shots `tools/tallshots.js`.
- Open: props (vines, webs) still follow x zones; `autoZoneOpen` needs the stall found; some seeds with only the starter gun
  stop at "Path blocked" (seen before this too).

## v1.0.49 — CaveRunner Auto: the bag grows (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask).
- The bag always has `BAG_EXTRA` (3) empty rows after the lowest row holding something (`run.js bagSize`/`bagFit`: `bagAdd`,
  `newRun` and the screen's render fit it), up to `BAG_MAX` (100 rows; only then full). The big bag is opaque.
  Suites: `auto-run` (grow/shrink/full), `auto-loot` and `auto-run` fill to BAG_MAX, browser `auto-screen` (91 slots).

## v1.0.48 — CaveRunner Auto: the camera after the grown play area (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's bug).
- A scene made while the play area was grown (the hub to a level, or back) took the grown height, so shrunk back its camera
  sat below the players. `make` now takes the play area's own height (`bigPlayRef`). Browser `auto-bigbag` checks it.

## v1.0.47 — CaveRunner Auto: the play area grows over the nav and bag (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask).
- A double tap on the play area (`BIG_TAP`) grows it down to the bag's bottom edge, over the nav and the bag (`bigPlay`:
  a bigger flex-basis taken back by a negative bottom margin, animated; `.aplay.big`); again, or B, back. The stick and
  A/B stay on top. Known: the scene keeps its height (dark space under the floor); the owner will say. Browser `auto-bigbag`.

## v1.0.46 — CaveRunner Auto: the bag grows over the play area (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask).
- A double tap on an empty bag slot (`BIG_TAP` 350 ms) grows the bag up over the nav and the play area (`.abag.big`, a
  negative top margin, animated); a double tap again or B puts it back. The stick's dome stays on top. Browser `auto-bigbag`.

## v1.0.45 — CaveRunner Auto: the gold stream steps up to bigger nuggets (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask: "a way of getting the gold out faster").
- A held at a machine, gold: after `autoStreamMedT` s at full speed the stream throws medium nuggets worth `autoStreamMedN`
  (25), then after `autoStreamBigT` s big ones worth `autoStreamBigN` (250) doubling every `autoStreamGrow` s; each no more
  than the bag holds and the machine still wants (`payout.js hubOwed`, gold on its way counted). `hubPayOne` takes a worth
  and a size (`HubThrow.sz`, `throwR`). Browser `auto-throw` checks it.

## v1.0.44 — CaveRunner Auto: maps and their levels, the map machine, health bars, the journey box (branch `autobattler`)
Released 2026-10-11 on the branch. PM (health bars, top bar) + agent `cr-maps` (maps, ~12 min).
- Maps (`auto/maps.js`): the THEMES in order, Mossy Caves free. Each map keeps its own level: the end teleporter
  raises it by 1, everyone fallen puts it back to 1. `run.tier` is now worked out from the active map (level + map index ×
  `autoMapStep`), so enemies, gold, loot and prices follow it. The next map unlocks once the one before is beaten and
  1,000,000G (`autoMapPrice`, × `autoMapGrow` each after) is paid in. Old saves: map 0 at their tier. Every map still
  uses today's cave look.
- The map machine: a new hub stop between the perk machine and the exit (the hallway is longer). Stick up/down browses,
  A picks an owned map or pays the next one (thrown gold pays too); its front shows the active map and level.
- Thin red health bars over creatures (`leveldraw.js levelBars`, over the dark). The boss bar is big, its name above it.
- Top left of the play area: the map's name and level; under it the journey box (the level at its own shape, the
  players' helmets where they are; a tap hides it, a tap on its place brings it back); the boss bar under that.

## v1.0.43 — CaveRunner Auto: drag a gun out of the Guns row (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask).
- In the nav's Guns row, a gun circle slid off before the hold (equip) becomes a drag: into the bag slot under the finger
  (`run.js gunToBag`: an empty slot, or a gun there swaps in; else the first free slot, `unfitGun`), or onto another
  gun circle (`gunMove`, a swap; the firing gun follows). Taking out the firing gun makes another fitted one fire.
- Tests: `auto-run` (gunToBag, gunMove), browser `auto-drag` (out to the bag and back with the mouse).

## v1.0.42 — CaveRunner Auto: manual mode holds 3 s after the stick is let go (branch `autobattler`)
Released 2026-10-11 on the branch. PM alone (owner's ask: back off the jet and have him drop, not flown up by the autopilot).
- `ctlOn` stays true till the stick has rested `DEV.autoCtlWait` s (3; Dev "Auto: death & feel"): `r.ctlIdle`, counted
  in `ctlStep`, cleared when he's let go. Tests: `auto-control` checks the drop and the hand-back; `auto-fuel` and
  browser `auto-steer` wait it out.

## v1.0.41 — CaveRunner Auto: hanging on vines and web lines (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/hangshots.js`). Agent ~30 min (worktree `cr-hang`, past its box).
- The owner: "port the ability to hang on vines and webs, same mechanics". The hand-steered player only (the autopilot
  never grabs): touching a vine, chain, root, arched vine or web line without jetting he hangs on, the tank refills; the
  stick climbs (up = jet, as the old game); no push across = the old pendulum swing about the root, the vine swinging
  with him; along arched vines and web lines hands on the line, pushing across or past an end lets go (0.35 s no
  re-grab); web lines dip under him and slow him. A hanging player stays steered with the stick released.
- `auto/hang.js`; `lineLetGo`/`LINE_OFF` moved to `world/sway.js` (player.js re-exports). Suite `auto-hang` (sandbox,
  16 checks); `auto-fuel` clears a cave's vines (a dry player now hangs on one, by the old rule). Not done: a hanging pose
  (the old game had none), burning vines lighting him.

## v1.0.40 — CaveRunner Auto: shot looks, part 2; Black Hole pulls, White Hole works (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/shotlookshots.js` sheets s5–s8). Agent ~10 min (worktree `cr-shots2`) + PM.
- Energy Orb an undulating energy blob, Energy Sphere the same hollow; Lightning the old v62 jagged bolt (`drawBolt`,
  re-kinked each frame) forking at creatures near it (looks only); Chain Bolt a black-purple crackling ball, a streak on
  each leap; Black Hole the old look and motes, drawn twice its size (`VOID_K`), and now it pulls (`holePull`, the old
  game's: DEV.bhPull, enemy shots swallowed); Plasma Beam / Luminous Drill fire as real beams (`traceBeam`, `castBeam`:
  they never hit before), plasma purple and burning, the drill green, short, tip fading; Death Cross sparkles; Nuke and
  Meteor big blasts (flash, shockwave, mushroom, debris; looks only, gameplay radius unchanged), Meteor's long fire tail.
- White Hole (vacfield) is cast in Auto (was GUN_TODO): still, `WH_AHEAD` along the aim, pulling creatures and enemy shots
  (`vacPull`, harmless); the game's look at half size, motes spawned over its reach fly onto it and are sucked in (a part's `to`).
- All looks use `Math.random`. Suite `auto-shotfx` (pull, white hole, a level plasma hit). Known flakes: `auto-steer`.

## v1.0.39 — CaveRunner Auto: shot looks, part 1 (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/shotlookshots.js`, close-ups too). Agent ~11 min (worktree `cr-shots1`) + PM.
- The owner's audit, [stage: shots] first half, by spell id (`s.sid`): Bolt a pink dart with the old pink trail; Spark a
  jittering fleck shedding sparks; Slug a copper bullet + muzzle smoke; Buckshot grey pellets, short range; Lance a thin
  blue saber; Blast a solid bomb, smoke trail, a smoking fuse at rest; Magic Arrow thin with a white streak; Magic Missile
  straight out then homes on the nearest creature, fire-to-smoke rocket trail; Fireball/Firebolt/Flamethrower one flaming
  look, fire and smoke trails, Fireball throws 6 burning drops (Firebolt 3) that light the scene's fire; Bubble Spark
  brighter, twinkling, blue light; Spitter drops falling pink; Pollen glows and leaves specks; Disc 4 fading afterimages.
- `auto/shotfx.js` (pure), `game/render/autolooks.js`; trails draw `Math.random` (looks only). Capped (trails stop
  near the particle cap, 40 shot lights). Suite `auto-shotfx`. Found: `auto-throw` flaked once in a full run (passes alone).

## v1.0.38 — CaveRunner Auto: jetpack fuel, the old cough, health rings (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/fuelshots.js`, `tools/hpringshots.js`). Agent ~15 min (worktree `cr-fuel`) + PM.
- Jetpack fuel in a level (exo Jetpack: a longer tank, a faster refill): jetting drains, the ground refills, dry = no
  thrust till it's back to a restart line; hand-steered too. The autopilot waits at a wall to refill (`S.fuelWait`).
  Hub and title keep a bottomless tank. `auto/fuel.js`; knobs `autoFuelDrain` / `autoFuelRegen`.
- The cough is the old game's own: `SPUTTER_FUEL` / `sputterStep` moved to `core/util.js` (player.js re-exports);
  near empty the jet cuts out, a dip, grey puffs, the sputter sound; running dry sputters too.
- The fuel meter is a strip down the back of the jetpack (`drawRunner`'s `gauge`), shown only when not full: yellow,
  orange under a quarter, red blinking when dry. The bar over the head is gone.
- Health rings: each helmet in the player row is ringed by that player's health, his colour, clockwise from the top
  (`nav.js hpFrac`, `.ahp`); under a quarter it flashes red (`.ahpf`), faster toward 0 (`--fl`).
- Tests: new `auto-fuel`; `auto-nav` checks `hpFrac`; `auto-perks` pins the starter shot (was flaky).

## v1.0.37 — CaveRunner Auto: Permanent Shield, Pinpointer, Angry Ghost (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/perkshots.js`). Agent ~9 min (worktree `cr-perks`).
- Permanent Shield: soaks a whole hit (`levelHurt`), back after 2.5 s; a light-blue glow brightest at the rim, a flash
  and a flying ring when it breaks, swelling back when ready.
- Pinpointer: look only (its speed/spread gone from `data/perks.js`): a red laser from the muzzle to the first rock or creature.
- Angry Ghost: a wisp trailing the player, a slow homing shot at the nearest creature (1 dmg / 1.4 s, 150 range: about a
  quarter of the old game's). Counts in the player's damage.
- `auto/perks.js`, `game/render/perkdraw.js`; Dev → Auto → "Auto: perks" (4 knobs). Test: `auto-perks`.

## v1.0.36 — CaveRunner Auto: pickups as their bag tile, flying into the bag (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd `tools/vendiconshots.js`). Agent ~9 min (worktree `cr-icons`) + PM.
- A mod, exo mod or perk from a machine (or dropped in a level) lies on the floor as the bag's tile: rounded box in its
  outline colour, the same icon (`auto/itemtile.js` `drawItemTile`, `tileItem`, `itemEdgeCol`; icons moved to
  `art/itemicon.js` so the canvas can draw them).
- Taken into the bag: a copy flies from the player into the slot it went to (0.5 s; `S.onTake`, `camTo`, `bagSlotOf`,
  AutoScreen `flyIn`/`FlyTile`, `.afly`). A new slot stays empty till it lands (owner); a stack it joins shows at once.
- Tests: new `auto-flyin` (logic and browser).

## v1.0.35 — CaveRunner Auto: the owner's item audit, part 1 (branch `autobattler`)
Released 2026-10-11 on the branch. The owner's notes: `docs/auto-item-audit-notes.txt` (what's done, what's staged).
- Binned (kept for old saves, never handed out; `off: 1`): mods Digging Bolt, Glowing Lance, Teleport Bolt, Matter Eater,
  Follow This, Aim Assist, Long-Distance Cast, Spells To Giga Sawblades; perks All-Seeing Eye, Enemy/Item/Wand Radar,
  Mini-map, Tinker, Trajectory Sight, and Fire Immunity (archived); the exo Carrot (out of `EXO_CATS`, counts for nothing).
- The "... With Trigger/Timer" variants are off; Add Trigger / Add Timer / Add Expiration Trigger are tier 1 and common on
  every floor (`spawn.js`).
- Fix: Wand Refresh did nothing in Auto (`scenegun.js gunPull` now skips the next recharge, as the game's `skipRech`).
- Fix: Glass Cannon gave no damage (`perkDmg(player)`: the fitted perks' damage × on every shot a player fires).
- Hair Trigger and Quick Recharge checked: they do shorten the recharge.
- Small Teleport Bolt hops 0.75 as far. Colours: Gravity, Anti-Gravity, Horizontal Path purple (flight path); the sweep
  moved Wand Refresh and Recoil to green (upkeep), Heavy Spread to pink (pattern).
- Tests: new `auto-audit`; `trigger`, `aimassist`, `auto-run`, `auto-hub`, `auto-guns` updated for the bins.

## v1.0.34 — CaveRunner Auto: semi-automatic manual mode, its crosshair, full speed on a slow phone (branch `autobattler`)
Released 2026-10-11 on the branch (bug round 2; owner OK'd the crosshair, shot `tools/stickshots.js` stick-c-cross).
- Manual mode is semi-automatic: the picked player (helmet held) plays by himself and the level keeps the pilot's pace
  till the stick is pushed; then he's steered (and the view follows him); let go, the autopilot again (`ctlOn`,
  `r.ctlWas`; `levelLead` only while steered, `levelPicked` the picked one). B still lets him go.
- The picked player's helmet in the nav wears the selected gun's crosshair (`.anavc.manual`).
- Fix: a slow frame (below 20 fps, a busy level on the phone) ran the whole scene slow (titleStep caps a step at 0.05 s);
  `ui/scenecanvas.js` now steps it in pieces (up to 0.2 s a frame). Likely the "manual speed differs from the hub".
- Fix: followers trail behind the steered player by the way he's going, not where his gun faces (`roamFollow`).
- Tests: new `auto-speed` (hub vs level walk speed); `auto-control`, `auto-roam`, `auto-steer` for semi-auto
  (auto-steer keeps rock free: `autoWallMin/Max` 120).

## v1.0.33 — CaveRunner Auto: manual control unhindered, the stick in the corner (branch `autobattler`)
Released 2026-10-11 on the branch (bug round 1; owner OK'd the look, shots `tools/stickshots.js`).
- Fix: a hand-steered player was taken over by the autopilot when he hit rock: his saw steered him to the autopilot's
  target (and up to open air after 6 s), a wall he couldn't clear jetted him over it, and a teammate's bump snapped him back
  to 0.62 of the screen (the "teleport"). Now his saw goes where the stick points and stops when it's let go (`ctlDig`),
  a wall he can't clear just stops him, and the bump keeps the whole screen (`separate`).
- New: the stick pushed down while standing saws down into the floor.
- The stick moved to the bar's left end (B, A to its right): a circle centred level with the buttons' top, rising over the
  bag's corner and cut off at the bar's bottom, one outline round it and the bar; the knob 56 px over a dark well.
- Tests: `auto-control` (dig down, no pull to the target, no snap), `auto-screen` (the stick's place), `auto-loop` (push in px).

## v1.0.32 — CaveRunner Auto: machine items seen and walked over, one hand-steered speed, the Dev panel (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd; shots `tools/vendshots.js`, `tools/devshots.js`).
- Fix: a machine's item was hidden behind the hub's back wall (since v1.0.26: `drawLoot` ran before `hubBack`); now drawn
  after it. It pops out toward player 1, bounces and lies there; picked up only once `autoPickMin` (1 s) old and a player
  within `autoPickReach` (22) of it (`TLoot.reach`, `minT`; it used to fly into a player standing at the machine).
- One hand-steered speed, `autoMoveK` (0.55, replaces `autoJetK`): × the old game's walk, jet, their pushes and the sink, in
  the hub and steering a player (the hub's followers too), so running and jetting keep the old game's balance.
- The Dev panel on the auto screen: ⏸ held 5 s toggles dev mode (the menu opens at once), a ⚙️ beside ⏸ opens it; the old
  game's run buttons are left out when there's no loadout (`ui/devpanel.js`).
- Tests: `auto-payout`, `auto-throw`, `auto-loop` walk player 1 to the item; `auto-steer`'s pace checks allow the
  pilot's own holds; `auto-control` uses the new speed.

## v1.0.31 — CaveRunner Auto: a gentler jetpack (branch `autobattler`)
Released 2026-10-11 on the branch (owner: "the jetpack feels way too fast and strong").
- New knob `autoJetK` (0.55, Dev → Auto → "Auto: jetpack and death"): × the old game's climb (`jetLift`), sideways jet speed and
  push (`JET_ACC`), in the hub and for a steered player; a climb no longer snaps up instantly (twice the push instead).

## v1.0.30 — CaveRunner Auto: feedback round 2, sixth batch (branch `autobattler`)
Released 2026-10-11 on the branch (owner OK'd; shots `tools/roamshots.js`).
- B at the player row hides the nav (the rows slide out, the slot closes); a tap on the play area brings it back
  (`navHidden`, `.anavwrap.hid`). No camera gestures any more: one fixed view (`runScene` option `still`; no pinch,
  drag or tap-to-follow).
- Manual mode (agent): a helmet TAP opens the player's menu; a HOLD in a level steers him (in the hub the hold is still the
  gun arc). The level's own scroll stops; the view follows him forward and back at `autoRoamCam` × his offset (damped),
  at most `autoRoamBack` screens behind the furthest point (a level keeps `TITLE_BACK` of cave, props, creatures and
  drops behind the screen); the team lines up behind him; B: the pilot again. `auto/level.js` `levelLead`, `roamStep`,
  `roamFollow`; suites `auto-roam`, `auto-steer` (rewritten).
- The jet: lowering the stick lowers the thrust and the flame until he sinks (`jetLift`, `jetThrottle`, `JET_SINK`; hub
  and a steered player).
- `auto-loot`'s "a slot frees" no longer flakes (the team's other kills' gold and drops raced for the slot).

## v1.0.29 — CaveRunner Auto: feedback round 2, fifth batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shot `tools/pillshots.js`).
- Fix: the jet flame away from the way he travels. The hub never ran the jetpack step (`S.still`): `hubMove` now calls
  `jetStep` for everyone, player 1's thrust from his stick (`r.jetIn`); a level's autopilot leans it by his speed through
  the world (`r.wvx`, the scroll counted; it was his speed on screen, ~0). `autoJetTilt` 0.6 → 1. Checks in `auto-hub`.
- Paying: full stream at twice the drag (`PAY_MAX` 90 → 180 px, `autoPayK` 4 → 2: the same top speed).

## v1.0.28 — CaveRunner Auto: feedback round 2, fourth batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shots `tools/deathshots.js`).
- Steering recheck: a player picked by his helmet in a level is the one the stick steers (the camera follows him);
  backing out to the player row (B) lets him go and clears the ring; a steered player roams the whole screen. Suite `auto-steer`.
- The old jetpack (agent): the flame from the backpack's nozzle (`titleNozzle`), pointing away from the thrust
  (`titleFlameDir`: the stick for a steered player, else up tilted by his speed, `autoJetTilt`), the old length; its smoke
  puffs (`jetStep`, `autoJetSmoke`; their own random, so the title's seeded run is unchanged).
- The old ragdoll on a death (agent, `auto/death.js`): a fallen player is a ragdoll (`world/ragdoll.js`) left behind; the
  whole team down: the scroll eases to a stop (`autoDeathStop`), "Tap A to Teleport back to Hub"; A (`levelTeleportHome`)
  blinks a red light on the helmet (`autoTpBlink`), a big blast, then home (`autoTpBoomWait`; `levelLost` only then).
  Knobs Dev → Auto → "Auto: jetpack and death". Suite `auto-death`; `auto-enemies` updated.

## v1.0.27 — CaveRunner Auto: feedback round 2, third batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shots `tools/pinshots.js`).
- Fix: the mod slots now light in each pull's colour with the gun panel's preview (v1.0.25 built it but the panel never
  passed its lights on: `onLit` was only given to the stack's last item, the slots row). A fitted mod no pull fires is
  dimmed (`pullSteps`, `.anavs.cold`), as the old Bag.
- Easier to pick up: `autoGrab` 0.35 → 0.45.
- Stats: a 4th span, "all", the whole level so far (`meters.js` `M.all`, `meterAll` averaged to `ALL_PTS`, `spanLabel`).
  A graph held `autoHoldMs` is pinned above the player row on its side (damage left, health right; no box; a dot in the
  player's colour); the newest at the bottom, older ones rise; held again it's unpinned. The pins ride up with the nav
  stack (`PinStack`, `PinGraph`).

## v1.0.26 — CaveRunner Auto: feedback round 2, second batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shots `tools/hubshots.js`, the old shop's `tools/oldshopshots.js`).
- The hub is the old shop's room (agent, then PM rounds): the old 120 between stops (was 100), the room 96 high, the
  old steel back wall with its lit rail and SHOP (no FLOOR n: owner), the roof with its strip of lights, the deck floor,
  dust in the tubes' cones, the TELEPORTER-over-PRINTER sign over the way in; the mod and perk machines play the old
  hologram demo of a gem going in until one has been paid (`stepHubDemo`, knob `autoHubDemoNear`).
- The exit pad's sign: TELEPORTER nailed over INCINERATOR, its plank lower and sloped the other way, "(for real)" under it
  (`art/sign.js` `drawTeleSign` options `plate`, `dx`, `dy`, `rot`, `sub`).
- In a level, a player tapped in the play area is steered by the pill stick (walk, jet up; the old game's steering,
  `titlescene.js` `ctlStep`); his gun still aims and fires by itself. B lets him go (back on the autopilot), else B is
  the nav's back. `auto/level.js` `levelControl`; suite `auto-control`.

## v1.0.25 — CaveRunner Auto: feedback round 2, first batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shots `tools/stackshots.js`, `tools/payshots.js`).
- The nav is a stack: going down a level, the row rises over the play area and the next slides in from the right; B
  reverses it (the row slides out, the rest drop back). Raised rows keep their pick lit (white ring), the rest dimmed,
  and still take taps. `auto/nav.js` `navPath`, `navPick`; `AutoScreen` `NavStack`.
- The equipped gun is marked by 4 white diagonal ticks (an X with its middle cut out); the white ring is the menu's pick.
- In the Guns row a gun held `autoHoldMs` becomes the active gun (a tap still opens it).
- At a gun's mod slots the gun panel rises above them: the old Bag's stats (live bars) and firing window
  (`ui/editor.js` `GunStats`, `GunFire`) in the cards' colours; the mod slots flash with each pull.
- Paying is A: at a machine "A to Pay" shows over it; a tap drops one of what it takes out of player 1's chest onto the
  floor in front of him, held it streams (ramping), and a drag from where A was pressed aims it (direction, speed).
  Each lands, rests `PAY_REST` and goes into the machine it was paid at. Gold and gems at their real sizes, colliding
  (`throwR`, `collideNuggets`). The throw from the bag tile is gone. `auto/throw.js` `hubPayAt`, `payVel`, `hubPayOne`;
  knobs `autoPayReach`, `autoPayHold`, `autoPayK` (the flick and stream-start knobs removed).
- Rows on screen when it opens no longer slide in (a test measured a helmet mid-slide).

## v1.0.24 — CaveRunner Auto: feedback round 1, fourth batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd; shots `tools/vendshots.js`).
- Fix: the level restarted whenever the play area changed size (the owner found it: the phone's app switcher shrinks the
  page into a card). `ui/scenecanvas.js` `runScene` remade the scene on every resize; with `keep` (the auto screen) a
  resize only resizes the canvas and the scene runs on. New suite `auto-keep` (fails on the old code).
- Hub: the gun is held the way each player faces (`HUB_GUN_ANG`, mirrored facing left).
- Hub machines: the item pops out, falls, lands and lies on the floor `PAY_REST` (0.45 s) before the pull (`TLoot.land`).
- `auto-loot`'s "a slot frees" check accepts any drop kind (it expected a mod and flaked about 1 in 6).

## v1.0.23 — CaveRunner Auto: feedback round 1, third batch (branch `autobattler`)
Released 2026-10-10 on the branch.
- Things go where you put them (owner: "auto arranging … makes setting up a gun impossible"): drag bag → bag (moves, swaps,
  or merges the same stack), slot → slot in a row (a gun's mod order, exo and perk slots swap), and a slot → the bag
  slot you drop it on (empty: there; the same stack: onto it; a single item that fits the slot: they swap). Before,
  only bag → slot and slot → "the bag" (first free slot) worked. `run.js` `bagMove`, `rowMove`, `rowToBag`
  (`SlotRow`).
- Gold and gems: the whole-stack lump (held still on the stack) is gone; it caught the start of a spray. Knob
  `autoLumpMs` removed. Suites `auto-throw` and `auto-loop` pay machines by a stream now.

## v1.0.22 — CaveRunner Auto: feedback round 1, second batch (branch `autobattler`)
Released 2026-10-10 on the branch (owner OK'd the stick shot, `tools/pillshots.js`).
- The pill stick reads exactly as the old left thumbstick: one reach every way (`PILL_REACH` 54 px, the old 150 px
  stick's 75 × 0.72), the knob free out to it past the pill's edges. Before, up/down was measured against the pill's
  small height, so a slight vertical wobble stole the sideways push (the "force blocking fast lateral movement").
- Creatures in a level start as a trickle: a new one every `autoFoeGap0` (4) s, at most `autoFoeCap0` (3) alive,
  easing to every `autoFoeGap1` (1.5) s and `autoFoeCap1` (10) by the arena (`level.js` `levelSpawn`, `S.lvl.spawn`;
  a rat swarm stops at the cap too).
- Fix (stage 6b): flying through the gap over a low blocked zone, the jet-over check counted only the air above his
  feet and could call it blocked; it now counts from a little below them.

## v1.0.21 — CaveRunner Auto: feedback round 1 (branch `autobattler`)
Released 2026-10-10 on the branch.
- Hub: player 1 moves exactly as in the old game (its walk, jetpack and gravity numbers, `core/consts.js`; the jet aims
  the stick's way). The knobs `autoHubRun` / `autoHubJet` are gone; the others' line-up walk is 150. No fuel in the hub.
- Starter items: a run saved before the starter kit existed (stage 5a) now gets it on load (`run.js` `kitMissing`).
- The boss: the team aims at its edge and shoots it from behind too; its health ×40 → ×12 (`autoBossHp`), so one
  starter gun kills a tier-1 boss in ~5–65 s instead of hitting the 120 s fallback. New suite `auto-boss`.
- The first wall (owner: none in the first 20 s, and not always at 20): each level makes sure of one of its own stage 6b
  blocked zones (`level.js` `plantWall`: the first random zone past its own random time, 20–35 s at full hurry, gets a
  normal `rollBlock` blockage at severity 1; `plan.wallX` its face): about 40–70 s in at normal pace. Before it nothing
  blocks (`levelFree`: the team digs through as on the title; a free dig ends with it). Knobs `autoWallMin` /
  `autoWallMax` (both 0: off). New suite `auto-wall`, shot tool `tools/wallshots.js`.

## v1.0.20 — CaveRunner Auto: the full-loop suite (branch `autobattler`, stage 14)
Released 2026-10-10 on the branch (tests and a tool only; nothing visible changed).
- Browser suite `auto-loop` (~55 s): new run → pay the gun machine by lump → pill stick to the exit pad, A → level
  (hurry, a chest opened with A, elites, the boss) → LEVEL CLEARED → hub at tier 2 → a green gem onto an empty circle →
  2 players. Shortcuts: a Buzzsaw gun for player 1, short level and weak-boss knobs, the boss's hp zeroed if alive 3 s in.
- `tools/autoperf.js`: a level's frame times. Phone size: ×1 CPU mean ~17 ms (60 fps), ×4 CPU mean ~26 ms (~39 fps),
  p95 ~36 ms.

## v1.0.19 — CaveRunner Auto: save, resume, cleanup (branch `autobattler`, stage 13)
Released 2026-10-10 on the branch (owner OK'd the New run shots, `tools/newrunshots.js`).
- Drops picked up in a level are saved at once: a quit mid-level reopens in the hub with the bag kept.
- ⏸ → **New run** (tap twice to confirm): a fresh run, back to the title.
- The old game (`ui/app.js` App, `game/levelgen.js`) is out of this branch's build: `index.html` 1,594,144 → 1,192,534 bytes.
  Its 91 browser suites moved to `tests/retired/`; `tests/build.js` no longer plants `window.__in`.
- README: how to play CaveRunner Auto. New suite `auto-save`.

## v1.0.18 — CaveRunner Auto: extra players (branch `autobattler`, stage 12)
Released 2026-10-10 on the branch (owner OK'd the shots, `tools/teamshots.js`).
- Drag a green gem onto an empty player circle (it lights green; anything else refused) → `addPlayer` (a green spent,
  the starter gun, a Buzzsaw into the bag); the new player teleports in beside the team, hub or level, with a flash,
  sparks and lightning (`auto/addrunner.js` `sceneAddRunner`, titlescene `titleRunner`), and in a level fires his own
  gun at once. Up to 4. The camera still follows player 1. Suites `auto-addplayer`, `auto-drag`.

## v1.0.17 — CaveRunner Auto: chests (branch `autobattler`, stage 11)
Released 2026-10-10 on the branch (owner OK'd the shots, `tools/chestshots.js`).
- `auto/chests.js`: `autoChestN` (3) chests a level, one per stretch of the random zones (never on the pads, in the
  arena or by a blockage), settled on the ground. In range (`autoChestR`) "Tap A to open" shows and the team slows; A
  opens it (`chestOpen`): the lid flips back, the contents (`chestRoll`: gold 45, mod 25, exo 15, red 10, perk 3,
  green 2) spill (`titleSpill`, shared with kills) and are vacuumed into the bag. Pixel chest `drawChest` (leveldraw.js).
  Dev → Auto → "Auto: chests". Suite `auto-chests`.

## v1.0.16 — CaveRunner Auto: throwing currency, the machines pay out (branch `autobattler`, stage 10)
Released 2026-10-10 on the branch (owner: "I'll test it and work on it later. Keep going").
- In the hub, from a gold, red or green stack in the bag: a flick throws one, move-and-hold streams them, holding still
  lifts the whole stack as a lump (`auto/throw.js`). Machines take only their currency (gun/exo gold, mod red, perk
  green), within `autoThrowPull`; the rest bounces off and comes back to the bag. Dev → Auto → "Auto: throw".
- A ring round each machine's hologram fills with paid / price (`run.paid`, saved); paid in full the machine shakes and
  flashes and its item flies into the bag (`auto/payout.js` `machinePay`, `machineItem`: a gun by `shopGun`, an exo
  mod, a mod by `crystalRoll`, a perk); change carries over; a full bag leaves it on the floor. A gun flies as its sprite.
  The machines' prices get thousands commas again (a regex that had lost its backslashes). Suites `auto-throw`, `auto-payout`.

## v1.0.15 — CaveRunner Auto: gun swap arc, stats, scrap, dropping items (branch `autobattler`, stage 9)
Released 2026-10-10 on the branch (owner OK'd the shots, `tools/arcshots.js`).
- Hold a player's helmet (`autoHoldMs` 350) and his 4 guns fan out in an arc (`gunArc`, `arcPick`, `autoArcR`); slide
  to one and release to make it active (`setActive`); elsewhere cancels. A helmet tap now opens his menu on release.
- Stats: two running graphs in the nav row, red damage dealt and green health (`meterTail`), a tap cycles 5 / 15 / 30 s.
- Scrap: drop a bag item on the gold tile → gold (`scrapAt`), a coin burst and "+n". Owner: drop a bag item on the play
  area → it leaves the bag and lies there (`leaveItem`, `left`: never vacuumed back; lost when left behind).
  Suites `auto-stage9` (logic and browser).

## v1.0.14 — CaveRunner Auto: dragging, cards, colour groups (branch `autobattler`, stage 8b)
Released 2026-10-10 on the branch (owner OK'd after three rounds, `tools/dragshots.js`).
- Drag from the bag onto the nav's slots (mods into a gun, guns onto the gun circles, exo mods into their kind, perks)
  and back down to the bag (`fitMod`/`fitGun`/`fitExo`/`fitPerk`/`unfit*`, saved each move); a ghost follows the
  finger, the right slot glows green, a wrong drop slides back. Works while playing. A touch grabs only within
  `autoGrab` (0.35 of the tile) of the icon's centre, else the bag scrolls. A tap opens the item's card (exo mods
  their own). Dev → Auto → "Auto: bag". Suite `auto-drag`.
- Owner rounds: tiles edged by group (mods their family's colour, guns/exo/perks their machine's, gold and gems light
  grey) and the icons coloured the same (exo shaded teal; gold, gems, guns their own); the cards in the dark purple
  theme with the pixel icons (`cards.js` `CARD_ICON`), no pin/trash; icon padding × 1.5 everywhere.

## v1.0.13 — CaveRunner Auto: the context nav (branch `autobattler`, stage 8a)
Released 2026-10-10 on the branch (owner OK'd after four rounds, `tools/navshots.js`).
- The row above the bag (`auto/nav.js`, `NavRow`): players → a player's Guns / Exo suit / Perks / Stats → his 4
  guns → a gun's mod slots (scrolls sideways); Exo suit → its 4 kinds → 5 slots; Perks → 6 slots; Stats a placeholder
  (stage 9). B goes back one level. Works in the hub and in levels without pausing.
- Owner rounds: players are their own helmets (`helmetIcon`, the scene's pixel filter); themed pixel icons, not emoji
  (`ui/auto/icons.js` `PixIcon`: menu, exo kinds, the bag's exo mods); Guns/Exo/Perks and their rows in their
  machines' colours (a gun's mods: the mod machine's red), the player's menu in his colour; gun circles in the gun's
  colour; item glyphs (`GlyphIcon`) centred by their painted pixels, filling the tile inside a padding, pixelated, no
  glow. Suites `auto-nav`, `auto-screen`.

## v1.0.12 — CaveRunner Auto: LEVEL CLEARED (branch `autobattler`, stage 7)
Released 2026-10-10 on the branch (owner OK'd the frames, `tools/clearedshots.js`).
- A level phase `cleared` between the arena and the walk out: once the boss's loot is in (or `autoClearWait` s),
  LEVEL CLEARED in the title's lettering (`titleLetter`, shared with CAVE RUNNER) drops in letter by letter with
  bounces, sparks, flash rings and a thud each, a shine sweeps, it fades after `autoClearT` s, then the team walks to
  the exit pad. `art/cleared.js` `clearedText`, `levelClearedAge`, the screen's `over`. Suite `auto-cleared`.

## v1.0.11 — CaveRunner Auto: blocked zones (branch `autobattler`, stage 6b part 1)
Released 2026-10-10 on the branch (owner OK'd the sheet, `tools/blockshots.js` + `tools/blocksheet.js`).
- `auto/blocked.js`: ~`autoBlockN` (2) zones a level carry a blockage suiting their base zone, severity in a knob
  range (partial: jet over; full: clear it or "Path blocked"). 11 kinds: collapse, deadend, thicket (webs slow the team
  to a halt; burnt or cut), timberfall, rockslide, roots, silt, cart, brickwall, stalactites, nest; each tagged with what
  clears it (rock, web, timber) for `canClear`. Owner rounds: each rolls its own width (`autoBlockThin` to
  `autoBlockWide` of the zone) and place, its ends a sheer face or a long slope, leaning ragged faces; roots are single
  roots (own thickness, length, sway, forks); crystal growth became stalactites and stalagmites in the ground's rock.
  Dev → Auto → "Auto: blocks". Suite `auto-blocked` (`auto-loot`'s full-bag check made steady).

## v1.0.10 — CaveRunner Auto: drops (branch `autobattler`, stage 6 part 2)
Released 2026-10-10 on the branch (owner OK'd the screenshots, `tools/autolootshots.js`).
- `auto/loot.js` `killLoot`: gold from every kill; a gun mod at `autoLootMod` % (`rollMod` by tier); elites + red gems,
  sometimes an exo mod, gold × knob; the boss a green gem + an exo mod + gold × knob. Drops fly out, then to the nearest
  living player into the bag (`levelScene`'s 7th argument, `run`); a full bag leaves them waiting on the ground; left
  behind off-screen, lost. Red and green gems are the game's crystals at full size (owner: so they stand out). Dev →
  Auto → "Auto: loot". Suite `auto-loot`.

## v1.0.9 — CaveRunner Auto: enemies, elites, the boss, death (branch `autobattler`, stage 6 part 1)
Released 2026-10-10 on the branch (owner OK'd the screenshots, `tools/enemyshots.js`).
- Level creatures by the run's tier (`enemyFor(id, tier)`; `levelScene`'s 6th argument). Bites and spit hurt the run's
  players (× `autoFoeDmg`, `levelHurt`); at 0 hp a player flickers out until the hub; all fallen → the hub, healed, tier
  unchanged (`levelFailed`). Elites (`autoFoeElites`, 2) along the zones, the pilot slows for them. The boss in the
  arena: a random kind × size/health/damage knobs, its bar over the play area (`.abossbar`); `autoLvlBossT` (120 s)
  is only a fallback. `auto/enemies.js`, Dev → Auto → "Auto: enemies". Suite `auto-enemies`.

## v1.0.8 — CaveRunner Auto: the clearing rule (branch `autobattler`, stage 5b)
Released 2026-10-10 on the branch (owner OK'd the screenshots, `tools/clearshots.js`).
- In levels the magic saw is gone: at rock a player switches to its best clearing gun (`auto/clear.js` `canClear`,
  `bestClearer`, `teamClearer`: scored from the real MODS — bore, eat, blasts; fire for webs and timber), fires it
  at the rock, then switches back; with none of its own it borrows a teammate's. No gun in play can → the team slows
  to a stop (`pilotPace({ blocked })`) and "Path blocked" pulses (`.ablocked`). Starter guns can't dig (the Buzzsaw
  is in the bag; dragging it in is stage 8). Knobs `autoClearMin/Fire/Gap`. Suite `auto-clear`.

## v1.0.7 — CaveRunner Auto: real guns in levels (branch `autobattler`, stage 5a)
Released 2026-10-10 on the branch (owner OK'd the gun sheet, `tools/gunshots.js`).
- In a level each player fires its active gun through the real `planCast` (`art/scenegun.js`: mana, recharge, the
  shot's look, speed, size, gravity, drag, bounce, pierce, explode, fire, homing, triggers…), real damage against the
  creatures' `enemyFor` health. 25 mods not carried yet: `GUN_TODO` (`src/auto/README.md`). The menu is unchanged.
- `starterKit(rnd)`: every new player gets a 3-slot no-shuffle gun with a random tier-1 shot, and a Buzzsaw in the bag.
  Dev → Auto → "Auto: guns". `auto/meters.js`: per-player damage and health, 30 s rings. Suite `auto-guns`.

## v1.0.6 — CaveRunner Auto: hub ⇄ level (branch `autobattler`, stage 4b)
Released 2026-10-10 on the branch (owner OK'd the screenshots).
- A on the hub's exit pad: everyone goes in the flash (`hubExit`), and when it fades (`hubLeft`, `HUB_LEAVE`) the run's
  level loads (`levelSeed(run)`: the same run and tier, the same level), the team healed (`healRun`). The level's exit
  pad (`levelDone`) brings it home: tier + 1, healed, saved (`levelCleared`). `newRun(seed?)` carries a seed;
  `runScene` takes `next(S)` (true: make a new scene). Suites: `auto-run`, `auto-hub`, browser `auto-screen`.

## v1.0.5 — CaveRunner Auto: the pill stick and the level strip (branch `autobattler`, stage 4a + owner's change)
Released 2026-10-10 on the branch (owner OK'd the screenshots).
- The bottom `<` `>` pair is one pill stick (as tall and round as B and A) that works like the old left
  thumbstick: in the hub player 1 runs and jets freely (`hubStick`), the others follow on the floor; on the exit pad
  "Tap A to exit". In a level the stick sets the pace: right hurries (× `autoLvlHurry`), left slows (× `autoLvlSlow`),
  never stops. Replaces stage 3b's stop-to-stop arrows (`hubGo`/`hubStandX` gone). Dev → Auto → "Auto: hub" knobs.
- Stage 4a (headless until 4b): the finite level strip (`auto/level.js`: start pad, random zones, boss arena,
  exit pad) and the pace pilot (`auto/pilot.js`: eases for elites and chests). Dev → Auto → "Auto: level".

## v1.0.4 — CaveRunner Auto: walking the hub, the exit prompt, prices (branch `autobattler`, stage 3b)
Released 2026-10-09 on the branch (owner OK'd the screenshots).
- `<` / `>` walk the team to the next stop (`hubGo`), easing in just left of a machine (right, coming back), taps
  queue; the others line up behind. On the pads the leader stands on the pad. At the exit pad "Tap A to exit"
  shows; A flashes the pad (`hubExit`; stage 4 starts the level). Each machine shows its price (`hubPrice`): gun
  and exo gold by tier, mod 1 red, perk 1 green. Dev → Auto → "Auto: hub" (walk speed, ease-in, stop offset, spacing).

## v1.0.3 — CaveRunner Auto: the hub room (branch `autobattler`, stage 3a)
Released 2026-10-09 on the branch (owner OK'd the screenshots).
- ▶ opens on the hub: a dark steel shop room (`auto/hub.js`, `titleScene(…, { hub })`, painter
  `game/render/hubdraw.js`); the left pad charges, the player comes through in a flash, and the tubes stutter on.
  Stops left → right: enter pad, gun (gold), exo (teal, new), mod (red), perk (green), exit pad (`HUB_STOPS`).
- The Jetpack exo's icon is a rocket (`EXO_GLYPH`), in the bag and on the exo machine. Suite `auto-hub`.
- Owner: leave the empty space above the room as is (they have plans for it).

## v1.0.2 — CaveRunner Auto: the four-section screen (branch `autobattler`, stage 2)
Released 2026-10-09 on the branch (owner OK'd the screenshots).
- ▶ on the title opens the auto screen (`ui/auto/AutoScreen.js`): the menu scene with the run's players (pinch,
  pan, tap to follow, ⏸ pause), the player row, the 70-slot bag (scrolls), B / < / > / A. The title keeps ▶ and ⚙
  only (one save). The scene loop and gestures are shared (`ui/scenecanvas.js` `runScene`); `titleScene` takes
  `{ runners }`. Suites: browser `auto-screen` (new), `title` (slot picker and old pause checks retired).

## v1.0.1 — CaveRunner Auto: the run model (branch `autobattler`, stage 1)
Released 2026-10-09 on the branch (no looks; nothing on screen yet).
- `src/auto/run.js` (pure): the run (tier, up to 4 players, a 70-slot bag), every bag and slot move, exo mods
  that add up, scrap, prices; `src/auto/save.js`: one save (`loadAutoRun`/`saveAutoRun`). Dev tab **Auto**
  (economy knobs). Suite `auto-run`.

## v1.0.0 — CaveRunner Auto: its own address and app (branch `autobattler`)
Released 2026-10-09 on the branch (stage 0 of AUTOBATTLER.md; plumbing, no game change yet).
- The branch counts its own versions from v1.0.0 (update number 1000000); `main` stays v0.0.x.
- CI runs on pushes to `main` and `autobattler` and deploys both builds to Pages every time (main at the root,
  the branch at `/auto/`). A push to the branch builds a second APK, **CaveRunner Auto** (`com.caverunner.auto`,
  `-PcaveAuto=true`, release `app-auto`) that updates from `/auto/`. The workflow file is on both branches.

## v0.0.176 — the title's gold pickup at 10%
Released 2026-10-09 (owner's ask; a minor update).
- The title animation's gold pickup sound plays at 10% of its volume (`SFX.ui(what, vol)` takes a volume now; the game's
  gold is unchanged). Test: `sound`.

## v0.0.175 — the pause menu's three volumes
Released 2026-10-09 (owner's ask; a minor update).
- The pause menu's single Volume slider is now the title's three: Master, FX, Music (`ui/volume.js` `Volumes`, shared by
  the title's Settings and `PauseMenu`). Test: `title` (+ the pause menu has the three). Screenshot: `tools/settingsshots.js`.

## v0.0.174 — the title: sound, music, ▶ / ⚙ buttons and settings
Released 2026-10-09 (owner OK'd; a minor update).
- **Sound for everything on the title** (owner: match the game): the scene queues sounds (`S.snd`, `snd()` in
  art/titlescene.js) and `ui/titlesound.js` plays them with the game's own: casts by the gun's spell voice (the saw while
  digging), hits, rock, bounces, blasts, debris, lightning arcs, chain hops, creature alert / idle / hurt / die / bite / spit /
  silk, lash, fizzle, whoosh as things catch, the fire loop, lantern glass, gold pickups and nugget landings, steps, landings,
  gun swaps, a jetpack loop per player, vine and web rustles (`rustleStep`), drips, the Mossy caves ambience. Heard from the
  camera's middle (the title at half the game's scale, nearer when zoomed). Follow / let go and the menu buttons click too.
- **The menu** (owner): a square bold ▶ (right) for Start / Continue and a matching ⚙ (left, `.tbig`, drawn icons). ⚙ turns
  the window into **Settings**: Master, FX and Music sliders (`SFX.setFxVolume`: the sfx and ambience buses;
  `SFX.setMusicVolume`: a new music bus; kept in localStorage `caverunner-vol-fx` / `-music`), × back.
- **Title music** (owner's brief: dark synthwave, pumping bass, 80s kick, 4 chords, building to a harmonised guitar solo):
  `audio/song.js` (the song as data: A minor, Am F Dm E, 100 bpm, 40 bars, looping from bar 8; `songStep`, the solo in note
  text, `harmonyOf`) played by `audio/music.js` (`makeMusic`: kick, snare, hats, riser, pumping bass, detuned pads, arps, and a
  guitar made of a modelled plucked string through an amp and cabinet; notes ring on and fade under the next, `REL`; reverb and
  echo made in code; `Music` start/stop live on the music bus). Three rounds with the owner (guitar more real, up an octave,
  notes blended). `node tools/musicwav.js` renders it to .wav/.m4a.
- Tests: `song` (new), `title` (+ sounds play without errors, the track plays, the buttons, the settings). `tools/settingsshots.js`.

## v0.0.173 — the title: the jellyfish glow's twinkle moves with the cave
Released 2026-10-08 (owner's report; a minor update).
- `titlePlantGlow` handed `plantGlowFill` screen coordinates, so its twinkle (a pattern by position) stood still on the
  screen while the cave scrolled under it. Now world coordinates (drawn at the screen's place as before).

## v0.0.172 — the title: a sixth zone, the winding caves
Released 2026-10-08 (owner OK'd; a minor update).
- `winding` in `TITLE_ZONES` (owner: the natural caves that aren't big and open): rock, a narrow tunnel snaking up and down
  through it (`windMid`, its half height `windHalf` 15–26: the zone's roof and floor, blended into its neighbours by
  `zoneMix`), now and then a side branch above or below and pockets of air in the rock round it (`windAir`, fading in from the
  zone's ends). Home to jellyfish, spiders and rats (`TITLE_HOME.winding`); natural-cave plants, drips and spores.
- Tests: slots (+ a narrow tunnel that snakes, air off it); three seed-bound tests now pick a seed with what they need (the
  zone order changed with a sixth kind). Screenshots `node tools/windshots.js`.

## v0.0.171 — the title: the game's dark and lights; no outline on the pixel look, shots in it too; jetpacks against gravity, bursts, varied pace
Released 2026-10-08 (owner OK'd; a minor update).
- **The dark** (owner): `titleDark` (titledraw): the cave at the game's `DEV.fogDim`, cut by lights that only reach as far as they
  can see (`visPoly` from world/vision.js on the title's cells, `titleSolidCell`: the rock throws shadows): each player's gun
  light at the game's sizes (cone `DEV.beamDeg` wide out to the old torch's reach × `DEV.beamReach`, soft sides; the round glow
  `DEV.beamNear`), lanterns (`TITLE_LAMPR` 60, warm pools with shadows), fire (sampled cells), burning creatures and plants,
  jellyfish. A small layer at the terrain's grid (lights unioned, source-over, cut out of the dark, blurred 1.5 px), smoothed up;
  the glows and shots over it. Owner's round 1: light reaches `TITLE_EDGE` (6) into the rock it falls on and the edge is blurred
  (the dark fades in from the edge); fire lights small pools at up to 80 of its cells (the big summed pools made one disc); the
  visible beam, the game's `drawBeam` (`titleBeam`: three soft cones from the muzzle, the lens, the spill). Round 2: the beam at
  `TITLE_BEAMA` (0.25) of the game's (four added up to white), fading in from the muzzle (against a wall, where a player sees
  only a sliver, its bright start filled that as a square), no lens when the muzzle is in rock.
- No dark outline on the players and creatures (titledraw: `pixelHeld` / `pixelSprite` line off).
- Shots and lightning in the pixel look: one layer on the world's grid, drawn 'lighter' as before; the Buzzsaw's blade
  its own, pinned to it.
- `pixelSprite` (art/sprites.js) now saves and restores its shared layer's state round each paint (the shots' 'lighter'
  leaked into the players' next paint: white blobs). Affects the game's pixel look too (no change there but safety).
- **Flying** (titlescene `flyStep`): gravity always pulls (`GRAV`), the jetpack pushes up (`JET` = 2.4 × gravity);
  jet off, they fall at gravity. Each player's `bursty` (0.75, 0.15, 0.5, 0.3) is the chance a flight is in full-blast
  bursts (0.1–0.35 s, gaps 0.05–0.35: bobbing; a burst stops short of the roof), else a steady throttle toward where
  it's going. Landing: jet off, a braking burst if dropping fast near the floor. A fast fall lands on the floor instead of sawing.
- **Running**: each player's `pace` (0.75–1.25 × speed); now and then walking (dropping back as the world passes faster)
  or sprinting (1.6–2 ×), `spd`.
- Measured (seed 7, 60 s): sawing went from ~75 to ~120 starts a minute (4 players), mostly running in their own tunnels.
- Tests: slots (+ falls at gravity, bursts bob, walk/sprint, pace per player). Screenshots `node tools/pixelshots.js` (c-burst).

## v0.0.170 — the title: rats no longer sink into the rock; every mine works its own layout; jellyfish glow on the vines; the pixel look on everything
Released 2026-10-08 (owner OK'd; a minor update).
- **Rats in the rock** (owner): a swarm comes in at the screen's edge and spreads up to ~110 to the right, but the terrain
  was made only 40 past the edge; rats past it stood in "rock" (the brains see unmade columns as rock) and sank. Now
  made `AHEAD` (130) past it, and a swarm stops where the terrain isn't made. Measured: on-screen rats in rock 0 (was ~50%).
- **Mine works** (owner: the layout was always the same): `mkMine` on each timber zone (`TZone.mine`, `TMine`): 1–3 tunnels
  (`mineBands`), come in at any of them and leave by any (the slope in and out goes to that tunnel, up or down: `mineNear`),
  the others walled off at that end some way in, a hole through the shelf at each step of the way through (`steps`, in
  order) and now and then another; frames and lanterns in every tunnel, staggered. The old closed upper band is gone (one
  of the layouts covers it). Hewn, not cut (owner's round 1): each tunnel's roof dug 2–14 past its frames' caps (`dig`,
  leaving 4 of the shelf), its floor down 0–4, its walled ends crooked (±12), the holes ragged. A mine's slope now starts from a brick works' level floor next to it (it ignored it: a step).
- **Jellyfish plant glow** (owner): the game's green glow on the vines and moss round each jellyfish, its reach × `TITLE_PLANTR`
  (0.25: the owner's round 1, the game's lit the whole screen) (`titlePlantGlow`:
  the terrain's own pixels + the plants at its grid, through `plantGlowFill`, white point `plantWhite` of the terrain).
- **Pixel look** (owner): plants, decorations, web lines, silk and gold drawn into one `pixelSprite` layer (1 unit a pixel,
  no outline, its grid pinned to the world: `worldLayer`); each creature its own `pixelSprite` (outlined, grid pinned to it,
  as the players'). Silk is drawn solid grey (the layer is solid or clear).
- Tests: slots (rats never in rock on screen; mine variety; a hole at every step). Screenshots `node tools/mineshots.js`,
  `node tools/pixelshots.js`. Not timed on a phone (the pixel layer reads back ~170k pixels a frame).

## v0.0.169 — the title's players: the pixel grid rides with them
Released 2026-10-08 (owner's bug report; a minor update).
- `drawTitleRunner` (game/render/titledraw.js) rounded the player's position for the pixel grid while drawing the body
  at the exact one, so the grid slid over the body and gun as they moved. Now pinned to the exact position, as the
  game's `drawPlayer` does (jet flame too).

## v0.0.168 — the title: random zones each visit; pinch zoom, pan, tap a player to follow
Released 2026-10-08 (owner OK'd; a minor update).
- **Zones** (art/titlescene.js `titlePlan`, `S.zp`): made from the scene's seed as it scrolls, each zone a random kind
  (none of the last two again), its own length (`TITLE_ZLEN` 200–360), its own roof and floor (height, hilliness,
  stretch, phase; blended over `ZMIX` 40 at the borders, no steps) and plant/web density. `titleZone`, `titleZoneAt`,
  `titleCeil`, `titleFloor` take the scene (its plan); `titleZoneSpan` gives the zone record. The title picks a
  random seed each visit (tests: 7, or `window.__TITLE_SEED`).
- **Camera** (`titleCam`, `camClamp`, `camAt`, `camStep`, `camTap`; gestures in ui/title.js; `titleDraw`'s `cam`):
  two fingers pinch (1×–`TITLE_ZMAX` 4×), one drags, a tap on a player follows them (zooming in to `TITLE_ZLOCK` 2×),
  a tap on them again lets go (the zoom stays: pinch out). It zooms about the action band's middle and never shows
  past the zoom-1 view (the screen's top down to the menu). Dragging does nothing while following.
- Tests: slots (+ random zones, no steps at borders, the camera), browser title (real touches: pinch, drag, tap);
  screenshots `node tools/titlecamshots.js`.

## v0.0.167 — the title's players collide and keep a little apart
Released 2026-10-08 (owner OK'd; a minor update).
- `separate` (after every player's step): within `TITLE_SEP` (24, height counted at 0.6) they're eased apart (sideways
  on the ground, any way in the air), and two bodies that overlap are pushed out along the shallower way (sideways
  for one on the ground), half each, or all on the one with room; never into rock. Replaces the old sideways nudge.
- Suite `slots` (55): no overlaps, seldom tight together.

## v0.0.166 — title players saw through rock (no teleports), each on its own clock; burning creatures and vines in the fire's crackle (title and game)
Released 2026-10-08 (the owner asked to see it in the app; a minor update).
- **Title movement** (`stepRunnerMove`: `runStep`, `flyStep`, `digStep`): running and flying each last a random
  while per player (`runTime`, `flyTime`; switches in `r.switches`); the mine works no longer force a landing, and
  the safety net that popped a player up through rock (a teleport) is gone. **Rock in the way** (a wall ahead past a
  step, a low roof, ground he's aiming into, rock the scroll brings to him) **brings out the Buzzsaw** (`startDig`:
  the `saw` shot on `TITLE_SAW`'s skin, the gun kept in `r.keep`), cutting a `TITLE_DIGR` tunnel (no charred rim,
  `titleCarve(…, false)`) at up to `DIGV` until he's been clear a moment; the blade drawn spinning at the barrel (the
  game's `disc` look); it cuts creatures it reaches. Flying targets (`pickTarget`) are now and then under the floor
  or up in the roof, so they saw tunnels. Floor bumps under a flying player lift him; landing is when his feet reach
  the floor. Counted in `S.digs`, `S.digT`, `S.digWhy`. Tests can hold the players still (`S.still`).
- **Burning creatures in the fire's crackle** (`art/crackle.js` `crackleBody`: about half the burning-pixel squares over
  the body, tongues above, a new flicker each fire tick): the title and the game (`render/actors.js`). On the title
  burning hurts in chunks as in the game, so they flash now and then instead of staying white.
- **Burning vines in the crackle in the game too** (`render/cave.js`, `crackleAt`): a hanging vine's burning tip,
  an arch's two fronts. The title's vines and silk use the same `crackleAt`.
- A rat swarm stops at its zone's end. Suite `slots` (53); pictures `tools/digshots.js`.

## v0.0.165 — the title: four players, twice the creatures, random guns with modifiers, a natural mine slope, slower fire, cut vines and webs hang and swing
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Four players** (`TITLE_RUNNERS`, `S.runners`; `S.runner` is player 1): each on its own clock, easing apart when
  side by side, each its colour (`TITLE_COLS`: blue, red, green, yellow) on the backpack and a stripe over the helmet
  (`paintBody`/`drawRunner`'s new `tint`). Creatures go after their nearest player (rats: a nav field each), gold
  flies to the nearest, any player stops spit and silk.
- **Twice the creatures** (`TITLE_FOES` 24, spawning twice as often, 6 to start).
- **Random guns** (`titleKit`): a random skin from all of `GUN_ART`, one of 23 shots (`TITLE_SHOTS`) and 0–2 of 18
  modifiers (`TITLE_MODS`) worked on it by their own `f` (double / triple: that many at once). Title shots now home,
  accelerate, and chain bolts leap creature to creature; lightning with more shots arcs to more creatures.
  `TITLE_KITS` is gone.
- **The mine works' roof** comes down over a long S-curve (`TIMBER_RAMP` 120, `timberD`) with lumpy rock, not a short
  straight step.
- **Fire at a tenth** (`TITLE_FIRESPEED` 0.1): cell-to-cell spread, plants catching beside fire, burning along vines
  and silk; jumps `TITLE_JUMPP` 0.05 (was 0.5). Burning vines and silk drawn with the burning cells' crackle (the
  fire colours in the terrain grid, a new flicker each tick).
- **Cut lines hang** (owner): an arch or web line that catches (or is blasted) is cut there; each side becomes a rope
  of `TITLE_LINKS` links (`hangPiece`, the game's `tailStep`) swinging down from its end and burning up from the cut;
  an end that doesn't hold (no rock above or beside) falls, as does anything whose rock is blasted away (`p.drop`);
  a long piece gathers up off the ground. An arch's strands drop when it's cut.
- **Players push the vines** as in the game (`stepSway`): hanging vines swing (`vinePush`, `swingStep`), arches
  and web lines give (`bendPush`/`bendStep`); strands ride their arch's bend (`on`). `titleWebAt` is `webAt`.
- Suite `slots` reworked (51 checks); pictures `tools/playershots.js`.

## v0.0.164 — the gun in hand in the body's pixel look; creatures over the shop's machines; title fire jumps, the runner waits
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **The gun in his hand goes through the body's pixel look** (`pixelHeld`, `art/sprites.js`: body then gun as one
  `pixelSprite`, the box grown `HOLD_PAD` for the longest gun): the game (`DEV.runnerPx`/`runnerLine`), the Bag's
  firing window, the title (1 unit, outlined). Ground and icon guns are drawn as they are.
- **Creatures (and shots, beams, silk) drawn over the shop's things**: `drawArrival`, `drawShop`, `drawVend`,
  `drawShops`, `drawDemo` moved before `drawSilk`/`drawEnemies` in `draw` (none of them touch `Math.random`).
- **Title fire jumps** (`spreadFrom`): a burning vine's tip, an arch's or a web line's fronts light any vine, arch or
  web within `TITLE_JUMP` (5) at `TITLE_JUMPP` (0.5) a fire tick. **Web lines burn along** (`catchWeb`, `L.fu` the
  burnt span, `TITLE_WEBFIRE` × `fireArch`), drawn as the silk left with glowing fronts; heat (`titleIgnite`) lights
  them, a blast's own hole still cuts them.
- **The title runner fires only within `TITLE_AIM`** (90 units) at creatures well on screen (`TITLE_VW − 24`):
  they come into view first.
- `tools/heldshots.js`: the screenshots. `slots` logic suite: fire jumps, the aim range.

## v0.0.163 — gun sprites at one scale, the gun in hand twice as big, the squirts turned; the title's fire, runner and lanterns
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **The two squirts** (Green, Pink) turned a quarter clockwise then mirrored (a transpose of their pixels and hand
  point); `tools/gunart-extract.js` makes the same (TURN 13/16: 3, no MIRROR) if it's re-run.
- **One pixel size for every gun sprite** wherever it shows: icons (`gunArtFit`: HUD slots, the Bag's gun row,
  the gun machine, dragging) and the 🖼️ gallery use the scale that fits the biggest sprite (`GUN_ART_MAXW/MAXH`), so a
  pistol is small and a sniper long. In the world they were already one scale (`GUN_ART_PX`).
- **The gun in his hand twice as big** (`GUN_HELD` = 1.1, was 0.55): the game, the Bag's firing window, the title.
  `gunMuzzle` finds each sprite's barrel tip: the gun light's beam, the Bag window's shots and the title's shots
  leave from it.
- **Title**: a safety net pops the runner back onto the floor if his middle ends up in rock or he's well under the
  floor line (the owner saw him stuck shooting from inside it). The fire is drawn as the game draws it: burning cells
  in `FIRE_COLS` (a flicker each tick, embers when nearly spent), the warm wash and glows, `flameAt` specks
  (2.5 a second a burning cell, ≤ 20 a frame) and `fireSmoke` puffs; the old white blobs went.
- **Title lanterns**: each chain hangs from what's really above it, the roof's underside or a frame's cap (`lamp`,
  `HOLDS`), no gap. As in the game (game/systems/props.js): a shot or a blast pops one (`popLamp`: a white spray,
  16 blobs of burning oil that light the fuel they pass through and where they land, the spot itself catches); its
  hold blasted or burnt away, it falls and pops where it lands.

## v0.0.162 — the title's creatures, gold and fire are the game's own
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Real creatures**: made by `enemyFor` (floor 1's kinds) in world coordinates and moved by their real brains
  (`jellyStep`, `spiderStep`, `ratStep`, `roamStep`, the rats' `navField`/`navWay` paths), with the game's aggro
  (reach × zoom × `DEV.aggro` × their own roll, on a sightline, kept until `loseAggro`), jellyfish spit, spider
  strings and lines they spin, rat bites (he isn't hurt), burning. Drawn by the game's `drawEnemy`. Rats have no
  nests here, so they don't steal gold. The title's own spider walk and silk drop went (the real spiders spin lines).
- **Real gold**: `spillGold` (25 / 5 / 1 nuggets), `stepNugget` (fall, bounce, roll), `collideNuggets`; pulled to
  him only within `COIN_PULL`, collected at 12, by the game's formula.
- **Real fire**: the title's fire runs `fireStep`'s rule (FIRE_TICK steps, `fireSpread`, `FIRE_UPW`, `FIRE_CATCH`,
  each fuel's burn time); vines and mycelium only (`FLAMMABLE`) burn from the tip at `firePlant`, arches outward at
  `fireArch` lighting their strands. Before, the title faded a whole plant at once (the game was never broken).
- Found: the owner's v0.0.161 Dev report set `fireSpreadHi` 0.2 → 1, so fire in the game spreads ~3× faster
  (moss: 83 px in 5 s against 27). The owner chose to put it back: `fireSpreadHi` 0.2 again.
- Fix (owner spotted it): the title's vine arches drew as straight lines. A title prop kept its world x in `wx`, which
  art/props.js reads as an arch's sideways bend (over 1,000 units off); it's `ox` now. Also the arches' clearance no
  longer flattens them, and their spans are the `arSpan` knob × 0.6 for the narrow screen.

## v0.0.161 — a new title scene (a tour of the real Mossy Caves); every gun wears pixel art; the owner's Dev defaults
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- **Title scene** (built by a time-boxed agent): one runner who runs along the floor (steps up ledges, drops into
  holes) and jetpacks over walls and gaps; the floor raised ~20 units. It scrolls through Mossy Caves' zones in turn
  (natural moss, timber works, paved brick works with chains, a grove), the theme's colours and the game's plant
  painters. The terrain is a carveable grid (2-unit cells): blasts blow holes, digging shots nick pits, fire shots
  and blasts light moss / timber / plants, which spread and burn out (`TITLE_FIRE` cap). He swaps gun every 3.5–6 s:
  7 real shots (`bolt`, `buck`, `fball`, `zap`, `flamer`, `blast`, `slug`) each with a gun sprite, drawn with the
  game's `drawLook` / `drawBolt`. Only floor 1's creatures: jellyfish, spiders (floor and roof), rat swarms (3–6,
  no nests). Kills drop gold that flies to him and is vacuumed up. The pure step stays in `art/titlescene.js`; the
  drawing moved to `game/render/titledraw.js` (it needs `drawLook`). `slots` suite covers it.
- **Title, owner's feedback rounds 2–3** ("a sideways tour of our actual Mossy Caves level"; the real floor surveyed
  first): zone borders fray by noise instead of a cut; zones are natural moss → the spiders' web caves → the built-up
  layers (low roof, stacked bands, strata.js's timber frames, hanging lanterns) → brick works (lanterns on long chains)
  → the grove (the level's vine arches from `ARCH_KNOBS`, strands). Painted by the level's rules (rock mottle, moss on
  upward faces, grass tufts, rubble, brick ledges, dark blotchy back wall), drips and spores. Creatures only in their
  home zones (`TITLE_HOME`: jellyfish natural only, rats in the works, spiders in the web caves and the layers);
  spiders walk web lines and rock, blasts and fire cut lines, and drop down on silk threads (hang, climb back);
  jellyfish tentacles from the jellyfish knobs.
- **The owner's Dev report (v0.0.159) as the new defaults**: zoom 1.7, torch 0.7, darker outside the torch, quieter
  jetpack and drips, a bigger hologram glow, floor 1 due in a day, 50 enemies +20 a floor, no player outline, the
  menu pointer and snap, 2500 kbit/s video, more web sag, 4–8 built-up nests, bigger caverns, tougher/bigger elites
  in yellow, a dark-violet elite flame, fire spreads faster, the carrot perk's ranges. Tests that measured the old
  numbers are pinned to them (`rats`, `dark`, `furnish`, `tomb`) or updated (`brood`, `deadline`, `ramps`,
  `perkstats`; `creatures` now checks each elite at its own roll).
- **Every gun wears a pixel-art sprite**: the old drawn gun is gone. A gun without a pick gets the `GUN_ART` sprite
  nearest its colour (`gunArtId`, `artForHue`, `artHue` in `art/gunart.js`), so it matches its HUD slot. `drawGun`
  takes the art id (no accent). The 🖼️ gallery's Default tile is gone; the gun machine's hologram is a sprite.
- Fix: on phones under 400 px wide the red debt line is smaller so it clears the ⚙️ (moved left in v0.0.160; `topgold`).

## v0.0.160 — dev mode: hold ⏸ 5 s to show the dev tools; ⏸ and ⚙️ swap places
Released 2026-10-08 (owner OK'd the screenshots; a minor update).
- ⏸ is now in the top-right corner, the ⚙️ left of it. ⏸ opens the menu on release; **held 5 s** it toggles dev
  mode instead (`ui/devmode.js`, `caverunner-devshow`; off by default, on for the browser test page).
- Dev mode off hides: the ⚙️, the mod/perk cards' 📌 / 🗑️ / Give Feedback, and the Bag's 💾 save-as-preset.
- `title` suite: ⏸ is pressed down + up now; holding it hides and brings back the ⚙️.

## v0.0.159 — the owner's LIST4: title screen + save slots, pause menu, gun looks, gun presets, coloured gun slots
Released 2026-10-08 (the owner OK'd the screenshots; a minor update). Built by three time-boxed agents on `list4`
(`LIST4.md` has each item's files and decisions).
- **Title screen** (`ui/title.js` `Root`, scene `art/titlescene.js`): shows on every load, the game mounts only after
  Start. A bobbing pixel CAVE RUNNER with a shine sweep over a scrolling cave of jetpackers blasting creatures; a
  menu of **3 save slots** (Floor · gold · guns, or Empty; 🗑️ then "Delete?") and Continue / Start. Per slot: the
  run save and both unlock collections (`slotKey`: slot 1 = the old keys, so the old run is slot 1; slots 2/3 add
  `-2`/`-3`; active slot `caverunner-slot`). Shared: Dev settings, audit, replays, presets. The test page skips it
  (`window.__TEST_TITLE` shows it).
- **Pause menu** (`ui/pause.js`, ⏸ beside ⚙️): Resume, Save (now), Volume (whole game: `SFX.setVolume`, kept in
  `caverunner-volume`), Exit to main menu (saves, reloads onto the title).
- **Bag header** (`BagHead`, `ui/editor.js`): the gun's name in its colour with ✏️ rename (keeps its hue), 🖼️ gun
  look, 💾 save as a named preset (`save/presets.js`, `caverunner-gunpresets`); the page title and gold are gone.
  **Dev → Spawn gun** lists the presets (tap = spawn that gun, `input.current.spawnPreset`; 🗑️ then Delete).
- **27 pixel-art gun looks** from the owner's picture (`art/gunart.js` `GUN_ART`, re-extract with
  `tools/gunart-extract.js`); the gallery `ui/gunart.js` `GunArtPicker`; `gun.art` drawn by `drawGun(…, art)`
  everywhere a gun shows (hand, ground, HUD slots, Bag, firing window), one pixel size `GUN_ART_PX`.
- **HUD gun slots** ringed and tinted in their gun's colour; the held one thicker with a glow (was amber).
- Suites: logic `presets gunart slots`, browser `presets gunart title`.

## v0.0.158 — the machine hints fit their words, centred over their machine
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: both level machines' hint boxes are as wide as their content plus padding (`width:max-content`) and sit
  centred above their machine (`input.current.promptLeft`, the machine's middle on screen, from `pickups.js`;
  `translateX(-50%)`). `vend` checks the centring.

## v0.0.157 — the buy machine: flick to pick a level, no menu
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: the buy machine's full-screen floor menu is gone (`ui/levelshop.js` deleted). At the machine the hint shows
  two options: **Select Level** (the R icon with thin up/down arrowheads, `PickKey` in `ui/hud.js`) and **Tap R to
  Buy**. A right-stick flick up/down picks the floor (`input.current.lvlStep` from `Stick`, `pickStep` in
  `game/systems/vend.js`, `W.pick`; `input.current.lvlPick`); you still aim and fire. Both
  machines' screens show the pick (`pickedFloor`). You can pick up to one floor past what's for sale
  (`pickTop`/`stepPick`, `data/levels.js`): that one is grey (`HOLO_GREY`, "*sell lvl N first"), "Tap R to Buy" dims,
  and a tap says "Sell level N first". The pick resets after a buy or a sale.
- The hint's look (owner's round): background at 25%, outline and words the machine's green (R icons stay
  white), less padding, the whole box at 0.6×. It shows only after 1.5 s with no stick input (or move key) (`PICK_IDLE`,
  `W.stickT`, `prompt.idle`), fading up quickly; any input hides it at once (`.pickhide`). The machine works the
  same with it hidden.
- The sell machine's hint in the same style (one option, `prompt.sell`; red outline and words while it
  refuses, `.red`), with the same 1.5 s wait.
- The thumbstick knobs carry a small L and R in their centres (`.klet`, the hint's R size: 8.4px).
- Tests: `levelpick` (new, logic); `vend` (real stick flicks, grey, limits) and `repo` updated.

## v0.0.156 — circle fields: sparkles instead of a filled disc
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- Owner: many area fields on one spot stacked into a solid blob. The circle fields (Stillness, Shielding, Vigour,
  Thundercloud, Glittering Field) lose their filled disc: sparkles (white and the field's colour) rise and fade
  inside (`drawFieldMotes`, `game/render/looks.js`, no state: seeded by the field's spot), and Vigour adds green
  plus signs. The dashed ring and Shielding's turning arcs are thin (0.5) at 10% opacity. The crystals keep theirs.
  Suite `fieldlook` (six Vigours stacked in a sandbox stay see-through).

## v0.0.155 — Follow Me split, Follow Me as a pull, buffs and nerfs; you in the firing window
Released 2026-10-07 (the owner OK'd the screenshots; a minor update).
- **Follow Me** brings shots *and* fields to you; the new **Follow This** (`followaim`, ↬) holds a field just ahead
  of your gun. The Gravity Gun uses Follow This now (`cleanGun` switches an old save's). On a shot either is a
  **pull**, not a turn (owner: no turning circle): `FOLLOW_PULL` × its strength toward the spot, so it slows, stops
  and comes straight back, never faster than it left (`spells/paths.js`; the aim line follows).
- **Buffs and nerfs** (`buff15` `buff2` `buff5` `nerf75` `nerf50` `nerf20`): every number of the NEXT mod drawn ×
  1.5 / 2 / 5 or × 0.75 / 0.5 / 0.2 — a shot's stats with its mana and delay, a modifier's effect, another buff's ×
  (they multiply); whole-number stats round (`boosted`, `spells/cast.js`). Suite `buffs`.
- **The firing window**: you at the far left drawn exactly as in the game (pixel look, outline, gun at 0.55 and the
  game's gun height), holding the gun on the sway; Follow Me shots come back to you (pulled `GF_FOLLOW_K` × harder
  to fit the window); shots fly their real flight time, slowed.

## v0.0.154 — a running DPS graph in the firing window
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). A thin red line across the top third of the
Bag's firing window, over everything: the dummy's DPS over the last `GF_GRAPH_S` (5) s, a sample every
`GF_GRAPH_DT` (0.1 s), newest at the right, scaled to its peak; gone once nothing has hit for 5 s
(`ui/editor.js` `GunFire`; suite `gunfire`).

## v0.0.153 — DPS over the firing window's dummy
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). A red "N dps" over the hologram dummy's head
in the Bag's firing window: the damage of shots that hit it over the last `GF_DPS_S` (3) s, hidden at 0
(`ui/editor.js` `GunFire`; suite `gunfire`). Blasts near it without a direct hit aren't counted.

## v0.0.152 — the firing window: sway, room, a hologram dummy
Released 2026-10-07 (the owner OK'd the screenshots; a minor update). In the Bag's firing window (`ui/editor.js`
`GunFire`): zoomed out (`GF_ZOOM` 2.2, was 3); the gun sways from aiming near the wall's top to near its bottom every
4 s (`GF_SWAY`, `GF_SWAY_S`), so bounces show; a dummy you at 2/3 size in front of the wall (`GF_DUMMY_K`,
`GF_DUMMY_GAP`), a hologram like the guide (`holoPass`), that takes hits (pierce passes on, hit triggers go off) and
glitches with the guide's tear when hurt, never dying; homing shots steer for it. Suite `gunfire` checks hits.

## v0.0.151 — a wall in the Bag's firing window
Released 2026-10-07 (the owner OK'd the screenshot; a minor update). The firing window has an unbreakable stone wall
at the far right (`GF_WALL`, `ui/editor.js` `GunFire`): shots stop on it or bounce, blasts flash, beams end on
it, and a trigger's payload goes off on its own moment (hit: the wall; timer: in flight; expire: any death) and
flies back out, so you can see what trigger builds do. Suite `gunfire` checks a payload goes off.

## v0.0.150 — the Bag's mana bar
Released 2026-10-07 (owner's ask; a minor update). The thin bar under the Bag's Mana stat now drains and refills
with the fire preview like cast delay's and recharge's: it read the gauge under the row's key (`manaMax`) instead
of `mana`, so it always showed full (`ui/editor.js` `GunStats`). New suite `manabar`.

## v0.0.149 — the owner's 12-item list (LIST3)
Released 2026-10-07 (the owner OK'd the screenshots and a feedback round; a minor update). Built by time-boxed
agents on branch `list3-small`, the tracker is `LIST3.md`.

- **Vines** (LIST3 #7): swinging on a vine you keep facing the way you were unless you push the other way
  (`W.p.steer`, `game/systems/gun.js`).
- **Trigger ring** (LIST3 #8, then the owner's feedback): the right stick fires at a ring just inside its three
  gauge rings, Dev → Player `aimPad` px in (5) (`triggerRing` in `core/consts.js`, `stickTrigger` in `ui/hud.js`;
  suite `trigring`; `interact` updated).
- **Feedback round**: Aim Assist hides the crosshair; Dev's **Spawn level** (any floor, `SpawnLevel`) replaces New
  cave + Floor 2; the copy buttons read "Copy Dev settings" / "Copy mod & perk audit"; the mini-map's open
  spaces dark-mid grey at 80% and its creature dots only where explored; the hologram glitch has its own rate
  for blinking on (`l2dFlkRate`), tearing (`l2dFlkTears`) and cutting out (`l2dFlkDrops`).
- **Fixed**: Dev's Copy report missed a half-typed box (the report was written before the box committed).
  Browser suites updated for the batch (the archived gun chooser via `gunMenu`; tiles found by mod id; a tap
  opens the gun card; Aim Assist exempt in `everymod`). `jelly`, `lightning`, `vendshop` fail on v0.0.148 too.
- **Guns by holding a HUD slot** (LIST3 #5, `ui/gunhold.js`): by a gun on the ground, hold a gun slot (the
  empty one too) and a ring fills round it; at full it takes the gun into that slot and your old one lies
  where it was. With no gun in reach, holding a filled slot lifts its gun out under your finger: drag it and
  let go to drop it there (settled on the floor; at your feet if the spot is rock or out of sight), out of
  your guns; let go over its own slot to cancel. Tapping the gun in hand shows its card (was a hold). The
  right-stick tap → swap chooser is archived (`input.current.gunMenu`). New `gunhold` browser suite;
  `gunpickup`/`interact` updated, `compare`/`teleport` set the archive flag.

- **Discriminate mod** (`discrim`, LIST3 #11): each copy gets its own permanent target. Tap an unset one in
  the Bag → "Set target" → the Bag closes and the aim stick drives Aim Assist's pointer, snapping onto any
  creature, you, or an object (props, pickups); let go on one to set it ("Discriminate → Konna" toast), let go
  on nothing to cancel. A set copy is its own id (`discrim:<kind>:<id>`, `spells/discrim.js`), so copies with
  different targets stack apart and saves keep them; its tile shows the target's little icon. The next spell
  then touches only that kind of thing: it passes through every other creature, you and props, homes/chains/
  pulls only onto the target, and its blasts hurt only the target. It still stops at rock, but never digs,
  blasts or burns it. Not covered yet: static fields, beams and a trigger's payload (they act as normal).
- **Aim Assist mod** (`aimassist`, LIST3 #10): with it on the gun in hand the aim stick drives a thin
  pointer ring out from your gun (like the vending menus' pointer) that snaps onto creatures in sight and on
  screen; on one it turns amber, the gun light swings onto it and the gun fires at it on its own (normal cast
  delay, recharge and mana). No trigger ring on the stick, no aim line; letting go stops. Its own Dev group,
  **Aim Assist** (reach, snap reach/pull/hit, stickiness, fire delay, ring size/line/dot).
- **Audit mods and perks** (LIST3 #6): every mod and perk card you can tap
  (Bag, Exo Suit, a gun card's mods) has a 📌 keep and a 🗑️ trash toggle (one or the other) and a
  Give Feedback button that turns the card into a notes box, prefilled with what you wrote before,
  with Save / Cancel. Kept on the device across runs and deaths (`caverunner-audit`). Dev → **Copy
  audit** copies it all as Markdown for a Claude Code session (Remove / Keep / Notes, each with the
  item's id). `save/audit.js`, `ui/cards.js`, `ui/devpanel.js`. Tests: new `audit` (logic + browser).
- **Collected mods stack** (owner, item 9): the Bag's "Collected mods" grid shows one tile per mod,
  with a small numbered circle top right when you hold 2+ (`.tcount`). Dragging from a stack fits one
  copy (the count drops; the tile goes at 0); a slot dragged back joins its stack; gun slots still hold
  one each. Display only: `LO.bag` still holds one entry per copy, so saves are unchanged
  (`stackBag`/`stackKey` in `spells/collection.js`; the key is the id today, ready for per-copy data
  like a Discriminate target). Suite: `stacks` (browser), `collection` (logic).
- **Mini-map perk** (owner, LIST3 item 12): fitted in the Exo Suit, a see-through box with a thin white outline over the
  gun buttons (their width, from just above them up to half the screen): what you have seen of the floor (rock black 20%,
  air dark-mid grey 80%, owner's feedback), you as a white arrow along the aim, red dots for creatures in explored parts of it, tiny red/green crystals, your pins (an
  off-box pin sticks to the edge its way). Tap: zoom out ×2, ×4, back. `ui/minimap.js`; suites `minimap` (logic + browser).
- **A modifier now affects only the next spell** (owner's decision): `[Damage Plus][Bolt][Bolt]`
  boosts only the first bolt; modifiers in a row all land on the next spell; inside a multicast or a
  trigger payload each spell gets only the modifiers right before it. Timing and mana unchanged.
  `planCast` (`spells/cast.js`); the aim line, bag stats and advisor read its shots, so they follow.
  Tests: new `nextspell`; `cast`, `groupstats`, `advice` updated to the new rule.
- **The Dev panel, tidied** (LIST3 #3):
  - The Dev panel is a dark card with **tabs** (Look, Player, Creatures, World, Level 2: `DEV_TABS` in `dev/knobs.js`),
  each a page of **collapsible groups**: a **tap** opens/shuts a group (was press-and-hold; a scroll gets no tap).
  Each header shows its knob count and how many you've changed; a dot on a tab means something on it changed.
  - The actions (All mods, All perks, Spawn gun, New cave, Floor 2, Restart run, **Copy report**) sit in a grid on top.
  - A **search box** finds knobs by name on every tab. Open groups and the tab are remembered (localStorage).
  - Copy report's text is unchanged. New suite `tests/browser/devpanel.test.js` (also takes the screenshots with
  `CAVERUNNER_SHOTS=<dir>`); `blackhole`, `jelly` updated for tabs and tap.
- **Bag: a firing window** (owner, LIST3 #4). The gun
  buttons moved to a row of four under the collected-mods grid; where they were, a small dark window
  shows the selected gun firing each pull's real shots (the game's own spell looks) in step with the
  slot lights, and it follows the build live as mods are moved (`ui/editor.js` `GunFire`,
  `bagsim.js` `S.shots`; suite `gunfire`).
- **Dark zones: the hologram glitches** (LIST3 #1). In or near a zone
  the hologram behind the silk is on (`l2dFlkBase`) and glitches at random: dropouts, strobing flashes
  brighter than it (`l2dFlkFlash`), torn horizontal slices (`l2dFlkGlitch`), `l2dFlkRate` bursts a second,
  from `l2dFlkNear` px outside a zone; `l2dFlk` 0 turns it off. Random backlight for the silk, aliens
  silhouetted. Pure state machine `world/holoflicker.js` (suite `holoflicker`); `holo.js` `holoKeep` makes the
  layer even while the hologram rests dark. No blur; pictures: `tools/holoflickshots.js` (`V2=1`: four frames
  held by `HoloFlicker.hold`). `darkHides` no longer skips an alien deep in the black while the hologram lights
  the backdrop: it's drawn, so it shows as a silhouette.

## v0.0.148 — Level 2 speed-ups; Flamethrower; Fire Immunity
Released 2026-10-06 (the owner OK'd the screenshots; a minor update). The owner's list, after
playing Level 2 (it dropped frames as a zone came into view and with the aliens about):

- **Drawn at 1.5× and stretched to fit** (`game/dpr.js` `gameDpr`; Dev → Camera & aim, `renderScale`): a phone
  is ~2.6×, so about a third of the pixels to draw.
- **Dark zones** (`render/dark.js`): the back wall blurred once a floor (not every frame); the hologram behind
  the silk blurred only with the new Dev switch `l2dHoloBlur` (off by default); the black's soft edge no longer
  blurred every frame but a banded ramp in `l2dBands` steps (3), made once a floor, with fire's lift taken out
  of it; the per-floor layers made on the floor's first frame (they were made the moment a zone came into view:
  the hitch); the working canvases only grow (a new size every frame was a new canvas every frame).
- **Aliens**: half as many (`alCount` 30–60 a zone); black, without the skin texture; one shared eye picture
  (white, veins, made once) with only the pupil and glint drawn per alien; not drawn at all deep in the black;
  they think in 5 groups, one group a frame, gliding between thinks (`game/creatures/alien.js`).
- Measured (alienperf's spot, software-drawn, CPU slowed 4×): 114 ms a frame → 36 ms.
- **Flamethrower** (`flamer`, a shot mod): a fast spray of short flames the way you aim; they slow, rise, pass
  through creatures and set alight what they touch.
- **Fire Immunity** (`fireimm`, a perk): you never catch fire (`youAlight`); blasts still hurt.
- **Dev → All perks** (owner, to playtest perks): like All mods, every perk in the Exo Suit's grid to fit as
  often as you like, and the suit (and mod editor) usable anywhere while it's on (`LO.debugPerks`, saved).
- Tests: browser `flamer` (new); `perks` (61 perks, Fire Immunity), `dark` (the new knobs); `camera`, `guide`,
  `pixelfx`, `holo` read the canvas's real scale (1.5×, not the screen's); `darkzone` checks the hologram blur
  with its switch on. `shop` ("the coin is gone once collected") fails on v0.0.147 too: not this change.

## v0.0.147 — Level 2: the Tombs
Released 2026-10-06 (every stage's look OK'd by the owner from screenshots; a minor update, for testing).
The owner's brief: LEVEL2.md; the parts and their knobs: HANDOVER.md, "LEVEL 2".

- **Floor 2 is the Tombs** (the theme renamed from Coal seams): an ancient tomb laid out as geometric rooms,
  galleries and shafts in cut stone (`world/tomb.js`), each room furnished by its type with skeletons and
  unlit candles (`world/furnish.js`), and its own carved back wall at the rock's brick scale (`paintTombWall`,
  drawn at terrain resolution: `level.bgHi`).
- **Dark zones** (`world/dark.js`, `render/dark.js`): 2–3 big zones of rough caves and small tunnels under thick
  silk. Inside, the hologram and back wall are blurred behind the silk, everything else is a black
  silhouette past a short fade, your gun light flickers out, and only fire lifts the dark.
- **A wasteland round them** (`world/destroy.js`, the reusable `world/byDistance.js`): 100 real blast holes in a
  ring round each zone, with scorch, soft blast streaks and soot, some burnt out; bones and skulls in the floors.
- **Loot instead of creatures** outside the zones (`world/loot.js`): gold where half a floor's creatures would
  have stood, in mixed nugget sizes, 12 red crystals; a prize in each zone's chamber (1000–2000 gold, 4–6 red or
  1–3 green crystals, at least one zone green). Gold on the ground is saved.
- **The aliens** (`creatures/alien.js`, `game/creatures/alien.js`): hundreds of eyeball creatures on three
  tapered legs, in packs (boids), mostly small with a few big; they flee fire and attack only in the dark;
  black strays outside run home. A passing bullet gives a glimpse of them.
- Dev groups: Level 2: dark zones, destruction, aliens (with bezier curve editors).
- Tests: logic `tomb furnish dark destroy loot2 alien bydistance`, browser `tomb darkzone darkperf alien
  alienperf`; `sound` now hops to floor 14 for its minecart (minecarts came only with floor 2's old decoration).
  Picture tools: `tools/floorshot.js darkshots.js boomshots.js lootshots.js aliensheet.js alienshots.js alienframes.js`.
- `CLAUDE.md`: "Subagents: keep them short" (the owner's rule after long agent runs).

## v0.0.146 — a dark shade under the controls
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A shade under the controls** (owner: so the sticks and buttons stand out): see-through at the map
  button's top, black by the sticks' middles and on down (`.ctlshade`, `shadeAt` in `ui/hud.js`); taps go
  through it; hidden on the map screen.
- Tests: `ctlshade` (new; browser: where it starts and goes black, the sticks still on top; screenshots
  `ctlshade_before.png` / `ctlshade_after.png`).

## v0.0.145 — the way up over the buy machine, the gun light, the teleporter's lightning
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A light on the gun in place of the hand torch** (owner; the torch is archived for creatures later:
  `HAND_TORCH` in `game/systems/player.js`, its code untouched). A steady white cone the way you aim
  (`DEV.beamDeg` 50°), swinging after the aim, reaching `DEV.beamReach` (2.2) × the sight radius and
  uncovering the fog that far along it (`beamFan`; elsewhere the old radius), stopping on rock; a small
  glow round you (`beamNear`); the free hand steadies the gun. No gun in hand (a new run's start): no cone,
  only the glow (owner).
- **A new run's teleporter: no lightning while it charges** (owner), only once you've come through in the
  flash (`render/pads.js`, `introHeld`); the fizz of sparks waits for you too. In the shop hall it reaches only as far as
  the torch did (the hall has its own lights). Dev → Torch & fog: `beamDeg`, `beamReach`, `beamNear`, `beamGlow`.

- **The shop's one hole in the roof is always straight over the buy machine** (owner: so it's obvious
  to find); it was anywhere along the roof. `makeLevel` still makes the old roll, so the rest of each
  seed's cave is the same apart from the route's first stretch up from the hole.
- Tests: `gunlight` (new; logic: the cone's shape and the fan; browser: lit ahead, dark behind, turns
  with the aim, no embers; screenshots `gunlight-*.png`); `torch` (the light holds steady now), `fog` (the
  map reaches the beam's reach); `intro` (no bolts drawn while you're held, bolts after); `shopexit` (new; logic: floors 1–3, every seed, one hole centred on `VEND_BUY_X`; browser: jet
  straight up from the machine into the cave, screenshots `shopexit-*.png`); `level2`'s pinned floor-2
  hashes re-pinned (the shaft moved).

## v0.0.144 — the heal under its light, dust in the cones, the guide's rude line, gun pickup, the arrival
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **The heal** stands centred under its tube (`HEAL_X` 566 → 556, `LIGHT_X[4]`).
- **The guide turns rude only once you walk out of its pool of light** to the right (`guideLitEdge`:
  its section's middle + `poolEdge`, 46), not as you pass it: walking right at full speed it had turned
  rude while still invisible, so it was skipped unseen.
- **Dust in the light cones** (`coneDust` in `render/shoplights.js`), dust-coloured, only ever inside
  a cone; the floor's ambience (floor 1's green spores) no longer spawns or drifts in the shop room.
- **Gun pickup** (`ui/swap.js`, `style.css`; owner): the slot buttons a full-width row of squares at
  the bottom, the two cards splitting the rest equally; the stats one column on the owner's phone, two or
  three across on shorter screens so nothing has to scroll.
- **A new run's arrival** (owner): the teleporter charges for a second (`ARRIVE_T`, `W.intro`; you're
  held, unseen, no torch; light spirals into the pad, the lightning builds, a rising `padCharge` sound),
  then a flash and lightning and you're on the pad (`stepIntro`, `padCharge`/`FLASH_T` in
  `render/pads.js`); a second later the tube over the teleporter flickers on (`LIGHT_WAIT` stays 2 s).
- **A gun's mods as square tiles** (owner): every gun card (the pickup, the gun machine, the Bag's gun
  card, the card by a gun on the ground) shows its slots as the Bag's square mod tiles, empty ones dashed;
  tapping one (not on the ground card) opens that mod's card over everything (`ModPop` in `ui/cards.js`).
  A mod card's examples ("modifiers go to its left"…) are square tiles too.
- Tests: `intro` (new: held while charging, through at 1 s, the tube on a second later; screenshots),
  `gunpickup` (square full-width slots, equal cards), `guide` (logic: the edge; browser: a full-speed walk sees it before it turns rude),
  `shoplights` (the heal under its light; no ambience in the shop; screenshot `shoplights-8-heal-dust`).

## v0.0.143 — the guide's gun: one shot a cast, 0.5 s recharge
Released 2026-10-05 (owner's ask; a minor update). The starter kit's level 5 gun now always casts one
shot (`multi` 1) and recharges in 0.5 s (`GUIDE_GIFTS`' gun takes `multi` and `recharge`; `giveGift` sets them).

## v0.0.142 — empty hands, a free pistol, the crystal machines show how
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update).

- **A new run starts with no guns and no gold** (`START_GOLD` 0; `App`'s new loadout is four empty
  slots). The Scratch Pistol is `scratchPistol()`; `startingGuns()` stays for the tests, and the browser
  test page still starts with it and 40 gold (`testhook.js`; `window.__TEST_EMPTY` for the real start).
  A save with no guns is a run now (`cleanLoadout` wants a guns array, `sel` 0). No gun in hand draws
  none (`render/actors.js`).
- **The gun machine's first gun is a free Scratch Pistol** while you have no gun (`ui/gunshop.js`:
  "FREE", "Take it"); it stands in front of the offer's first gun, which is still there once you have one.
- **The crystal machines show how** (`stepDemo`/`demoAt`/`demoPos` in `game/systems/shops.js`,
  `drawDemo` in `render/shops.js`): standing within 100 of the nearer one that no real crystal has gone
  into this run (`LO.fed`, saved), a hologram crystal in the guide's look (its pass is now `holoPass`,
  shared) with its own red or green showing through (owner) glitches in on the floor beside it, on your
  side, sits, is sucked into the slot, a flash, 2 s, again.
- **The guide's kit: 2 red crystals** (was 3).
- **The guide waits until it's on screen**: measured at Carrot 0 (the view 225 wide), it jumped out ~27
  in from the right edge with its light mostly off screen. Now its dark spot must be `DEV.guideIn` (50,
  Dev → Guide hologram) in first, or you within `GUIDE_NEAR` (30, was 70); `GUIDE_GONE_X` is gone.
- **Gun and mod machines swapped** (owner): left to right guns, mods, perks.
- Tests: `emptystart` (browser: empty start, the free pistol, the demo with screenshots); `guide`
  (both) and `runner`, `shoplights` logic updated.

## v0.0.141 — a new map, pins, and a guide hologram in a longer hall
Released 2026-10-05 (after the owner's OK of the screenshots; a minor update). The guide greets every
new run, after a death too (owner).

- **The map, rebuilt** (`ui/map.js`, owner: other UI got in the way and the outline lines broke up into
  pixels). A full-screen React screen (`MapScreen`): a picture of the floor as it was made — decoration
  with the rock over it on the floor's dark, a pixel a terrain pixel (`mapPicture` in
  `game/systems/level-entry.js`, into `G.mapC`, at each `enterLevel` and `voidCave`) — fitted to the
  screen's height, under the fog memory (only seen ground shows; it spreads 2 cells into the rock round
  what you saw, `spread`, or walls stayed black), with your helmet where you are, and the shop's machines
  as coloured squares (owner: `MAP_MARKS`; teleporter blue, heal pink, buy cyan, sell violet, mods red,
  guns gold, perks green). The open air is drawn a little lighter than the fog. One
  finger pans, two pinch to zoom (a wheel too). It covers everything but the map button (still under
  your thumb, to shut it) and the pin button. The old canvas map is gone (`drawMap`, `miniEdges`,
  `W.miniEdgeIdx`, `G.miniC`…, `MINI_D`/`MMW`/`MMH`), and with it the loot dots and room outlines.
- **Pins**: on the map screen only (owner), the pin button mirrors the map button on the right (`deckLayout` `pin`). Tap: a grid of pins
  used before (last first; localStorage `caverunner-pins`) and **+** (a box taking one character, an
  emoji counting as one: `firstChar`); hold: drops the chosen pin where you stand (`W.pins`, saved with
  the floor). Pins stand on their spot on the map.
- **The shop hall**: the heal and every machine moved to the far right (`HEAL_X` 566, `VEND_BUY_X` 676 …
  perks at 1156); the teleporter and its sign stay. The light sections run `SHOP_SLOT` apart from the
  teleporter's to the end wall (`LIGHT_X`), each machine the middle of one. **Pools of light** (owner:
  darker between the lights): each tube lights ±30 fading over 16 (`POOL_FADE`, where its cone meets the
  floor), and between pools it's `DEV.shopGap` (0.9) dark, the lit shop too (`shopDark(null, …)`); your
  torch only lifts `DEV.shopTorch` (0.45) of the hall's dark; brighter cones and a pool on the floor
  (`render/shoplights.js`). Dev → Torch & fog has both knobs.
- **The guide hologram** (`world/guide.js`, `game/systems/guide.js`, `game/render/guide.js`): on a new
  run, once the teleporter is off screen the hall ahead snaps on (`lightNear`) and a little see-through
  blue you hovers there, just inside the dark under the tube that snaps on (`guideSpot`: 20 short of the
  first held section's middle; it also jumps out if you come within `GUIDE_NEAR` of it first), invisible until the
  tube over it is lit (`guideShown`: it blinks in with the tube's stutter), in the hologram layer's parallax, waving, distortion bars rolling over it. A speech
  box types the owner's welcome a letter at a time (Dev → **Guide hologram**: `guideCps`, `guideWait`),
  then it throws out the starter kit one thing at a time (150 gold, 3 red + 1 green crystal, Buzzsaw,
  Bolt, Double Cast, a level 5 gun cut to 3 empty slots, not shuffled) and glitches away. Pass through it
  before that: it glitches, types "Rude. Yeh OK have fun!…" and goes, no kit. The hall past it stays dark
  until it's gone (`lightsStep`'s `hold`). New suites: `guide` (logic and browser); `map` rewritten;
  `shoplights` (both) and `shoplayout` follow the new hall.

## v0.0.140 — a red mod machine, a gold gun machine, no Boosted reroll
Released 2026-10-04 (after the owner's OK of the screenshots).

- The mod machine's hue (`SHOPS.mods.hue`) is crystal red `#ff3a4a` (was blue), the gun machine's gold
  `#ffd95a` (was orange; the gold nuggets' own colour, `NUGGET_PAL`): hologram, edge strips, emitter.
- The gun machine's red-crystal **Boosted** reroll is gone (`ui/gunshop.js`: the button, the crystal count,
  the red `Sparks`, `.gboost`). The pure boost helpers in `spells/gunshop.js` (`boostGun`, `boostCost`,
  `shopGun`'s `boost`) stay, unused by the game. `gunshop` checks there's no Boosted button.

## v0.0.139 — the mod machine can repeat
Released 2026-10-04 (logic only: the owner's call in chat).

- The mod machine pops out any mod off the current floor's drop table by its odds (`rollMod`), ones you
  have included, so it may repeat; a new one is unlocked ("Unlocked X"), a repeat just names it. Perks
  stay one of a kind (owner): the perk machine only gives a perk you've never unlocked (`perkRoll`), and
  with none left the crystal gives nothing ("No perks left"). `machineRoll` in `game/systems/shops.js`.
- `crystalmachine` checks both.

## v0.0.138 — crystals are rocks, the machines eat them
Released 2026-10-04 (after the owner's OK of the screenshots).

- **You can't pick crystals up** (`game/systems/pickups.js`: the fly-to-you is gone). A loose crystal is a
  rock: it falls, bounces, rolls and bumps other crystals (`world/nuggets.js` `stepNugget`/`collideNuggets`,
  now taking a radius, `CRYS_R` 8), and walking into it shoves it (`shoveNugget`: out of your box, given
  your speed). A hidden room's green crystal still drops off its altar once you're near.
- **The Gravity Gun drags crystals** (`game/systems/fields.js`): inside a White Hole a crystal is steered to
  its middle and held up (`q.hold`: no gravity), but it moves through `stepCrystals`, so it bumps into rock
  rather than passing through it like other loot.
- **Crystal machines** (`game/systems/shops.js`: `SHOPS[k].takes`, `stepCrystals`, `intakeOf`,
  `machineRoll`, `shakePhase`, `CYCLE` 2.4 s): the mod machine takes red, the perk machine green. One that
  comes within `INTAKE_X` flies into the slot (`SLOT_Y`, `q.into`); each machine works one at a time
  (`W.machines[k]`: `n` queued, `t` into the shake): faster and faster shaking and chase lights, reel
  ticks, then it pops out a new unlock off the current floor's drop table (`crystalRoll`/`perkRoll`, saved
  to the collection; everything unlocked: one you have). Drawn in `render/shops.js` (a slot in the crystal's
  colour, cap lights, the glass flaring).
- **Their menus are archived**: `shopNear` skips a machine with `takes`; `ui/vendshop.js`/`ui/modshop.js` are
  untouched (drop `takes` to bring one back). The gun machine keeps its menu; its Boosted spin needs carried
  red crystals, which only old saves have now.
- Tests: `crystalmachine` (new: sandbox push/hold/drag, the machines); `vendshop`/`perkshop` open the
  archived menus directly; `perks` expects the altar crystal to drop loose.

## v0.0.137 — the Gravity Gun, path mods that work, crystals like gold, burning elites
Released 2026-10-04 (after the owner's OK of the screenshots).

- **No perk column on the play screen** (the Exo Suit tab shows what's fitted): `.perkcol`, `.perkpip`,
  the perk card and `perkTap` are gone; `perkcol.test.js` deleted.
- **Bigger deck buttons** (`ui/hud.js` `deckLayout`): the gun arc sits `DECK_PUSH` (14) px further out
  from the right stick and each button is as big as fits with `DECK_GAP` (6) px between (46 → 62 px on
  a 412-wide phone, max `DECK_MAX` 64); the bag and map match it, the map `DECK_GAP` + 2 above the bag.
- **Crystals are collected like gold** (`game/systems/pickups.js`): no card, no tap; within gold's pull
  (`COIN_PULL × goldPull`) one flies to you through rock; an elite's pile waits `SPILL_WAIT` (`nopull`);
  a hidden room's green crystal comes off its altar as a loose crystal once you're in reach. Their round
  glow is gone: `crystalMotes` (`particles.js`) sheds specks (`'breeze'` motes) that rise and drift on a
  slow cave breeze, and a trail along the way while one flies.
- **Flight paths rebuilt, one shared function** (`spells/paths.js` `pathStep`, used by the bullet loop,
  moving fields and `tracePath`): Boomerang turns for home at half its flight time and is caught (gone)
  back at you; Ping-Pong reverses out `PONG_T`, back half that, on again (it used to flip every frame);
  Spiral Arc is a widening side-to-side swing along the aim (`spiralOff`; it was an offset orbit); Orbiting
  Arc circles what cast it at `ORBIT_R` (your gun, or a trigger's carrier while it lasts, then the spot it
  reached drifting on with its momentum: `anchorOf`/`pathEnv` in `fields.js`, `from` through
  `releaseAt`/`spawnShot`/`castField`).
- **New mods**: **Follow Me** (`follow`, Homing aimed at you; a field hovers `FOLLOW_AHEAD` ahead of your
  gun), **Enlarge**/**Shrink** (`grow`/`shrink`: × / ÷ 1.5 size and every radius, `sizeBy`), **Longer
  Flight**/**Shorter Flight** (`lifeup`/`lifedn`: × / ÷ 1.5 flight time).
- **Static fields move under path mods** (`castField`: `FIELD_SPEED` along the aim, steering with
  `SEEK_ACC`), through rock, still working as they go.
- **Vacuum Field is the White Hole**: a steady pull (`VAC_PULL`, stronger further in, holding things in
  the middle) for 1.2 s, harmless, through walls; creatures, their shots (slowed so they settle), gold,
  loot. No circle: a tiny white-and-blue black hole (`drawWhiteHole`, `render/looks.js`) with specks
  drawn into it (the old portal's `'in'` motes, following a moving hole). `VACUUM_WAIT` is gone.
- **The Gravity Gun**, a third starting gun (`startingGuns`): Follow Me + White Hole. A save from before
  keeps its guns: Dev → Restart run to get it.
- **Elites burn** (`stepEliteFire` in `particles.js`, `drawEliteFire` in `render/actors.js`, over the
  creatures): fire specks from the body, carrying the elite's speed and losing it to air resistance (a
  trail), rising and swinging. **Dev → Elites: flames**: range knobs (rate, length, rise, wavyness and its
  rate, air resistance, size, spawn spread), a gradient editor (`GradEditor`: tap the bar to add a stop,
  drag, pick its colour, delete) and an opacity-over-life B-spline (`RampEditor`: tap to add a point,
  drag, delete), with a live preview (`FlamePreview`). Kept as strings (`DEV.elFxGrad`, `DEV.elFxAlpha`;
  `art/ramps.js`); the Dev store now accepts such strings.
- **The elite's glow is a soft radial gradient** (`drawEnemies`), strongest in the middle and fading to
  nothing at `e.r + elGlowR`: it was a flat disc with a hard rim (the owner: "lose the big circle").
- Suites: logic `paths`, `ramps`; browser `paths` (sandboxed: boomerang, orbit, ping-pong, spiral,
  the Gravity Gun), `elitefx`; `teleport`, `vendshop`, `gunshop`, `perkshop`, `perks`, `cast` updated.

## v0.0.136 — the dark shop, the TELEPORTER sign, gold you can see
Released 2026-10-03 (after the owner's OK of the screenshots).

- **A new run starts in a dark shop** (`world/shoplights.js`, `game/systems/shoplights.js`,
  `game/render/shoplights.js`): the way in crackles blue (and fizzes) while only it and your torch light
  anything; after 2 s the ceiling tube over the teleporter and heal stutters on like a fluorescent tube
  (a click each time it catches, sound `tube`); each time you reach the middle of the last lit section
  the next one flickers on, one vending machine each; the perk section on 3 s (or you leave the shop),
  the rest of the hall comes on in a run. The dark is `drawFog`'s (`fogDark × shopDark`). Every shop now
  has the tubes on its ceiling. Not on a save's reload; the test page only with `window.__TEST_INTRO`.
- **The shop's layout moved along** (`core/consts.js`): the way in's pad centred under its sign
  (`ARRIVAL_X` 66, was 34), the heal just past the sign (`HEAL_X` 124, was 96), then the machines evenly
  spaced, `SHOP_SLOT` (120) apart: buy 210, sell 330, mods 450, guns 570, perks 690 (were 180, 280, 530,
  640, 750), so each light section reveals one. The first section (`FIRST_X` 76) covers the pad, sign and heal.
- **The way in's sign** (`art/sign.js`): "TELEPORTER" painted by hand on a plank nailed at a slant over
  the machine's old "PRINTER" plate (its top and "ER" still showing), the pad centred under the plate.
  "WAY IN" is gone.
- **Gold knocked loose by a kill or a dig waits 0.25 s** (`SPILL_WAIT`, as `nopull`) before it flies to
  you: close by, it used to be taken before it was ever drawn (you heard it, never saw it).
- Suites `shoplights` (logic and browser).

## v0.0.135 — locked perks give nothing away
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The Exo Suit's perk grid hides perks not unlocked yet**: each is a blank dashed tile in its own place
  (no glyph, tint, tier, name or lock), and takes no touch (`pointer-events:none`: no card; a swipe on it
  still scrolls the grid). The grid keeps the perks' own order. Suite `perklocked`.

## v0.0.134 — the vending machines' new screens
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The sell machine is lit from the start**: green "SELL lvl 01" and its price, no fine print. Half a
  second after a level is bought (`SELL_WAIT`) its screen glitches over `SELL_GLITCH` s (bands of the old
  and new screen, torn sideways, a colour-split ghost, white tear lines: `glitch`, `sellScreen` in
  `game/render/vend.js`) to red with "*no biological entities accepted"; and back the same way once sold.
- **Both offers have a new layout** (`deal` screens): "BUY lvl 01" on one line (the verb and number big, "lvl"
  small and leaning), the price in bold under it, fine print small below ("*credit available" on the buy
  machine). Both machines share sizes and positions (the verb's room is SELL's; the price fitted to the sell
  price). The buy machine shows the floor the menu would sell next (`W.floor`).
- **A blocky terminal font** for every machine screen (`art/pixfont.js`: `pixText`, `pixWidth`, `pixHas`;
  glyphs drawn as rects, the same on every phone, no font file). Suite `pixfont`; `vend` checks the sell
  screen's timing.

## v0.0.133 — Restart empties the mods unlocked
Released 2026-10-03.

- **Dev → Restart run starts clean like a death**: `restart` (`ui/app.js`) empties the mods unlocked
  (`collection` and its store); the perks unlocked stay, as on a death. `restart-confirm` checks it.

## v0.0.132 — version numbers are major.minor.patch
Released 2026-10-03.

- **The version is `vX.Y.Z`** (major release, major update, minor update), carrying on from v131 as
  v0.0.132. The app compares an update number, X × 1,000,000 + Y × 1,000 + Z (`tools/build.js` `code`),
  written into the page as `<!-- VERSION = 'v132' -->` and into `version.txt` as `132 v0.0.132`, so the
  app already installed (which reads a plain number) keeps updating. The app's `verNum` reads semver
  first now, and its prompt shows `v0.0.132` (`verLabel`; needs the new APK, optional). Suite `version`.

## v131 — the jet flame comes out of the backpack
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The jetpack's flame and smoke come out of the backpack's nozzle** (`jetNozzle`, `NOZZLE_X`/`NOZZLE_Y`
  in `game/systems/player.js`: behind you, the foot of the pack), not from between your feet; the flame's
  base is slimmed to the nozzle's width (`jetFlame`). `pixelfx` checks it sits on your back's side facing
  either way.

## v130 — the floor menu, levels made ahead, three exits, pixel flames
Released 2026-10-03 (after the owner's OK of the screenshots).

- **The buy machine opens a full-screen floor menu** (`ui/levelshop.js` `LevelVend`, `SHOP_MENUS.levels`,
  the stick pointer like the other machines): each floor's debt, sale price, reward and kill gold. Floor 1
  is always for sale; floor N once N − 1 has been sold this run (`LO.soldTop`, saved; a new run clears it).
  The menu hands back `input.current.buyFloor`; `buyLevel` puts it on the debt and starts the warp.
- **Exponential economy** (`data/levels.js`): the debt starts at a billion (`LVL_BUY`, was 64 billion) × 3
  a floor (`lvlGrow`); the reward on top starts at 1,000 (`lvlBonus`, was `lvlReward`) and doubles a floor
  (`rewardGrow`, 2: 1,000, 2,000, 4,000, 8,000…); kill gold and the heal
  × 1.35 a floor (`killGrow`, `goldScale`, was +30% a floor). A sale always pays the reward and clears
  the debt (an old 64-billion debt can't eat your gold). Old-save mending keeps the old price (`OLD_LVL_BUY`).
- **No freeze at the buy flash** (`game/levelgen.js`): while there's no level, a Web Worker running the
  same bundle makes the floor up for sale; the warp takes it, waiting in the dark up to `WARP_WAIT` if it's
  still coming, or makes it itself if there's no worker. Then its rock goes onto the canvases a band a
  frame from the bottom up (`stepReveal`). Worst frame at the flash with the CPU slowed 4×: 1117 ms → 67 ms.
  A sale no longer makes (and throws away) the next floor's level: the cave is voided in place.
- **No level, no level sounds**: ambience off in `voidCave` (`SFX.setAmbience(null)`), no ambience
  one-shots, the exit's hum silent.
- **Three exits along the top** (`EXIT_X`, `W.portals`, `exits`/`nearExit`), evenly spaced, joined by a
  passage. Floor 2's pinned cave hashes moved (`level2.test.js`).
- **Teleporter pads crackle only when used** (`W.padZap`, `ZAP_T`): going through an exit sets off it and
  the way-in pad.
- **Pixel flames**: the hand torch (`torchFlame`: tongues on their own beats, licks breaking off) and the
  jetpack's flame (`jetFlame`) through `pixelSprite`, the jet smoke through `pixelSoft`, all on the
  player's grid (`DEV.runnerPx`). Suite `pixelfx`.
- **The Exo Suit's perk grid is a ScrollBox** like the Bag's mods: a grab bar, a perk you can fit takes the
  touch (drags without the grid scrolling), the rest let a swipe scroll; a cancelled press opens no card.
  Suite `perkgrid`.

## v129 — vines that trail, Witness fixes, one of each perk, mods reset on death, Dev for floor 2
Released 2026-10-03.

- **A swung vine has a tail** (`world/sway.js` `tailStep`/`vinePt`/`vineJoint`): above the joint
  (`sj`: your grip while held) it's the one straight piece turned by `sw`; below it, `vineLinks` (4)
  verlet links (`tl`/`tq`) hang off the joint under gravity, damped by `vineTailDamp`, so grabbing near
  the top no longer swings the bottom stiff in line. Drawn through `vinePt` (no more canvas rotate);
  `hangX` follows it. The tail is dropped once still, so the vine sleeps.
- **Witness export is the screen's shape**: the copy canvas started 300 × 150 (a new canvas's size), so
  the "size it on the first frame" check never fired and every video was 300 × 150. And while exporting
  the replay draws on the whole screen (`V.full`), not just above the panel.
- **The replay's hologram counts what it counted then**: each snapshot keeps `bio` (`holoCount`, the
  whole floor), and `drawHolo` shows `G.RPV.bio` in a replay (it counted only the creatures recorded
  near you). Older saved clips fall back to the old count.
- **Mods unlocked reset on death** (`hurt` empties `collection` and its store); perks unlocked stay.
- **One of each perk in the suit**: `activePerks` counts a perk once; `cleanPerks` sends a second
  fitted copy back to the carried ones; the Exo Suit grid shows a fitted perk ticked and faded
  (`.xperk.inuse`) and won't fit a second copy.
- **Dev → Level 2: layout & look** (`L2_KNOBS`, `L2_LOOK`, `l2Decor`): every number of floor 2's
  noise cave as a min/max range (rolled on their own generator: at the defaults the caves are exactly
  v128's, pinned in `level2.test.js`), its palette as colour pickers (`themeFor` builds Coal seams
  from them), and a decoration multiplier. **Dev → Floor 2** (`newCave = 2`) goes there.

## v128 — elites drop crystal piles, and a Dev group for them
Released 2026-10-03.

- **An elite drops red and green crystals** (`damageEnemy`): `elRed` reds and `elGreen` greens (3–5
  and 1), thrown out of it; a dropped green is a `crystal` pickup with `green: true` (drawn green,
  saved with the level). **One tap takes every crystal in reach** (an elite's pile), reds to
  `LO.crystals`, greens to `LO.greens`.
- **Dev → Elites** (`ELITE_KNOBS`, `ELITE_COLS`, all min/max): elites per floor (`elCount`, 2–4: replaces
  `ELITE_CHANCE`'s 5%), health, damage, gold reward, red and green crystals, size, tint strength, tint
  and glow colour, glow strength and size. `ELITE_HP`/`ELITE_DMG`/`ELITE_GOLD`/`ELITE_TINT` are gone.
  `makeLevel` still rolls once per creature (so caves are unchanged) and makes elites of the
  `elCount` lowest rolls, the count and each elite's place in the ranges (`k.eu`) hashed from the
  seed. Size and tint follow the knobs live (`eliteLive` in the enemy loop); health and damage are
  set when the floor is made; gold and crystals are rolled when one dies.

## v127 — vines and webs that give
Released 2026-10-02.

- **Web lines, arched vines and hanging vines move** (`world/sway.js`, looks only: no rope physics).
  A line (web line, arch) bends as one damped spring, its bend (`wx`/`wy`) peaking where you touched it
  (`wu`), straight from each end to there (a tent, so it goes taut in a V under you). Web lines sag at
  rest (`L.sag`). Flying through pushes it your way (`bendPush`); grabbing one bounces it
  (`lineSway` in `decorStep`), and held it settles at a dip under your weight. A hanging vine is a
  pendulum (`sw`/`swv`, drawn as the whole vine turned about its root): brushed past it swings;
  held with the stick not pushing across, you swing on it (`movePlayer`, sideways only) and it hangs
  through your hands. Everything that finds a line (`webNear`, `archNear`/`archAt`, `pOver`,
  spiders riding a line) finds it where it's drawn. Only what you touch wakes; it sleeps once still.
- Dev group **Vines & webs: sway** (11 knobs: sag, springiness, settling, push, grab bounce, dip,
  most bend; vine swing pull, settling, push, widest swing).

## v126 — the Carrot stat
Released 2026-10-02.

- **Carrot**, a sixth Exo Suit stat (`STAT_PERKS.carrot`, `pb.carrot` = its level 0–5): it stretches
  the camera distance, the torch's reach, enemy aggro distance and the Trajectory Sight line.
  Each has a Dev min (none fitted) and max (Carrot V) in the new **Carrot** group (`CARROT_KNOBS`,
  `carrotAt(k, level)`); defaults 1→1.35, 1→1.5, 1→1.25, 1→2. `tracePath` takes a `far` stretch.

## v125 — the astronaut, teleporter pads, a steel shop, a steady count
Released 2026-10-02.

- **You're a white-suited astronaut in pixels** (`art/sprites.js`): one `paintBody` from a pose,
  big helmet with a gold-rimmed visor, backpack, chest panel; arms and legs are two bones each,
  knees and elbows solved by `reach` (`runnerPose`: feet from the stride, hands on the gun and the
  torch). Drawn by `pixelSprite` at `DEV.runnerPx` (1 world unit a pixel) on a grid riding with
  you, solid pixels, a dark outline (`runnerLine`); the gun is its own pixel layer on top, aiming as before.
- **The ragdoll has elbows and both hands** (11 joints, `RAG_BRACE`), drawn as the same astronaut
  (`ragPose`; old 8-joint replays get elbows made up).
- **The portals are teleporter pads** (`render/pads.js`): a platform, a blue beam fading upward,
  rising specks, and blue lightning off the pad (the warp's `drawBolt`). No wall torches by them now;
  the way-in motes rise off the pad in blue. "Find the exit pad at the top".
- **The shop is steel** whatever the floor (`shopPanel`: roof with ceiling lights, deck floor, side
  columns; the back wall's panels, rivets and lit rail in `drawTerrain`).
- **Vending machines left to right: mods, guns, perks.**
- **The hologram's count only goes down**: it went back up as nests let new rats out. A nest now
  holds a fixed brood (`nest.left`, Dev `raBrood` 4–6) counted while inside (`bioCount`); the
  autosave keeps it (`brood`). Selling needs the nests emptied or destroyed.
- **Lines don't trap you**: on a web line or an arched vine, any push mostly across it (any way,
  not only down), or along it past an end, lets go (`lineLetGo`, `LINE_OFF`), and the push carries you off.
- Dev: `enemies` / `enemiesUp` (how many a new level gets), `lvlReward` (`lvlSell`), `runnerPx`,
  `runnerLine`, `raBrood`. The Dev panel's group headers open on a **press and hold**
  (`DevGroupHead`), and the jellyfish preview sits inside the Jellyfish colours group.

## v124 — saved death replays, video export, the ragdoll
Released 2026-10-02.

- **Your corpse is a ragdoll** (`world/ragdoll.js`: eight joints, sticks, the rock, floor friction,
  `RAG_SLUMP` so it topples rather than sits), drawn solid with the runner's parts (`drawRagdoll`);
  it used to freeze at 35% alpha. Dead, `movePlayer` runs `corpseStep` and you follow the hip; a
  blast after death throws it (`explode` → `ragPush`). The replay copies it (`rag`, `joints` in `RP_DEEP`).
- **The replay has sound**: `recSfxHook` wraps `SFX`'s one-shots and loops once for the page, the
  recorder keeps `REC.sfx` and each snapshot's loops; `rpSound` plays them as the clock passes.
- **Saved replays**: the live replay is a `Clip` now (`input.current.witness`, `V.clip`); **💾 Save**
  (`clipKeep`) cuts it to the box round your path plus `DEV.witPad` (`clipCrop`), with the floor's
  `SCENE_KEYS`, the gun in hand and the background, packs it (gzipped JSON, `clipPack`: ~0.5–1.5 MB
  for 13s, from ~8 MB) into IndexedDB (`save/clips.js`) with a thumbnail of the death. The Bag's
  third tab **Witness** (`WitnessGallery`) lists them: tap to play full screen (camera held inside
  what was kept), ✏️ Rename, 🗑️ Delete.
- **🎬 Export video** (`exportClip`): plays it once as set up, records the play area and the sound
  (`SFX.stream()`), MP4 straight from `MediaRecorder` or WebM → MP4 with ffmpeg.wasm; saved through
  the app's new bridge (`VideoSaver`, reinstall the APK once) or downloaded in a browser.
- A replay now sees the rock as it was (`RT.mat` from the terrain's pixels), not today's.
- Dev → **Witness (death replays)**: `witPad` (80), `witKbps` (6000).
- The gold no longer shows over the replay.

## v123 — Dev knobs for the menu pointer
Released 2026-10-02.

- Dev → **Menu pointer & snapping** (`g: 'menuptr'`): `ptrStart` (stick push before the ring comes out,
  0.12; a tap under it presses the lit button), `ptrReach` (× the far-corner distance, 1), `ptrSize` (×
  the knob, 1), `ptrLine` (ring px, 0.75), `snapR` (28px), `snapPull` (0.3), `snapHit` (10px). They
  replace `MENU_PTR` and the `SNAP_*` constants.

## v122 — Questions Later; the pointer moves to the right stick, with a snap
Released 2026-10-02.

- New passive mod **Questions Later** (`auto`, ⇶, 70g, tier 2, drops on every floor: `OURS_AUTO`): the
  held gun fires as if the trigger were held (`gunPassives().auto`, `aimAndCast`), aimed where the
  right stick points or the way you face.
- The menus' pointer is the right stick now (`useMenuNav`): it comes out once the stick is pushed
  past `MENU_PTR` (0.12); a plain tap still presses the lit button (`Stick`'s `peak`). A gentle snap
  (`snapTo`): the nearest visible button within `SNAP_R` 28px pulls the ring up to `SNAP_PULL` 0.3 of
  the way to its middle and counts as under it within `SNAP_HIT` 10px.

## v121 — the menus' left-stick pointer
Released 2026-10-02.

- In a vending machine's menu the left stick is a pointer (`useMenuNav`, `menuPointer` in
  `ui/vendshop.js`): dragging it shows a second knob, a 0.75px ring with no fill (`.mptr`), at the
  stick's centre plus its direction × its 0..1 × the distance to the furthest screen corner, held
  inside the window. It lights the `[data-nav]` it's over and presses it on release. The stick
  publishes its centre and size (`StickState.cx/cy/size`). The arrow keys still step.

## v120 — the perk machine, green crystals, the Exo Suit
Released 2026-10-02.

- A third machine (`SHOPS.perks`, a green ✦ hologram, left of the guns): the mods' menu with a
  `perkShop` def (`ui/modshop.js`): a green crystal unlocks a perk you don't have (`perkRoll`;
  kept across runs, `caverunner-perkcollection`), gold (`PERK_PRICE` 200) dispenses a copy that
  pops out as a `perk` pickup. `ShopDef.unlock.name` names the crystal.
- One hidden room a floor, its altar holding a green crystal (`kind: 'green'`, `LO.greens`); the
  heart room is gone. Old saves' perk and heart rooms still work.
- Perks are carried (`LO.perks`) and count only fitted to the Exo Suit's `SUIT_SLOTS` (6,
  `LO.suit`; `activePerks`). A pre-suit save's switched-on perks are fitted (`cleanPerks`).
  Fitting runs `applyPerks` (the extra health comes full, the eye lights the floor, the ghost).
  The perk column shows the fitted ones; the on/off toggle is gone.
- The Bag has tabs along the bottom (`ui/exosuit.js` `Bag`): Guns & Mods (the Editor) and the Exo
  Suit (portrait, stats, six slots, the perk grid; drag to fit, tap for the card).
- Stat perks (`STAT_PERKS`, ids `st_<stat><1-5>`): Max Health, Movement Speed, Jetpack Fuel (`pb.fuel`:
  the tank drains slower), Jetpack Recharge (`pb.refuel`), Gold Vacuum, five levels each, priced
  `STAT_PRICE` 60–650g. The suit (`SUIT_LEN` 11) has a slot per stat beside its row (`fitsSlot`: stat
  perks only there, the rest only in the six). `perkRoll` unlocks a stat's levels in order.
- The top bar shows the crystals as a row of red and green silhouettes under the gold (`CrystalRow`).

## v119 — the gun vending machine, elites, crystals at the top
Released 2026-10-02.

- A second machine (`SHOPS.guns`, the gun sprite as its hologram) with its own menu
  (`ui/gunshop.js` `GunVend`, in `SHOP_MENUS`): three guns of the floor's pool (`LO.gunShop`,
  `spells/gunshop.js`) as slot-machine reels on the left with prices (`shopGunPrice`: `gunPrice` ×
  level), the selected gun's card on the right, and Buy selected / Reroll (gold, `rerollPrice`, ×1.6
  each use on the floor) / Boosted (red crystals, `boostCost` = uses + 1: 1–3 levels deeper,
  `boostGun`). Reels stop one at a time, overshoot, thud (`reelThud`/`reelTick`); a boosted roll
  spins faster with red sparks streaming past. A bought gun pops out of the chute (GunSwap as usual).
- The cave's guns are red crystals now too (12 a floor).
- Elites (`eliteOf`, `ELITE_CHANCE` 5%): ×2.5 health, ×1.5 damage, ×4 gold, gold-tinted with a glow,
  and they drop a red crystal that falls to the floor (thrown pickups now land on any rock).
- The stick navigation is a shared hook (`useMenuNav`); `CrystalIcon` moved to `ui/hud.js`.
- The top bar shows the red crystals you carry, beside your gold.

## v118 — the mod vending machine and red crystals
Released 2026-10-02.

- The shop's plinths of mods (or guns, on even floors) are gone; only the heal is left on one. In
  their place a vending machine in the middle of the room, a flickering ⚙️ hologram on its glass
  (`game/systems/shops.js`, `render/shops.js`). "Tap R to shop" opens its menu (`ui/vendshop.js`):
  the collection (every mod by rarity, empty cells until unlocked), the red crystal button (a
  crystal unlocks a mod you don't own off its floor's drop table: `crystalRoll`), and "Dispense
  selected" (buys a copy, `MOD_PRICE`; it pops out of the machine's chute onto the floor).
- The collection is kept across runs (`caverunner-collection` in localStorage, `loadCollection`).
- The cave's 7 mods are red crystals now (`kind: 'crystal'`, `floor`); carried in `LO.crystals`.
- The menu is generic: a `ShopDef` per machine (`ui/modshop.js`, `SHOP_DEFS`), so a gun or perk
  machine is a `SHOPS` entry and a def. The left stick moves the highlight, a right-stick tap presses it.
- Extra Item in Holy Mountain is gone with the plinths (30 perks); `gunshop` suite removed.

## v117 — a Dev knob for level 1's repay time
Released 2026-10-02.

- Dev → Level layout (floor 1) → "Time to repay level 1 (minutes)" (`DEV.due1`, default 60).
  `dueMs(floor)` in `dev/knobs.js`: floor 1 the knob, the rest keep `DEADLINE_MS`. It sets the
  deadline when you buy the level, so a level already bought keeps its clock.

## v116 — the hologram flashes on a kill
Released 2026-10-02.

- The hologram rests at brightness 0 (`DEV.holoMin`) and a kill (the count going down) throws it up
  to `DEV.holoMax`, fading back over `DEV.holoFade` seconds along a bezier curve
  (`bezierFade` in `core/util.js`; control points `holoC1x`..`holoC2y`, shaped on the Dev panel's
  `FadeCurve`). One multiplier (`holoBright()`, times `holoAlpha`) over the layer, its fog swap and
  its bloom; at 0 none of the three run. Repossessed, it stays lit.
- Software-rendered, the sandbox room: ~19ms a frame lit, 16.7 (the 60fps cap) dark.

## v115 — the hologram, its fog and the glows at the rock's pixel size
Released 2026-10-01.

- The battery: the hologram was made every frame at full canvas resolution (a tilted fill twice
  the view, ~250 scan lines), its fog swap at 1/2 and its bloom at 1/4, about 85% of the drawing.
  Now all three work on one grid of `DEV.holoPx` world units a pixel (default 2, the rock's),
  fixed to the hologram so its pixels slide with it (`holoGrid` in `holo.js`), scaled up crisp.
  At 2 the small words go to pixel squiggles (the number reads); 1 keeps them readable.
- `holoAlpha` 0 now skips the hologram's work entirely (it used to build the layer and hide it).
- `drawGlows` draws the glows into a rock-pixel layer and adds it once (`DEV.pixelFx`: 1 crisp,
  0 smooth; the fog swap too). Glowing particles stay full size.
- Software-rendered, flying through a cave: ~69ms a frame -> ~20ms (24 at `holoPx` 1).

## v114 — a quick Bag with a big gun
Released 2026-10-01.

- The Bag's dmg/s line re-ran the whole build advisor, parked swap tips included, on every render,
  and a drag re-renders per move: with a 26-slot gun one drag cost ~380ms of script on a PC (far
  more on a phone), and taps queued behind it (the "lag closing the Bag"). `buildAdvice(gun, bag,
  withTips)`: the editor passes `SHOW_TIPS` and keeps the result in a `useMemo` on the build's sig.
  The same drag now costs ~50ms. `bagspeed` (browser) times it; `advice` (logic) checks the
  tipless answer matches.

## v113 — steady camera in fast flight
Released 2026-10-01.

- The camera eased 15% toward you *per frame*, so how far it trailed you hung on each frame's
  length: on a phone (uneven frames, the odd dropped one) you jittered against the screen flying
  fast sideways, up to ~10 device px. It now eases by the sim's clock (`W.camT`; 15% per 60th of a
  second, so at an even 60fps it is as before).
- You are drawn nudged under a pixel (`F.snapX`/`snapY`, round `drawJetFlame`/`drawAim`/`drawPlayer`)
  so your place on screen follows your distance from the camera, not the world's pixel rounding.
- `camera` (browser) flies across a sandbox with a jittery, dropping frame clock at 60 and 120Hz.

## v112 — gold nuggets
Released 2026-10-01.

- Gold is nuggets now (`world/nuggets.js`, drawn by `drawNugget`): big 25, medium 5, small 1. Every drop
  (a kill, a rat's load, a nest, a gold seam) goes through `spillGold`/`splitGold`: as many big ones
  as fit, sometimes one fewer, then medium the same way, small for the change; it adds up exactly.
- Loose nuggets have physics (`stepNugget`: fall, bounce, roll downhill, hop pixel steps) and push
  each other apart (`collideNuggets`; one resting on the rock holds still under one on top). The old
  bob and the rat's separate `pop` arc are gone. `sandbox({ ramp: true })` for the browser suite.

## v111 — bigger gold, debt and clock at the top
Released 2026-10-01.

- The top readout is larger and centred: gold 24px (it had been shrunk to 14px by the shop's
  `.purse` rule), debt 18px, settlement clock 16px. The debt shows in full (`-64,000,000,000g owed`),
  not `fmtGold`'s 64B. `topgold` checks it at 360 and 412 wide.

## v110 — the shop heal can be bought again
Released 2026-10-01.

- The shop heal no longer sells out: the first on a floor is free, then 100g, x1.75 each time after
  (`healPrice`, `HEAL_PRICE`/`HEAL_MUL` in `data/creatures.js`), lifted by the floor like kill gold
  (`goldScale`, now shared with `enemyFor`). The count is the heal plinth's `bought`, saved as
  `level.heals`; a new floor's shop starts it at 0. The plinth shows its price (or Free).

## v109 — an hour to pay; standable plinths; bedrock shop floor
Released 2026-10-01.

- The repayment deadline is an hour (`DEADLINE_MS`), shown at the top under the debt too
  ("Settlement due 00:59:59", `DueClock`; blinks in the last five minutes). `countdown` drops the days
  under a day.
- A save with 64B+ gold and no debt (an older page loaded a v107 save, dropped the debt and paid
  out the whole sale) gets the level's price taken back off.
- The shop's floor is bedrock (`BED`, painted as the brick): it can't be dug or blown through.
- Item plinths' feet are one-way ledges (`ledgeUnder`): land on a hidden room's altar with the rock
  dug from under it; the altar stays (and stays standable) once its prize is taken.
- The background hologram's tiles are half as far apart (`PERIOD_X`/`PERIOD_Y` 150 x 171).

## v108 — repossession
Released 2026-10-01.

When the repayment deadline passes (`stepRepo`, `W.repo`, `src/game/systems/vend.js`): the hologram
says REPOSSESSED (also on the shop's back wall, `drawHoloShop`), after 3 s the level is teleported
away with you in the shop (warp `repo`), then the klaxon, red emergency lights pulsing and a ten
second "INCINERATION IN" countdown (also on both machines), then fire jets out of grates in the
shop floor (`drawRepo`, every `REPO_JET`) fill the room and burn you, harder each second, until
you're dead. A deadline that passed while the game was closed goes straight to the alarm.

## v107 — debt of its own, a five-day deadline; gold at the top
Released 2026-10-01.

- A bought level goes on your debt (`LO.debt`), not your gold, so the shop still works. Selling
  pays it off out of the sale; the other 1,000 is yours.
- The repayment deadline: five real days from buying (`LO.due`, the device clock, so it runs while
  the game is closed), counted down in red on the buy machine's screen (`countdown`: "4d 23:59:59",
  then "OVERDUE"). Nothing happens at zero yet.
- Gold moved to the top centre of the screen; the debt shows under it in red ("-64B g owed").
- A v106 save with negative gold loads as gold + the debt.

## v106 — the level vending machines
Released 2026-10-01.

- A run starts with no level: above the shop is solid dark bedrock and the roof is sealed
  (`voidCave`, `src/game/systems/vend.js`). Two tech vending machines on the shop's back wall,
  past the way in and the heal (`VEND_BUY_X`, `VEND_SELL_X`): **BUY LVL N** (64,000,000,000 G on credit:
  gold goes negative) and **SELL LVL N** (64,000,001,000 G, red until `bioCount` is 0, then green).
  Screens are stacked like the background hologram, in its green and red (`src/game/render/vend.js`).
- Buying: the screen goes dark, then a flash, a sweep and lightning over the shop roof, and the level
  arrives (`enterLevel(..., 'shop')` rebuilds it from its seed; you and the stock stay put). Selling:
  the same, it goes, the floor number goes up and the next floor's shop and level are made, hidden.
- The exit portal no longer ends the floor: it drops you back in the shop.
- Gold can be negative (save, deck readout: `fmtGold` does k/M/B and a minus sign).
- The browser test page starts with the level bought (`window.__TEST_VOID` for the game's start);
  `__lvl.nextFloor()` replaces walking into the portal in the suites.

## v105 — hologram static, change glitch, silhouettes
Released 2026-09-30.

- The hologram is made once per frame into its own layer (`drawHolo`), which the fog swap and the
  bloom reuse. Static runs through it: fine scan lines crawling down, rolling bands, dropouts (all
  from `W.time` hashes, never `Math.random`).
- When the number changes: a glitch (slices torn sideways, blocks of data dropping out, 0.45 s,
  `holoGlitch`) and the glow flashes brighter.
- Vines, chains, kelp and spider webs in front of the hologram are black silhouettes outside the
  torchlight (the full fog three times over), and don't glow.

## v104 — the hologram ignores the torchlight's dark
Released 2026-09-30. The hologram is darkened only by the fog of war, not by the dark outside your
torchlight: `drawFog` also bakes a fog-of-war-only layer (`fogWarC`), and where the hologram shows
(`holoMask`) the picture takes that one instead. The bloom uses it too. A creature standing in
front of the hologram gets the same treatment there.

## v103 — flat red hologram with bloom; fog reaches the edges
Released 2026-09-30.

- The hologram: flat bright red and see-through, nothing else (no outline colour, no halo, no
  flicker), full brightness, the boxes half the size on the same grid.
- The FX layer (`src/game/render/fx.js`, after the lights): the hologram's bloom. The parts of it you
  can see (not behind rock, the shop wall or fog) are brightened, blurred and added over everything.
  Dev → Hologram & glow: `holoAlpha`, `bloom`, `bloomBlur`, `bloomBright`.
- Everything below the shop floor is black.
- Perks: the column grows to near the top of the screen before starting the next; pips 36px; with a
  perk's card up, tapping another perk shows its card.
- Fixed: the fog's blur faded out at the level's left and right edges, leaving a see-through strip
  down both sides (the sharp edge cells now go back under the blur).

## v102 — perks you can switch off; the hologram glows
Released 2026-09-30.

- The perk icons are a column going up from above the map button, wrapping into a new column
  further in (they used to hide behind the controls). Tap one: the game pauses and its card opens;
  R (a right-stick tap, the r key, or the card's line) switches it off/on (`LO.perksOff`,
  `activePerks`; saved).
- The hologram 3× bigger and drawn as red light: added over the background, black is no light
  (numbers cut out of the lit box), with a glow.

## v101 — the hologram
Released 2026-09-30. A slanted, tiled red "N biological entities detected" hologram between the
background and the rock (`src/game/render/holo.js`, count: `bioCount`), parallaxing halfway; green and
inverted at zero. The background pushed further back (parallax 0.8 → 0.6).

## v100 — refactor Phases 4–5: type checking, notes next to the code
Released 2026-09-30. `index.html` is the same as v99 apart from the version. Same game.

- **Refactor Phase 4**: TypeScript checking (JSDoc, `tsc --noEmit` in the test run, `src/types.d.ts`),
  every file under `src/` checked. Found, not fixed: Stendari's bomb never lights fires; a vent reuses
  `Prop.on` (REFACTOR.md, Found along the way).
- **Refactor Phase 5**: notes moved next to the code (a README per `src/` folder), this changelog,
  CLAUDE.md slimmed. Same game.

## v99 — refactor Phase 3: Game taken apart
`Game` split into `src/game/systems/`, `src/game/render/`, `src/game/creatures/` (the world object `W`,
the context `G`, step's and draw's frame objects, `ACTS`); Game.js 186 lines. The owner's Dev report
became the new defaults (zoom 1.6, torch 0.5, aggro 0.6, Black Hole pull 65 / speed 50, sound levels,
the spider/jelly/rat/fire ranges), so v99 plays a little differently from v98 on purpose. Owner:
"plays great".

## v98 — refactor Phase 2
The UI in `src/ui/`, `Game` in `src/game/Game.js`. Same game.

## v97 — refactor Phases 0–1
`index.html` is built from `src/` by esbuild; the pure code split into modules; the undefined-name
check; dev `package.json`. Same game as v96.

## v96 — every other spell after Noita
All but Black Hole (the owner likes it) got their Noita twin's look and flight: Magic Missile is a
rocket (speed 140, accel 2.6, vmax 780), Blast a bomb on a 1.8s fuse that rolls and rests, rubber
ball, accelerating lances, tumbling cross, skipping saw; new shot fields `vmax`, `lifeBoom`, spell
`accel`; holes where they hit; fire from Explosion/Nuke (`boom` is `fire: 1, embers: 6`); field looks
(`drawFieldLook`); Stillness and the Thundercloud's rain put fire out (`fireDouse`). Old tests using
Slug as "the straight shot" now use Glowing Lance.

## v95 — tier-1 spells after Noita, drips knob, rats on the ground
Bolt, Spark, Buckshot, Spitter, Bubble Spark, Magic Arrow, Digging Bolt, Small Teleport Bolt, Pollen's
look, Brimstone's fire: own sprite, trail, glow and flight (new `blankShot` fields `drag`, `bounceE`,
`pit`, `wig`, `look`, `light`/`lightR`; all mirrored in `tracePath`). Dev → Sound "Drips & trickles"
(`vDrip`). Rats need footing to run a path (they jump or fall, webs still count as ground) and roaming
rats spread out (`raSpread`). Real-floor probe: ~14/16 carriers home in 15s.

## v94 — rarity gate
`TIER_FLOOR`: tier-4 spells (Black Hole, Glitter, Storm, Saw Storm) can't drop before floor 4 (owner
saw a Black Hole in the floor-1 shop).

## v93 — nest burrows are real tunnels
Open holes hidden only by the fog (`nestFog`) until you dig a sightline in; no more rock paint over
them (v88–v92 painted it and gated drawing on `burrowShut`). Carried gold drawn at ground-coin size.

## v92 — rats have 1 health
Any hit kills one, on any floor.

## v91 — the death replay loops
On by default, with a Loop toggle (`.wloop`) beside Fog.

## v90 — death replay, "WITNESS YOURSELF"
A button on the death screen replays the 10s before the death and 3s after through the real renderer:
scrub bar (red tick = death), play/pause, .25/.5/1/2×, fog toggle, drag to pan, pinch/wheel zoom,
Follow, Close. Only a box round you is recorded (~0.1ms a sample, ~8MB for 13s). Talked about next:
saving replays, a "killed by …" caption.

## v89 — rats find their way; the R prompt
Rats pathfind (`navField`/`navWay`, path mode), holes are solid to walk over (`ratSolid`), safety nets
for the rare wedge (~95–100% of carriers home within 20s, was ~65%). The Buy/Take text became a thin
white circle with an R (`RKey`, owner's design).

## v88 — rats, nests, lanterns, split rooms
Nests (a mound, a winding tunnel, a hidden room) through floor 1's built-up zones and a few natural
ones. Rats bite, knock gold out of you and fetch loose gold home (triple bite when you're broke; a dead
nest drops 60 + its stash). Wall and hanging lanterns in built-up zones pop into burning oil when shot.
Heart and perk rooms in different zone types (coin toss). Route fix: a BFS link when the spine alone
can't reach the top (seed 7).

## v87 — zoned floor 1, arched vines
Floor 1 mixes the natural cave with v85's layered one (Dev → Level layout: zone size, share,
raggedness); jellies keep to the natural zones. Long leafy vines arch between ceiling spots, with
strands; hang, climb along, push down to drop; they burn.

## v86 — fire
Grass, moss, vines, mycelium and timber burn and spread pixel by pixel until the fuel's gone. Lit by
fire spells, explosions (sometimes), minecarts, vents, Levitation Trail (and meant to be Stendari: see
Unreleased). Creatures and you catch fire; puddles, snow, ice, slime put you out. Doesn't reveal fog.
Dev → Fire.

## v85 — floor 1 is a layered cave
`strataCave` (like Noita's Mines: layers, corridors, holes, two vaults for the hidden rooms, old
paved workings) and timber that really holds the roof up (`timberFrame`; fixed floor 2's hovering
beams). Dev → Level layout (floor 1), Dev → New cave. The owner found "3x" timber far too dense.

## v84 — jelly spores and plant glow
Jellies puff glowing spores from the rim on every push; green vegetation near a jelly glows and
twinkles in its colour (the owner's comp: green key → levels → radial ramp → twinkle → × colour → add).

## v83 — jelly preview and master sliders
A live jellyfish box above Dev → Jellyfish colours, and master hue / saturation / brightness sliders.

## v82 — jelly stings, colour knobs
Tentacles sting on touch (even when it hasn't noticed you). A colour A and B for each of 14 parts, each
jelly a blend (`colourKnobs`, usable by any creature).

## v81 — the jellyfish
Myrkkymeduusa replaces Heikkohiisi on floors 1–2: pulse-and-glide swimming with a turn limit, a bell
thin when fast and flat at rest, trailing tentacles, green glow, dripping spit that splats. ~36 Dev
knobs, all ranges. The shared creature pieces became modules (`rangeKnobs`, `kr`/`kru`, `roamStep`,
`turnToward`, `flyMove`, `kp`, `HUNTERS`, goo shots).

## v80 — Noita spawn table and more
Mod drops follow Noita's spawn table (`NOITA_SPAWN`, `NOITA_OF`); Teleport Bolt and Small Teleport
Bolt; Vacuum Field warps everything in reach to its middle; gold seams in the rock drop gold when dug;
never-held ground guns glow; map marks (loot dots, found rooms, X when taken, 80% see-through);
minecart blast ×1.75 (105).

## v79 — grab bars
Down the side of the slot grid and the mod bag (tap to jump, drag); a swipe on an empty slot scrolls.

## v78 — webs are vines; spider knobs are ranges
Web lines latch, hang, climb along, push down to let go, and slow you ×0.8 per line; every spider Dev
control became a min/max range rolled fresh at each use (owner's rule).

## v77 — spiders no longer freeze
A spider that reached its goal with both clocks run out sat still for good (~40% of floor-1 spiders).

## v76 — the spider rebuilt
Hämähäkki crawls rock and its own web lines in darting bursts, shoots lines across gaps (they stay),
bites up close, strings you from range (×0.8 speed a string, snaps when pulled too far). ~23 Dev knobs.

## v75 — see-through controls
Thin rings, fuel a ring inside health (the `.jetzone` fill gone), gun buttons on an arc round the right
stick, bag + map buttons, gold under the sticks (`bottom:5%`), no fills; the corner minimap became a
full-screen map toggle that pauses.

## v74 — Pollen nerf
Drags to a stop and floats up, homes only on a creature within 80, pops a small blast instead of eating
rock.

## v73 — bag fire preview
Slots light at the gun's real firing pace (trigger held); live cast delay / recharge / mana bars. Dev
key `bagAnim` renamed `bagSpeed`.

## v72 — advisor tips parked
Swap suggestions hidden (`SHOW_TIPS = false`; restore `advice.test.js`'s tip checks from v71 when
un-parking); the dmg/s line stays; the bag gets the space.

## v71 — bag screen rebuilt
Stats list (red→green quality, +/- from mods), 2×2 gun buttons with pictures, a fixed slot grid with a
per-pull firing light, scrolling mod bag. The per-pull outlines and family legend went
(`bulletgfx.test.js` dropped); `castGroups` allows 64 pulls (was 16).

## v70 — drips and gun ranges
Drips fall on their own random clocks (`pr.dn`/`pr.di`), quieter (about 1/3 and 1/2). Gun stat ranges
widened by the owner: 2–25 slots, 1.5–0.01s delay and recharge, 50–1000 mana, 10–500 regen, 20–0
spread, 0.5–2 speed.

## v69 — gun levels
Level 1–10 from the floor only (no cave height; `gunTier`/`FLOOR_TIER` gone); level 1 anywhere in the
range, level 10 near-perfect; ~20% of cave guns rare (higher level); guns coloured by level, `Lv N`.

## v68 — dev and tweaks
Minecart blast ×2 (60, was 30); Enemy Radar marker red (the perk's tint, not `COL.enemy` purple); Dev →
Spawn gun; the Trajectory Sight line fades in with the right stick's push.

## v67 — jetpack cough, per-sound volume, live update check
Near empty the jet cuts out in short random bursts (Dev "Jet sputter drop"); jet pitch climbs over 3s
held; a volume knob per kind of sound. The Android shell checks for updates on resume and every 2 min
(needs the new APK once).

## v66 — sound pass 2
Portals, footsteps and landings by surface, prop breaks by material, vents, mushrooms, tendrils,
stones, eyes, dark matter, drips/lava/steam/sparks, crits, chain hops, splits, util spells, enemy shot
fizzle/absorb, recharge-ready click, gun switch, UI sounds. All via `SFX.fx`, randomised per play.

## v65 — rustles and bangs
Plants rustle on grab and when moving through (rate-limited); minecarts bang with debris; pods pop;
explosions randomised.

## v64 — procedural sound
Web Audio, no files: themed spell voices bent by the shot's stats, creature voices by body, per-theme
ambience, jetpack and Black Hole loops, UI sounds, positional pan/falloff; Dev → Sound.

## v63 — autosave
The run saves every 2s and on backgrounding; reopening resumes the floor (the same cave on the same
version, a fresh one after an update; gear kept). Death/Restart wipe it.

## v62 — lightning looks like lightning
A jagged flickering bolt that forks side arcs at nearby creatures and rock.

## v61 — torches no longer clear fog
v59's fog clearing round torches gave away the prize rooms; torches and lanterns now show by the same
rule as items (`fogLit`).

## v60 — Noita-style triggers
Trigger/timer/expiration are variants of existing spells plus Add Trigger/Timer/Expiration; payloads
are isolated mini-casts that can nest. Greek letters switched off (`off: 1`); Summon Platform and
Summon Wall removed.

## v59 — denser decoration
3× decoration, vine clumps and 14 overgrown groves per green floor; torch flame leans ~2.5× more; owner
Dev settings made defaults (zoom 1.35, aggro 0.8, BH pull 50, BH speed 65); Dev panel in collapsible
groups; wall torches cleared fog round themselves (reverted in v61).

## v58 — level decoration
Five decorations per theme (60, `DECOR`): baked pixels (moss, rubble, beams, pillars, gears, ribs,
cracks, soot) and working props (vines/chains/roots to hang on, falling icicles and geodes, explosive
minecarts, spikes, vents, mushrooms, spore pods, slow/slick/hurting zones, noisy skulls and stones,
cover, dark matter, tendrils, lanterns, eyes). Props drop when their rock goes. Theme ambience
particles. Snow "cushions falls" not built (no fall damage).

## v57 — Black Hole knobs
Dig radius = the drawn core (`eat: 19`); Dev knobs for its pull range and speed; the Dev panel's copy
button for pasting settings back to Claude.

## v56 — Black Hole rework and visuals
Black Hole hauls creatures in, rolls on through them grinding, swallows enemy shots; purple haze,
starry core, mote trail. Portal motes; the hand torch flame drags as you move, with a halo and a second
light; wall torches by portals and prizes; background parallax (0.8) and shadow blotches.

## v55 — gun-stat rings and "+" crosshair
Three rings on the right stick (mana, recharge, cast delay), bag stats colour-matched (`GAUGE_COL`);
the crosshair a thin `+` with its centre cut out.

## v54 — Matter Eater fix, softer fog, aim crosshair
`eat` bullets tunnel through rock instead of dying on it; the fog edge dilated one cell and blurred;
a small crosshair dot `DEV.aimDist` (44) out.

## v53 — Buzzsaw reliability
It only dug when its centre was in rock ("cuts every tenth try"); now `eat: 14` digs its radius every
frame. Closer (`reach: 5`, was 10) and no white circle (`hidden: 1`).

## v52 — accurate minimap
Outlines sampled from the real rock in 4px blocks (`miniEdgeIdx`), smoothed; a yellow dot for you.

## v51 — Buzzsaw melee slice
Buzzsaw a melee cutter (`speed: 0`, `size: 15`, `bore: 12`), its recharge back to default
(`rech: -0.17`; v50's `rechMul: 0.33` gone), Pick Axe recharge 1.0; starters back to Scratch Pistol
first, Pick Axe second.

## v50 — big batch
Pick Axe starter holding Buzzsaw; a weak Scratch Pistol; the aim line became the Trajectory Sight perk
(31 perks); sticky aggro with `DEV.loseAggro` (2); a bottom-left minimap; mods taken with a tap (the
ModFound overlay gone), guns keep the GunSwap chooser (owner's call); death restarts on a right-stick
tap; health ring green→amber→red; the Mods button became Bag (always opens, editing gated); shop
plinths reach the floor.

## v49 — aggro distance knob
`DEV.aggro` (then default 1): a multiplier on chasers' and bombers' aggro reach.

## v48 — gold nudged up
Just under the stick tops (`top:5%`).

## v47 — gold in the deck
Off the canvas into a DOM readout between the sticks; `fmtGold` (`1234` → `1.2kg`).

## v46 — HUD onto the thumbsticks
The top-left stack (floor, enemies, bars, gun name) gone: health ring round the left stick, mana ring
round the right, fuel a wipe in the left stick; the floor number on the shop's back wall; Restart into
the Dev panel; the Dev button a bare ⚙️.

## v45 — panel stats capped
The pickup panel's stat list caps at ~3 rows (60px) and scrolls.

## v44 — line-of-sight aggro, dotted ring
Scrollable panel stats; chasers need a sightline to aggro; the right stick's trigger ring dotted; the
dashed `.throw` ring removed.

## v43 — pickup panel floats above the item
Half width, bottom edge just above the plinth (`promptBottom`).

## v42 — one pickup panel
Card and buy line in one `.buypanel`; bolder knobs (white rings, black fill); aggro and firing reach
scale with `1/DEV.zoom`.

## v41 — the Dev panel
Live, saved tweak knobs (zoom, torch fall-off, fog darkness, outside-torchlight darkness, move speed)
and the All mods toggle; pauses but keeps drawing. Deliberately not in the README (a dev tool).

## v40 — fog of war back
v38's lamp was a blanket gradient that lit the whole cave on a phone ("fog missing"); the lamp is now
masked by the fog. `SIGHT` (200) is both the reveal radius and the lit bubble.

## v39 — perks and hidden rooms
30 Noita-style perks, one per hidden perk room; a second room holds a +25 max-health heart (raises the
cap, no heal); perk icons above the sticks; cave loot rests on the ground.
