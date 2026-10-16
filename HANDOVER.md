# HANDOVER — CaveRunner

Where things stand, for a fresh session. Read `CLAUDE.md` first (the owner's working style, the
release loop, testing), then the README of the `src/` folder you're working in.

## BRANCH `grem` (2026-10-16): CaveRunner Grem — Grem Mode only (the owner's focus)

**Start here (fresh session on `grem`):** **v2.0.2 is pushed to `grem`** (2026-10-17, owner OK'd the shots: step 2, burnable coal + smouldering seams; v2.0.1 step 1; APK at `app-grem` built, but **Pages refuses `grem`**: "Branch grem is not allowed to deploy to github-pages due to environment protection rules" — every `grem` push so far; v2.0.0 went live only through a `main` push, whose run builds `grem/` too. **Waiting on the owner** to add `grem` in Settings → Environments → github-pages → Deployment branches, then re-run the latest `grem` run or push again): Coal Seams build step 1
(its own zones; Mossy's plants off, the old mine set on; CHANGELOG v2.0.1; art/README's Coal Seams note). Live check once Pages allows it:
`/CaveRunner/grem/version.txt` = `2000002 v2.0.2`. Step 2 (v2.0.2): coal seams (`TM.COAL`, art/README's Coal note), catch rate 0.2 × timber (the doc's 0.8 was far too fast; told
the owner). **Next:** minecart rails (idea 1) and coal piles/chutes (10), gas pockets (3) later; then the Cavern dressing, Bats (owner's boids spec), Glow worms (inchworm gait spec). Each step: phone screenshots
(`node tools/coalshots.js`, Grem started at level 2) → owner OK → bump, docs, push `grem`.
The plan is the Claude Doc: read it with the docs tools (doc id `62f545c8-940a-4833-9ba9-ff20db771da5`, tab body node
`64396f1a-182a`; last write rev 23) — never web-fetch it. Every open question is decided (its Decisions section, owner
2026-10-16): ideas 1, 2, 3, 10 picked; spider webs stay; burnt coal → open; ladders background, stalactites solid; bats harmless
(Dev bite 0), glow worms ≈ spider health/strike, their blast hurts the team at half (Dev); Digging zone = `winding`, Cavern =
`spider`; only light: lanterns and glow worms. Its HTML review copy https://claude.ai/artifact/BZCnJDP93NEcB1fd99JPXM (republish
when the doc changes; `read` it first in a new session). Known failing before this: logic `auto-zonelab`.

Forked from `autobattler` at v1.0.109 (owner: "git branch a Grem Mode only version and just work on that, so we can properly
archive out the regular mode legacy content and bloated dev menu"). **v2.0.0** is the fork. `autobattler` and `main` keep
everything; nothing there changed except the shared CI file.

- **Its own app and address:** package `com.caverunner.grem` ("CaveRunner Grem", `android/app/build.gradle` `-PcaveGrem=true`),
  APK at release `app-grem`, updates from `https://5rob.github.io/CaveRunner/grem/`. `.github/workflows/android.yml` deploys all
  three builds (root, `auto/`, `grem/`) on any push: **keep it identical on main, autobattler and grem**. The `github-pages`
  environment must allow `grem` (Settings → Environments → github-pages → Deployment branches) — if the first deploy fails
  there, the owner adds it.
- **The title (owner, after the fork):** under CAVE RUNNER, AUTO (silver blocks, glitching) and GREM MODE (green, slanted, swelling letters, goo drips, spores, glow): `art/gremtitle.js`, laid out by `ui/title.js` (GREM_TOP, BOTTOM). Shots: `tools/gremshots.js` grem-a-title.
- **What was cut:** the title's ▶ opens Grem (no GREM MODE button, no Auto run); the Auto play screen (`ui/auto/AutoScreen.js`;
  the pieces Grem uses moved to `ui/auto/parts.js`: DEV_PAGES, PillStick, GunPanel, ItemIcon, FlyTile); the old game's files
  (Game, its systems and render passes, old creature brains, the old level generator `makeLevel` with tomb / dark zones /
  destruction / nests / veins, shops, minimap, witness, replays, saves, aim assist, guide hologram); and every top-level
  function the build no longer reaches (found by building `src/main.js` with tree shaking and cutting what it drops; 1.63 MB →
  ~1.0 MB page). A few tiny helpers the suites set up with (`newRun`, `addPlayer`, `levelDone`, `meterSum`, …) sit at the
  end of their files under "kept for the test suites".
- **Dev menu:** only what Grem reads. `dev/knobs.js` lost every row and group no remaining code reads (fx, holo flash, guide,
  bag, menu pointer, witness, Level 2's four, carrot, aim assist, Auto economy / hub / maps / blocks / bag / throw; also
  bhSpeed, old elite counts, old fire damage); values still read whose rows lived on cut pages are fixed constants at the
  end of knobs.js. GREM_DEV, DevPanel's `only`, AUTO_KNOBS (`dev/autouse.js`, `tools/autoknobs.js`) and the green/grey
  colour key are gone; the old run buttons and "Copy mod & perk audit" too. Copy Dev settings now lists only knobs the
  panel has (rows + zone check boxes).
- **Tests:** suites for cut code deleted; essentials now version, spells, cast, grem, auto-guns/level/tall/zones/blocked/
  enemies/boss/floors/preview + browser title, grem-tap, grem-dev. Known failures (also on autobattler): `auto-zonelab`,
  `modtable` (3 glyph clashes), `orbweb` ("no orb web strung in view").
- **Folder READMEs** carry a "grem branch" note naming the files cut there; older text may still name them (it describes
  autobattler / main). Many `tools/*shots.js` were written for the Auto screen and may not run here; fix or delete one when
  it's needed (`tools/gremshots.js` works).
- **Next:** Coal Seams, planning only so far (design doc https://claude.ai/code/artifact/62f545c8-940a-4833-9ba9-ff20db771da5,
  HTML review copy https://claude.ai/artifact/BZCnJDP93NEcB1fd99JPXM): its creatures are now Spiders, Bats (the owner's boids
  spec) and Glow worms (inchworm gait, agro, explode) — build on `grem`.

## BRANCH `autobattler` (2026-10-09): the auto-battler pivot — read AUTOBATTLER.md

Planned with the owner (brief + quiz answers + 16 stages + the PM's kick-start prompt, all in `AUTOBATTLER.md`;
mock-up `docs/autobattler-mockup.png`). Progress: AUTOBATTLER.md's Log. `main` keeps the old game.

**Start here (2026-10-16, after v1.0.97):** **the owner's priority going forward is Grem Mode** (their words: "I'm kinda only focused on Grem Mode right now"). **v1.0.109 (released):** Grem's Dev panel only shows Grem's groups (`GREM_DEV` in GremScreen.js: a new Dev group Grem uses goes in that list); creatures renamed to English (CHANGELOG has the old ↔ new names). **Planning now: a design doc per level, starting with Coal Seams** (Claude Doc https://claude.ai/code/artifact/62f545c8-940a-4833-9ba9-ff20db771da5, the living doc: fill it as the owner and you plan, add approved screenshots to its Screenshots section; and its CaveRunner-themed HTML review copy https://claude.ai/artifact/BZCnJDP93NEcB1fd99JPXM, republish it from the doc when the doc changes): planning only, nothing built yet. Open questions are in the doc's last section (which zones "digging zone" and "cavern" mean is asked in a doc comment). **v1.0.108 (released):** after Void Hollow the levels go back to Mossy Caves (`levelFloor`: 1 + (level − 1) mod 12). (The `auto-floors` check "a Hiisi shoots a ball at him" failed ~1 run in 16 since v1.0.97, the player behind rock; the Hiisi is now held beside him: 20/20.) **v1.0.107 (released):** a tapped spot counts as reached within `gremWayDone` (16, was 8). **v1.0.106 (released):** `autoCtlWait` 3 → 1 s (the stick let go: back to the autopilot after 1 s). **v1.0.105 (released):** a tapped target sends the whole team after it (`level.js pickChase`: autopilot goals short of it, through rock). **v1.0.104 (released with v1.0.103, owner OK'd):** Grem bosses slide in on screen every level (`levelOnward` resets `L.introDone`), the Disc drawn × `DISC_K` 2. **v1.0.103:** boss under the ground fixed (`enemies.js unbury`), a tapped target off the view loses the lock, no wait at a tapped spot, the elites' glow and flames (`stepEliteFx`), the level's name under its number in Grem. **v1.0.102 (released):** a tapped spot is the autopilot's own goal (`r.goal`, titlescene.js goalStep/goalAim; the view centres it: level.js roamStep); he goes round or saws through rock to it, holds it `autoCtlWait` s, plays on. **v1.0.101 (released, owner OK'd; the tap moves the picked player only, the owner kept that):** Grem taps: empty cave → the picked player heads there (`levelWaypoint`, ring marker), then the idle wait, then autopilot; a chest opens at a tap on it from anywhere (`chestAt`); gun names under the unlock row's pictures. **v1.0.100 (released, owner asked):** creatures keep `autoFoeKeep` (16) units off each player in a level (a close rat was inside the gun's tip: titlescene.js keepOff / biteReach); Grem Mode gets the Dev panel (⏸ held 5 s, then ⚙️). **v1.0.99 (released, owner asked):** Grem's gun row has no scroll bar on a PC browser; the mouse wheel scrolls it sideways. **v1.0.98 (Grem: the next old floor each level cleared, the seam blended past the arena; CHANGELOG):** screenshots `node tools/gremseamshots.js` ; released, owner OK'd. Nothing waiting. v1.0.97 is out (owner OK'd). v1.0.97: levels 2+ play as the old game's themed floors 2..12 in turn (palette, ambience, creature roster as before main's custom Level 2), level 1 untouched; the old shooters / turrets / chasers / bombers ported into the level scene (`art/titlescene.js classicAct`), softened by Dev knobs `autoOldDmg` 0.4 / `autoOldCd` 1.5 (CHANGELOG v1.0.97; `auto/maps.js levelLook`). The owner plans to improve these levels and creatures later; balance past level 3 with starter guns is steep (tier scaling on top). Known failing before this, not from it: logic `auto-zonelab` (6 checks: likely the v1.0.95 defaults) and `slots` ("pace differs"). Before that, every release up to v1.0.96 is out and OK'd. Latest: **music** (v1.0.96: `audio/songs.js` holds six tracks that cycle one per level cleared and Colossus for every boss fight; `musicPick` in `ui/titlesound.js` picks; `node tools/musicwav.js <id>|all` renders mp3s for the owner to hear, slow: ~10 min a track, run them in parallel; rules in `src/audio/README.md`). **Copy Dev settings** is complete since v1.0.94 (`auto/devcopy.js`: every DEV key, the gun presets and Grem kit as JSON; built-in defaults `save/presetdefaults.js`, `auto/grem.js GREM_KIT_DEFAULT`; dev/README says how each line maps back; CLAUDE.md: it must stay complete); v1.0.95 applied the owner's first copy. Before that: **Grem Mode** (the title's GREM MODE, a toddler mode): rules in `src/auto/grem.js` and the `L.grem` branches of `auto/level.js` / `enemies.js` / `chests.js` / `game/render/leveldraw.js` / `titledraw.js`; the screen `src/ui/auto/GremScreen.js`; Dev → Grem (`ui/auto/gremkit.js`) and Dev → Presets (`ui/auto/presetlib.js`, the guns Grem unlocks); screenshots `node tools/gremshots.js`; suites `grem`, `devcopy` (logic), `auto-presets` and `volume-lock` (browser). The owner sends rounds of short notes; each look change goes to them as screenshots first (music as mp3s), then a release (a push to `autobattler`). Where the paragraphs below disagree, the newer version wins: v1.0.85's guesses (new unlocks auto-equip, players join by level, NEW badges, preset prices on the Presets page) were all replaced by v1.0.90–92; the v1.0.78 / v1.0.75 "Next" notes (zone notes, perks stage) are older open threads the owner hasn't returned to.

**Where it stands (2026-10-16, v1.0.93 live at /auto/; v1.0.93: hold a volume slider 4 s to lock / unlock the volumes; v1.0.92: Grem round 3 (name tags, no auto-equip, boss entrance + bar, GO!, teleport-in, scaled damage, gold wait, random gun order); v1.0.91: Grem chests twice the size with a pulsing green light; v1.0.90: Grem Mode gentler (no damage, quarter climb, double gold, no A/B, tap opens chests, centred stick, dark 15% brighter, players among the unlocks); v1.0.89: Dev → Presets drags and gun look; v1.0.88: a White Hole with several Discriminates pulls all their targets; v1.0.87: the gun panel's 💾 at the firing window's top right; v1.0.86: a buffed / Enlarged White Hole keeps its core size; v1.0.85: Grem Mode (the title's GREM MODE), Dev → Presets and Dev → Grem, White Hole + Follow Me fixed; v1.0.84: three mana mods (Recharge Battery, Mana Spring, Mana Burst); v1.0.83: Switch takes single mods, Discriminates add up, the grown mod row puts the gun panel at the top; v1.0.82: Follow Me + Discriminate on a player makes a field follow that player; v1.0.81: the Dev mod grid scrolls (it sat outside the panel's scrolling body); v1.0.80: the nuke's mushroom cloud, the level ends in one nuke under the exit pad, webs strung off screen and their hub swinging when a spoke goes, players join in the hub through the teleporter, the Switch's pairing in the pull flashing (CHANGELOG); v1.0.79: the gun window's DPS graph keeps its history over gun changes, Dev performance graphs bottom right of the play area (tap to hide), the level map outlines the view (CHANGELOG); v1.0.78: Dev → Zones (zone preview, can-have boxes, sliders, notes; CHANGELOG); v1.0.77: orb webs break apart when cut, burnt or their rock goes (CHANGELOG); v1.0.76: just orb webs in a level's webs and spider zones, large ones too (CHANGELOG); v1.0.75: the owner's 7 notes and the spider zone (CHANGELOG); v1.0.74: the owner's 23-note play round (CHANGELOG; boss → exit, head pops, pads one at a time, Borer, roam heights, bag drag rows/groups/insert, Dev mod grid); v1.0.73: Recoil and Recoil Damper red (Damage); v1.0.72: Double / Triple / Quad Switch mods; v1.0.71: Discriminate (hold the tile: a target popup; shots and White Holes touch only it); v1.0.70: trajectory mods part B (homing, seeker, short-range, auto-aim, gravity, anti-gravity, horizontal); v1.0.69: trajectory mods part A (orbit, spiral, boomerang, ping-pong; auto/traj.js) and the Dev Edit button on mod cards (ui/trajedit.js); v1.0.68: the owner's Dev report as defaults (levels 2 min at pace 2, slower vine fire, `autoZoneOpen` 0); v1.0.67: the gun preview runs the level's own scene (auto/preview.js; hologram target, double tap grows it, floor regrows), Follow Me on every shot, burning vines and webs bright with their own light; v1.0.66: Circle of Vigour heals in Auto, with Follow Me it follows its caster; v1.0.65: Questions Later fires with nothing in sight in a level; v1.0.64: Dev buttons +1 red / +1 green crystal into the bag; v1.0.63: burnt-off vine and silk pieces fall as loose ropes (owner OK'd); v1.0.62: the fire sim's window twice as tall and sticky at the top (the Fire sim tab scrolls as one, `fsmode`), burnables 10% in from each spot's sides (`LAB_IN`); v1.0.61: silk's own fire knobs and smoke (`firesilk`), the fire sim keeps everything when panned back, web ends on the floor no longer hang into rock; v1.0.60: Dev controls for the fire's flame specks and smoke (group `firefx`, gradients on the panel's editors); v1.0.59: players' aim reaches the roof (`autoAimR` 400), no shots in the right-hand strip (`autoAimEdge`) or past it, a hail mary off the left (`autoAimLeft`), `titleAimPick`; v1.0.58: burning pixels twinkle (`crackle.js` `fireTone`; the old hash barely changed), the fire sim in five separate test spots (`LAB_SPOTS`) with flame jets while Fire is held (`labStep`, `titleJet`); v1.0.57: the Dev panel colours knobs by whether Auto reads them (green / amber group / grey; `src/dev/autouse.js` generated each build by `tools/autoknobs.js`), burning vines and webs burn through and drop the rest, turning (`autoBurnCut`, `autoBurnSpin`); v1.0.56: Dev → Fire sim page (a long test room of things that burn, `art/firelab.js` + `ui/firesim.js`; every fire knob under it, moved off World and Auto), leaves burn and light fuel near them (`autoLeafReach`/`autoLeafLight`), new knobs `autoFireSpread`/`autoWebFire`/`autoVineCatch`; going-round fixed (no team fuel wait, no nudge-climbing); `auto-steer` flakier lately (2/5): watch; v1.0.55: vines burn all along in three states (unburnt, burning, charred `p.ch`/`autoVineAsh`), the climb ×2 with noise (`autoVineSpread` 24, `autoVineJitter`); the autopilot goes over/under gentle rock before sawing (`navAround`/`rockNormal`, `autoNavCut` 0.8, `autoNavGive` 1.2) — the exit pad's ground survives; no spawns once the arena is in sight (`levelSpawn`); v1.0.54: the blasts' hard line rises to just under the exit pad (`levelHardY`); v1.0.53: fire climbs vines and silk ahead of the burn (`p.lit`, `autoVineSpread`) and jumps sideways (`autoFireJump/P`); creatures scale steeper (`autoFoe`: health × `autoTierHp` 1.45 a level, compounding; the owner's level 10 team one-shot the boss); v1.0.52: blasts bite less toward a level's bottom edge (`deepK`, knobs `autoHardDeep`/`autoHardEdge`); v1.0.51: the caves' shapes follow the curving zones (`autoZoneOpen` 1, `zoneOpenAt`, `titleRoof`), props too, vines burn 3× (`autoVineFire` 3); v1.0.50: levels twice as tall with a following camera, zones curving by noise (looks; shapes still by x: `autoZoneOpen` stalls the autopilot, to fix), vines burn faster (`autoVineFire`); v1.0.49: the bag grows, 3 empty rows past its last item, up to 100 rows (`bagFit`); v1.0.48: the camera stays on the players after the grown play area (a scene is made at the normal height); v1.0.47: double tap the play area grows it over the nav and bag (B or again: back; the scene keeps its height, owner to say whether to fill it); v1.0.46: double tap an empty bag slot grows the bag over the play area (B or again: back); v1.0.45: the A gold stream steps up to medium then big, doubling nuggets (`hubOwed`); v1.0.44: maps with their own levels (the end teleporter +1, a wipe back to 1), the map machine in the hub (1,000,000G unlocks the next map), creature health bars, top bar with map, level and journey box (`auto/maps.js`); v1.0.43: guns drag out of the Guns row into the bag (`gunToBag`); v1.0.42: manual mode holds 3 s after the stick rests (`autoCtlWait`); v1.0.41: the steered player hangs on vines and web lines (old mechanics; autopilot never grabs); v1.0.40: shot looks part 2, Black Hole pulls, White Hole cast; v1.0.39: shot looks part 1 (13 shots, missile homing, fire spray); v1.0.35: the item audit part 1 — bins, triggers common, Wand Refresh and Glass Cannon fixed, colour sweep; v1.0.36: pickups as bag tiles flying into the bag; v1.0.37: Shield, Pinpointer, Ghost; v1.0.38: jetpack fuel, the old cough, the meter on the jetpack, health rings round the helmets) (other perks still do nothing in Auto: only max health, Glass Cannon's damage and these three): all stages 0–14 built; feedback rounds 1 and 2 released.**

**v1.0.78 (released 2026-10-14, owner OK'd):** Dev → Zones (CHANGELOG): a zone preview window (whole zone / close up), per-zone "can have" boxes for heavy vegetation and spider web filled, a notes box per zone and variant, Copy zone notes; and (the owner's next ask) a Tweak button per row with that zone's layout / looks sliders (`zl_*`). Next: the owner reviews zones on the phone and pastes Copy zone notes: changed boxes = new `zv_*` defaults, changed sliders = new `zl_*` defaults (dev/knobs.js), notes = a round of zone changes. The owner's pasted zone notes are a round of zone changes (boxes changed = new `zv_*` defaults in dev/knobs.js).

**v1.0.75 (released 2026-10-14):** the owner's 7 notes (post-boss run to the exit, pace by level, group layout + green outlines, bag gun view, mod grid grab zones, no trigger variants in it) and the spider zone + orb webs + spider mines (CHANGELOG v1.0.75). Owner OK'd the screenshots (tools/roundshots.js, tools/spidershots.js). Not built yet: dropping mods from the bag onto the bag gun view; orb webs may want to be bigger or brighter (knobs "Auto: orb webs"). `auto-steer` failed 2 of 4 runs this round (its known flake; level 5's mine is now a spider mine: the suite turns `autoSpiderMine` off).

**v1.0.93 — Volume lock: RELEASED 2026-10-16 (owner OK'd)** (shot tests/build/autoshots/volume-locked.png from `node tests/run.js volume-lock`): a press held 4 s still on any volume slider locks / unlocks all three (ui/volume.js, `caverunner-vol-lock`; dimmed + 🔒; the press changes no volume). Works wherever the volumes show (pause menu, title settings). Nothing waiting.

**v1.0.92 — Grem round 3: RELEASED 2026-10-16 (owner OK'd)** (`node tools/gremshots.js`: grem-f-go, g-join, b-play, h-boss-title, h-boss-fight, e-kit). Name tags (Dev → Grem, kit `names`, drawn in GremScreen's over), no auto-equip (a joining player still comes with one of the open guns: say so), NEW badge → a glow pulsing behind till used, the boss made off screen and eased in under its name in red (enemies.js bossIntro, level.js levelTitle, cleared.js clearedText lines/red; `gremBossT`), boss bar (`.gboss`), joiners teleport in with the start pad's charge on them (addrunner hides, level.js joinStep/teleFx, leveldraw.js), GO! (`gremGoT`), gun damage × the creatures' health growth (`gremDmgScale`, S.dmgMul in hitFoe), gold bounces `gremGoldWait` 0.6 s before it flies (S.coinWait), ⏸ twice the size, the guns in a random order each run (gremUnlocks rnd; Presets page no longer shows prices). Nothing waiting.

**v1.0.91 — Grem chests: RELEASED 2026-10-16 (owner OK'd)** (shots grem-c-chest, grem-c-chest-close from `node tools/gremshots.js`): Grem's chests × `gremChestSize` (2) and a green light pulsing behind each shut one (`gremChestGlow` 1; leveldraw.js chestK / chestAt, levelGlow redraws the chest over it). Nothing waiting.

**v1.0.90 — Grem Mode round: RELEASED 2026-10-15 (owner OK'd the screenshots)** (`node tools/gremshots.js`: grem-b-play, b-dark85, b-dark1, c-chest, c-chest-open). No player damage (enemies.js levelHurt), the creatures and pace climb a quarter as fast (`gremHard` 0.25: grem.js gremHardTier, enemies.js gremFoe, keeps the level's gold), gold drops × `gremGold` 2, no A / B (a tap on the play area opens a chest in reach: hint "Tap to open.", drawHint's noKey), the stick centred at the bottom (helmets 1-2 left of it, 3-4 right), no health rings, the dark × `gremDark` 0.85 (owner: 15% brighter; shot b-dark85), players 2-4 are unlocks spread among the guns (grem.js gremUnlocks/gremOpen/gremGunAt; the gremP2-4 knobs gone). Nothing waiting.

**v1.0.89 — Dev → Presets drags and gun look: RELEASED 2026-10-15 (owner OK'd the screenshots, tests/build/autoshots/presets-*.png from `node tests/run.js auto-presets`):** the ⠿ handle drags a preset to reorder; in the editor drag mods between slots, onto the mod grid to throw away, from the grid (grab circle) onto a slot; 🖼️ picks the gun's sprite. Nothing waiting.

**v1.0.88 — fix: a White Hole with several Discriminates (a creature, then gold, then a green gem) pulled only the first one's kind: RELEASED 2026-10-15 (owner's screenshot).** Nothing waiting.

**v1.0.87 — the gun panel's 💾 (dev mode, save as a preset) moved to the firing window's top right (it covered PER CAST): RELEASED 2026-10-15 (owner asked, no approval needed).** Nothing waiting.

**v1.0.86 — a buffed / Enlarged White Hole keeps its core size, more sparkles over its bigger reach: RELEASED 2026-10-15 (owner OK'd)** (CHANGELOG v1.0.86). Nothing waiting.

**v1.0.85 — Grem Mode, Dev → Presets, Dev → Grem, White Hole + Follow Me fix: RELEASED 2026-10-15 (owner OK'd the screenshots)** (`node tools/gremshots.js`: title button, Grem screen, Presets grid, preset editor, Grem kit). Nothing waiting; the owner may send Grem feedback after playing it. What it is: CHANGELOG v1.0.85. Guesses the owner may retune: prices 100 × 1.5 each (`gremPrice`/`gremGrow`), new unlocks auto-equip player 1, extra players get the newest unlocked guns, a wipe starts Grem over from level 1 (all locked), the Grem run never saves, the kit only on player 1. The owner dropped the bag from Grem mid-build; round 2 (one scrolling gun row, NEW flash, helmets picking the player the guns go to, the full-window preset editor) is in, shots re-sent. The White Hole fix is a logic fix (no approval needed) riding with it.

**v1.0.81–84 (released 2026-10-14/15, owner OK'd; nothing waiting):** v1.0.81 the Dev mod grid scrolls; v1.0.82 Follow Me + Discriminate:Pn follows Pn; v1.0.83 a Switch takes turns between the next n single mods (not groups), several Discriminates add up (`only.or`), a grown gun mod row puts the gun panel at the top and gives the bag the room (`rowLift`); v1.0.84 mana mods Recharge Battery / Mana Spring / Mana Burst (CHANGELOG for the mechanisms). **Mana mod ideas the owner didn't pick yet** (offer them if mana comes up): Mana Leech (hits give mana back), Overflow (free and faster while mana is full), Mana Debt (cast into negative mana, slower refill till paid), Mana Siphon (take mana from a teammate's gun), Mana Shield (damage taken from mana first), Scaling Shot (stronger the fuller the mana), Last Gasp (much stronger near empty mana). Numbers to tune if the owner asks: rechbat -40 max, `MANA_TICK` 8, Mana Burst 30 within 60. The browser suite `title` ("a tap on a player follows them") failed now and then this session: a timing flake, passed alone.

**v1.0.80 (released 2026-10-14, owner OK'd):** the owner's 7-note round: nuke mushroom cloud (autolooks.js drawMushroom, S.mush; knobs autoMushT/autoMushK); the level ends with one nuke under the exit pad (death.js exitNuke, level.js exitStep: L.nukeT/padGone/gatherT; knobs autoExitNukeR/F/Wait; the head pops and autoExitPop*/autoExitRagT gone); orb webs strung off screen (titlescene.js AHEAD_LVL 340, a web that would show is skipped); an orb web's hub swings to a new rest point when a spoke goes (orbweb.js orbHubRest/orbSpring, titlescene.js orbRig/orbSwing); players join in the hub only, through the enter pad (hub.js hubLate, H.at/late/far; AutoScreen.js hubFarFlash); a Switch lights its picked group in the pull flashing (preview.js pvPull, .pulse.skip). Answered: the owner's Switch gun alternated Vigour-with-everything vs the Buzzsaw (a switch takes whole groups). Shots: tools/nukeshots.js, joinshots.js, switchlitshots.js. Nothing waiting.

**v1.0.79 (released 2026-10-14, owner OK'd):** DPS graph history kept (marked at changes, 10 s), Dev-only performance graphs (`auto/fps.js`, `perfDraw`), view outline on the level map. Nothing waiting. On the PC's test browser draw (~15 ms) far outweighs update (~0.5 ms); the owner may now read the phone's numbers and ask for performance work.

**Next session (after v1.0.78):** the same play-and-notes kick-start (AUTOBATTLER.md section 8, "Kick-start for a play-and-notes round", current). Likely first: the owner pastes **Copy zone notes** from Dev → Zones (how to take it: the v1.0.78 paragraph below). The owner hadn't answered whether to start the perks stage next — ask. Zones page facts: `ui/zonesim.js` (README in src/ui), `art/zonelab.js`, knobs `ZONE_KNOBS`/`zv_*` in dev/knobs.js, generation hooks `zk`/`zoneMay`/`titleZoneForce` in art/titlescene.js; suite `auto-zonelab`; shots `node tools/zonesimshots.js [out] [zones]`; the preview's level height is a guess (3/4 of the screen, `levelVh`). Worth knowing from v1.0.74: spider legs by distance is a guess at the owner's note (check with them); roam heights still meet rock above in some caves; the bag group-select has no browser test, edge scroll isn't tested. Worktrees `../cr-bagdrag`, `../cr-base` (leave). **Before (2026-10-13, after v1.0.73):** a fresh kick-start prompt (the text is at the end of AUTOBATTLER.md section 8,
"Kick-start for a play-and-notes round"); the owner plays on the phone and guides the round with notes. **This session (v1.0.63–73):**
falling ropes; Dev +1 red / green crystal buttons; Questions Later and Circle of Vigour work in Auto (Vigour heals, follows with
Follow Me); Follow Me on every shot; the gun preview runs the level's own scene (`auto/preview.js`: hologram target, double tap
grows it, floor regrows); burning vines and webs bright with their own light; the owner's Dev report as defaults (v1.0.68: levels
2 min at pace 2, slower vine fire, `autoZoneOpen` 0); every purple trajectory mod in Auto (`auto/traj.js`) with a Dev-only **Edit**
button on its card (live sliders + Copy: the owner may paste a trajectory report — it becomes defaults like a Dev report);
Discriminate (hold the tile: target popup incl. P1–P4; the White Hole gravity gun); Double / Triple / Quad Switch
(planCast `sw`); Recoil + Damper red. Agents ran in worktrees `../cr-preview`, `../cr-traj`, `../cr-discrim` (merged; leave them).
Worth knowing: Gravity's bolt lands short in the preview (`trGravG`/`trGravLob`); homing ignores a Discriminate target; the
Discriminate popup has no light-mode colours; Orbit reads small at radius 20 (`trOrbR`).
**Open, in order:**
1. **Perks stage (6)** from the item audit (below): every perk left working in Auto with fancy looks, likely two agent stages.
2. Fire leftovers the owner hasn't raised: the old game's `render/cave.js` keeps the still burning-pixel hash (not in this
   branch's build); `titleTumbleLow` / `tumble` (stick pieces) are unused once ropes ship (remove then); fire on the title menu
   is the old look (its own rules, `TITLE_FIRESPEED`).
3. Smaller: the hub doesn't fill the grown play area (dark space under its floor); the LEVEL CLEARED thuds sound at
   `S.top + 30`; mine works' extra tunnels aren't covered by a blocked zone's blockage. Rough edges not yet reported: the view
   doesn't follow a hand-steered player inside the boss arena; after a wipe the camera doesn't move onto the last ragdoll.
The owner may paste a Dev-panel report ("Copy Dev settings", panel via ⏸ held 5 s then ⚙️; green bars = knobs Auto reads): it
becomes the new defaults (`src/dev/knobs.js`). Leftover worktree folders `../cr-*` (all merged; the 8 plain copies and the `cr-*` branches were removed
2026-10-14): the sandbox can't delete them, the owner can (CLAUDE.md: new worktrees go in `.claude/worktrees/`). Known flakes: browser `auto-steer` "stick right…"/"stick left…", logic `auto-wall` seed 5, `slots` spiders, and `auto-roam` "stick left…"
(timing; re-run alone), logic `spider` fails every run (known). Measured 2026-10-14 (4 runs each): `spider` 4/4 failed,
`auto-steer` 2/4, the rest passed; all of them are archived now (not in `tests/essentials.js`). Screenshot tools: `tools/*shots.js` (`firesimshots <out> <spot>
<ms>`, `twinkleshots`, `vinefireshots <out> <spread> <cut>`, `devshots`, …).

**The item audit is back** (owner's notes, 2026-10-11: `docs/auto-item-audit-notes.txt`, each line marked done or which
stage). v1.0.35 did the small part. **Next, one agent stage at a time** (worktree, AUTOBATTLER.md section 8's limits):
~~(1) machine items as bag tiles flying into the bag~~ (done v1.0.36);
~~(2) perks: Shield, Pinpointer, Ghost~~ (done v1.0.37); ~~(3) jetpack fuel~~ (done v1.0.38, plus health rings);
~~(4) shot looks part 1~~ (done v1.0.39); ~~(5) part 2 + Black Hole pull + White Hole~~ (done v1.0.40); **next: (6)** perks: every perk left (not `off`) working in Auto with fancy looks (owner; Carrot scrapped), likely two stages. Shots tool: `tools/shotlookshots.js` (close-up sheets cut from the canvas).
Each with screenshots for the owner's OK before release.

**Was waiting on the owner: the item audit** (`docs/auto-item-audit.txt` and the page `docs/auto-item-audit.html`, published at https://claude.ai/artifact/Mh3LkWFHfS2VhKs9R5d4zX: notes and a bin per item, "Copy all edited module notes" gives their edits as text; both made by `node tools/itemaudit.js docs/auto-item-audit.txt docs/auto-item-audit.html` from `tools/itemaudit.html`): every mod, perk and exo mod, works now / could / wouldn't. Most perks do nothing in Auto yet (only max health); the owner will send notes for an overhaul (likely an agent-sized stage: perk effects + a unique look on the player for each, Permanent Shield first: a light-blue radial glow brighter outside, flashing off on a hit, back when ready). Bug round 2 (v1.0.34): manual mode semi-automatic (steered only while the stick is pushed; `ctlOn`), the crosshair on
the picked helmet, slow frames stepped in pieces (`scenecanvas.js`: the owner felt manual slower than the hub; waiting
on the owner to say if it's fixed), followers trail by travel direction (the known rough edge, fixed). Bug round 1 (v1.0.33): a hand-steered player's saw follows the stick (`ctlDig`), no jet-over or snap back for him; stick
down saws down; the stick is a circle at the bar's left end (B, A right of it; `.astick`, one outline with the bar; shots
`tools/stickshots.js`). Round 2h (v1.0.32): machine items drawn in front of the hub wall again (pop out, bounce, picked up by walking over after
`autoPickMin` 1 s within `autoPickReach`); one hand-steered speed `autoMoveK` 0.55 (walk, jet, pushes, sink; hub and
steering); the Dev panel on the auto screen. Round 2g (v1.0.31): a gentler jetpack. Round 2f (v1.0.30):
B hides the nav, one fixed camera, hold a helmet in a level for manual mode (scroll stops, damped follow, team behind), jet thrust
by the stick's height (open: no follow inside the arena; followers may trail the wrong side backing up). Round 2e (v1.0.29):
the jet flame away from travel (hub and level), full gold stream at twice the drag. Round 2d (v1.0.28):
steering rechecked (helmet pick, B lets go), the old jetpack flame and smoke, the old ragdoll and the teleport home after a wipe
(open: the camera doesn't move onto the last ragdoll by itself). Round 2c (v1.0.27):
the pull lighting on the mod slots (fixed), a wider grab, stats span "all", graphs pinned above the player row. Round 2b (v1.0.26):
the hub is the old shop's room (spacing 120, the old wall/roof/floor/sign/dust, the gem demo; exit sign INCINERATOR "(for real)");
in a level a tapped player is steered by the stick, B lets go. Round 2a (v1.0.25): the nav as a rising stack, hold a gun to
equip, the gun panel over the mod slots, pay with A. Waiting on the owner: try it on the phone. Noted by the agent: the hub's
camera shows ~250 units across vs the old ~214 (things a little smaller). Round 1
(v1.0.24: the level no longer restarts on a resize, e.g. the app switcher; guns face left in the hub; machine items
land before the pull. v1.0.23: drags go where they're put, bag → bag and slot → slot too; the gold lump removed. v1.0.22: the pill stick as the old thumbstick, its knob free past the pill; creatures start as a trickle, `levelSpawn`;
jet-over fix. v1.0.21, the PM alone): hub movement now the old game's exactly; old saves get the starter kit (`kitMissing`); the
boss is finished (aimed at by its edge and from behind, `autoBossHp` 12); one of the level's blocked zones is made full
past a random 20 s+ (`plantWall`, `levelFree`, knobs `autoWallMin/Max`). Waiting on the owner: try it on the phone and OK it.
Open, in order of weight:
1. ~~The team doesn't finish the boss~~ fixed in v1.0.21 (suite `auto-boss`).
2. ~~A fresh run stops at the first rock within seconds~~ v1.0.21: nothing blocks till the level's sure blocked zone (suite `auto-wall`).
3. ~~Tune the gold stream~~ replaced by paying with A (v1.0.25; knobs "Auto: throw").
4. Polish noted: the gun arc crowds the left corner for player 1, empty arc circles faint; chest small, grass over it;
   the menu icons small after the ×1.5 padding; only bag items scrap/drop (not slot items); dragging a gun out of
   its circle done v1.0.43 (slot-to-slot moves within a row: done in v1.0.23); `auto-loot` flakes rarely in a full run (logic and browser: chance, passes alone).
5. Old-game code still bundled through `cards.js` / `editor.js` (GunIcon) / `pause.js` (`save/save.js`).
How the PM worked: one agent per stage in a hand-made worktree (`git worktree add .claude/worktrees/stageN -b stageN autobattler`
+ `node_modules`; the Agent tool's own worktree option fails on the path's casing), the time-box brief word for word
(AUTOBATTLER.md section 8), small feedback rounds done by the PM. Tests on this branch (2026-10-14): `node tests/run.js` runs only the essentials (`tests/essentials.js`),
`related` adds the archived suites naming a changed file, `all` everything (known failure `spider`); the old game's browser
suites are in `tests/retired/` and `tests/determinism.js` no longer applies here.
- **Stage 0 done (v1.0.0):** the branch deploys to `https://5rob.github.io/CaveRunner/auto/` and builds the
  CaveRunner Auto APK (release `app-auto`); `android/README.md` has how. The only change on `main` was the shared
  workflow file. The owner allowed `autobattler` in Settings → Environments → github-pages (needed for the deploy).
- **Stage 1 done (v1.0.1):** the pure run model, `src/auto/` (README there). 
- **Stage 2 done (v1.0.2, owner OK'd):** the four-section screen (`src/ui/auto/`). 
- **Stage 3a done (v1.0.3, owner OK'd):** the hub room, machines, teleport-in (`auto/hub.js`, `render/hubdraw.js`). The
  owner wants the empty space above the room left as is (plans for it). 
- **Stage 3b done (v1.0.4, owner OK'd):** walking the hub, the exit prompt, prices. 
- **Stage 4a + the pill stick done (v1.0.5, owner OK'd):** the level strip and pace pilot (not reachable yet), and the
  owner's pill stick (hub free roam with run + jet; in levels hurry/slow, never stop). 
- **Stage 4b done (v1.0.6, owner OK'd; PM built it):** the exit pad takes the team into the run's level, the level's exit
  pad brings it home (tier + 1, healed, saved). 
- **Stage 5a done (v1.0.7, owner OK'd):** real guns in levels, the starter kit, the meters. Next: stage 5b, the
  clearing rule (`canClear`/`bestClearer`, "Path blocked"), replacing the magic saw.
- **Stage 5b done (v1.0.8, owner OK'd):** the clearing rule and "Path blocked". Until stage 8 (dragging mods) a team
  of starter guns stops at its first wall. 
- **Stage 6 part 1 done (v1.0.9, owner OK'd):** enemies by tier, elites, the boss and its bar, death. Spider silk does no
  damage yet. 
- **Stage 6 part 2 done (v1.0.10, owner OK'd):** drops into the bag; gems at the old game's crystal size (owner).
  
- **Stage 6b part 1 done (v1.0.11, owner OK'd):** 11 blocked-zone kinds with varied shapes. Part 2 dropped by the owner
  (happy with the 11). 
- **Stage 7 done (v1.0.12, owner OK'd):** LEVEL CLEARED. 
- **Stage 8a done (v1.0.13, owner OK'd):** the context nav, helmets, pixel icons, machine colours. Next: stage 8b,
  dragging between the bag and the slots (grab radius, cards).
- **Stage 8b done (v1.0.14, owner OK'd):** dragging, cards, colour groups. Not yet: dragging a gun out of its circle,
  slot-to-slot moves, bag reordering. `auto-loot` failed once in a full logic run and never in 16 runs alone (watch it).
  
- **Stage 9 done (v1.0.15, owner OK'd):** the gun arc, stats graphs, scrap, dropping items on the play area. Notes:
  the arc crowds the left corner for player 1, empty arc circles faint; only bag items scrap or drop. Next: stage 10,
  throwing gold and gems, the machines pay out.
- **Stage 10 done (v1.0.16):** throwing and payouts. The owner will test and tune it later (the stream is thin: slow
  start, quick pull — knobs in "Auto: throw"). Only the gun machine's payout is browser-tested. 
- **Stage 11 done (v1.0.17, owner OK'd):** chests. Polish later: the chest is small, moss grass draws over it; no
  chest browser suite yet. 
- **Stage 12 done (v1.0.18, owner OK'd):** extra players.
- **Stage 13 done (v1.0.19, owner OK'd):** level drops saved at once (mid-level quit → hub, bag kept), ⏸ → New run (two taps), the old App and level worker out of the build (index.html −401 KB), the old game's 91 browser suites in `tests/retired/` (on this branch `node tests/run.js browser` runs only `auto-*` and `title`; `tests/determinism.js` drives the old game, so it's dead here too). 
- **Stage 14 (v1.0.20):** `auto-loop` plays the whole loop; `tools/autoperf.js` (×4 CPU ~39 fps). Found: (1) the team
  doesn't finish the boss (it sat at 2 hp; the 120 s `autoLvlBossT` fallback moves on) — to look at; (2) a fresh run's
  starter guns can't dig, so the team stops at the first natural rock until the Buzzsaw is dragged into a gun (by design:
  "Path blocked"). **Waiting on the owner:** play the full loop on the phone and OK it (the project's done-when).

## NEXT (as of v0.0.176, 2026-10-09)

- **v0.0.176 released: the title's gold pickup at 10% volume** (owner's ask; `ui/titlesound.js`, `SFX.ui('coin', 0.1)`).

- **v0.0.174 released: the title's sound, music, ▶ / ⚙ and Settings** (owner OK'd all). Sounds: `art/titlescene.js` `snd()`
  → `ui/titlesound.js`. Music: `audio/song.js` (data) + `audio/music.js` (synths), title only; `node tools/musicwav.js` to
  listen. Settings: Master / FX / Music (`SFX.setFxVolume`, `setMusicVolume`). v0.0.175: the pause menu has the same three
  sliders (`ui/volume.js`, shared). No music in the game itself. Not timed on a phone (music + title sounds).
- **The title (v0.0.165–173) is all released; the owner is playing it in the app.** Where it lives: `art/titlescene.js`
  (pure: zones, mines, winding caves, players, camera; its README row in `src/art/README.md`), painter
  `game/render/titledraw.js` (pixel layers, the dark and lights, the jellyfish plant glow; `src/game/render/README.md`),
  gestures in `ui/title.js`. Suite `slots` (75 checks; seed-bound checks search for a seed with what they need, the zones
  being random). Pictures: `tools/titlecamshots.js` (visits, camera), `mineshots.js`, `windshots.js`, `pixelshots.js`
  (glow, pixel look, a burst flyer), older `playershots.js`, `digshots.js`.
- **Not timed on a phone**: the title now draws pixel layers (world, creatures, shots), the dark with four players' and the
  lanterns' line-of-sight fans, and the plant glow every frame. If the owner reports slowdown: fewer fan rays (120 a
  player, 72 a lantern), shorter beams, or the world pixel layer every other frame.
- Settings the owner may want to tune: `TITLE_BEAMA` (0.25, the visible beam), `TITLE_PLANTR` (0.25, the glow's reach),
  `TITLE_LAMPR` (60), `TITLE_EDGE` (6, light into rock), `JET` and the players' `bursty` (0.75, 0.15, 0.5, 0.3).
- Open questions for the owner: the pixel look in the game too (vines, webs, gold, creatures)? Letting go of a followed
  player keeps the zoom (pinch out); dragging does nothing while following. The players saw more since v0.0.171 (~120
  starts a minute for four, was ~75), mostly running in their own tunnels.
- **Still open from the owner: ground and shop guns in the pixel look** (the gun in hand has it). The brief is under
  v0.0.164 below. Looks: screenshots first.
- Title notes kept from v0.0.165–167: fire crackle is `art/crackle.js` (title and game); a `slots` check that measures
  something the players would saw through or shoot sets `S.still = true`.
- Open idea the owner hasn't asked for: the game's web lines still flare away at once when lit (the title's cut
  lines hang and swing; the game's don't).
- Known failing as before: logic `spider` ("every roaming spider moves about": 1 still of 69), browser `vendshop`.

## v0.0.175 — the pause menu's Master / FX / Music sliders: RELEASED on `main` 2026-10-09 (owner OK'd)

CHANGELOG v0.0.175.

## v0.0.174 — title sound, music, ▶ / ⚙, Settings: RELEASED on `main` 2026-10-09 (owner OK'd)

CHANGELOG v0.0.174.

## v0.0.169–173 — the title: RELEASED on `main` 2026-10-08 (owner OK'd each)

CHANGELOG v0.0.169 (pixel grid rides with the players), v0.0.170 (rats out of the rock, random hewn mines, jellyfish glow,
pixel look on everything), v0.0.171 (no outline, shots pixelated, jetpack gravity + bursts, run pace, the game's dark and
lights), v0.0.172 (winding caves zone), v0.0.173 (the glow's twinkle moves with the cave).

## v0.0.168 — title: random zones each visit; pinch zoom, pan, tap to follow: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.168. Screenshots sent. Logic all pass except the known `spider`; browser `title` passes.

## v0.0.167 — title players collide + keep apart: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.167. Screenshots: `node tools/playershots.js`. Fixes v0.0.165's "players bunch up".

## v0.0.166 — title players saw tunnels (no teleport), own run/fly clocks; fire crackle on burning creatures + vines (title and game): RELEASED on `main` 2026-10-08 (owner asked to see it in the app; feedback may follow)

CHANGELOG v0.0.166. Screenshots sent (`node tools/digshots.js`). Known: the game's webs still flare away at once (only
vines and creatures got the crackle there; the title's cut-and-hang lines are title-only).

## v0.0.165 — title: 4 players, 2× creatures, random modded guns, mine slope, fire ×0.1, cut vines/webs hang: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.165.
Screenshots sent (`node tools/playershots.js`). The owner's asks in this session, all built: double the enemies, 3 more
players with a colour each, more mod variety in the guns, a natural slope into the mine works, fire at 10% speed,
burning vines with the cells' crackle look, cut vines/webs fall or hang + swing + burn, players pushing vines.
Only the title changed (the game's fire knobs are untouched). Known: cut webs leave long strands in the web caves
(the players bunching up: fixed in v0.0.167).
Note: ad-hoc `node -e` and probe files run from `tests/` were blocked by a security hook ("NODE9", approval
timeout); `node tests/run.js`, `tools/*.js` and scripts in the session scratchpad ran. To see a number, put it in a
check's `got` and run the suite.

## v0.0.164 — gun in hand in the body's pixel look, creatures over the shop's machines, title fire jumps + runner waits: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.164. `TITLE_AIM` 90: the owner's OK.

**NEXT SESSION, from the owner (2026-10-08): give the guns on the ground and in the shop the same pixel look as
the gun in hand.** Today `pixelHeld` (`art/sprites.js`) does it only for the held gun; the ground guns
(`render/cave.js` `drawLoot`, `drawGun(…, 0.9, …)`) and the shop's stock (`drawShop`, 0.85) draw the sprite as
it is. Put them through `pixelSprite` at `DEV.runnerPx` (outline `DEV.runnerLine`) with a grid pinned to the
gun. Ask the owner whether the HUD/Bag icons (`gunArtFit`) should change too. Looks: screenshots first.

Known failing as before: logic `spider`; browser `vendshop`
(fails on v0.0.163 too, different checks each run).

## v0.0.163 — gun sprites one scale, gun in hand ×2, squirts turned, title fire + runner pop + lanterns: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.163.

## v0.0.162 — the title's creatures, gold and fire are the game's own: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.162. Fire spread (`fireSpreadHi`) back to 0.2 (owner's choice; their v0.0.161 report had set 1, ~3×
faster). Known: rats have no nests on the title (no gold stealing); nuggets are game-size.

## v0.0.161 — title scene (a tour of the real floor 1) + pixel-art on every gun + the owner's Dev report as defaults: RELEASED on `main` 2026-10-08 (owner OK'd)

CHANGELOG v0.0.161. The owner gave three feedback rounds on the title (zones blend, low timber, spider webs, jelly
tentacles, dense vines, home zones, then "a sideways tour of our actual Mossy Caves level": surveyed the real floor
(tools: a phone-size shot at a prop / zone, the whole floor zoomed out with the hologram off) and painted it by the
level's rules).
Spiders drop on silk (owner's ask). Known: the gun is game-size (small); fire can burn the layers' frames away quickly;
not yet timed on a phone. The browser suite last ran before rounds 2–3 (logic + `title` + `slots` pass now).

## v0.0.160 — dev mode (hold ⏸ 5 s), ⏸ / ⚙️ swapped: RELEASED on `main` 2026-10-08 (owner OK'd)

⏸ top right, ⚙️ left of it and hidden until you hold ⏸ 5 s (again hides it; remembered). Dev mode off also hides
the cards' 📌 / 🗑️ / Give Feedback and the Bag's 💾. `ui/devmode.js`; CHANGELOG v0.0.160. Note: the owner's phone starts with dev mode **off** after the update.

## v0.0.159 — LIST4 (5 items): RELEASED on `main` 2026-10-08 (owner OK'd)

Read `LIST4.md` (items, files, decisions) and CHANGELOG v0.0.159: title screen with 3 save slots, pause menu (⏸:
save, volume, exit), Bag header (name + ✏️, 🖼️ gun look, 💾 preset), presets in Dev → Spawn gun, 27 pixel-art gun
looks, gun slots in their gun's colour. **Waiting on the owner:** playing it on the phone. Known: ✏️/💾 also work
in a view-only Bag; the title's slot summaries read each slot's save; logic `rats`, `spider`, `strata` and browser
`jelly` spit fail as before.

## v0.0.158 — the machine hints fit their words, centred over their machines: RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.157 — the buy machine: flick the right stick to pick a level (no menu), new machine hints, L/R on the knobs: RELEASED on `main` 2026-10-07 (owner OK'd)

The floor menu is gone: at the buy machine flick the right stick up/down to pick the floor (one past what's for
sale shows grey), tap to buy; aiming and firing still work there. Both machines' hints are small green panels
(red on the sell machine while it refuses) that fade up after 1.5 s with no stick input. CHANGELOG v0.0.157.
Desktop has no key for the pick (phone only).

## v0.0.156 — circle fields drawn as rising sparkles (+ plus signs for Vigour), no filled disc; rings thin at 10%: RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.155 — Follow Me (to you) / Follow This (ahead of the gun, the Gravity Gun's) split, Follow Me as a pull; buffs and nerfs; you in the firing window: RELEASED on `main` 2026-10-07 (owner OK'd). Buff/nerf mana and tiers are my guesses: the owner may retune.

## v0.0.154 — a running DPS graph (5 s, thin red line) across the firing window's top third: RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.153 — a red DPS over the firing window's dummy (direct hits, last 3 s, hidden at 0): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.152 — the Bag's firing window: gun sway, zoomed out, a hologram dummy you that takes hits (homing shows): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.151 — a wall at the far right of the Bag's firing window (trigger payloads show): RELEASED on `main` 2026-10-07 (owner OK'd)

## v0.0.150 — the Bag's mana bar drains with the fire preview: RELEASED on `main` 2026-10-07 (owner's ask; a fix)

## v0.0.149 — THE OWNER'S 12-ITEM LIST: RELEASED on `main` 2026-10-07 (read LIST3.md for each item)

All 12 built by time-boxed agents (worktrees, merged into `list3-small`), every look OK'd from screenshots, one
feedback round done by the manager. `LIST3.md` has each item's files, decisions and the log; CHANGELOG v0.0.149.
In short: dark-zone hologram glitch (3 rates in Dev), modifiers hit only the next spell, Dev panel with tabs +
Spawn level + audit copy, the Bag's firing window and gun row, hold a HUD gun slot to take/drop guns (R/swap menu
archived), mod/perk audit (📌/🗑️/notes, Dev → Copy mod & perk audit), vine facing, trigger ring inside the gauges
(`aimPad`), mod stacks, Aim Assist mod, Discriminate mod, Mini-map perk.

**Waiting on the owner:** playing it on the phone. They said they'll test **Discriminate**, and tune the hologram
glitch rates (`l2dFlkRate`/`l2dFlkTears`/`l2dFlkDrops`) and may paste a Dev report. Known gaps (told the owner):
Discriminate doesn't cover fields, beams or trigger payloads, and its icons are emoji; Aim Assist aims the whole
pull at the target (one aim per pull); the mod card has no example showing the spell *after* the boosted one
coming out plain. Known failing as before: logic `rats`, `spider`, `strata`.

## v0.0.148 — SPEED-UPS, FLAMETHROWER, FIRE IMMUNITY: RELEASED on `main` 2026-10-06 (the owner OK'd it; Pages shows `148 v0.0.148`)

The owner played Level 2 on the phone: frames dropped as a dark zone came into view and with the aliens about.
Their list, all done (CHANGELOG v0.0.148 has the details): drawn at 1.5× (`renderScale`, `game/dpr.js`); the back
wall blurred once a floor; the hologram's blur behind the silk a Dev switch (`l2dHoloBlur`, off); the black's edge
a 3-step banded ramp (`l2dBands`) instead of a per-frame blur; half the aliens (`alCount` 30–60), black with no
skin, a shared eye picture, thinking in 5 groups with tweened moves. Mine, free: per-floor layers made on the
floor's first frame (the hitch when a zone appeared), grow-only canvases, aliens deep in the black not drawn.
Measured at alienperf's spot with the CPU slowed 4×: 114 → 36 ms a frame. Plus the owner's two asks: the
**Flamethrower** mod (`flamer`) and the **Fire Immunity** perk (`fireimm`); browser suite `flamer`; and a
**Dev → All perks** button (`LO.debugPerks`: every perk to fit, the suit usable anywhere).
Known failing, not from this: browser `shop` ("the coin is gone once collected", fails on v0.0.147 too); logic
`rats`, `spider`, `strata` as before. `vendshop` failed once in the full run and passed alone (chance).

**Next, from the owner:** how it runs on the phone (target 60 fps). Further levers if it's still slow: a lower
`renderScale`, fewer aliens, dropping the veins from the shared eye, longer think groups. If the owner had touched `alCount` in Dev, their saved value overrides the new default.

## LEVEL 2 — RELEASED FOR TESTING in v0.0.147 (2026-10-06; read first)

The owner's brief is **LEVEL2.md**. Built in 8 stages on the `level2` branch: the main session as project
manager, subagents for the big stages (time-boxed, CLAUDE.md "Subagents: keep them short"), the owner approving
every look from phone-size screenshots. **All 8 stages approved and released as v0.0.147** (a minor update, for
the owner to test on the phone). Next: the owner's feedback from playing it, and the open questions below.

Floor 2 is now **Tombs** (the theme renamed from Coal seams), built in `makeLevel` in this order:
1. **The tomb** (`world/tomb.js`): a room list first (types, mirror-symmetric geometric shapes), straight galleries
   and shafts, cut-stone lining; `level.tomb` / `tombRoomAt`. **Its own back wall** `paintTombWall`: courses at the
   rock's scale (7 × 4 px), glyph friezes, pilasters, painted at terrain resolution (`level.bgHi`, drawn in place of
   the quarter-size wall: `G.bgHi`/`G.bgHiOn` in `render/cave.js`, `render/dark.js`; `bgImg` its averaged copy).
2. **Furnishing** (`world/furnish.js`): each room type a painted, mirrored kit, skeletons, unlit candles (owner: dark).
3. **Dark zones** (`world/dark.js`, look `render/dark.js`; Dev "Level 2: dark zones" `l2d*`): 2–3 zones off the main
   route (radius `l2dSize` 120–176 px), rough caves, small tunnels (`tunnels: { pts, w, fits }`), a flat-floored
   chamber, ragged silk-and-dark fringe. Compositing (owner): back wall + hologram blurred, silk multiplied over them,
   everything in front black past a 12 px fade (`l2dTintDepth`); fire lifts the black, silk included (`l2dFireR`, the
   `l2dFire` curve); the torch flickers out 18 px in (`l2dTorchDepth`, 4 px gap back).
4. **Destruction** (`world/destroy.js`, Dev "Level 2: destruction" `l2b*`; the reusable scatter is
   `world/byDistance.js`): 100 blasts in a 100 px ring round the zones, denser and bigger at the edge, anywhere in
   the ring (`l2bInRock`), off the chambers; scorch (`l2bScorch`) and soft radial streaks (`l2bStreak`), soot on the
   back wall, 30% burn and the fire runs out during generation; bones and skulls (`l2bBones`). Pure and seeded.
5. **Loot** (`world/loot.js`): no ordinary creatures; 46 spots (half the usual enemy count, their spawn rules,
   outside the zones) with that creature's gold as a scatter of all three nugget sizes (`scatterGold`, `Coin.sz`),
   12 with a red crystal; each zone's chamber one prize (1000–2000 gold, 4–6 red, 1–3 green; at least one zone green).
   Ground gold is `level.coins` → `W.coins`, kept in the autosave.
6. **Aliens** (`creatures/alien.js` sprite + brain, `game/creatures/alien.js`; Dev "Level 2: aliens" `al*`): 60–120
   per zone plus 2–4 black strays; sizes 0.6–2.4 × leaning small (`alScale`, `alBias`); boids packs on the silk,
   flee fire (`alFleeR`), bite only when you're in the dark, keep off in light; strays sprint home; pupil darts then
   locks on; each its own leg stance and twitch, rounded bumpy tapered legs, purple-blue skin. A live bullet in a
   zone lifts the black a little (`alGlimpse`).

Floor build ~1 s (1.5 s worst, Mac) of the 5 s budget. Pictures: `tools/floorshot.js` (the whole floor as drawn),
`darkshots.js` (HOLO=1), `boomshots.js`, `lootshots.js`, `aliensheet.js`, `alienshots.js`, `alienframes.js`.
Suites: logic `tomb furnish dark destroy loot2 alien level2 bydistance`, browser `tomb darkzone darkperf alien alienperf`.

**Open questions for the owner** (ask after they've played it):
- How it runs on the phone with a zone and hundreds of aliens on screen (Mac: zone ~+5 ms, aliens ~+1.3 ms a frame).
- The bullet glimpse is faint at the defaults (`alGlimpse`); each alien drops a coin (hundreds a floor);
  strays steer home without pathfinding (one can stick behind a long wall).
- The tomb's own altar room still holds a green crystal outside the zones; should the exit pads keep glowing.
- Minecarts only came with floor 2's old decoration, so they're now first seen on floor 14 (the palette wraps).

Known failures (before level 2 too): logic `rats`, `spider`, `strata` ("workings").

## Where things stand

- **The refactor is done and fully on `main`** (all five phases). The game is modules under
  `src/`, bundled by esbuild into the same `index.html`; every file is type-checked (JSDoc + `tsc`);
  the notes live next to the code (a README per `src/` folder), history in `CHANGELOG.md`.
  `REFACTOR.md` keeps the plan, decisions D1–D21 and the session log.
- **Released: v0.0.147** on `main`, 2026-10-06 (a minor update, for testing): **Level 2, the Tombs** — see the
  section above.
- **Released: v0.0.146** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): a dark
  shade under the controls (`ui/hud.js` `shadeAt`).
- **Released: v0.0.145** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): the
  shop's way up always straight over the buy machine (`world/level.js`, `shopExit`); the hand torch archived
  (`HAND_TORCH`, kept for creatures later) for a light on the gun, a cone the way you aim, only with a gun in
  hand (`render/light.js`, Dev → Torch & fog `beam*`; the owner may paste Dev numbers for it); a new run's
  teleporter keeps its lightning until you've come through. The new caves tip two chance checks (`strata`,
  `rats`) over their bars: measured, not regressions (REFACTOR.md, Found along the way).
- **Released: v0.0.144** on `main`, 2026-10-05 (the owner OK'd it): the heal centred
  under its light, dust (not green spores) only inside the light cones, and the guide turns rude only once
  you walk out of its pool of light to the right (at a run it was skipped unseen); the gun pickup's slots a
  full-width row of squares with the cards splitting the rest; a new run's teleporter charging for a
  second before you come through in a flash, the tube over it on a second later; gun cards' mods as the Bag's
  square tiles, a tap showing the mod's card (a mod card's examples square too).
- **Released: v0.0.143** on `main`, 2026-10-05: the guide's starter gun casts one shot and recharges in 0.5 s.
- **Released: v0.0.142** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): a new run
  starts with no guns and no gold; the gun machine gives a Scratch Pistol free while you have no gun; the
  crystal machines play a hologram demo of a crystal going in (red/green showing through) until a real one
  has (`LO.fed`); the guide's kit has 2 red crystals; the guide jumps out only once its dark spot is
  `DEV.guideIn` (50) on screen; the gun and mod machines swapped (guns, mods, perks). Note: without the
  Pick Axe and Gravity Gun a new run can't dig or drag crystals until it finds the mods (owner's call).
  The browser test page still starts with the old kit (`window.__TEST_EMPTY` for the real start).
- **Released: v0.0.141** on `main`, 2026-10-05 (the owner OK'd the screenshots; a minor update): the
  new full-screen map with pan/zoom, machine squares and emoji pins (pin button on the map screen only:
  `ui/map.js`), the shop's heal and machines moved to the far right with pools of light under the tubes
  and dark between (Dev → Torch & fog: `shopGap`, `shopTorch`), and the guide hologram that welcomes
  **every new run, deaths included (owner)** and hands out a starter kit, or goes off in a huff if you
  walk through it (`world/guide.js`; invisible until the tube over it lights). Not saved: closing the app
  mid-welcome loses the kit. The old map's loot dots and prize-room outlines are gone (owner: picture +
  fog + helmet + pins). The owner may paste Dev numbers for the hall's dark or the guide's typing.
- **Released: v0.0.140** on `main`, 2026-10-04 (the owner OK'd the screenshots): the mod machine glows
  crystal red, the gun machine gold, and the gun machine's red-crystal Boosted reroll is gone.
- **v0.0.139** on `main`, 2026-10-04: the mod machine rolls any mod off the floor's table, repeats
  included; perks stay one of a kind (never given twice; the perk collection is kept across runs, so a
  perk once had never comes from the machine again: ask the owner if that's wrong for later runs).
- **v0.0.138** on `main`, 2026-10-04 (the owner OK'd the screenshots):
  crystals can't be picked up, they're rocks you push or drag with the Gravity Gun; the mod machine eats
  red ones and the perk machine green ones, shakes faster and faster and pops out a new unlock off the
  floor's table (`game/systems/shops.js` `stepCrystals`). Their menus are archived (`takes` on a `SHOPS`
  entry; drop it to bring the menu back).
- **v0.0.137** on `main`, 2026-10-04 (the owner OK'd the screenshots). No perk column on
  the HUD; bigger gun/bag/map buttons; crystals fly to you like gold and shed breeze sparkles; flight
  paths rebuilt in one place (`spells/paths.js`: Boomerang returns, Ping-Pong, Spiral, Orbit round its
  caster or a trigger's carrier) and working on moving fields; new mods Follow Me, Enlarge/Shrink,
  Longer/Shorter Flight; Vacuum Field → **White Hole** (steady harmless pull, tiny white-blue look, specks
  drawn in); the elite glow a soft radial fade, not a disc (owner's first feedback); the **Gravity Gun** as a third starter (old saves: Dev → Restart run); elites burn, with
  **Dev → Elites: flames** (gradient editor, opacity B-spline, length, wavyness, air resistance…). The
  owner may paste Dev numbers for the flames. Not done: flames off creatures' appendages (body only),
  and the flames aren't in death replays. An orbit cast standing on the floor clips the floor (the
  circle is 26 units; your gun is ~13 above your feet).
- **v0.0.136** on `main`, 2026-10-03 (the owner OK'd the screenshots): a new run's dark shop
  lighting up a section at a time (`world/shoplights.js`), the pad centred under a TELEPORTER plank nailed
  over PRINTER, the heal just past it and the machines evenly spaced (`SHOP_SLOT`), and kill/dig gold
  waiting 0.25 s (`SPILL_WAIT`).
- **v0.0.135** on `main`, 2026-10-03 (the owner OK'd the screenshots): in the Exo Suit's
  perk grid a perk not unlocked yet is a blank tile in its place, nothing to tap (`.xperk.locked`).
- **v0.0.134** on `main`, 2026-10-03 (the owner OK'd the screenshots): the sell machine is
  lit green from the start and glitches to red with its fine print half a second after a buy; both
  machines' offers read "BUY/SELL lvl 01" + price + fine print, in a blocky terminal font (`art/pixfont.js`).
- **v0.0.133** on `main`, 2026-10-03: Dev → Restart run empties the mods unlocked, like a
  death (perks unlocked stay).
- **v0.0.132** on `main`, 2026-10-03: version numbers are now **major.minor.patch**
  (`vX.Y.Z`; CLAUDE.md has how the update number keeps the installed app updating). The APK's update
  prompt label is tidier with the new APK (reinstall optional: the old one updates fine, showing
  "132 v0.0.132"). Next release: ask which part to bump if it isn't clearly a minor update.
- **v131** on `main`, 2026-10-03 (the owner OK'd the screenshots): the jet flame and smoke come
  out of the backpack's nozzle (`jetNozzle`), not the feet.
- **v130** on `main`, 2026-10-03 (the owner OK'd the screenshots first): the buy machine's
  full-screen floor menu (`ui/levelshop.js`; floor N for sale once N − 1 is sold this run, `LO.soldTop`), an
  exponential economy (`data/levels.js`: debt 1 billion × 3 a floor, reward 1,000 doubling a floor, kill gold
  × 1.35 a floor; all Dev knobs in Level), the next level made by a Web Worker while the shop stands empty
  (`game/levelgen.js`; flash lag 1117 → 67 ms at CPU ÷4) and drawn in bottom-up, no level sounds without a
  level, three exits along the top, pads that crackle only when used, pixel flames for the torch and jet
  (and blocky jet smoke), and the Exo Suit's perk grid as a ScrollBox. CHANGELOG has the details. Untested
  on the phone itself: the Web Worker in the app's WebView (if it fails, the warp makes the level itself,
  with the old freeze). The owner may paste Dev numbers for the economy.
- **v129** on `main`, 2026-10-03: a swung vine trails below your grip (a tail of verlet
  links, `world/sway.js` `tailStep`/`vinePt`; Dev `vineLinks`, `vineTailDamp`); Witness export fixed (it
  was always 300 × 150: now the screen's shape) and the replay's hologram shows the count of that
  moment (`bio` per snapshot); mods unlocked reset on death (perks stay); one of each perk in the
  suit; **Dev → Level 2: layout & look** (floor 2's cave numbers, palette, decoration; **Floor 2**
  button). The owner may paste Dev numbers for floor 2. Noticed, not fixed: on floor 2, seed 5
  (`makeLevel(5, 2)`) the runner-box flood from the shop doesn't reach the top (v128 too): only
  floor 1 has the "way through" repair.
- **v128** on `main`, 2026-10-03: elites drop a pile of red and green crystals (one tap
  takes the pile) and have a Dev group, **Elites** (count per floor, health, damage, gold, crystals,
  size, tint, glow). The owner may paste Dev numbers for it.
- **v127** on `main`, 2026-10-02: vines and web lines give (`world/sway.js`: one spring per
  line, a pendulum per hanging vine; Dev group **Vines & webs: sway**). v126: the **Carrot** suit stat
  (camera, torch, aggro, aim line; Dev group **Carrot**, min = none fitted, max = Carrot V). The owner may
  paste Dev numbers for either.
- **v125** on `main`, 2026-10-02: the player as a pixel astronaut with jointed limbs
  (`art/sprites.js` `paintBody`/`runnerPose`/`pixelSprite`), the ragdoll with elbows, teleporter pads
  for both portals (`render/pads.js`), a steel shop (`shopPanel`), machines left to right mods/guns/perks,
  a hologram count that only goes down (nests hold a fixed brood, `nest.left`), Dev knobs for the enemy
  count and the level reward, press-and-hold Dev group headers, and any push off a web line or arched
  vine lets go (`lineLetGo`). The owner may paste Dev numbers for
  the astronaut (`runnerPx`, `runnerLine`). The owner's reference picture never arrived in the session:
  the look is from "a white-dressed astronaut, pixel style".
- **v124** on `main`, 2026-10-02: saved death replays (the Bag's Witness tab: play,
  rename, delete), the replay's sound, **Export video** (MP4 with sound into Movies/CaveRunner via
  a new app bridge, `window.CaveApp`: **the APK must be reinstalled once** for saving videos; ffmpeg.wasm
  converts if the phone can't record MP4), and the corpse as a ragdoll (`world/ragdoll.js`).
  `replay/README.md` has how it fits. Untested on the phone itself: MediaRecorder's MP4 in the
  WebView, and the bridge (CI builds the Java; nothing here compiles Android).
- **v123** on `main`, 2026-10-02. v118–v123: three shop vending machines (mods v118, guns v119, perks v120: `game/systems/shops.js`, `ui/vendshop.js`, `ui/gunshop.js`), red/green crystals in place of cave loot, elites, the Exo Suit tab in the Bag with stat perks, the menus' right-stick pointer with snapping (v121–v122, Dev knobs v123), the Questions Later auto-fire mod (v122) (CHANGELOG). v117: a Dev knob for level 1's repay time (`DEV.due1`, minutes). v116: the hologram rests dark and flashes on a kill (Dev → Hologram flash, with a fade-curve editor). Before it, v115 on 2026-10-01 (history in `CHANGELOG.md`). The last three were the
  owner's lag and battery complaints: v113 the camera eases by time, not per frame (it jittered you
  in fast flight on the phone; confirmed fixed); v114 the Bag works out its dmg/s line once per build,
  without the parked swap tips (a drag cost ~380ms with a big gun); v115 the hologram, its fog swap,
  its bloom and the glows draw at the rock's pixel size (`DEV.holoPx`, `DEV.pixelFx`): ~69ms a frame
  to ~20ms software-rendered. The owner may paste a Dev report with the look they settle on.
- **Measuring render cost:** a PC's GPU hides it. Launch Chromium with `--disable-gpu
  --disable-gpu-compositing` and phone size (412x880, dpr 2.625), then time frames with steps
  switched off one at a time; seed `Math.random` in an init script so old and new builds draw the same cave.
- Tests: logic 33/33 and `smoke` green on every Phase 5 commit and on the v100 release; the last full browser run was green
  after re-runs of known flakes (end of P3.5).
- `.claude/` is untracked on purpose (it holds an API token): never commit it.

## What's next: REFACTOR.md → "Found along the way"

- **`shop` browser suite fails on v124 and v125 alike** (not a flake): "the coin is gone once
  collected" (a coin left lying) and so "you keep your mods and gold". Not looked into yet.

That list is the to-do the refactor left (nothing in it was fixed in passing). The main ones:

- **Stendari's bomb never sets anything alight**: `enemyFor` (`src/data/creatures.js`) doesn't copy
  `fire`, so `CREATURES.tuli.fire` never reaches `e.k`. One-field fix, but a gameplay change (bombs on
  floors 6, 7, 9 start fires): the owner's call. Two `@ts-expect-error`s mark the reads.
- **A vent reuses `Prop.on`** as "roaring" (`src/game/systems/props.js`), which also means "the arch I
  hang off" for `propAnchored`. Harmless today; give vents their own field (`roar`).
- **Flaky browser checks** (timing or chance; each passes alone): `jelly` spit group (fails on v96 too),
  `sound` portalOut, `torch` falloff/flicker, `lightning` fork, `trigger` explosion carrier (wall-clock
  waits: make it frame-counted), `fog` "next floor is dark again" and "flying on reveals more",
  `everymod` telecast, `rats`, `save`, `vendshop` arrow-key step, `nuggets` "settle on the floor" (fails on v114 too), `map` "the rest black" (random caves: sometimes the walk up stops low; 5 fails in a row once, then 6 passes), `archvine`, `decor` vine, `t1spells` bubble, `compare`, and the logic `spider` "every roaming spider moves about" on real caves (1 of 119 barely moves since v120's one-room caves: make it seeded or sandboxed). Worth
  making them frame-counted / seeded. `shoplayout` and `perks` logic suites run close to the 30s cap.
- Smaller: `paint()` has no callers, `W.best` is written and never read, a static field cast just before
  the portal carries on to the next floor, a few comments sit above
  the wrong code (listed there).

## The Android app

Live: APK at `https://github.com/5rob/CaveRunner/releases/tag/app`, game at
`https://5rob.github.io/CaveRunner/`. Pushing to `main` is the release; the app offers the update.
Essentials in `CLAUDE.md`, details in `android/README.md`.

## Testing on this machine (Windows PC)

`npm install` once; `node tests/run.js` (the essentials), `related`, `all`, `logic`, `browser`, or one filter. Browser suites
find playwright-core in `node_modules/` and the installed Chrome by themselves (never
`playwright install`). A `node serve.js` may already be running from an earlier session
(`EADDRINUSE` on a second one is harmless).

## Ideas raised but not built

- **Delayed Spellcast** — a static that casts three more spells after a pause; the trigger/timer
  machinery exists (`payload` on a shot, `firePayload`), so it's a small job.
- Noita spell categories only partly mined: Material spells (none), Divide By N, the Requirement spells.
- More perks, or Noita's perk reroll (skipped on purpose for now).
- Death replay: a "killed by …" caption (needs the source plumbed through `hurt`). (Saving replays: v124.)
