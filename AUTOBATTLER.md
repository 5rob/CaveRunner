# CaveRunner Auto — the auto-battler pivot (branch `autobattler`)

The build document for the whole project. **A stage agent reads: this file's sections 1–4, then its own
stage in section 5, then `CLAUDE.md` and the READMEs of the folders it touches.** The project manager (PM)
reads all of it and keeps the **Log** (section 7) current.

Mock-up (layout only; keep the main menu's colours and style): `docs/autobattler-mockup.png`.

---

## 1. The owner's brief (verbatim, 2026-10-09)

> I want to test a idea that pivots the play style. Can we branch an alternative version to work on?
>
> I'm loving the animation of the main menu background so much that I want to try turn it into a side scrolling auto battler.
>
> Here's what I'm picturing: it starts with just one player, spawning in on the teleporter into our current starting area. Same lighting effects, everythings the same.
>
> Where the thumbstick controls were, is a new layout. See attached image (image is layout mock-up only, and we should try to keep the colour and style of the main menu).
>
> It's broken up into 4 sections. Top to bottom: Game play screen, contextual navigation, item bag, interaction buttons. I've done a series of 4 mock ups to show progressing through the contextual nav to get to a gun modification screen. First image has all your active characters. Circles will be empty if you haven't unlocked more players. Tapping a player icon changes the context menu to his sub menu selection, which offers guns, exo suit, perks, statistics. I've mocked up highlighting selections to simulate tapping that icon. Tapping the gun option brings up the gun slots with equipped guns, 4 in total, still using the context nav. Then selecting a gun shows its mod slots. If more than the screen can handle, allow horizontal scrolling. Here you can drag mods or anything gun related up into the slots to build your gun just like we already have.
>
> Exo suit menu has 4 options: Max Health, Movement Speed, Jetpack, and Carrot. Tapping any brings up the slots like the gun mods. You can drag a collected exosuit mod onto the slot of their designation. Each category has the amount of slots that we have tiers for those categories. But instead of replacing the one with a higher version, you collect and add them to these slots to have them cumulatively add their bonuses.
>
> Perks is the same thing.
>
> Stats removes the circles and replaces them with the running dps meter we use in the gun modification screen preview area. One Red one for damage dealt, the other green for health amount. Tapping it should cycle through 3 different time lengths that it shows its history for, 5 sec, 15 sec, 30 sec.
>
> While in the main hub, tapping the arrows auto navigates between interest points in the hub hallway. Tap the right arrow once causes the player to travel that way to the next feature in the hallway. Have him slow to a stop to the left (or right if coming from the right) of each feature to allow the player to interact with it.
>
> Let's remove the buy and sell machines.
>
> Change the gun machine to work be like the other two vending machines, where it drags in gold nuggets and spits out a single gun for the tier that you're on.
>
> To pay the asking price displayed on the outside of the gun machine, there are several controls for doing it. A swipe from the gold icon in your inventory up into the play area throws a single gold nugget into the game area in a trajectory that it was flicked, it does its bouncing collisions with the floor then gets sucked up by the machine. If a player taps, moves their finger and holds it down, it expels nuggets in the moved direction with the distance moved as its velocity multiplier. It expels them slowly at first, but ramps up to a stream. Tapping and holding on the gold icon but not moving, causes the whole stack to be picked up as one to drop as one. The machine shows partial gold payments as a circle loading bar around the gun logo. The machine spits out the gun and it flies into your inventory.
>
> Now they bag / collection area, this can have 10 rows of empty item slots that hold your collected mods guns and perks. This section should scroll vertically to be able to browse. Try and only allow interaction with the items in the slots if you have tapped within a certain distance from the centre of its mod icon. This should allow for room for the grid to be dragged easily for vertical scrolling.
>
> A and B buttons are for the sometimes need for confirmation or going back in nav.
>
> Game play: the player shops around in the hub, upgrading. Then when they're ready, at the far right of the tunnel is now another teleporter for exiting to the next level. A prompt to tap A shows. Once selected, you are teleported to a teleport platform at the beginning of the level. The character heads off in their travels just like we have on the current Main Menu screen animation, but now we can mod his guns and exosuit and perks on the fly.
>
> Enemies drop gold nuggets just like in the original game, elites drop red gems, and then we have a final boss at the end that drops a green gem. They go in slots in your inventory, with stack numbers showing their count.
>
> The boss is just a mega large and strong version of a random enemy from that level.
>
> Auto travel across the level slows when elites are present, and travel comes to a slow and stop when at the boss at the end.
>
> After the boss is down and loot is auto collected via vacuum, show a level cleared title in the style of the main menu Cave Runner title, with some fancy letters animation to celebrate. Then the player continues on to the teleporter at the end and is transported to the hub to begin the cycle again.
>
> Let's just loop the Mossy Caves level to start before I flesh out all the levels.
>
> For the extra players, on the player select nav, if you drag a green crystal onto an empty player slot, it teleports in another player, which has their own gun slots, perks and stats to level up with mods.
>
> As an addition, I'd like some treasure chests to spawn at random intervals which can have a random choice of gold, a mod, a exosuit mod, a red gem, and on the rarer side a perk or green gem. But you have to tap A within a certain range of it to open and spill its contents and be vacuumed up.

## 2. The owner's answers to the quiz (2026-10-09) — these are decisions, don't reopen them

| Topic | Decision |
|---|---|
| Engine | **The menu's engine for everything** (`art/titlescene.js` + `game/render/titledraw.js`). Levels become a finite strip that ends in a boss, and the hub is rebuilt as a strip in the same engine, so there's one look. The old `Game.js` world is not used on this branch. |
| Scope | **Replaces the game on this branch.** Play starts the auto-battler. `main` keeps the old game, untouched. |
| Testing on the phone | **A second web address and a second APK.** Pages serves the branch at `https://5rob.github.io/CaveRunner/auto/`, and a separate app, "CaveRunner Auto" (its own package id, its own release tag), updates from there. The installed main app keeps playing the main game. |
| Guns | One **active** gun per player fires (auto aim, auto fire, on its own mana). **Swap gesture:** press and hold a player's icon in the context nav, and 4 circles fan out in an arc above it (that player's gun slots). Still holding, drag toward one; it highlights; release to switch to it. |
| Hub stops (left → right) | **Enter teleporter, gun machine, exo machine, mod machine (red gem), perk machine (green gem), exit teleporter.** The buy and sell machines, the heal station, the debt and the timer are all gone. |
| Tier | **Levels cleared + 1.** Each loop of Mossy Caves is one tier deeper: enemies (`enemyFor(id, tier)`), gold, the gun machine's guns and its price. |
| Death | **The others carry on.** A fallen player is out until the hub. If everyone falls: back to the hub, loot kept, level not cleared (tier unchanged). |
| Healing | **Full heal at the start of each level** (and on arriving in the hub). No heal station. Vigour fields and perks still heal in a level. |
| Exo mods come from | Chests, elite drops (sometimes), the boss (always one), and the **exo machine** (takes thrown gold, priced by tier, gives a random exo mod of the tier). |
| Exo categories | **Max Health, Movement Speed, Jetpack, Carrot.** Jetpack = fuel **and** recharge together. Gold Vacuum is dropped (loot is vacuumed anyway). |
| Slot counts | **5 per exo category** (the 5 tiers I–V); **6 perk slots.** Exo mods **add up** (slot I + slot III both count). An exo mod fits only its own category. |
| Bag full | **Scrap for gold:** drag any item onto the gold stack to turn it into gold. New loot that doesn't fit waits on the ground (the strip), and is vacuumed once there's room. |
| Chests | **The team slows while passing one** (not a stop). A "tap A" prompt shows while a player is in range; missed is missed. |
| `<` `>` in a level | ~~Speed / hold; in the hub a tap moves to the next stop.~~ **Changed by the owner (2026-10-09, after stage 4a):** `<` `>` become **one pill-shaped stick** (same height and roundness as the arrow buttons) that works like the old game's left thumbstick (drag sideways to run, up to jetpack). **In the hub: free roam** (run and jet anywhere; the exit prompt shows on the exit pad). **In a level:** left slows the team, right hurries it; it **never stops** them. |
| Level length | **~5 minutes** start to boss at normal pace. |
| Gems into the hub machines | **Thrown like gold**, with the same flick, stream and hold gestures from the gem's bag slot. |
| Version | **Starts at v1.0.0 on the branch** and counts on its own (`main` stays v0.0.x). Update number 1,000,000+. |
| Saving | **One save** (no slot picker). Autosave in the hub and at each level's end. Quitting mid-level resumes in the hub, keeping the loot already banked in the bag. |
| Mock-up 4's dim slots | Mock-up shading only. Show the gun's real mod slots, and scroll sideways if there are more than fit. |
| Gun mods in levels | **Yes, as rare enemy drops:** rarer than gold, more common than a green gem (a Dev knob). Vacuumed into the bag. |
| Digging / clearing | **Players magically pull out their best way through** (the menu's trick, but from their own kit): when the way is blocked (rock, webs, fallen beams, anything), a player switches on its own to whichever of **their 4 guns** can clear it best (Buzzsaw, Digging Bolt, drills, bombs and blasts, black holes, fire for webs and timber; anything that breaks through at minimum), clears it, then switches back. **The team slows to a stop only when no gun of any player in play can clear it** (then a "Path blocked" hint pulses over the play area: my default). Same rule for ordinary walls. |
| Starter kit (added 2026-10-09) | Each new player: **one basic gun, 3 slots, no shuffle**, holding **a random projectile mod** (a tier-1 shot, not a digger). **A Buzzsaw mod in the bag** (so the first block teaches you to drag it in). This replaces `scratchPistol`. |
| Blocked zones (added 2026-10-09) | A new zone kind in the random rotation, **~2 a level**: a copy of a random other zone, its path blocked by an amount rolled from "small inconvenience" to "blocked all the way through". The blockage suits the zone: mine works → collapses or dead ends; vegetation caves → a rounded-off dead end; tunnels/web caves → so many webs that their overlapping slow-downs halt the team (burn or dig out); **plus ~20 more variations the agent invents** (the owner sees them in screenshots). The point: make the player switch to a gun that can dig. |
| Camera | **Follows the team, with pinch zoom.** Tap a player to follow them, as on the menu. Swipes that start in the bag (gold or gem throws) never move the camera. |

## 3. What already exists (facts so agents don't re-explore)

- **The menu scene** (`src/art/titlescene.js`, 1717 lines, pure, layer 4): `titleScene(vh, seed, top, bot)` →
  `S`, `titleStep(S, dt)`. Terrain is a scrolling ring of `TCELL` (2 world-unit) columns (`S.cells`, `S.scroll`,
  `genCol`), and the zones are `TITLE_ZONES` (moss, webs, timber, paved, grove, winding), planned by `titlePlan(seed)`.
  It has 4 players (`S.runners`, colours `TITLE_COLS` = blue, red, green, gold) that run, jet (`JET`), dig (`TITLE_SAW` =
  `irongatling`, `startDig`), aim within `TITLE_AIM`, and swap random kits (`titleKit`: a skin, a shot from
  `TITLE_SHOTS`, 0–2 `TITLE_MODS`). **These shots are the menu's own simplified sim, not the real `planCast`.**
  Creatures are the game's brains (`jellyStep`, `spiderStep`, `ratStep`), floor 1's roster `TITLE_KINDS`. Gold
  (`spillGold`, `stepNugget`), fire (`stepFire`), the camera (`titleCam`, `camStep`, `camTap`, `camClamp`,
  `TITLE_ZMAX`), and sound (`snd()` → `S.snd` → `ui/titlesound.js`). `titleText` draws CAVE RUNNER in `pixfont`
  (bob, extrude, gradient, glow, shine). The painter is `src/game/render/titledraw.js` `titleDraw(ctx, S, cw, ch, cam)`
  (pixel layers, the dark with each player's and each lantern's line-of-sight fans, the plant glow). The screen is
  `src/ui/title.js` (canvas + rAF + gestures). Suite: `tests/logic/slots.test.js` (75 checks). Picture tools:
  `tools/titlecamshots.js`, `mineshots.js`, `windshots.js`, `pixelshots.js`, `playershots.js`.
- **Real guns:** `spells/guns.js` (guns, `gunLevel`, `scratchPistol`), `spells/mods.js` (`MODS`), `spells/cast.js`
  `planCast(g, others)` (what a pull fires), `effRecharge`; `spells/bagsim.js` (the Bag's fire preview sim:
  `fireSimNew`/`fireSimStep`, `castGroups`); `spells/gunshop.js` (`shopGun`, `shopGunPrice`). The Bag's firing window
  (`ui/editor.js` `GunFire`) draws real shots with `drawLook` and has **the running DPS graph** (`GF_GRAPH_S`,
  `GF_GRAPH_DT`, scaled to its peak): the stats meter's model.
- **The Bag's drag rules** (`ui/editor.js` `SlotGrid`, `ScrollBox`; `ui/exosuit.js` `ExoSuit`): `.grab` tiles have
  `touch-action:none`, everything else `pan-y`, and a cancelled press opens no card. Stacks: `spells/collection.js`
  `stackBag`, `stackKey`. Cards: `ui/cards.js` (`GunCard`, `ModCard`, `PerkCard`, `ModPop`).
- **Perks:** `data/perks.js` `PERKS`, `STAT_PERKS` (hp, walk, fuel, refuel, pull, carrot; vals by tier I–V),
  `SUIT_SLOTS` (6), `perkBag` (folds perks into multipliers). Exo mods are new, but their values come from `STAT_PERKS`.
- **Creatures:** `data/creatures.js` `enemyFor(id, floor)`, `goldScale(floor)`, `eliteOf(k, u)`, `eliteCol`, `ROSTERS[0]`.
- **The shop's machines today** (to port the *look* into the strip): `game/render/vend.js`, `game/render/shops.js`,
  `game/render/shoplights.js` (tubes stuttering on), `game/render/pads.js` (teleporter pads, lightning),
  `game/systems/vend.js` (crystal suction and shake). These draw in the old world's units, so port the drawing and
  don't call into the old `Game`.
- **Shell:** `src/ui/app.js` (`App`, the old play screen), `src/ui/title.js` (`Root` picks the title or the game),
  `src/ui/pause.js`, `src/ui/volume.js`, `src/save/save.js` (3 slots: replace with one), `src/ui/devpanel.js`
  (keep it; new knobs go in `dev/knobs.js`, each enemy and behaviour knob a min/max range: `rangeKnobs`/`kr`/`kru`).
- **CI** `.github/workflows/android.yml`: on push to `main` it deploys Pages (`_site/index.html` + `version.txt`)
  and builds the APK (`android/`, `applicationId 'com.caverunner.app'`, `MainActivity.PAGES_BASE` =
  `https://5rob.github.io/CaveRunner/`, release tag `app`). **Pages is one site per repo: every deploy replaces it
  whole.** So both branches' builds must go out together (stage 0).
- Known failing before this project: logic `spider`, browser `vendshop`.

## 4. Ground rules for every stage

- **New code lives in `src/auto/`** (pure: the run model, the strips, the level and hub plans, loot, the
  autopilot, layers 3–4) and **`src/ui/auto/`** (React: the layout, nav, bag, gestures). Painter additions go in
  `game/render/` (as `titledraw.js` does). Add a README to each new folder. Keep pure things pure (logic suites call them).
- **Don't break the menu animation.** The title screen still runs `titleScene` for its background. Extend the
  engine with options (for example `titleScene(..., { mode: 'title' | 'hub' | 'level', plan })`) or with new modules
  that import its pieces. Don't fork a copy of 1700 lines. `slots` must keep passing.
- **Old-game suites:** when a stage removes an old feature from the branch's play screen, it deletes or retires
  that feature's suites **in the same commit** and lists them in its report. The `logic` run stays green except for
  the known failures. Pure modules nobody imports any more can stay (main still uses them).
- **Tests:** a logic suite per pure module (`tests/logic/auto-*.test.js`), and a browser suite per screen
  (`tests/browser/auto-*.test.js`). Test mechanics in a sandbox: a flat strip with nothing else in it (add a
  `sandbox` option to the strip), not a generated level. Every wait-loop is capped.
- **Phone first:** 412×880, touch. Every gesture also works with a mouse (desktop testing).
- **Dev knobs** for every number the owner may tune (speeds, prices, drop chances, boss size, slow-downs), in a
  new Dev tab "Auto".
- **Looks need the owner's OK** (screenshots at 412×880). The PM sends them and waits, and the agent never pushes.
- **Version:** each stage the PM releases bumps `src/version.js` on the branch (v1.0.0 first, then v1.0.1, …;
  a big stage may be a v1.Y.0, the PM asks the owner).

## 5. The stages

Each stage is one agent run (~20 min box). The PM may split a stage that overruns, and may do small follow-ups itself.
**"Looks"** = screenshots to the owner before release.

### Stage 0 — Plumbing: the second address, the second app, v1.0.0 (no looks)
- `src/version.js` → `'v1.0.0'`. Check the build's update number (1000000) and `tests/logic/version.test.js`.
- **Pages, both builds in one site:** the workflow runs on pushes to `main` **and** `autobattler`. Whichever
  triggered it, it checks out **both** branches, puts main's `index.html` + `version.txt` at the root and the
  branch's at `auto/`. Keep `concurrency` so only the newest run deploys. **The same workflow file must land on
  `main` too** (a push to main must not wipe `/auto/`): this is plumbing, so commit it to `main` (no version bump
  needed for a workflow-only change; check with the PM) and merge `main` into `autobattler`.
- **The second APK:** built only when `autobattler` triggered the run. Same shell, but `applicationId
  'com.caverunner.auto'`, app name "CaveRunner Auto", `PAGES_BASE` = `…/CaveRunner/auto/`, release tag `app-auto`.
  Drive it with Gradle properties or a build flavour, so `main`'s app is byte-for-byte the same as before. Don't
  touch `LOCAL_URL`. Update `android/README.md`.
- Done when CI is green on both branches, `…/CaveRunner/version.txt` still shows main's version,
  `…/CaveRunner/auto/version.txt` shows `1000000 v1.0.0`, and the release `app-auto` has an APK. The PM gives the owner the link.

### Stage 1 — The run model (pure, no looks)
`src/auto/run.js` (+ README, `pure.js` export, `types.d.ts`):
- `newRun()`: tier 1, `players: [p]` (up to 4; each has `col` from `TITLE_COLS`, `guns: [g|null ×4]`, `active`,
  `exo: { hp:[5], speed:[5], jet:[5], carrot:[5] }`, `perks: [6]`, `hp`, `alive`), and `bag`: **70 slots** (10 × 7)
  of items `{ kind: 'gun'|'mod'|'exo'|'perk'|'gold'|'red'|'green', … , n }`. Gold and gems are stacks; mods stack by
  `stackKey`.
- Pure moves: `bagAdd` (returns what didn't fit), `fitMod`/`unfitMod`, `fitGun`, `fitExo` (category check),
  `fitPerk`, `setActive`, `scrap(item, tier)` → gold, `spend(kind, n)`, `addPlayer(run)` (costs one green).
- `exoMod(cat, tier)` items; **`exoBonus(player)`** sums the fitted ones from `STAT_PERKS` values (hp adds;
  speed, fuel and refuel multipliers stack additively on their excess: two +8% = +16%; carrot adds levels,
  capped at V); `playerStats(player)` folds exo + `perkBag`.
- Prices: `gunPrice(tier)`, `exoPrice(tier)`; the `scrap` table. Dev knobs.
- One save: `src/auto/save.js` (`loadRun`/`saveRun`, its own localStorage key, versioned).
- Done when `tests/logic/auto-run.test.js` covers every move, stacking, scrap, bag overflow, and save round-trip.

### Stage 2 — The screen: four sections, the scene in the top one (looks)
- `src/ui/auto/AutoScreen.js`: top **play area** (the scene's canvas, ~55% of the height), **context nav** row,
  **bag** (vertical scroll, 10 rows × 7), **buttons** row (B red pill, `<` `>` dark circles, A green pill), as the
  mock-up. It uses the menu's colours, fonts and dark panels (look at `.title` / the menu window in `style.css`).
- The nav shows the player row: 4 circles, the player's colour ring, an empty dark circle for locked ones. Taps do
  nothing yet. The bag shows empty slots plus the run's items (icons from `gunart`/mod glyphs) with stack counts.
- The scene runs in the play area (for now the plain menu scene with `S.runners` cut to the run's player count, the
  camera's pinch and follow from `ui/title.js`).
- `Root`: the title's ▶ starts the auto screen (one save, so no slots: the title keeps ▶ and ⚙ only). The old
  `App` isn't mounted on the branch. Pause ⏸ (top right of the play area) keeps the pause menu (volumes, exit to title).
- Looks: the screen at 412×880, in a quiet moment and a busy one.

### Stage 3 — The hub strip (looks)
- `src/auto/hub.js`: a fixed strip (no scrolling ring): the steel shop room look (brick and steel, ceiling tubes
  that stutter on as on main, `shoplights`), and the stops, left → right: **enter teleporter, gun machine, exo
  machine, mod machine, perk machine, exit teleporter**, evenly spaced. Port the machines' and pads' drawing from
  `game/render/vend.js` / `shops.js` / `pads.js` into the strip's painter. The exo machine is new: give it its own
  hue and an exo glyph hologram.
- A run begins with one player teleporting in on the left pad (charge, flash, lightning, as on main) in the dark,
  with the lights coming on.
- **Arrow travel:** tap `>` and the team walks to the next stop to the right, easing to a stop just **left** of it
  (just **right** when coming from the right). Tap during travel and it queues the next one. With several
  players, they line up behind the leader.
- **The exit:** at the exit teleporter a "Tap A" prompt (the machine-hint style) shows. A starts the level (stage 4
  hooks it; for now it flashes).
- Every machine shows its asking price on the front (gun and exo machines: gold; mod: 1 red; perk: 1 green).
- Looks: the hub lit, one player at a machine, the exit prompt.

### Stage 4 — The level strip and the autopilot (looks)
- `src/auto/level.js`: a **finite** plan for Mossy Caves from the menu's zones (moss, webs, timber, paved, grove,
  winding; keep their random order rules), long enough for **~5 min** at normal pace (a Dev knob). It has a start
  pad, then the zones, then a **boss arena** (a wide flat chamber), then the **exit pad**. Same seed → same level.
- The team arrives on the start pad in the teleport flash, then runs and flies as on the menu (dig with the menu's saw for now (stage 5 swaps in the clearing rule), jet, keep
  apart), heading right.
- **Pace control** (`src/auto/pilot.js`, pure): normal pace; **slows while an elite is alive and near**; slows
  passing a **chest**; **slows to a stop at the boss arena** until the boss is dead; holding `>` hurries (×1.6,
  knob) and holding `<` stops. The camera follows the team.
- After the boss: the team walks to the exit pad, teleports, and the hub loads (arriving on the enter pad,
  everyone fully healed, tier + 1). Full heal at each level start.
- Done when a logic suite runs a level plan headless (the scene stepped without drawing) from pad to boss to exit
  in a frame budget, and the team never gets stuck (the digging covers walls).
- Looks: the start pad, mid-level, and the boss arena with the team stopped.

### Stage 5 — Real guns in the scene (looks: a shot sheet)
- The players fire **their active gun through `planCast`**, with the real mods' behaviour where the scene can
  carry it. Map `planCast`'s output to the scene's shots (look, speed, size, gravity, drag, bounce, pierce,
  explode, fire, homing, trigger payloads, fields, beams). Mana and recharge as the real gun. Damage is real
  (hits the scene's creatures by their `enemyFor` health).
- List every mod the bridge can't do yet in the stage report and in `src/auto/README.md` (the PM decides what to
  chase). `everymod`-style suite: each mod at least changes something, or is on the list.
- Each player records **damage dealt** and **health** per tick (ring buffers, 30 s) for the stats meters.
- **Starter kit** (section 2): `starterKit(rnd)` in `src/auto/run.js`: a basic 3-slot, no-shuffle gun with a random
  tier-1 projectile (not a digger) in slot 1, and a Buzzsaw (`saw`) into the bag. Every new player gets one.
- **The clearing rule** (section 2) replaces the menu's magic Buzzsaw: `canClear(gun, block)` (pure: which mods
  dig rock, burn webs or timber, blast) and `bestClearer(player, block)`; the player switches to it, clears, and
  switches back. No gun on any player can → the pilot stops and the "Path blocked" hint pulses.
- Looks: a sheet of 6–8 guns firing in the sandbox strip.

### Stage 6 — Enemies, elites, the boss, drops, death (looks)
- Spawns along the level by the zones' home rules, scaled by `enemyFor(id, tier)`; **elites** (`eliteOf`, the Dev →
  Elites knobs; count per level a knob); the **boss** in the arena: a random kind from the roster, scaled huge
  (size ×4, health ×40, damage ×3, knobs), with a health bar over the play area.
- **Drops** (vacuumed into the bag, or waiting on the ground if the bag is full): gold from every kill (as now,
  × `goldScale(tier)`); **gun mods: rare** (rarer than gold, more common than green, a knob), rolled by the tier's
  mod weights; elites: red gems (+ sometimes an exo mod); boss: **a green gem + an exo mod** (+ gold).
- **Death:** a fallen player drops out (a little teleport-out flicker) until the hub. All fallen → teleport to the
  hub, loot kept, the tier unchanged.
- Looks: an elite, the boss with its bar, loot flying to the team.

### Stage 6b — Blocked zones (looks)
- `src/auto/blocked.js` (pure): the zone kind `blocked` in the level plan's rotation (~2 a level, a knob), based on
  a random other zone; a severity roll 0..1 (knob range) from a small inconvenience (a partial wall you can jet
  over or chip through) to blocked all the way through.
- The blockage fits the base zone: **mine works** → a collapse (rubble and broken frames) or a dead end;
  **vegetation caves (moss, grove)** → a rounded-off dead end; **web caves / winding tunnels** → a web thicket whose
  overlapping slow-downs bring the team to a halt (webs slow players inside them: add that to the scene if it isn't
  there), cleared by fire or digging; **plus 20 more variations** the agent invents (fallen timber, a rockslide, roots,
  a flooded/silted pass, a jammed mine cart, a brick wall, crystal growth, a nest plug, …), each listed with the
  zones it suits and what clears it (dig, blast, fire).
- Each block is tagged with what clears it, so stage 5's `canClear` decides who can get through.
- Done when a logic suite generates many seeds: every variation appears, severity spans its range, a team with
  a digger always gets through (headless, frame budget), and a team with only the starter projectile stops at a
  full block.
- Looks: a sheet with each of the ~23 variations (one shot each, phone size), sent to the owner to strike or keep.

### Stage 7 — Level cleared (looks)
- After the boss's loot is vacuumed: **LEVEL CLEARED** in the CAVE RUNNER style (`titleText`'s pixfont,
  extrusion, hot gradient, glow, shine), with a fancy letters entrance (letters drop in one by one, bounce, spark
  burst, a shine sweep) for ~3 s, then it fades, and the team walks on to the exit pad.
