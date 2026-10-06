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
| 1 | Dark zone: hologram flickers/glitches on and off in flashes (backlights silk, silhouettes aliens) | agent | review (merged into list3-small) | `world/holoflicker.js`, Dev `l2dFlk*`; aliens in the black now drawn while lit; v2 shots sent; probe `V2=1 node tools/holoflickshots.js <dir>` |
| 2 | Modifiers affect only the next spell | agent | ready | merged into `list3-small` (7661710): only planCast changed; suite `nextspell`. Wrap: a trailing modifier is wasted. Not done: a card example showing the spell after coming out bare (a look) |
| 3 | Dev menu: modern, tabbed pages, collapsible groups | agent | review (merged into list3-small) | `DEV_TABS` in dev/knobs.js; suite `devpanel`; 4 shots sent |
| 4 | Gun mod screen: gun buttons as a row under the mod grid; live window of the gun firing in time with the pull animation | agent | review (merged into list3-small) | `GunFire` in ui/editor.js, `bagsim` `S.shots`; suite `gunfire`; 3 shots sent |
| 5 | Hold a HUD gun slot to equip a pickup there (replaces R/swap menu); hold with nothing to pick up = drag the gun out, drop on release; tap the equipped gun = its info card | agent | agent (worktree, from list3-small) |  |
| 6 | Audit: pin / trash icons + "Give Feedback" notes on mod & perk cards; Dev button copies all to clipboard for Claude Code | agent | review (merged into list3-small) | `save/audit.js` (localStorage `caverunner-audit`), cards.js toggles + notes screen, Dev "Copy audit"; suites `audit` (logic+browser); 3 shots sent. Skipped: pin/trash dots on Bag tiles |
| 7 | Vines: keep facing unless you steer the other way | manager | ready | branch `list3-small` 7423885 (`W.p.steer`, gun.js facing) |
| 8 | Right stick: trigger ring near the stick's edge, Dev padding from the edge | manager | review | branch `list3-small`; `triggerRing` in core/consts.js, Dev `aimPad` (10px, Player group); suite `trigring`; screenshot sent |
| 9 | Collected mods stack, count badge top-right; one per gun slot | agent | review (merged into list3-small) | `stackBag`/`stackKey` in spells/collection.js (display-only grouping, saves unchanged); suite `stacks`; 2 shots sent |
| 10 | Aim Assist mod: pointer snaps to enemies, no trigger line, auto-fires when snapped; own Dev group | agent | review (merged into list3-small) | `spells/assist.js`, gun.js, overlay `drawAssist`; Dev group `aimassist` (Player tab); suites `aimassist` (logic+browser). Whole pull aims at the target (one aim per pull); 2 shots sent |
| 11 | Discriminate mod: pointer sets a permanent target (enemy type / player / object) per copy, icon in the tile; its shot only affects that | agent | agent (worktree, from list3-small) | per-copy target in stackKey; shots stop at walls but don't dig |
| 12 | Mini-map perk: box over the gun buttons, terrain/open fill, 3 zoom taps, edge-stuck pins, player arrow, red enemy dots, crystal icons | agent | agent (worktree, from list3-small) |  |

## Waves (one agent per file set at a time)
- Wave 1 (parallel): 1 (game/render/dark.js), 2 (spells/), 3 (ui/devpanel.js), 4 (ui/editor.js). Manager: 7, 8.
- Wave 2: 5 (ui/hud.js, swap), 6 (cards + devpanel), 9 (editor), 12 (new ui/minimap + perk).
- Wave 3: 10, then 11 (mods + pointer).

## Log (newest last)
- 2026-10-07: list received, questions answered, tracker made.
- 2026-10-07: wave 1 agents launched in worktrees (items 1, 2, 3, 4; 20–25 min boxes). Manager did 7 and 8 on branch `list3-small`; #8 screenshot sent.
- 2026-10-07: #2 merged into `list3-small`. #10 Aim Assist agent launched.
- 2026-10-07: #3 merged into list3-small, 4 shots sent. #6 agent launched. #1 agent retaking shots (needs silk + aliens in frame).
- 2026-10-07: #4 and #1 merged into list3-small, shots sent. #9 and #12 agents launched. Running: #6, #9, #10, #12. Waiting on owner: OKs for #1, #3, #4, #8.
- 2026-10-07: #10 merged, shots sent. #5 agent launched. Running: #5, #6, #9, #12. Next: #11 after #9.
- 2026-10-07: #6 and #9 merged, shots sent. #11 agent launched. Running: #5, #11, #12.
