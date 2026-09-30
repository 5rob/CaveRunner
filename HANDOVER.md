# HANDOVER — CaveRunner

Where things stand, for a fresh session. Read `CLAUDE.md` first (the owner's working style, the
release loop, testing), then the README of the `src/` folder you're working in.

## Where things stand

- **The refactor is done** (all five phases, on the `refactor` branch). The game is modules under
  `src/`, bundled by esbuild into the same `index.html`; every file is type-checked (JSDoc + `tsc`);
  the notes live next to the code (a README per `src/` folder), history in `CHANGELOG.md`.
  `REFACTOR.md` keeps the plan, decisions D1–D21 and the session log.
- **Released: v99** (Phase 3) on `main`; CI green, `version.txt` = v99, the owner play-tested it
  ("plays great"). **Not merged yet: Phases 4–5** (type checking, docs). Both leave `index.html`
  byte-identical to v99, so the merge is a docs/tooling release; **the owner decides when** (bump
  `src/version.js` to v100 then, as always).
- Tests: logic 33/33 and `smoke` green on every Phase 5 commit; the last full browser run was green
  after re-runs of known flakes (end of P3.5).
- `.claude/` is untracked on purpose (it holds an API token): never commit it.

## What's next: REFACTOR.md → "Found along the way"

That list is the to-do the refactor left (nothing in it was fixed in passing). The main ones:

- **Stendari's bomb never sets anything alight**: `enemyFor` (`src/data/creatures.js`) doesn't copy
  `fire`, so `CREATURES.tuli.fire` never reaches `e.k`. One-field fix, but a gameplay change (bombs on
  floors 6, 7, 9 start fires): the owner's call. Two `@ts-expect-error`s mark the reads.
- **A vent reuses `Prop.on`** as "roaring" (`src/game/systems/props.js`), which also means "the arch I
  hang off" for `propAnchored`. Harmless today; give vents their own field (`roar`).
- **Flaky browser checks** (timing or chance; each passes alone): `jelly` spit group (fails on v96 too),
  `sound` portalOut, `torch` falloff/flicker, `lightning` fork, `trigger` explosion carrier (wall-clock
  waits: make it frame-counted), `fog` "next floor is dark again" and "flying on reveals more",
  `everymod` telecast, `rats`, `save`, `archvine`, `decor` vine, `t1spells` bubble, `compare`. Worth
  making them frame-counted / seeded. `shoplayout` and `perks` logic suites run close to the 30s cap.
- Smaller: `paint()` has no callers, `W.best` is written and never read, a static field cast just before
  the portal carries on to the next floor, a replay's reveal uses the live rock, a few comments sit above
  the wrong code (listed there).

## The Android app

Live: APK at `https://github.com/5rob/CaveRunner/releases/tag/app`, game at
`https://5rob.github.io/CaveRunner/`. Pushing to `main` is the release; the app offers the update.
Essentials in `CLAUDE.md`, details in `android/README.md`.

## Testing on this machine (Windows PC)

`npm install` once; `node tests/run.js` (everything), `logic`, `browser`, or one filter. Browser suites
find playwright-core in `node_modules/` and the installed Chrome by themselves (never
`playwright install`). A `node serve.js` may already be running from an earlier session
(`EADDRINUSE` on a second one is harmless).

## Ideas raised but not built

- **Delayed Spellcast** — a static that casts three more spells after a pause; the trigger/timer
  machinery exists (`payload` on a shot, `firePayload`), so it's a small job.
- Noita spell categories only partly mined: Material spells (none), Divide By N, the Requirement spells.
- More perks, or Noita's perk reroll (skipped on purpose for now).
- Death replay: saving replays to watch later, and a "killed by …" caption (needs the source plumbed
  through `hurt`).
