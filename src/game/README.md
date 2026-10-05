# game/ — layer 5: the running game

The only layer (with `ui/`) that isn't pure. May import every layer above it, never `ui/`.

| Path | Holds |
|---|---|
| `Game.js` | The canvas component: makes `W` and `G`, the listeners (mouse, resize, save), the loop (`step` + `recFrame` + `draw`, or `drawReplay` while a replay plays; `SFX.tick()` every frame), and the React bridge. Its own `h`/`useRef`/`useEffect` off the global React (D13: it can't import `ui/h.js`; esbuild prints them `h2`/`useRef2`/`useEffect2`) |
| `world.js` | `makeWorld()`: `W`, the live level's state as one object — every field is listed there. `exits(W)` (the three exit portals, `W.portals`; an old saved replay has only `W.portal`), `nearExit(W, x)` |
| `levelgen.js` | The next level made off the main thread (v130): `preLevel(floor, seed)` asks a Web Worker running this same bundle (main.js keeps its script text, `setBundle`; inside a worker it calls `levelWorker()` instead of mounting; stand-ins for React/document/VERSION in `PRELUDE`; the Dev knobs go with each ask), `takeLevel(floor)` hands it over once, `levelPending`. No Worker or it fails: the warp makes the level itself. `LVLGEN` is its state (the suites read `made`) |
| `testhook.js` | `testHook(W, …)`: `window.__lvl` for the browser suites (= `W` + `sandbox`, `placeProp`, some of Game's functions, the old names), only when the page sets `window.__TEST`. The test page starts with the level bought (`__TEST_VOID`: not) and the pre-v0.0.142 kit, `startingGuns()` + 40 gold (`__TEST_EMPTY`: empty hands, the game's way) |
| `systems/` | One frame of the simulation, by job: see `systems/README.md` |
| `render/` | One frame of the picture: see `render/README.md` |
| `creatures/` | Each creature's part of the enemy loop, `ACTS`: see `creatures/README.md` |

## The shapes (REFACTOR.md D15–D20)

- **`W`** (the world): the level's simulation state — the player `W.p`, the perk bag `W.pb`, the
  terrain (`W.mat`, `W.img`, `W.dimg`, `W.zone`, `W.fuel`; floor 2's room list `W.tomb` and dark zones `W.dark`, `W.darkMask`, `W.webbing`, `W.webDirty`), fog memory `W.seen`, the lists
  (`W.enemies`, `W.bullets`, `W.props`, …), camera, clocks, timers, sound loops. `enterLevel` replaces
  the level-scoped parts per floor; **lists are emptied in place, never replaced** (the recorder holds
  them by reference). `W` stays plain data.
- **`G`** (the context, made in `Game`): what isn't world state — `input` (App's `input.current`), the
  canvases and contexts (`tctx`/`dctx` are the recorder's *wrapped* ones), `REC`/`RT` (recorder and
  replay terrain), `RP_ARR`/`rid`/`ridN`, `RPV` (the replay view `draw()` reads), `fireBox`, `ratOnWeb`,
  `mouse`, `aimPath`, the plant glow's scratch (`pgArt`, `pgC`/`pgCtx`, `pgGlow`/`pgGlowCtx`). A new
  key must be declared above `G` in `Game`.
- **`F`** (a frame object): `step` makes one (`dt`, `LO`, `MHP`, `pcx`/`pcy`, D18) and `draw` another
  (`dpr`, `playPx`, `vw`/`vh`, `pcx`/`pcy`, `TH`, `onView`, `held`, `ax`/`ay`, `gy`, `cw`, D19). Each
  part takes `(W, G, F)` (only what it uses) and reads `F` with `const { … } = F;`; a part that sets
  something later parts need writes it onto `F`.
- A function takes `(W, G, …)` if it needs something outside the world, `(W, …)` if only the world,
  just its own arguments if neither (D16). Where pure code wants a callback (`losClear`, a creature's
  `env.solidCell`) the call site passes an arrow: `(cx, cy) => solidCell(W, cx, cy)`. **An event
  listener is the exception**: `removeEventListener` needs the very same function, so it gets one
  named arrow (`saveNow`).
- **Call cycles between systems are allowed** (`explode` → `fireBlast` → `ignite` → `blowProp` →
  `explode`) because a module does nothing at load that calls another system: its top level is
  function declarations, arrow consts and plain data (D17). Keep it so.
- Types for all of these are in `src/types.d.ts` (`World`, `GameCtx`, `GameInput`, `StepFrame`,
  `DrawFrame`, `EnemyCtx`); a new field goes there too.

## Rules

- **The order of step's and draw's parts is fixed.** `draw()` is not only a picture: it writes the
  fog memory (`drawFog`), eases the camera (`drawCamera`), and draws from the simulation's
  `Math.random` stream (the looks, the jet flame, the beams). Step's parts feed each other within the
  frame. `node tests/determinism.js` catches a reorder (and any behaviour change: it was the refactor's
  proof, still handy for any change meant to be behaviour-free).
- **Every partial `putImageData` on the terrain goes through `G.tctx`/`G.dctx`** (wrapped by
  `recWrap`), or the death replay misses it (`replay/README.md`).
- Game's state was named loosely before the refactor (`mat`, `seen`, `zfx`, `enemies`, `p`, `camY`,
  `fire`…); old notes (CHANGELOG, REFACTOR.md) use those names. Today each is `W.<name>`.
