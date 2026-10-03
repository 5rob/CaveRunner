# CaveRunner

A single-page browser game: a jetpack cave shooter with Noita-style wand building.
`index.html` is the whole game, but it is **built**: **edit `src/`, never `index.html`.** `node
tools/build.js` (esbuild) bundles `src/main.js` with `src/shell.html` and `src/style.css` into it;
`node tests/run.js` builds first. `index.html` stays committed (CI, Pages, the APK, `serve.js` read it):
commit it with the `src/` change. The module refactor is done (`REFACTOR.md`: decisions D1–D21, and
**Found along the way**, the to-do it left). History: `CHANGELOG.md`. Where things stand: `HANDOVER.md`.

## How the owner likes to work

**Talk briefly.** Short, concise replies. Minimal technical jargon unless they ask about
something specific — then give them the real mechanism, not a summary. They do ask, and
they want the actual answer when they do.

**Iterate fast, don't plan at length.** They'd rather see the thing working than read a
plan for it. Build the idea, show it, adjust. Don't open a planning session for something
you could just try. Don't ask permission for the obvious next step.

**Don't stress about polish** unless they ask for it. Working beats tidy.

**Design work gets their approval before it ships.** Anything they'll *see* — a new look, a menu
or screen, an animation, an effect, a layout — goes to them as **screenshots first** (send the files
with SendUserFile; phone size, 412×880, the real game via a browser suite or a probe), with a line
on what each shows. Then **wait for their feedback or OK** and do a round of changes if they ask,
*before* it goes onto `main`. Build it to show it, yes (that's the fast iteration above), but don't
release design they haven't seen. Logic, fixes and plumbing don't need this; looks do.

**Finish every task with the docs up to date, unasked.** A fresh session must be able to pick up
from the files alone, and the owner shouldn't have to ask for it. Before calling a task done:
`HANDOVER.md` (where things stand, what's released, what's waiting on the owner), `CHANGELOG.md`,
the README of every `src/` folder you touched (new files, new rules), the version line below,
`README.md` for player-facing changes, and anything in `REFACTOR.md`'s **Found along the way**
you fixed or found. It's part of the task, not an extra.

Their words, from the first session:

> This is just a fun personal project, so don't focus on production level
> infrastructure, just keep it simple and focus on just what I ask for. Reduce
> technical jargon to a minimum unless I ask about something specific.

So: do the thing asked, no more. No frameworks, no package.json for the game itself.
The root `package.json` is **dev tooling only** (esbuild, ESLint, TypeScript, `playwright-core`):
`npm install` once per checkout. The game still ships as one `index.html` with no dependencies.

They play on a phone through the **installed Android app**, so **every change has to work at phone
width with touch**. The owner's rules for each area are in that folder's README; a Dev-panel report
they paste becomes the new defaults (`src/dev/README.md`).

**`node serve.js`** serves the game to their phone over the LAN for a quick look without a release,
at **http://192.168.86.233:8000/** (the PC's wifi address: only while `serve.js` runs and the phone is
on the same network; if it stops answering, `ipconfig` and update this line). Run `node tools/build.js
--watch` alongside so a save in `src/` rebuilds. It answers only for `index.html` — deliberately:
`.claude/settings.json` holds an API token a general static server would hand to the whole wifi. Don't replace it.

## The loop

1. Change `src/` (the folder READMEs say where things are and the rules there).
2. Test: `node tests/run.js` (see **Testing**). Add a suite for anything new.
3. **Looks changed? Screenshots to the owner, and their OK** before going on (above).
4. Bump the version in `src/version.js` (below), and **update the docs** (above: HANDOVER, CHANGELOG,
   the folder READMEs, `README.md` for player-facing changes).
5. Commit, then **get it onto `main`** — that is the release: CI (`.github/workflows/android.yml`, on
   `main` only) deploys Pages and rebuilds the APK. A branch + merge is fine.
