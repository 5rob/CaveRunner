# LIST3 — the owner's 12-item list (started 2026-10-07)

**A fresh session: read this first, then CLAUDE.md and HANDOVER.md.** The main session runs as project
manager: small items it does itself, bigger ones go to time-boxed subagents (CLAUDE.md "Subagents"),
each on its own git worktree branch, merged by the manager. Looks go to the owner as screenshots
(412×880) and wait for their OK before `main`. Releases: **small batches** of approved items, each a
minor update (owner's call).

Status: `todo` · `agent` (running, branch named) · `review` (screenshots sent, waiting on owner) ·
`ready` (done, waiting for a batch) · `released vX.Y.Z`.

## Owner's decisions (2026-10-07)
- Modifiers affect **only the next spell drawn after them** (several modifiers in a row all land on that
  one spell). Not the whole cast like Noita.
- The mini-map is a **perk in the Exo Suit** (always on once fitted).
- Release in **small batches** of approved items.

## The list

| # | Item | Who | Status | Notes |
|---|------|-----|--------|-------|
| 1 | Dark zone: hologram flickers/glitches on and off in flashes (backlights silk, silhouettes aliens) | agent | agent (worktree) | look → screenshots |
| 2 | Modifiers affect only the next spell | agent | agent (worktree) | logic; planCast, tracePath, advisor, bagsim, tests |
| 3 | Dev menu: modern, tabbed pages, collapsible groups | agent | agent (worktree) | look → screenshots |
| 4 | Gun mod screen: gun buttons as a row under the mod grid; live window of the gun firing in time with the pull animation | agent | agent (worktree) | look → screenshots |
| 5 | Hold a HUD gun slot to equip a pickup there (replaces R/swap menu); hold with nothing to pick up = drag the gun out, drop on release; tap the equipped gun = its info card | agent | todo | after 8 (hud.js) |
| 6 | Audit: pin / trash icons + "Give Feedback" notes on mod & perk cards; Dev button copies all to clipboard for Claude Code | agent | todo | after 3 (devpanel) |
| 7 | Vines: keep facing unless you steer the other way | manager | ready | branch `list3-small` 7423885 (`W.p.steer`, gun.js facing) |
| 8 | Right stick: trigger ring near the stick's edge, Dev padding from the edge | manager | review | branch `list3-small`; `triggerRing` in core/consts.js, Dev `aimPad` (10px, Player group); suite `trigring`; screenshot sent |
| 9 | Collected mods stack, count badge top-right; one per gun slot | agent | todo | after 4 (editor.js) |
| 10 | Aim Assist mod: pointer snaps to enemies, no trigger line, auto-fires when snapped; own Dev group | agent | todo | after 2 |
| 11 | Discriminate mod: pointer sets a permanent target (enemy type / player / object) per copy, icon in the tile; its shot only affects that | agent | todo | after 10 |
| 12 | Mini-map perk: box over the gun buttons, terrain/open fill, 3 zoom taps, edge-stuck pins, player arrow, red enemy dots, crystal icons | agent | todo | |

## Waves (one agent per file set at a time)
- Wave 1 (parallel): 1 (game/render/dark.js), 2 (spells/), 3 (ui/devpanel.js), 4 (ui/editor.js). Manager: 7, 8.
- Wave 2: 5 (ui/hud.js, swap), 6 (cards + devpanel), 9 (editor), 12 (new ui/minimap + perk).
- Wave 3: 10, then 11 (mods + pointer).

## Log (newest last)
- 2026-10-07: list received, questions answered, tracker made.
- 2026-10-07: wave 1 agents launched in worktrees (items 1, 2, 3, 4; 20–25 min boxes). Manager did 7 and 8 on branch `list3-small`; #8 screenshot sent.
