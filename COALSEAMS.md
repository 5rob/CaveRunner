# COALSEAMS.md — finishing Coal Seams (branch `grem`), run by a project manager session

The plan for the rest of Coal Seams, written 2026-10-17 at v2.0.3. A fresh **project manager (PM)** session reads this and
delegates each chunk to one sub-agent at a time. The spec is the Claude Doc (below); this file is the work breakdown, the
rules and the agent brief. Keep it current: tick chunks off here (and in HANDOVER) as they release.

## Rule 1: keep it short (every message, PM and agents)

Token use is the owner's cost. **No narration, no recaps, no plans in chat, no file dumps.** PM to owner: 2–5 lines plus
shots. Agent reports: at most 10 lines. Briefs give the facts so agents don't re-explore. Read files by `Grep` and
`offset`/`limit`, never whole big files (`titlescene.js` is ~4,000 lines). The owner asks when they want more.

## Where things are

- **Spec:** the Claude Doc "CaveRunner: Coal Seams", doc id `62f545c8-940a-4833-9ba9-ff20db771da5`, tab body node
  `64396f1a-182a`, last write **rev 26**. Read it with the docs tools only (load the docs skill first; never web-fetch).
  Sections: Cavern zone, Creatures (Bats: the owner's boids spec and Dev table; Glow worms: inchworm/FABRIK spec, behaviour,
  look, Dev list), Ten decoration ideas (3 = Gas pockets), Screenshots (newest first), Decisions (nothing open).
  Its HTML review copy: https://claude.ai/artifact/BZCnJDP93NEcB1fd99JPXM (stale since rev 23: republish at the end, C7).
- **Done (v2.0.1–v2.0.3, live):** Mossy decorations off, the old mine set on, burnable coal seams + smouldering seams,
  minecart rails, coal heaps + chutes, timber as the old game's measured sets (`src/art/timber.js`). CHANGELOG has each.
