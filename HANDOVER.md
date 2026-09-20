# HANDOVER — CaveRunner

A running note for picking the project up in a fresh session. Read `CLAUDE.md` first — it
has the owner's working style, the build/test/publish loop, and the deep per-system notes.
This file is just "where things stand right now" and can be edited freely or deleted once
it's stale.

## Where things stand

- **On-disk version: v42.** Branch: `claude/compassionate-rubin-fcqsif` (pushed).
- Working tree is clean apart from `.claude/` (untracked on purpose — it holds an API token,
  never commit it).
- Full test suite is green (`node tests/run.js`), see **Testing** below for two known flakes.

## What shipped recently (most recent first)

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
