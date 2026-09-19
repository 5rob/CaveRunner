# CaveRunner

A single-file browser game: a jetpack cave shooter with Noita-style wand building.
`index.html` is the whole thing — markup, CSS, React and game loop, no build step.

## How the owner likes to work

**Talk briefly.** Short, concise replies. Minimal technical jargon unless they ask about
something specific — then give them the real mechanism, not a summary. They do ask, and
they want the actual answer when they do.

**Iterate fast, don't plan at length.** They'd rather see the thing working than read a
plan for it. Build the idea, show it, adjust. Don't open a planning session for something
you could just try. Don't ask permission for the obvious next step.

**Don't stress about polish** unless they ask for it. Working beats tidy.

Their words, from the first session:

> This is just a fun personal project, so don't focus on production level
> infrastructure, just keep it simple and focus on just what I ask for. Reduce
> technical jargon to a minimum unless I ask about something specific.

So: do the thing asked, no more. No frameworks, no bundler, no package.json for the
game itself.

They play on a phone through the published artifact, so **every change has to work at
phone width with touch**.

**`node serve.js`** serves the game to their phone over the LAN, for testing before or
instead of publishing. It answers only for `index.html` — deliberately, because
`.claude/settings.json` in this folder holds an API token, and a plain
`python -m http.server` from the project root would hand that to the whole wifi. Don't
replace it with a general static server.

## The loop we've settled into

1. Make the change in `index.html`.
2. Test it. `node tests/run.js` — see **Testing** below. Add a suite for anything new.
3. Bump the version: `<title>` on line 6 and `const VERSION` near the top of the script.
   They asked for this so the published page doesn't get stuck on a cached old build.
4. Update `README.md` — it describes the game for a player, and stays current.
5. Commit and push to the working branch.
6. **Publish it.** They test on their phone, so a change isn't delivered until it's live
   at the link. Republish to the **same URL** every time:
   `https://claude.ai/artifact/2rarFzJoTseCKXhTPwMyLT`
   Pass that as `url`. Publishing without it makes a *second* artifact and they lose their
   link. If this session hasn't published yet, read the artifact first, then publish.

Current version: **v33**. Branch: `claude/compassionate-rubin-fcqsif`.

### The version number is not optional

Their phone caches the page. A build published under the old number can silently serve
them the previous version, and then you're both debugging a bug that's already fixed.
So **every published build gets a new number**, in both places:

- `<title>CaveRunner vNN</title>` — line 6
- `const VERSION = 'vNN';` — near the top of the script, drawn on screen in-game

The number on screen is how they tell you which build they're looking at. Bump it before
publishing, never after.

## Layout of index.html

Roughly top to bottom:

| What | Where |
|---|---|
| CSS | in `<style>`, one block, light and dark via `prefers-color-scheme` |
| World constants | `CELL`, `CW`/`CH`, `SHOP_*`, tuning consts (`GRAVITY`, `JET`, …) |
| `THEMES` / `themeFor` | the 12 level palettes; the floor number picks one |
| `CREATURES` / `ROSTERS` | the 16 creature types, and which live on floors 1–10 |
| `rosterFor` / `enemyFor` | a floor's creatures, and one creature's floor-scaled stats |
| `MODS` | the 111 spells, each a plain object |
| `FAMILIES` / `FAMILY_OF` | the 8 colour families the UI groups mods by |
| `MOD_PRICE` / `MOD_TIER` | shop price and rarity 1–4 for every mod |
| `planCast` | **the heart of it** — works out what one pull of the trigger fires |
| `gunRate` / `buildAdvice` | the build advisor |
| `castGroups` / `groupStats` | the outlines and stat lines in the build screen |
| `tracePath` | simulates a shot for the aim line |
| `makeLevel` | terrain, shop, enemies, pickups |
| sprites | `drawRunner`, `drawEnemy` (one per creature body), `drawGun`, `rr` |
| `Game` | the canvas component: `step(dt)`, `draw()`, `cast()`, bullets, fields |
| React UI | `ModCard`, `GunCard`, `Editor`, `GunSwap`, `App` |

Everything above `makeLevel` is pure and top-level, which is why the logic tests can
load it and call it directly. **Keep it that way** — if a new mechanic can be a pure
function, make it one.