- **Code map (for briefs):**
  - `src/art/titlescene.js`: `genCol` (makes each terrain column; Coal Seams branch: `coal = coalAt(S, wx)`), `TM` /
    `TITLE_SOLID` / `FUEL` tables (add a material = a new number at the end of all three), `coalDeco` (props on floors),
    `timberPlan` / `timberCol` / `natCol` (timber lanes), `coalCell` (coal), `cartBoom` (a blast: the pattern for a
    whoomph or a worm's burst), `titleIgnite`, `stepFoes` / `spiderAct` / `jellyAct` (creature brains in the scene),
    `spiderRock` (the Cavern's boulders), `lamp`.
  - `src/art/timber.js` (pure timber sets), `src/art/props.js` `drawProp` (prop art), `src/game/render/titledraw.js`
    (`cellRGB` colours per material; `titlePlantGlow` the glow overlay to copy for glow worms; `titleDark` the darkness and
    lights).
  - Creatures: `src/data/creatures.js` (`CREATURES`, `ROSTERS`: Coal Seams' roster is floor 2; jellyfish `meduusa` and the
    drones go), `src/auto/enemies.js` (`autoFoe`), `src/creatures/spider.js` (a creature module's pattern; README "how to
    add a creature"), `src/world/sway.js` (vine rope sim: the glow worm's body).
  - Knobs: `src/dev/knobs.js` group `'coal'` (Dev → Grem → Coal Seams): `DEV_DEFAULTS` + `DEV_META`, `rangeKnobs` for
    min/max pairs, `colourKnobs`; anything outside `DEV` goes in `src/auto/devcopy.js` (Copy Dev settings must stay complete).
  - Tests: `tests/logic/coal-deco.test.js`, `coal-seams.test.js` (the grem sandbox pattern: CLAUDE.md "Test mechanics in a
    sandbox"). Shots: `node tools/coalshots.js`, `node tools/timbershots.js` (phone 412×880, Grem started at level 2;
    clip close-ups round a thing, as timbershots does).
- **Known failing before this work:** logic `auto-zonelab`. Ignore it.

## Chunks (in order; one agent at a time)

Each chunk: agent builds a quick version → **design shots (stop)** → PM sends them to the owner → owner's OK or changes →
agent finishes (knobs, test, tidy) → PM releases. Logic-only chunks skip the shot stop.

| # | Chunk | Spec / notes | Release |
|---|---|---|---|
| C1 | **Gas pockets** (idea 3) | Invisible methane in low corners (hollows in the floor, dead ends); fire or a blast reaching one sets off a pale blue whoomph (a flash, a soft blast, fire round it; hurts creatures like a cart, smaller). Dev: pockets per screen, size, blast radius/damage, colour. Shots: a whoomph mid-flash. | v2.0.4 |
| C2 | **Stalactites + stalagmites** (Cavern) | Solid rock (block, break when sawn/blasted): hanging points on every underside (roof, boulder bottoms), rising points on floors and boulder tops, shorter and blunter; clusters of mixed lengths; rock colour with a lighter tip. Dev: density, length range, clustering (each). Only in the Cavern (`spider` zone, coal). | v2.0.5 |
| C3 | **Ladders + Cavern timber** | Ladders: background, pass-through, burn like timber; floor → boulder or rock top → rock above; vertical or a little leaning, two rails and rungs. Timber: many sets in the Cavern, under boulders too (a lane on boulder tops/undersides, `timberPlan`), some leaning or broken. Dev: ladder count and lean; Cavern supports per screen, broken share. | v2.0.6 |
| C4 | **Bats** | The doc's boids spec exactly (roosts under any downward rock, slots, Roost/Fly/Return, the Dev table, toggles: players scare bats, debug draw; buttons: reset, scare all). Harmless (Dev bite damage 0). Roster: floor 2 = spiders + bats (+ glow worms at C5); jellyfish and drones out. Two stops: (a) roost + flock look shots, (b) after tuning. | v2.0.7 |
| C5 | **Glow worms** | The doc's spec: rope body with IK feet, inchworm crank gait, FABRIK bend (Ω), roam all surfaces; agro (rear up, rigid, vibrate, mouth pulse); strike; killed → green burst that blasts rock and hurts creatures (chains), the team at half (Dev). ≈ spider health/strike. Look: white-green body, saturated green inner outline, glow; the drifting glow overlay (copy `titlePlantGlow`), orange and faster in agro; flicker; casts green light. Split: (a) body + gait shots, (b) behaviour + blast, (c) look + light shots. | v2.0.8 |
| C6 | **Light check** | Decided: lanterns and glow worms are the only light. Check what else lights Coal Seams (plant glow, fire is fine as fire?) and ask the owner if unsure. | with C5 |
| C7 | **Wrap** | Doc Screenshots section has every release's approved shots; republish the HTML review copy (read it first); HANDOVER, CHANGELOG, READMEs; this file marked done. | — |

## PM duties

- Before each chunk: read only the doc section it needs (by block id from an outline read), write the brief (template
  below) with the facts, start the agent (`Agent`, general-purpose, `run_in_background`). One agent at a time on these files.
- **Check in about every 10 minutes:** `git log --oneline -3` / `git diff --stat`, or `SendMessage` asking for a one-line
  status. Looping, off-task, or past its box with nothing committed → stop it (`TaskStop`), keep what passes, re-brief smaller.
- **Design shots:** the agent stops and reports file paths + one line each. PM sends them with `SendUserFile` (caption:
  what each shows), waits for the owner. Then resume the same agent with `SendMessage` (its context intact) with the
  owner's words, or brief a new one if it finished.
- **Review the result** before release: `git diff --stat`, run `node tests/run.js related` once, check the doc's spec
  points are all there (list them against the diff; ask the agent for anything missing, don't re-read its code).
- **Release (PM does it, not agents):** bump `src/version.js` (patch), CLAUDE.md version line, CHANGELOG, HANDOVER, the
  touched folders' READMEs, `README.md` if players see it; commit; `git push origin grem`; confirm
  `curl -s https://5rob.github.io/CaveRunner/grem/version.txt` shows it (Pages takes a few minutes; failed run →
  `.../actions/runs?per_page=2`, then `/jobs`). Approved shots into the doc's Screenshots section: `upload_asset`
  (Artifact tool) to `https://claude.ai/code/artifact/62f545c8-940a-4833-9ba9-ff20db771da5` → one `create` blob per
  asset (`object "blob"`, `engine "blob"`, `payload {asset: id}`, separate calls) → one prose `insert` after block
  `m1p3g9t91tx.17797` (`### vX.Y.Z: …` + a line + `![alt](blob/<id>)` per shot). Note the new doc rev in HANDOVER.
- Tell the owner in 2–4 lines when each chunk ships. Then the next chunk.

## Agent brief (template; fill the braces, keep it this short)

```
Coal Seams chunk {C#}: {what}, on branch grem (CaveRunner Grem). Read CLAUDE.md's Testing section and {the 1–3 folder
READMEs}; nothing else unprompted. Spec (the owner's, exact): {pasted doc text}. Facts: {files, functions, knobs, patterns
from COALSEAMS.md's code map}.
Rules:
- Time box 20 minutes. Stuck or past the box: commit what passes, stop, report where you got to.
- Be terse. Report at most 10 lines: what's done, files touched, test result, shot paths, open points. No recaps.
- Design first: build the smallest version that shows the look, take phone shots (412x880; clip a close-up round the
  thing; extend tools/coalshots.js or a tools/<name>shots.js), then STOP and report the paths with one line each. Do not
  finish or polish until the PM passes on the owner's OK. At most 2 shot rounds.
- Every new owner-tunable number is a Dev knob in group 'coal' (DEV_DEFAULTS + DEV_META; ranges via rangeKnobs).
- Tests: a logic suite in tests/logic/ (sandbox pattern), `node tests/run.js <name>` while working, `node tests/run.js
  related` once at the end. Commit to grem with the message "{C#} …: not released". Don't bump the version, push, or
  edit HANDOVER/CHANGELOG (the PM does). Edit src/ with Edit/Write or CRLF-safe node scripts; never index.html by hand.
```

## Status

- [x] v2.0.1 step 1 · v2.0.2 coal · v2.0.3 rails, heaps, chutes, timber
- [x] C1 Gas pockets (v2.0.4) · [ ] C2 Stalactites/stalagmites · [ ] C3 Ladders + Cavern timber · [ ] C4 Bats · [ ] C5 Glow worms ·
  [ ] C6 Light check · [ ] C7 Wrap
