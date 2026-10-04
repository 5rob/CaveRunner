# ui/ — layer 6: the React page

React without JSX (`h(...)`), off the global React the page loads from a CDN. Everything must work
**at phone width, with touch** (the owner plays in the Android app).

| File | Holds |
|---|---|
| `h.js` | `h` (`React.createElement`), `useRef`/`useEffect`/`useState`/`useMemo` |
| `app.js` | `App`: the loadout, the input ref shared with the Game (`input.current`: `GameInput` in `types.d.ts`), the canvas, the sticks, the deck buttons, every overlay, the key handler |
| `map.js` | The map (v0.0.141): `MapScreen` (full screen `.mapscreen`, its own canvas and rAF while open: `input.current.mapView()`'s picture, fitted to the height (`fitView`, `FIT_PAD`), the fog memory over it (a pixel a fog cell, smoothed, grown `MAP_SPREAD` cells by `spread`: the memory only lifts air and wall faces, so this shows the rock round what you saw), the shop's machines as coloured squares (`MAP_MARKS`: teleporter, heal, buy, sell, then `SHOPS` in their hues), your `helmet`, the pins standing on their spots; one pointer pans, two pinch round their middle, a wheel zooms, `keepOn` keeps some of it on screen, `ZOOM_MAX`; the view is on the canvas's `data-view` for the suite), `PinPicker` (`.pinpick`: the pins, last used first, `.pinopt[data-pin]`, then `.pinadd` (+) opening a one-character box, `firstChar`: a whole emoji counts as one), `loadPins`/`savePins` (localStorage `PIN_KEY`, `PIN_DEFAULTS`, `PIN_MAX`), `usePin` |
| `hud.js` | `Stick` (thumbsticks + gauge rings; publishes its centre and size for the menu pointer, and keeps the touch's `peak` push), `RKey`, `CrystalIcon` (red or `green`), `CrystalRow` (the top bar's crystal silhouettes, `CRYS_MAX` a colour then +N), `GAUGE_R`/`GAUGE_C`/`GAUGE_COL`, `healthCol`, `holdPress` (tap vs hold), `deckLayout` (`pin`: the pin button, mirroring `map`), `fmtGold` |
| `cards.js` | `GunCard`, `ModCard`, `PerkCard`, `GUN_STATS` — the same cards in the build screen and in the shop/pickup panel (`ingame`) |
| `editor.js` | The build screen (Bag): `Editor`, `GunStats`, `GunIcon`, `SlotGrid`, `ScrollBox`, `PULL_COL`, `GS_ROWS`, `LIVE_BAR`, `SHOW_TIPS` |
| `swap.js` | `GunSwap`: the chooser when you take a gun (found or bought). Since v0.0.144 (owner) the four slot buttons are a full-width row of squares at the bottom and the two cards split the rest equally (`flex: 1 1 0`); their stats one column, two on a screen under 860 tall, three under 700, so nothing scrolls (`gunpickup` checks 412×880, 390×844, 360×640) |
| `witness.js` | `Witness` (the death replay's controls, for the live clip or a saved one: `saved` is its `ClipMeta`; **💾 Save** → `input.current.saveClip`, **🎬 Export video** → `exportClip`), `RP_SPEEDS` |
| `clips.js` | `WitnessGallery` (the Bag's Witness tab: `.wclip` cards, thumbnail → play, ✏️ Rename inline, 🗑️ then Delete), `exportClip` (plays the replay once from the start as set up, drawn on the whole screen while `V.full` so the video is the screen's shape, copies it each frame (`V.onFrame`) into a canvas sized on the first frame (a new canvas is already 300 × 150, so it's a flag, not `!width`), `captureStream` + `SFX.stream()` into a `MediaRecorder`; MP4 if `pickMime` finds one, else WebM through `toMp4`, ffmpeg.wasm from jsdelivr), `saveVideo` (the app's `window.CaveApp` bridge, or a download), `fileName` |
| `vendshop.js` | `VendShop`: a vending machine's menu for any `ShopDef` (collection grid in groups, unlock button, the selected card, "Dispense selected"), `useMenuNav` (the right stick is a pointer past `MENU_PTR`: `menuPointer` maps it out to the furthest screen corner, `snapTo` pulls it gently onto the nearest button, a thin ring `.mptr` shows it, it lights that `[data-nav]` and presses it on release; a plain tap `input.current.menuTap` presses the lit one: right-stick tap, r/f/enter; arrows step with `navStep`) |
| `modshop.js` | `modShop` (the mods' `ShopDef`), `SHOP_DEFS` (by `SHOPS` key), `CrystalIcon`. **Archived since v0.0.138** with `VendShop` for mods and perks: those machines take crystals and have no menu (`takes` in `SHOPS`); the code stays so a menu can come back |
| `gunshop.js` | `GunVend`: the gun machine's menu (three `Reel`s of `LO.gunShop`, the selected `GunCard`, Buy / Reroll; reels stop one at a time, `REEL_*`; the Boosted reroll went in v0.0.140; with no gun to your name the first reel is a `scratchPistol`, **FREE**, standing in front of the offer's first gun, which isn't used up by taking it, v0.0.142). `SHOP_MENUS` (in `modshop.js`) maps each `SHOPS` key to its menu; `useMenuNav` (vendshop.js) is the shared stick/key handling |
| `levelshop.js` | `LevelVend`: the level buy machine's floor menu (`SHOP_MENUS.levels`; a `.lvrow[data-floor]` per floor with its debt, sale, reward and kill multiplier, locked ones dashed with 🔒, sold ones ticked; "Buy LVL N on credit" sets `input.current.buyFloor` and closes; `useMenuNav` for the stick and keys) |
| `exosuit.js` | `Bag` (the Bag's three tabs, `.btabs`: the `Editor`, which takes a `tabs` element to put at its foot, the Exo Suit, and Witness = `WitnessGallery`; `tab0` picks the one it opens on), `ExoSuit` (portrait, stats, `SUIT_SLOTS` slots `[data-xslot]`, the perk grid `.xperk` in a `ScrollBox` (a perk you can fit is `.grab`, `touch-action:none`; the rest `pan-y`; a cancelled press opens no card); drag a carried perk to a slot, a slot to a slot or off; tap for `PerkCard`; sets `perksDirty`; one of each: a fitted perk is `.xperk.inuse`, ticked, and won't drag into a second slot; a perk not unlocked is `.xperk.locked`: a blank tile in its own place, no glyph/tint/title, `pointer-events:none`) |
| `devpanel.js` | `FlamePreview`, `GradEditor` (tap the bar: a stop; drag; colour; delete), `RampEditor` (the opacity B-spline: tap to add, drag, delete) for Dev → Elites: flames; `DevPanel`, `DevGroupHead` (a group header: press and hold `HOLD_MS` to open/shut it, a bar fills while held; moving `HOLD_SLOP` px or letting go cancels, so scrolling can't flip one), `DevRow`, `JellyPreview` (runs the real `jellyStep`/`drawJelly`), `SpawnGun` |

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
  hold for its card) on an arc round the right stick, `DECK_PUSH` px out and as big as fits with `DECK_GAP`
  px between (v0.0.137; capped `DECK_MAX`), the bag and map the same size; the Bag (`.weapon`, 🎒) mirrors the last gun on
  the left; the map (`.mapbtn`, 🗺️) above it; the pin button (`.pinbtn`, the chosen pin) mirrors the map on the right, **only while the map is open** (owner). Gold (`.gold`, `fmtGold`: `1234` → `1.2kg`, thousands
  truncated) sits top centre, `pointer-events:none`, with the debt under it in full (`-64,000,000,000g owed`,
  not `fmtGold`) and `DueClock` under that, with `CrystalRow` (red and green silhouettes) between the gold and the debt, all centred (`topgold` checks them at phone widths); it updates because gold changes
  call `input.current.notify()` (re-renders `App`). The Dev button is a bare ⚙️
  (`.devbtn`); Restart is inside the Dev panel (`.dbg.restart`); like a death it empties the mods unlocked (`collection`), not the perks.
- **The map covers everything but its own button and the pin button** (v0.0.141, the owner: other UI
  got in the way). `.mapscreen` is `position:fixed` at z-index 11 in the page's root; `.app.mapping`
  raises `.sticks` (where the deck buttons live) to 12 and hides the sticks, guns and bag, so the map
  button is still under your thumb to shut it. The pin picker raises `.sticks` the same way
  (`.app.pinning`). The pin button is `holdPress`: tap = picker, hold = drop (`input.current.dropPin`).
- **No perk column on the play screen** (removed v0.0.137, the owner's call: the Exo Suit tab shows them).
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
  (`.dbg.newcave`) → `input.current.newCave = true`; **Floor 2** (`.dbg.floor2`) → `newCave = 2` (that floor, fresh). **All mods** (`.dbg`) flips `LO.debug`.
  `JellyPreview` sits at the top of the Jellyfish colours group, folded away with it.
- **Death:** "Tap the right stick to restart"; the **WITNESS YOURSELF** button (`.witnessbtn`) opens
  `Witness`; `.app.witnessing` hides the controls (and the gold). A saved replay (`playClip`: the
  gallery's tap) closes the Bag, plays in the same `Witness`, and Close reopens the Bag on its Witness
  tab (`bagTab`).
- **Exporting a video**: the scene doesn't take drags while it records (the framing holds); the
  video is only the canvas's play area, so the panel and its progress bar never show in it.