## Things worth knowing before you change anything

**`planCast(g, others)` mutates `g.idx`.** It walks the slot list from wherever the gun
left off. Callers that only want to look (previews, the advisor, `castGroups`) pass a
copy. It returns `{ shots, defs, start, cost, delay, acts, hp, wrap }`.

**Spell kinds.** `shot` (a projectile) and `static` (a field that stays put) each take a
cast slot, so multicasts gather them. `mod` and `util` are modifiers that don't — `util`
also carries an `act` string the game switches on. `passive` works from anywhere on the
gun. A modifier only affects spells drawn *after* it, which is the whole game.

**Copies (the Greek letters) are fiddly.** They push ids into a queue drawn before the
gun's own list, and they must widen `multi` to make room for themselves *and* the
originals they came from, or the multicast limit eats them. They never copy a copy, they
never expand after a wrap-around, and `multi` is clamped to what the gun can actually
produce. Break any one of those and Omega or Myriad runs away. `spells.test.js` covers it.

**The aim line must stay honest.** Anything that changes how a bullet flies has to be
added to `tracePath` as well as the bullet loop, or the line lies. There's a test for
every path mod.

**Cast delay vs recharge.** Cast delay accumulates in draw order and a few mods (Buzzsaw)
*reset* it to zero rather than subtracting, so position matters. Recharge counts from any
slot. `effRecharge(g)` is the one true answer.

**The advisor prices resources.** `gunRate` scales damage by mana sustain *and* by health
drain, so a build that bleeds you dry isn't credited with damage you'd never live to
deal. If you add a mod that spends something, make sure `gunRate` sees the cost.

**A floor's identity is the floor number, not the seed.** `themeFor(floor)` and
`rosterFor(floor)` are pure functions of the floor alone. Floors 1–10 hand back the same
palette and the same creatures on every run, and that is the feature, not an oversight —
the player is meant to learn floor 3. Only past floor 10 does `rosterFor` take `rnd`.
Don't be tempted to roll either one from the level seed.

**Enemy behaviour belongs to the creature.** Every enemy carries `e.k`, its floor-scaled
stats, and `e.k.act` decides how it moves and fights: `shoot`, `turret`, `chase` or
`bomb`. `e.k.body` picks the sprite, `e.k.col` its colours. `enemyShots` carry their own
`dmg`, `col` and `size` — there is no global enemy damage constant any more. The enemy
loop runs backwards because a bomber splices itself out mid-loop. If you add a creature,
give it all of those fields and a body that already has a sprite.

**Detail cards in the build screen open at the top** (`.pop.top`). The editor's content
reaches the bottom of the screen, so a bottom-anchored card buried the mod bag. Four
separate bugs came from that; don't move it back.

**UI controls fire on `onPointerDown`, not `onClick`.** A click synthesised after a sheet
closes lands on whatever is underneath — that's how the Done button used to restart the
run.

**A mod on the ground asks before it is taken.** The interact tap sets
`input.current.confirm`; `ModFound` renders the card with **Pick up** / **Leave** and the
game pauses behind it. It publishes its `{ take, leave, aim }` on
`input.current.confirmAct`, and `Stick()` reads that on release, so a drag points at a
button and letting go picks it. Two things about it are easy to break. The overlay is
`pointer-events:none` on purpose — the right stick has to stay live underneath it, and
only `.pop.ingame` and `.modfoundbtn` take touches back. And it stops above the control
deck via an inline `bottom` measured in `ModFound`, so the stick you are being asked to
drag isn't sitting in shadow.

**`found` is already taken as a class name.** `GunCard` is rendered with `mark: 'found'`
for a gun on the ground, and `tests/browser/gunpickup.test.js` queries `.pop.found`. So
the mod overlay's classes are all `modfound*`. Reusing `.found` silently restyled every
found-gun card, and it took a browser suite to surface it.

**The lamp has to stay inside the screen.** `SIGHT` is deliberately well under `VIEW_W`:
at 200 it lit a circle wider than the phone screen, which revealed terrain you could not
look at. If you raise it, check it against `VIEW_W` rather than against the map.

**Unicode is stored raw** in `index.html` (`·`, `—`, `×`, `Ω`), not as `\uXXXX`. Match the
literal characters when editing with a script, or the edit silently finds nothing.

