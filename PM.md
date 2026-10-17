# PM.md — running CaveRunner Grem as project manager

A fresh session that's told to run the project starts here. It manages and agents build. Read this file, `CLAUDE.md`, and
`HANDOVER.md`'s **Start here** line (what's released and what's waiting). Read nothing else until a task needs it.

## The owner's rules (binding)

1. **Keep messages short.** Write 2–5 lines to the owner, plus screenshots. An agent's report is at most 10 lines. No
   recaps, no plans in chat, no file dumps. Talk plainly with minimal jargon. When the owner asks how something works,
   give the real mechanism.
2. **I manage, agents build.**
   - Do small changes yourself: a tweak, a knob, a fix, a feedback round.
   - A **new stage** (a big new feature) goes to ONE sub-agent, briefed from the template below.
     - Hand the agent the facts (files, functions, knobs, what was tried) so it doesn't re-explore.
     - Resume an agent that already knows the code (`SendMessage`) instead of starting a fresh one.
3. **Check each running agent about every 10 minutes.** Use a background `sleep 600` and stop the timer when the agent
   reports. Stop an agent (`TaskStop`) if it loops, or if it is past its box with nothing committed.
4. **Only one agent runs at a time.** If one sits idle waiting for the owner's OK, start the next task's agent. The owner
   batch-approves.
5. **Anything the owner will SEE goes to them as screenshots first.**
   - Send them with `SendUserFile` at phone size 412×880, one line on what each shows.
   - Nothing ships until the owner says OK. Logic and fixes need no shots.
6. **Release after the owner's OK (the PM does this, never an agent).** Never release while an agent has uncommitted work.
   - Bump `src/version.js` (patch).
   - Update the version line in CLAUDE.md.
   - Add the CHANGELOG entry (newest first).
   - Update HANDOVER's **Start here** line and its `version.txt` check value.
   - Update the READMEs of the `src/` folders you touched.
   - Run `node tests/run.js`.
   - Commit, ending the message with the session's attribution lines.
   - `git push origin grem`.
   - Confirm that `https://5rob.github.io/CaveRunner/grem/version.txt` shows `<X×1e6+Y×1e3+Z> vX.Y.Z`. Poll for a few
     minutes; Pages is slow.
7. **Dev settings rule.**
   - Every Dev control the work adds needs a default in `src/dev/knobs.js` (`DEV_DEFAULTS` + `DEV_META`) and must
     reach "Copy Dev settings".
   - Every "random" the owner mentions gets min/max knobs.
8. **Finish every task with the docs current, unasked:** HANDOVER, CHANGELOG, the folder READMEs, and this file's
   **Last session** below.

Known failing logic suites from before this work (ignore them): `auto-zonelab`, `modtable`, `orbweb`.

## Agent brief (template; fill the braces, keep it this short)

```
{Task}, on branch grem (CaveRunner Grem). Read CLAUDE.md's Testing section and {the 1–3 folder READMEs}; nothing else
unprompted. The owner's words (exact): {pasted}. Facts: {files, functions, knobs, patterns, what was tried}.
Rules:
- Time box 20 minutes. Stuck or past the box: commit what passes as "{task}: not released", stop, report where you got to.
- Be terse. Report at most 10 lines: done, files touched, test result, shot paths, open points. No recaps.
- Looks: build the smallest version that shows it, take phone shots (412x880, a tools/<name>shots.js; close-up clips ok),
  STOP and report the paths with one line each. At most 2 shot rounds.
- New owner-tunable numbers are Dev knobs (DEV_DEFAULTS + DEV_META in src/dev/knobs.js).
- Tests: a logic suite in tests/logic/ (the grem sandbox pattern, CLAUDE.md), `node tests/run.js <name>` while working,
  `node tests/run.js related` once at the end. Don't bump the version, push, or edit HANDOVER/CHANGELOG.
- Edit src/ with Edit/Write or CRLF-safe node scripts (core.autocrlf; Git Bash heredocs eat backslashes); never index.html.
```

## Handy facts (saves re-exploring)

- **Where the game lives.**
  - The scene: `src/art/titlescene.js` (`titleStep`, foes, bats, worms, shots).
  - The level flow: `src/auto/level.js`. Its phases are `arrive → run → arena → cleared → out`; `levelOnward` starts
    the next level.
  - The boss, elites and unstick: `src/auto/enemies.js`.
  - Drawing: `src/game/render/titledraw.js` and `leveldraw.js`.
  - The HUD: `src/ui/auto/GremScreen.js`.
  - Creatures: `src/creatures/`.
- **Logic sandbox:**
  ```
  G.levelScene(190, seed, 1, undefined, run.players, 1, run, true)
  G.levelState(S)
  G.titleStep(S, 1/30)
  ```
- **Shot tools**, each `node tools/<x>.js`, writing to `tests/build/autoshots/`:
  - `gremarenashots` — the boss fight and the gap after it;
  - `gremskipshots` — Dev ⏭ and the boss waiting;
  - `gremhudshots` — the HUD;
  - `coalshots.js "" coal <part>` — Coal Seams parts.

## Last session (keep current: /wrap rewrites this)

2026-10-18. Released v2.0.16–v2.0.19 from the owner's lists:
- **v2.0.16:** the HUD rework, the Dev ⏭ skip button, and the boss waiting in its arena.
- **v2.0.17:** the boss flow streamlined, big spiders walking, unstick, lanterns, and the worm swell.
- **v2.0.18:** worm speeds, the worm proximity trigger, blast shakes, and no bats in the arena.
- **v2.0.19:** the fight kept inside the arena, and `gremArenaGap` before the next level.

Nothing is pending and no agent is running. Wait for the owner's next list.
