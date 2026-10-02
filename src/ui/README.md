# ui/ — layer 6: the React page

React without JSX (`h(...)`), off the global React the page loads from a CDN. Everything must work
**at phone width, with touch** (the owner plays in the Android app).

| File | Holds |
|---|---|
| `h.js` | `h` (`React.createElement`), `useRef`/`useEffect`/`useState`/`useMemo` |
| `app.js` | `App`: the loadout, the input ref shared with the Game (`input.current`: `GameInput` in `types.d.ts`), the canvas, the sticks, the deck buttons, every overlay, the key handler |
| `hud.js` | `Stick` (thumbsticks + gauge rings; publishes its centre and size for the menu pointer, and keeps the touch's `peak` push), `RKey`, `CrystalIcon` (red or `green`), `CrystalRow` (the top bar's crystal silhouettes, `CRYS_MAX` a colour then +N), `GAUGE_R`/`GAUGE_C`/`GAUGE_COL`, `healthCol`, `holdPress` (tap vs hold), `deckLayout`, `fmtGold` |
| `cards.js` | `GunCard`, `ModCard`, `PerkCard`, `GUN_STATS` — the same cards in the build screen and in the shop/pickup panel (`ingame`) |
| `editor.js` | The build screen (Bag): `Editor`, `GunStats`, `GunIcon`, `SlotGrid`, `ScrollBox`, `PULL_COL`, `GS_ROWS`, `LIVE_BAR`, `SHOW_TIPS` |
| `swap.js` | `GunSwap`: the chooser when you take a gun (found or bought) |
| `witness.js` | `Witness` (the death replay's controls), `RP_SPEEDS` |
| `vendshop.js` | `VendShop`: a vending machine's menu for any `ShopDef` (collection grid in groups, unlock button, the selected card, "Dispense selected"), `useMenuNav` (the right stick is a pointer past `MENU_PTR`: `menuPointer` maps it out to the furthest screen corner, `snapTo` pulls it gently onto the nearest button, a thin ring `.mptr` shows it, it lights that `[data-nav]` and presses it on release; a plain tap `input.current.menuTap` presses the lit one: right-stick tap, r/f/enter; arrows step with `navStep`) |
| `modshop.js` | `modShop` (the mods' `ShopDef`), `SHOP_DEFS` (by `SHOPS` key), `CrystalIcon` |
| `gunshop.js` | `GunVend`: the gun machine's menu (three `Reel`s of `LO.gunShop`, the selected `GunCard`, Buy / Reroll / Boosted; reels stop one at a time, `REEL_*`; `Sparks` on a boosted spin). `SHOP_MENUS` (in `modshop.js`) maps each `SHOPS` key to its menu; `useMenuNav` (vendshop.js) is the shared stick/key handling |
| `exosuit.js` | `Bag` (the Bag's two tabs, `.btabs`: the `Editor`, which takes a `tabs` element to put at its foot, and the Exo Suit), `ExoSuit` (portrait, stats, `SUIT_SLOTS` slots `[data-xslot]`, the perk grid `.xperk`; drag a carried perk to a slot, a slot to a slot or off; tap for `PerkCard`; sets `perksDirty`) |
| `devpanel.js` | `DevPanel`, `DevRow`, `JellyPreview` (runs the real `jellyStep`/`drawJelly`), `SpawnGun` |

CSS is `src/style.css` (one block, light and dark via `prefers-color-scheme`).

## Rules

- **Controls fire on `onPointerDown`, not `onClick`.** A click synthesised after a sheet closes lands
  on whatever is underneath (that's how Done once restarted the run).
- **The knob is the bit under the thumb.** The owner's "make the thumb circles bigger" meant the
  knobs: `KNOB` (0.38 of the stick) keeps its edge visible round a thumbprint. The amber ring is
  **dotted** and is `AIM_RING`, derived from `AIM_DEAD` and `KNOB` (`core/README.md`) — the trigger
  line. Knob: a white ring, no fill. **No second ring** (the old dashed `.throw` ring was noise to
  the owner) without asking.
- **The stick has no `overflow:hidden`**: the knob travels past the rim, and clipping would bite it.
  `.stickclip` clips the wash and centre line instead.
- **The HUD is the thumbsticks.** `draw()` publishes `input.current.hud` each frame (`render/README.md`);
  each `Stick` reads it on its own `requestAnimationFrame` loop and re-renders only when a value moves
  ≥1%. Left stick: health ring outside (colour `healthCol(frac)`, green→amber→red), fuel ring inside
  (`GAUGE_COL.fuel`, red track when dry). Right stick: three rings stacked flush at the outer edge —
  mana (gold), recharge (blue), cast delay (purple) — each a readiness wipe (1 when ready, 0 the
  moment it fires, refilling over its own time, so the ring that lingers low is the bottleneck). All
  rings thin (`sw` 1.6, spacing `rw` 3.2), clockwise from 12 o'clock, with a track circle behind.
  `GAUGE_COL` is shared with the bag's stat labels, so a ring and its stat read as one thing.
- **See-through deck:** `.view` fills the screen and `.controls` float over its bottom with no
  background (pointer events only on `.stick`/`.dbtn`); App measures their height into
  `input.current.ctlH`. `deckLayout` places the round `.dbtn`s: the four guns (`.slot`, `.on` = held,
  hold for its card) on an arc round the right stick; the Bag (`.weapon`, 🎒) mirrors the last gun on
  the left; the map (`.mapbtn`, 🗺️) above it. Gold (`.gold`, `fmtGold`: `1234` → `1.2kg`, thousands
  truncated) sits top centre, `pointer-events:none`, with the debt under it in full (`-64,000,000,000g owed`,
  not `fmtGold`) and `DueClock` under that, with `CrystalRow` (red and green silhouettes) between the gold and the debt, all centred (`topgold` checks them at phone widths); it updates because gold changes
  call `input.current.notify()` (re-renders `App`). The Dev button is a bare ⚙️
  (`.devbtn`); Restart is inside the Dev panel (`.dbg.restart`).
- **Perks: a column over the map button** (`.perkcol`, `PERK_PIP`/`PERK_GAP`/`PERK_TOP` in `app.js`):
  bottom up from just above `.mapbtn` to `PERK_TOP` px from the top of the screen, then a column further in.
  With a card up, the shade sits over the column: its tap finds a `.perkpip` under the finger
  (`elementsFromPoint`) and switches the card to it. Tap a pip: `perkInfo` (pauses),
  a `.perkinfo` card (always dark) saying it's fitted to the Exo Suit. The column shows only the
  perks fitted to the suit (`activePerks(LO)`: `LO.suit`); carried ones (`LO.perks`) don't count.
  There's no on/off toggle any more (v120): fitting and taking out happen in the Bag's Exo Suit tab,
  which sets `perksDirty` (Game runs `applyPerks`). The card's shade stops at the controls.
- **The Bag always opens; editing is gated**: `canEdit = inShop || Tinker`. Read-only hides drop,
  gun reorder, Sort and the tips, and the footer says "Viewing only…"; tapping a mod still shows it.
  (The `e`/`tab` key opens it only where you can edit.)
- **Detail cards in the build screen open at the top** (`.pop.top`); bottom-anchored ones buried the
  bag (four bugs). Don't move it back. A gun with few slots makes the bag ride up under the top card:
  browser suites that tap bag tiles with a card open select a roomy gun first (`buzzsaw.test.js`).
- **The shop/pickup panel `.buypanel`** is half width (`left:25%;right:25%`), floats just above the
  item (`bottom` and `maxHeight` from `input.current.promptBottom`), and holds the item's card
  (`ingame`) then one `.pbuy` line: `RKey` (a thin white circle with an R, the owner's design) and
  `<price>g`, or `free`. The whole panel is `pointer-events:none` (buying is a dead-zone tap on the
  right stick) except its stat list `.prows` (max ~3 rows, 60px, scrolls). `.buypanel .pop` strips the
  inner card's frame and wins over `.pop.ingame` on source order: **keep the `.buypanel` block after
  `.pop.ingame` in the CSS**. `ModCard` drops its use-example (`.pdemo`) when `ingame`.
- **Vending machine menus** (`SHOP_MENUS` in `modshop.js`: `VendShop` for mods and perks, `GunVend` for
  guns) cover the view down to the sticks (`.vshop`, always dark) and pause the game. Every button in
  one has `data-nav`. `useMenuNav`: the right stick is a pointer past `DEV.ptrStart` (a thin `.mptr`
  ring, `menuPointer` × `DEV.ptrReach`, `snapTo` with `DEV.snapR/snapPull/snapHit`), pressing what
  it's over on release; a plain right-stick tap (`Stick` checks `peak`) or r/f/enter presses the lit
  one (`input.current.menuTap`); arrows step (`navStep`).
- **Mods are taken with a tap, guns open `GunSwap`** (hold a slot to swap, or "Leave it"; the owner
  asked to keep this chooser). The old ModFound overlay is gone; `Stick` still writes `confirmAim` and
  reads `confirmAct`, but nothing sets `confirmAct` any more, so a dead-zone tap just sets
  `input.current.interact`.
- **The key handler ignores keys aimed at `input`/`textarea`/`select`** (so typing a Dev value doesn't
  steer the runner).
- **The bag screen:** `GunStats` (one `.gsrow[data-stat]` per `GS_ROWS`, value coloured by
  `statQual`, a `<u class=up|down>` delta from `gunModDeltas`) beside a 2×2 `.gtabs` of guns. Slots
  never regroup. The live fire preview (`fireSimNew`/`fireSimStep`, a copy of the gun) runs in
  `SlotGrid`'s own rAF at `DEV.bagSpeed` × real time and re-renders only when the lit pull changes;
  `GunStats` writes its three live bars (cast delay, recharge, mana: `LIVE_BAR`, only those — owner)
  straight to the DOM. Advisor tips are parked (`SHOW_TIPS = false`; the dmg/s line stays).
- **`ScrollBox` grab bars** on the slot grid and the mod bag: tap to jump, drag the thumb; empty slots
  are `touch-action:pan-y` so a swipe there scrolls. Its suite uses real CDP touch
  (`Input.dispatchTouchEvent`); `synthesizeScrollGesture` doesn't scroll in headless Chrome.
- **Dev panel** pauses the run but `draw()` keeps running behind a light backdrop, so look knobs
  preview live. **Copy all dev settings** (`.devcopy`) copies `devReport()`; if the clipboard is
  refused (a WebView can), it shows the text in a box to long-press. **Spawn gun** (`.dbg.spawngun`)
  sets `input.current.spawnGun = level`; step drops `caveGun(level)` in front of you. **New cave**
  (`.dbg.newcave`) → `input.current.newCave`. **All mods** (`.dbg`) flips `LO.debug`.
  `JellyPreview` sits sticky above the jelly colour rows.
- **Death:** "Tap the right stick to restart"; the **WITNESS YOURSELF** button (`.witnessbtn`) opens
  `Witness`; `.app.witnessing` hides the controls.
