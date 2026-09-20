# HANDOVER — CaveRunner

A running note for picking the project up in a fresh session. Read `CLAUDE.md` first — it
has the owner's working style, the build/test/publish loop, and the deep per-system notes.
This file is just "where things stand right now" and can be edited freely or deleted once
it's stale.

## Where things stand

- **On-disk version: v48.** Branch: `claude/compassionate-rubin-fcqsif` (pushed).
- Working tree is clean apart from `.claude/` (untracked on purpose — it holds an API token,
  never commit it).
- Full test suite is green (`node tests/run.js`), see **Testing** below for two known flakes.

## What shipped recently (most recent first)

- **v48 — gold nudged up** to sit just under the tops of the sticks (`.gold` `top:5%`).
- **v47 — gold moved into the deck.** The gold readout came off the canvas (was top-right)
  and is now a DOM element (`.gold`) in the gap between the two sticks, just under their tops. Shows a `g` not the word, and truncates thousands to a `k` (`1234` → `1.2kg`) via
  `fmtGold` (pure, above `makeLevel`, tested by `tests/logic/gold.test.js`).
- **v46 — HUD cleared out, moved onto the thumbsticks.** The whole top-left stack (floor,
  enemies, health/fuel/mana bars, gun name) is gone. Health is now a green ring round the
  left stick, mana a gold ring round the right, each wiped clockwise as it drops; fuel is
  the amber wipe in the left stick's top half, draining down to the centre line. Floor
  number is painted big along the shop's back wall. Version top-left, gold top-right.
  Restart moved into the Dev panel; the Dev button is a bare ⚙️ top-right. `draw()` publishes
  `input.current.hud` each frame and each `Stick` reads it on a rAF loop. See the HUD note
  in `CLAUDE.md`.
- **v44–v45 — scrollable panel stats, line-of-sight aggro, dotted trigger ring.** The pickup
  panel's stat list (`.buypanel .prows`) caps at ~3 rows (`max-height:60px`, tightened from
  156px in v45) and scrolls the rest, so a loaded gun/busy mod can't fill the screen — it's
  the one `pointer-events:auto` part of an otherwise click-through panel. Chasers and bombers
  now need an actual sightline to aggro (`hunting` gained a `lineOfSight` gate), so nothing
  chases through a wall. The right stick's amber trigger ring is dotted, and the old dashed
  `.throw` ring (edge of the knob's travel) was removed.
- **v43 — pickup panel is half width and floats above the item.** `.buypanel` is now
  `left:25%;right:25%` (half width, centred) and its bottom edge sits just above the plinth
  instead of at the screen bottom: `step()` measures the item's on-screen spot and stores
  `input.current.promptBottom`, which `App` applies as the panel's inline `bottom`/`maxHeight`.
- **v42 — unified pickup panel, bolder knobs, zoom-aware aggro.** The shop/pickup info
  card and the buy pill are one panel now (`.buypanel`, grown up from the bottom): the
  item card, then a `.pbuy` line reading `Buy <price>` for stock or `Take`/`free` for
  loot. The mod use-example is dropped from the in-game preview (kept in the editor). The
  stick knobs are white rings with a black fill (stroke 1.5× the ring lines). Enemy aggro
  and firing reaches now scale by `1/DEV.zoom` (via the `sees` factor), so zooming the
  camera in no longer lets off-screen enemies hunt and shoot you.
- **v41 — Dev panel.** A **Dev** button next to **Restart** in the view (always reachable,
  not shop-only) opens `DevPanel`: pauses the run but keeps drawing behind a light backdrop
  so the visual knobs preview live. Holds the **All mods** toggle (the old DEBUG shelf,
  `LO.debug`) and five saved, persisted variables — Camera zoom, Torch fall-off distance,
  Fog of war darkness, Outside-torchlight darkness, Base movement speed. Values live in the
  `DEV` object (read by `Game` every frame), defaults in `DEV_DEFAULTS`, saved to
  `localStorage` (`caverunner-dev`) via `devSet`; a blank field restores the default. See the
  Dev-panel note in `CLAUDE.md`. **Owner confirmed it works.**
- **v40 — fog of war fixed.** The v38 lamp was a blanket radial gradient that cleared fog on
  every cell in its radius, so on a phone the whole cave read as lit ("fog missing"). Now the
  lamp is **masked by the fog**: it only brightens ground line of sight has already uncovered,
  and never-seen cave stays dark. `SIGHT` (200) is both the reveal radius and the lit bubble.
- **v39 — perks + two hidden rooms + ground loot.** 30 Noita-style perks, one per hidden
  perk room; a second room holds a +25 max-health heart (raises the cap, no heal); collected
  perks show as icons above the thumbsticks; cave loot now rests on the ground. `PERKS` /
  `perkBag` are pure and above `makeLevel`; the run reads one folded bag `pb`.

## The owner's loop (from CLAUDE.md — follow it every change)

1. Edit `index.html` (single file, no build step).
2. Test: `node tests/run.js` (browser env vars below). Add a suite for anything new.
3. Bump the version in **two** places: `<title>` (line 6) and `const VERSION` near the top.
4. Update `README.md` if it's a player-facing change (the Dev panel is a dev tool, so v41
   left the README alone — that was deliberate).
5. Commit + push to the working branch.
6. **Publish** to the SAME artifact URL so the owner's link keeps working:
   `https://claude.ai/artifact/2rarFzJoTseCKXhTPwMyLT` (pass it as `url`). The publish tool
   makes you read the current live version in full before it will overwrite it.

Talk briefly, iterate fast, don't over-plan. Every change works at phone width with touch.

## Testing on this machine (Windows PC)

- `node tests/run.js` — everything. `node tests/run.js logic` — the fast pure ones. A single
  suite: `node tests/run.js <name>` (e.g. `perks`, `torch`, `fog`).
- Browser suites need these env vars (bash) or they silently skip:
  - `CAVERUNNER_PLAYWRIGHT=C:/Users/5robm/AppData/Local/Temp/cr-pw/node_modules/playwright-core`
  - `CAVERUNNER_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"`
- Do **not** run `playwright install`.
- **Known flakes** (pass reliably in isolation, occasionally fail under full-suite load —
  re-run the single suite to confirm; both are enemy-geometry / random-seed sensitive, not
  regressions): `everymod` (telecast) and `trigger` (double trigger). See
  `memory/cardfit-known-failure.md`.

## Testing on the phone over WiFi

`node serve.js` serves the live `index.html` (re-read per request, so a reload picks up
edits) at **http://192.168.86.233:8000/** — the PC's LAN address. A `serve.js` is often
already running from a previous session (starting a second one errors with
`EADDRINUSE`, which is harmless — it means it's already up). If the address stops
answering, the PC got a new IP: `ipconfig`, then update the address here and in `CLAUDE.md`.
Keep `serve.js` index.html-only — a general static server would expose `.claude/`.

## Ideas raised but not built (from CLAUDE.md)

- **Delayed Spellcast** — a static phenomenon that casts three more spells after a pause; the
  trigger/timer machinery already exists (`payload` on a shot, `firePayload`).
- More perks, or the Noita perk reroll (the owner deliberately skipped reroll for now).
- Noita spell categories only partly mined: Material spells, Add Trigger/Timer, Divide By N,
  the Requirement spells.