6. **Confirm it landed** (public API, no token): `.../actions/runs?per_page=5`, `.../runs/<id>/jobs`
   for the failed step, `.../check-runs/<job-id>/annotations` for the error (logs need auth); then
   `https://5rob.github.io/CaveRunner/version.txt` shows the new `<number> vX.Y.Z` and the app offers the update.
   (No artifact publish; `https://claude.ai/artifact/2rarFzJoTseCKXhTPwMyLT` and `serve.js` are fallbacks.)

**Current version: v0.0.134** (release channel `main`). **The version number is not optional.**
It's **major.minor.patch** (since v0.0.132; before it a single `vNN`, up to v131): the owner's
grouping — a **major release** bumps X, a **major update** Y, a **minor update** Z (reset the parts
after the one you bump). Ask the owner which kind a release is if it isn't obvious; small fixes and
tweaks are a minor update. The app offers an update only when `version.txt` is newer: no bump, no
prompt, and the owner debugs a fixed bug. One place: `export const VERSION = 'vX.Y.Z';` in
`src/version.js` (that shape, single quotes, each part under 1000). The build writes it as an
un-bundled `<script>` line, fills `<title>` (`{{VERSION}}` in `src/shell.html`), and works out the
**update number** X × 1,000,000 + Y × 1,000 + Z (0.0.132 → 132, 0.1.0 → 1000) into a comment
`<!-- VERSION = 'v132' -->`: the shape an app installed before semver parses (`VERSION = 'v(\d+)'`),
so it keeps updating. CI writes `version.txt` as `132 v0.0.132` (old apps read the first number).
`tests/logic/version.test.js` runs the old app's reading against the built page. It's on screen: how
the owner says which build they see. Bump before you push to `main`, never after.

## The Android app

A thin WebView shell in `android/` (`android/README.md`). It plays offline (bundles `index.html` +
React): the two React CDN tags are rewritten to the bundled copies in **two places kept in sync**,
`android/prep-assets.js` (build) and `localize()` in `MainActivity.java` (each update); the canonical
`index.html` keeps its CDN tags (a new React version: both rewrites + the two files in
`android/app/src/main/assets/`). On launch, `onResume` and every 2 min it checks Pages' `version.txt`
and offers the new `index.html`. CI builds the APK (release tag `app`, the committed
`android/debug.keystore` so it installs in place) — nothing builds on the PC; reinstall only when shell
code changes. `assets/index.html` is git-ignored. Don't change `LOCAL_URL`'s host (the save lives there).

## Where things are