## Testing

### Write tests into the repo, never the scratchpad

This already went wrong once: every suite was built in the session scratchpad, so when
that session ended the project had no tests at all. They were rescued and committed, but
only because someone noticed.

**Rules:**

- A new test goes in `tests/logic/` or `tests/browser/` from the start. Don't write it in
  the scratchpad "for now" — there is no later, the scratchpad is deleted with the session.
- Commit it in the same commit as the change it covers.
- Throwaway debug scripts (one-off probes, screenshot scratch) can live in the scratchpad.
  If a probe turns out to be worth keeping, move it into `tests/` before the turn ends.
- Don't hardcode machine paths. Logic suites find `index.html` relative to `__dirname`;
  browser suites get Chromium from `tests/chromium.js`. Keep both that way so the suites
  still run on a different machine.
- Don't assume LF, either. A Windows checkout with `core.autocrlf` on hands you `index.html`
  with CRLF, and the logic suites slice the script out on `'<script>\n'`, which then finds
  nothing and every suite fails with a syntax error. They all normalise with
  `.replace(/\r\n/g, '\n')` before slicing now — keep that when adding one.
- Before finishing a session, `git status` — anything untracked under `tests/` is about to
  be lost.

```
node tests/run.js           # everything
node tests/run.js logic     # the fast ones, ~2 seconds
node tests/run.js browser   # Chromium, ~2 minutes, runs one at a time
node tests/run.js advice    # anything matching "advice"
```

**Logic suites** (`tests/logic/`) slice the `<script>` block out of `index.html`, eval it,
and call the pure functions. ~1250 checks. Add to these first — they're fast and they've
caught most of the real bugs.

**Browser suites** (`tests/browser/`) drive the real page in Chromium through
`playwright-core`. `tests/build.js` makes `tests/build/test.html`: the game with React
served from `tests/lib/` and two debug hooks, `window.__in` (the input ref — loadout,
guns, bag, prompt) and `window.__lvl` (the live level — player, enemies, bullets, fields).
If a suite needs to reach something new, add it to the hook in `build.js` rather than
reaching into the game from the test.

`tests/chromium.js` finds Playwright and a Chromium wherever this machine keeps them, so
no suite hardcodes a path; override with `CAVERUNNER_PLAYWRIGHT` and `CAVERUNNER_CHROME`.
The runner skips the browser suites if there's no Chromium to drive. On this environment
it's the preinstalled one at `/opt/pw-browsers/` — don't run `playwright install`.

Two suites are worth knowing about: `everymod.test.js` equips and fires all 108 mods in
the real game and checks each puts something into the world, and `smoke.test.js` plays a
short run and asserts no page errors.

**Measure, don't assert.** This project has a habit of proving things rather than
claiming them — flood-fill the cave to prove tunnels connect, count buried bullets before
and after a bounce fix, screenshot the build screen to check a card fits. It has caught
several things that looked fine. When a test disagrees with you, check which one is
actually wrong; it's been both.

## Where to look when something breaks

- Terrain sealed off or unreachable → `tests/logic/level.test.js` flood-fills 20 seeds.
- A floor looking wrong, or a creature that isn't behaving → `tests/logic/creatures.test.js`
  covers the tables; `tests/browser/creatures.test.js` climbs five floors in the real game
  and checks each one's palette, roster and behaviour.
- A mod doing nothing → `tests/browser/everymod.test.js` will name it.
- Aim line wrong → the mod is in the bullet loop but not `tracePath`.
- Build screen card covering something → `.pop.top` height cap and the sheet layout.
- Editor slow → `buildAdvice`; it shortlists for a reason (`SHORTLIST`).

## Ideas raised but not built

- **Delayed Spellcast** — a static phenomenon that casts three more spells after a pause.
  The trigger/timer machinery now exists (`payload` on a shot, `firePayload` in the bullet
  loop, v31), so this is a much smaller job than it was.
- **Perks**, mentioned when gold pickup range was reduced: "later when I introduce perks
  we could have a perk that increases that range". The range is deliberately short now.
- Noita spell categories we only partly mined: Material spells (none), and the rest of
  Other (Add Trigger / Add Timer, Divide By N, the Requirement spells).