- Looks: three frames of the animation (or a short GIF if easy).

### Stage 8 — The context nav and the bag (looks)
- The nav follows the mock-up: **players** → tap one → **Guns / Exo suit / Perks / Stats** (4 circles; the tapped
  player stays highlighted) → **Guns** → its 4 gun slots → tap a gun → **its mod slots** (square tiles in a row,
  scrolling sideways when there are more than fit). **Exo suit** → Max Health / Movement Speed / Jetpack / Carrot →
  that category's 5 slots. **Perks** → 6 slots. **B** goes back one level, and A confirms where something asks.
- **Drag from the bag** onto a slot (mods into mod slots, guns into gun slots, exo mods into their category,
  perks into perk slots); drag a slot item back down to the bag. It all works **while the level plays** (no pause).
  The same rules as the Bag today (a tap opens the card: `ModCard`/`GunCard`/`PerkCard`).
- **Grab radius:** a touch grabs an item only within a radius of its icon's centre (a knob, ~35% of the tile).
  Anywhere else it scrolls the bag vertically.
- Looks: the four mock-up states for real, plus the exo and perk slots.

### Stage 9 — Gun swap arc, stats meters, scrap (looks)
- **Gun arc:** press and hold a player's icon (in the player row, ~350 ms), and 4 circles fan out in an arc above it
  (that player's guns, empty ones dim). Drag to one to highlight it, release to make it active. Releasing on none cancels.
- **Stats:** the row becomes two running graphs (the `GunFire` DPS graph's look): **red = damage dealt, green =
  health**. A tap cycles **5 s → 15 s → 30 s** history, and the current span shows small in a corner.
- **Scrap:** drag any bag item onto the gold stack → it becomes gold (`scrap`), with a little coin burst.
- Looks: the arc open, the stats row, a scrap.

### Stage 10 — Throwing gold and gems; the machines pay out (looks)
- From a gold (or red or green) stack in the bag, up into the play area, in the hub:
  - **Flick:** a quick swipe throws **one** nugget on the flick's trajectory (screen velocity → world velocity).
    It bounces on the floor (`stepNugget`) and the nearest machine that takes it sucks it in.
  - **Press, move, hold:** after moving away from the stack and holding, nuggets stream out in the moved
    direction, speed × the distance moved; slow at first, ramping to a stream (knobs).
  - **Hold still** on the stack: the whole stack lifts as one lump to the finger, and drops where released.
- Machines take only their currency (the gun and exo machines take gold, the mod machine red, the perk machine
  green). Anything else bounces off and is vacuumed back after a while.
- **Partial payment:** a ring loading bar around the machine's hologram logo. Paid in full: shake and lights as
  today, then it spits out the item, which **flies into the bag** (gun machine: one gun at the tier's level via
  `shopGun`; exo: a random exo mod of the tier; mod: a mod via `crystalRoll`; perk: a perk). Change carries over.
- Throws work only in the hub (in a level a throw is ignored, and the stack snaps back).
- Done when a browser suite pays each machine by flick, by stream and by lump.
- Looks: a throw mid-air, a half-paid ring, a gun flying to the bag.

### Stage 11 — Chests (looks)
- Chests placed at random along a level (count a knob, ~3 in 5 min, never in the boss arena). Contents are rolled
  on open: gold (common), a mod, an exo mod, a red gem, rarer a perk or a green gem (weights are knobs).
- While a player is in range (a knob), a "Tap A" prompt shows over it and the team slows (stage 4's pilot). A opens
  it: the lid pops, the contents spill out, bounce, and get vacuumed.
- Looks: a closed chest with its prompt, and one spilling.
- **Built (branch stage11, not merged, waiting on the owner's look at tools/chestshots.js c1/c2):** auto/chests.js; no browser suite of its own yet (chestshots taps the real A button and checks it opens).

### Stage 12 — Extra players (looks)
- Drag a **green gem** from the bag onto an **empty player circle** → `addPlayer`: the new player teleports in
  beside the team (pad flash and lightning wherever they are, hub or level) with their own empty slots, plus the
  starter kit (`starterKit`: the basic gun, and a Buzzsaw into the bag). The team keeps apart, as the menu's four do. The camera frames them all.
- Looks: the teleport-in, and the nav with 2–3 players.

### Stage 13 — Save, resume, cleanup (no looks unless something visible changes)
- Autosave in the hub (after any change) and at a level's end. The title's ▶ resumes. Mid-level quit → resume in
  the hub, bag kept. Pause → exit to title saves.
- Remove the old play screen's leftovers from the branch's build path (sticks, old HUD, old shop menus, the
  buy/sell machines): **don't delete pure modules that main still needs** (the branch may merge back some day).
  Retire their suites as in rule 4.
- README.md (player-facing) on the branch: rewrite "how to play" for the auto-battler.

### Stage 14 — Integration and wrap-up (PM)
- A full loop on the phone-size page: new run → hub → buy a gun → level → elites → chest → boss → cleared →
  hub, tier 2 → add a second player. A browser suite `auto-loop` that does it with the test hook (speeded up, capped).
- Timing on a mid phone (CPU ×4 slow in Chromium): note the frame time. The levers are in HANDOVER's title notes.
- Docs: HANDOVER (the branch's state, what's waiting on the owner), CHANGELOG, every touched README, this file's Log.

## 6. My defaults (the owner may retune; all are Dev knobs)

Gun price = `shopGunPrice(tier)`; exo price = 60% of that; scrap = 25% of the price (gems: red 40 × goldScale,
green 150 × goldScale). Mod drop 3% of kills, exo from an elite 25%. Boss: size ×4, health ×40, damage ×3. Elites 3
a level. Chests 3 a level: gold 45%, mod 25%, exo 15%, red 10%, perk 3%, green 2%. Hurry ×1.6. Elite slow ×0.4,
chest slow ×0.5. Grab radius 35% of a tile.

## 7. Log (the PM keeps this)

| Stage | State | Version | Notes |
|---|---|---|---|
| 0 | done | v1.0.0 | Done by the PM (small plumbing). Workflow on both branches (deploys both; APK `app-auto` via `-PcaveAuto=true`). Pages env: owner allowed `autobattler`. |
| 1 | done | v1.0.1 | Agent, ~8 min. Names clash-free: `autoGunPrice`/`autoExoPrice`, `loadAutoRun`/`saveAutoRun`. Exo mods stack in the bag by cat+tier, perks by id; fitting onto a full slot swaps; `fitPerk` refuses `st_*`; knobs `autoGunBase/Grow/ExoPrice/Scrap/Red/Green/ModGold`. |
| 2 | done | v1.0.2 | Agent, ~9 min; owner OK'd shots (`tools/autoshots.js`). `ui/scenecanvas.js` `runScene(canvas,{size,make,over?,paused?})` shared with title; `titleScene(..., { runners })`; `PauseMenu` `label`. Retired: `title` slot/old-pause checks. `tools/titleshots.js` broken on the branch (clicks old slots; not a test). Gun icon dark on its slot (noted). |
| 3a | done | v1.0.3 | Agent, ~10 min (split by PM: 3a look + teleport-in; 3b travel, exit prompt, prices). `HUB_STOPS`/`hubStopX(id)`, `titleScene opts.hub`, materials STEEL/BWALL/SWALL, runner `hide`/`stand`, `runScene` make may return `warm`. Owner: keep the empty space above the room (plans for it); jetpack icon → 🚀 (`EXO_GLYPH`, PM). |
| 3b | done | v1.0.4 | Agent, ~10 min. `hubGo(S,dir)`, `hubStandX`, state `H.lx/at/goal/dir/tier/exitT`; `hubExit(S)`, `hubAtExit`, `hubExitFlash` (stage 4 hooks these); `hubPrice(id,tier)`; `hubScene(vh,seed,n,tier)`. Leader stands ON the pads. Knobs group `autohub`. |
| 4a | done | v1.0.5 | Agent. `levelPlan`, `levelScene(vh,seed,n,plan?)`, `levelDone`, `levelHold`, `levelState` (`L.elites/chests/bossDead`), phases arrive/run/arena/out/exit; `pilotPace`/`pilotEase`. Knobs `autolevel`. Notes: players drift while "stopped", menu creatures still spawn (stage 6), players overlap on arrival. |
| pill | done | v1.0.5 | Owner's change after 4a, agent ~10 min. `<``>` → one pill stick (`.apill`): hub free roam (`hubStick`, run + jet; `hubGo`/`hubStandX` and `autoHubOff/Ease` removed; knobs `autoHubRun/Jet/Space/Walk`), level pace (`levelHold`: right × `autoLvlHurry`, left × `autoLvlSlow`, never 0). Nit: knob pokes a few px above the pill when pushed up. |
| 4b | done | v1.0.6 | PM built it (small wiring). `hubExit` hides everyone + ignores the stick after; `hubLeft(S)` (`HUB_LEAVE` 0.7 s); `run.seed`, `levelSeed(run)`, `healRun`, `levelCleared` (tier + 1, heal); `runScene` opt `next(S)`; AutoScreen `where` ref (hub/level), saves on each swap. Mid-level quit resumes in the hub (stage 13). Check later: the arena floor looked hilly in `l3-arena.png` (where the team stops vs. the flat span). |
| 5a | done | v1.0.7 | Agent ~27 min (past the box; the PM took the gun sheet, `tools/gunshots.js`). Split by PM: 5a guns/kit/meters, 5b the clearing rule. `art/scenegun.js` (planCast → scene shots), `titleScene opts.team`, `levelScene(..., team)`, `starterKit`/`STARTER_SHOTS`, `auto/meters.js` (`L.meters[i]`), knobs group "Auto: guns". `GUN_TODO` 25 mods (statics/fields, knock, crit, spiral, cluster…). Starter gun numbers a guess. |
| 5b | done | v1.0.8 | Agent ~9 min. `auto/clear.js` (`canClear` scores: bore×3 + eat + explode/2, fire × `autoClearFire` for web/timber; scorch pits don't count), `bestClearer`, `teamClearer` (self first, then a living teammate: the runner borrows the gun). The old carve still runs while the clearing gun fired within `autoClearGap`. `L.blocked`, `pilotPace({blocked})` → 0, `.ablocked` hint (polled 200 ms), `window.__autoScene` under `__TEST_TITLE`. Starters can't dig till stage 8. |
| 6 (1) | done | v1.0.9 | Agent ~9 min (split by PM: part 1 enemies/elites/boss/death, part 2 drops). `auto/enemies.js`, `titleFoeAt`, `S.tier`, `opts.level.hurt` → `levelHurt`, `r.out` flicker, `L.failed`/`levelLost` → `levelFailed(run)`; elites in `L.elites` {x, alive, u, f}; boss `levelBoss(S)` → `.abossbar`; `autoLvlBossT` 120 s fallback. Knobs group `autofoes`. `auto-level` sets `autoFoeElites = 0`. Silk does no damage yet. |
| 6 (2) | done | v1.0.10 | Agent ~8 min. `auto/loot.js` (`killLoot`, `bagFits`, `lootCol`), `S.loot` pickups, `levelScene(..., run)` hooks loot/fits/take/lootCol, `L.bagV` for the bag's redraw, `titleKill` exported. Owner: gems as the old crystals at full size (PM: `drawNugget` `CRYSTAL_R`; mod/exo diamonds r 5). Knobs `autoloot`. |
| 6b (1) | done | v1.0.11 | Agent ~23 min + PM feedback rounds. `auto/blocked.js` (`BLOCK_VARIANTS` 11, `rollBlock`, `planBlocks`, `blockCell`/`blockCol`/`blockKind`, `webSlow`), `levelPlan(seed, min, blocks)`, titlescene `jetOver`, TM 14–22. Owner: shapes vary (width, place, sloped ends `rl/rr`, `lean`; knobs `autoBlockThin/Wide`), roots organic (`rootAt`), crystal → stalactites (rock). Partial blocks leave PH×1.6+12 of room. Part 2 dropped (owner, 2026-10-10: happy with the 11; each lands on a random zone, enough variation). |
| 7 | done | v1.0.12 | Agent ~8 min. Phase `cleared` (`L.lootT`, `L.clearT`; waits for `S.loot`+`S.coins` empty or `autoClearWait`), `titleLetter` factored out of `titleText`, `art/cleared.js` (`clearedText`, `clearedLand`, `clearedShine`, `CLEARED_N`), `levelClearedAge(S)`, AutoScreen `over`. Knobs `autoClearT`/`autoClearWait`. |
| 8a | done | v1.0.13 | Agent ~8 min + 4 PM/owner rounds. Split by PM: 8a nav, 8b drag. `auto/nav.js` (`navStart/Open/Back/Row`, `NAV_MENU`, `EXO_NAMES`, `MACHINE_COL`), `NavRow`; `ui/auto/icons.js` (`PixIcon` pixel maps `NAV_ICONS`, `HelmetIcon` via sprites `helmetIcon`/`paintHelmet` + `pixelSprite`, `GlyphIcon` ink-centred `GLYPH_PX` grid, no glow). |
| 8b | done | v1.0.14 | Agent ~10 min + 3 PM/owner rounds. Drag/tap in AutoScreen (ghost `.aghost`, `.drop`, grab handle by `autoGrab`, 6 px to drag), `CardPop` (`.acard` theme), `ExoCard`; `itemEdge` (`--ic`), `PixIcon tint`/`tintShade`, `CARD_ICON` in cards.js. Not done: gun out of its circle, slot-to-slot, bag reorder. |
| 9 | done | v1.0.15 | Agent ~13 min. `holdHelm`, `GunArc`, `StatsRow`/`paintGraph`, `CoinBurst`; nav.js `gunArc`/`arcPick`; meters.js `meterTail`/`STAT_SPANS`/`nextSpan`; titlescene `leaveItem` (`left` loot, owner's ask). Knobs `autoHoldMs`, `autoArcR`. Helmet tap opens on release. Polish later: the arc at the left edge, faint empty circles. |
| 10 | done | v1.0.16 | Split by PM: 10a throws (agent ~10 min: `auto/throw.js`, `H.thrown/paid/back`, `throwPress`, `drawThrown`, knobs "Auto: throw"), 10b payout (agent ~14 min: `auto/payout.js`, `run.paid`, `stepPay`, `payRing`, hub `fits/take`). PM: gun sprite in flight, drawPrice regex. Owner to tune the stream later. |
| 11 | done | v1.0.17 | Agent ~24 min (past the box). `auto/chests.js` (`chestPlan`, `chestRoll`, `chestInRange`, `chestOpen`, `chestsStep`), titlescene `titleSpill`, leveldraw `drawChest`, knobs "Auto: chests" (9). `auto-level` sets `autoChestN = 0`. |
| 12 | done | v1.0.18 | Agent ~10 min. `auto/addrunner.js` `sceneAddRunner(S)`, titlescene `titleRunner`/`zapArc` exported, empty circles as green-only drop targets (a hub throw turns into a drag over them), `window.__autoHub`. Camera follows player 1. |
| 14 | done (owner's phone OK pending) | v1.0.20 | Agent ~20 min: `auto-loop` suite, `tools/autoperf.js`. Boss not finished by the team (fallback timer); fresh runs stop at rock until the Buzzsaw is fitted. |
| 13 | done | v1.0.19 | Agent ~20 min. Save gaps filled (level drops saved), ⏸ New run (two taps), old App + levelgen out of the build (index.html −401 KB), 91 old browser suites → `tests/retired/`, README how-to-play. Test `auto-save`. |
| feedback round 1 | done | v1.0.21 | PM alone, no agent. Owner's notes: hub movement as the old game (hubMove on core/consts WALK/JET/GRAVITY, knobs autoHubRun/Jet removed); starter items missing (old saves from before 5a: `kitMissing` on load); the rock wall: "not in the first 20 s, random after" → `plantWall` (one of the level's own blocked zones made full past a random time; a custom-drawn wall was tried and dropped: the owner wanted the stage 6b looks) + `levelFree` (knobs autoWallMin/Max, 0 off), suite `auto-wall`, shot `tools/wallshots.js`. Open item 1 fixed: boss targeted by its edge and from behind, `autoBossHp` 40 → 12, suite `auto-boss`. Suites auto-blocked / auto-clear set the wall knobs to 0. |
| feedback round 1 (b) | done | v1.0.22 | PM alone. Owner: lateral hub speed held back (the pill's dy was scaled by its tiny half-height: now the old Stick's maths, `PILL_REACH` 54 px, knob free past the pill); too many enemies (`levelSpawn`: trickle 4 s / 3 alive → 1.5 s / 10 by the arena, knobs autoFoeGap0/1, autoFoeCap0/1). Found: jetOver missed a gap he was already flying through (scan from below his feet). `auto-loot` logic flaked once (passed 5/5 alone). |

## 8. The PM's kick-start prompt

Paste this into a fresh Claude Code session on the `autobattler` branch:

```
You are the project manager for CaveRunner Auto, the auto-battler pivot on the `autobattler` branch.
Read CLAUDE.md, HANDOVER.md, then AUTOBATTLER.md in full. AUTOBATTLER.md is the plan: the owner's
brief, their quiz answers (decisions, don't reopen them), the facts, the ground rules, 16 stages (0-14 and 6b), and
the Log you keep.

How you run it:
- Work through the stages in order, ONE subagent at a time (never two at once). Spawn each with
  isolation "worktree", branched from `autobattler`. Its brief: "Read AUTOBATTLER.md sections 1-4 and
  stage N, CLAUDE.md, and the READMEs of the folders you touch", plus the facts it needs from earlier
  stages' reports (files made, names, knobs, what failed), so it doesn't re-explore.
- Every brief carries these limits, word for word:
  "TIME BOX: 20 minutes. STOP RULE: if you are stuck, looping on the same failure, or past the box,
  commit what passes, stop, and report exactly where you got to and what's left. Use targeted tests while
  iterating (node tests/run.js <name>); run the full `logic` set ONCE at the end; run a browser suite only
  if it covers your change. Never wait on a test without a cap; if a suite hangs or fails the same way
  twice, stop and report it rather than retrying. At most 2 screenshot rounds (412x880, saved under the
  repo's tools/ shot scripts, not the scratchpad). Do not push. Do not merge. Report: what you built,
  files, test results (pass/fail with names), screenshots' paths, what you could not do."
- Check on the running agent about every 10 minutes. If it's looping, or past its box with nothing
  committed, stop it, take what's committed, and either finish the rest yourself (if small) or brief a
  fresh agent with a narrower slice. A stage that's too big: split it.
- Do small things yourself: follow-ups, a tweak, a knob, the owner's feedback rounds on a stage that's
  already built. Agents are for building stages only.

After each stage:
1. Review the diff in its worktree: does it fit with what's already there (names, layers, README rows,
   pure where it can be, the menu animation and `slots` still passing)? Fix small misfits yourself.
2. Merge it into `autobattler`. Run `node tests/run.js logic` (known failures: `spider`; browser
   `vendshop`). Old-game suites retired by a stage must be listed in its report.
3. Looks? Send the owner the screenshots (SendUserFile, a line each), and WAIT for their OK or changes
   before releasing. Do their change rounds yourself if small.
4. Bump src/version.js (v1.0.x; ask the owner if a stage seems a v1.Y.0), update the docs (HANDOVER,
   CHANGELOG, folder READMEs, the AUTOBATTLER.md Log), commit, push `autobattler`. Confirm CI is green and
   https://5rob.github.io/CaveRunner/auto/version.txt shows the new version. Tell the owner in one or two
   short lines what landed and what to try in the CaveRunner Auto app.
5. Never push to main, except stage 0's workflow file (plumbing, as stage 0 says).

Keep the owner's style: short, plain messages; no long plans; show working things.
Keep the owner's credits in mind: no agent runs past its box, and no idle polling.
You are done when stage 14's full loop works on the phone, the docs are current, and the owner has OK'd
it. If a stage is blocked on a question only the owner can answer, ask them briefly and move to the
next stage that doesn't depend on it.
Start with stage 0.
```