`src/shell.html` (the page, React CDN tags, the build's slots), `style.css` (all CSS, light/dark),
`main.js` (mounts `App`), `version.js`, `pure.js` (re-exports all for the logic suites), `types.d.ts` +
`globals.d.ts`. **Each folder's README.md: its files and its rules — read it before changing it.**

| Folder | Layer | What |
|---|---|---|
| `core/` | 1 | world size, tuning, fog/sight numbers, `COL`; small helpers |
| `dev/` | 1 | `DEV` and every Dev-panel knob table |
| `data/` | 2 | themes, creature types and rosters, perks |
| `spells/` | 3 | `MODS`, drops, guns, `planCast`, `tracePath`, the advisor, the bag's sim |
| `world/` | 3 | `makeLevel`, strata, zones, decoration, nests, nav, vision + fog rules, the fire engine |
| `creatures/` | 4 | creature brains and sprites; **how to add a creature** |
| `art/`, `audio/`, `save/`, `replay/` | 4 | sprites and props; sound; autosave; death replay (pure part) |
| `game/` | 5 | `Game`, `W`/`G`/`F`, the test hook; `systems/` (step's parts), `render/` (draw's parts), `creatures/` (`ACTS`) |
| `ui/` | 6 | React: `App`, HUD sticks, cards, the Bag, the Dev panel, GunSwap, Witness |

**Layer rule:** a module imports only from its own layer or layers above it (lower numbers), never
from `main.js`. Everything outside `game/` and `ui/` is pure and top-level, so the logic suites call
it directly. **Keep it that way:** if a new mechanic can be a pure function, make it one.
**Editing:** Unicode is stored raw in `src/` (`·`, `—`, `×`, `Ω`), not `\uXXXX`: match the literal
characters in a script. `core.autocrlf` is on: edit with the Edit/Write tools or CRLF-safe node
scripts, not `sed -i`; Git Bash heredocs eat backslashes.

## Testing

**Write tests into the repo, never the scratchpad** (a session's suites were once lost that way): in
`tests/logic/` or `tests/browser/` from the start, committed with the change; a probe worth keeping
moves into `tests/`. No machine paths, no assuming LF (loaders normalise `\r\n`). Before finishing,
`git status`: untracked files under `tests/` are about to be lost.

```
node tests/run.js           # everything
node tests/run.js logic     # the fast ones, ~2.5 minutes
node tests/run.js browser   # Chromium, ~12 minutes, one at a time
node tests/run.js advice    # anything matching "advice" (one filter)
node tests/determinism.js   # same scripted run on HEAD's build and this tree's, frame by frame
```

Every run first builds, then the **undefined-name check** (ESLint, only `no-undef`, over `src/`: a
forgotten import fails only when its line runs) and the **type check** (`tsc --noEmit -p .`; alone:
`node node_modules/typescript/bin/tsc --noEmit -p .`). A report from either fails the run. Types are
JSDoc (files stay `.js`, every one checked); a new function gets `@param` types, a new field goes in
`src/types.d.ts`. **No comment inside an expression** — esbuild keeps it, so it lands in `index.html`:
no inline casts `/** @type {X} */ (expr)`, no `// @ts-expect-error` inside an object or array literal;
type the declaration instead (D21). A `@ts-expect-error` above a statement is fine (say why).

**Logic suites** start `const G = require('../load');` (it bundles `src/pure.js` in memory: every
export, plus `.source` = all of `src/`'s `.js` as text; a new module gets an `export * from` line in
`pure.js`). Add to these first: fast, and they've caught most real bugs. **Browser suites** drive the
page with `playwright-core` (`tests/chromium.js` finds Chrome; `CAVERUNNER_PLAYWRIGHT`/`_CHROME`
override; never `playwright install`) via `tests/build.js`'s test page: `window.__in` (the input ref),
`window.__lvl` (= `W`, `src/game/testhook.js`: add new reach there), every bundle name on `window`.

**No test may wait forever.** `tests/run.js` kills a suite past `LOGIC_CAP` (30s) / `BROWSER_CAP`
(120s). Every wait-until loop needs a frame or try limit and must fail, not spin. A suite that measures
the canvas in world units pins `DEV.zoom = 1`.

### Test mechanics in a sandbox (the owner's rule)

**A test of one mechanic — a prop, a spell, a creature, a pickup — runs in a sandbox, not a generated
cave** (cave layout kept failing the mushroom and minecart tests). `__lvl.sandbox()` carves a clean
room (open air, flat floor, fog lifted, you on the floor) → `{ x, y, l, r }`; `__lvl.placeProp(proto,
x, room.y)` copies a real prop in; push enemies/pickups/fields into the live arrays; set gun and
position exactly, then measure (`decor.test.js`'s mushroom and minecart are the pattern). New needs
(`sandbox({ roof: true })`) → an option in `testhook.js`. Generated levels only for generation
(tunnels, palettes, rosters, decoration, fresh-floor fog, the `smoke` run). Flaky because of the cave?
Move it into the sandbox; don't loosen it.

**Measure, don't assert.** Prove it (flood-fill the cave, count buried bullets, screenshot the card);
when a test disagrees with you, check which is wrong — it's been both. **Known flakes** (timing or
chance; re-run the one suite alone first): `jelly` spit, `sound` portalOut, `torch`, `lightning`,
`trigger`, `fog`… — the full list is in REFACTOR.md, Found along the way. **Where to look:** sealed terrain → `level` (flood-fills 20 seeds); a floor or creature wrong →
`creatures` (logic + browser); seeing through a wall → `vision`, `torch`; a mod doing nothing →
`everymod`; aim line wrong → the mod is in the bullet loop but not `tracePath`; a card covering
something → `.pop.top`; the editor slow → `buildAdvice` (`SHORTLIST`).
