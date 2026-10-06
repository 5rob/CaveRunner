# ui/ — layer 6: the React page

React without JSX (`h(...)`), off the global React the page loads from a CDN. Everything must work
**at phone width, with touch** (the owner plays in the Android app).

| File | Holds |
|---|---|
| `h.js` | `h` (`React.createElement`), `useRef`/`useEffect`/`useState`/`useMemo` |
| `app.js` | `App`: the loadout, the input ref shared with the Game (`input.current`: `GameInput` in `types.d.ts`), the canvas, the sticks, the deck buttons, every overlay, the key handler |
| `map.js` | The map (v0.0.141): `MapScreen` (full screen `.mapscreen`, its own canvas and rAF while open: `input.current.mapView()`'s picture, fitted to the height (`fitView`, `FIT_PAD`), the fog memory over it (a pixel a fog cell, smoothed, grown `MAP_SPREAD` cells by `spread`: the memory only lifts air and wall faces, so this shows the rock round what you saw), the shop's machines as coloured squares (`MAP_MARKS`: teleporter, heal, buy, sell, then `SHOPS` in their hues), your `helmet`, the pins standing on their spots; one pointer pans, two pinch round their middle, a wheel zooms, `keepOn` keeps some of it on screen, `ZOOM_MAX`; the view is on the canvas's `data-view` for the suite), `PinPicker` (`.pinpick`: the pins, last used first, `.pinopt[data-pin]`, then `.pinadd` (+) opening a one-character box, `firstChar`: a whole emoji counts as one), `loadPins`/`savePins` (localStorage `PIN_KEY`, `PIN_DEFAULTS`, `PIN_MAX`), `usePin` |
| `minimap.js` | The Mini-map perk (owner, `W.pb.minimap`; App mounts it in `.sticks` while fitted and the map is shut): `MiniMap` (a `canvas.minimap`, its own rAF; `data-zoom`, `data-k`, `data-foes`, `data-pins` for the suite), `miniBox(deck, top)` (the gun buttons' width, `MINI_PAD` above them, up to half the screen), `miniScale` (zoom 1 = `MINI_REACH` game-view widths across the box; `MINI_ZOOMS` 1/2/4, a tap steps), `miniAt` (world → box, you in the middle), `edgeClamp` (an off-box pin slides in on the line to it, `MINI_EDGE` from the edge), `spread`/`MAP_SPREAD` (the fog memory grown; `map.js` re-exports them). Picture: `G.miniC` (rock black 20%, air white 25%, made once per floor by `level-entry.js` `miniPicture`), masked by the fog memory only when it grows (a count of seen cells, or `mapN` changes); per frame one blit, then crystals (seen cells only), red dots, the arrow (aim, else facing), pins |
| `hud.js` | `Stick` (thumbsticks + gauge rings; publishes its centre and size for the menu pointer, and keeps the touch's `peak` push; no trigger ring while the gun in hand has Aim Assist, `hasAssist`), `RKey`, `CrystalIcon` (red or `green`), `CrystalRow` (the top bar's crystal silhouettes, `CRYS_MAX` a colour then +N), `GAUGE_R`/`GAUGE_C`/`GAUGE_COL`, `healthCol`, `holdPress` (tap vs hold), `deckLayout` (`pin`: the pin button, mirroring `map`), `shadeAt` (v0.0.146: the dark shade under the controls, clear at the map button's top, black by the sticks' middles), `fmtGold` |
| `cards.js` | `GunCard`, `ModCard`, `PerkCard`, `GUN_STATS` — the same cards in the build screen and in the shop/pickup panel (`ingame`). A `GunCard`'s mods are the Bag's square `.tile`s in a `.gmods` grid (v0.0.144, owner); with `tapMods` (the pickup, the gun machine, the Bag's gun card) a tap shows that mod's `ModCard` over everything (`ModPop`: a portal to `document.body`, so no card it sits in clips or restyles it); a `ModCard`'s example rows are square tiles as well. **The owner's audit** (LIST3 #6, `save/audit.js`): every tappable `ModCard`/`PerkCard` (not `ingame`: the shop panel takes no touches) has 📌 keep / 🗑️ trash toggles in its head (`.aumark[data-audit]`, exclusive, tap again to clear) and a Give Feedback button (`.aufb`, the notes peeking beside it) that turns the card into `AuditText` (a textarea `.autext` prefilled with the notes, Cancel / Save, kept near the top so a phone keyboard leaves Save in view); `useAudit` keys its state by item, so the Bag's one card follows the mod tapped |
| `editor.js` | The build screen (Bag): `Editor`, `GunStats`, `GunFire`, `GunIcon`, `SlotGrid`, `ScrollBox`, `PULL_COL`, `GS_ROWS`, `LIVE_BAR`, `SHOW_TIPS`. Top: the stats and, beside them, `GunFire` (`.gfire`, owner's item 4): a small dark canvas with the selected gun (`drawGun`) firing each pull of the fire preview as it happens — it watches the same sim as `SlotGrid` (`S.fired` ticks, `S.shots` = that pull's shots, `bagsim.js`), so the window and the slot lights are in step and follow every build change. Shots are drawn with the game's `drawLook` (else its streak; beams a fading line, fields a fading disc), in world units × `GF_ZOOM`, slowed to `GF_SPEED`, at most `GF_MAX`; its own rAF, gone with the Bag. The gun buttons (`.gtabs.gunrow`, four equal columns) are a row **under the mod grid** (they were a 2×2 by the stats). Don't name a class `.grow`: the vending menus own it. The "Collected mods" grid (item 9) is one tile per stack (`stackBag`, `spells/collection.js`) with a count circle `.tcount` top right for 2+ (it hides the tile's `.tmark`); a drag takes one copy (the stack's first bag index), a slot dropped on the bag joins its stack; the Debug shelf stays one tile per mod, unstacked. **Discriminate** (LIST3 #11): a set copy's tile (and its card's glyph) shows its target's icon (`tgtBadge`, `cards.js`: `.ttgt` top left); an unset copy's card has a **Set target** button (`ModCard`'s `act`, `.pact`) that sets `input.pickTarget` to its bag index and closes the Bag (the game does the pick, `game/systems/gun.js`); opening the Bag cancels a pick |
| `gunhold.js` | `gunSlotPress` (the HUD gun slots' tap / hold-to-take / hold-and-drag-to-drop), `HoldRing`, `DragGun`, `GUN_HOLD_MS` |
| `swap.js` | `GunSwap` (archived since v0.0.149: only with `input.current.gunMenu`): the chooser when you take a gun (found or bought). Since v0.0.144 (owner) the four slot buttons are a full-width row of squares at the bottom and the two cards split the rest equally (`flex: 1 1 0`); their stats one column, two on a screen under 860 tall, three under 700, so nothing scrolls (`gunpickup` checks 412×880, 390×844, 360×640) |
| `witness.js` | `Witness` (the death replay's controls, for the live clip or a saved one: `saved` is its `ClipMeta`; **💾 Save** → `input.current.saveClip`, **🎬 Export video** → `exportClip`), `RP_SPEEDS` |
| `clips.js` | `WitnessGallery` (the Bag's Witness tab: `.wclip` cards, thumbnail → play, ✏️ Rename inline, 🗑️ then Delete), `exportClip` (plays the replay once from the start as set up, drawn on the whole screen while `V.full` so the video is the screen's shape, copies it each frame (`V.onFrame`) into a canvas sized on the first frame (a new canvas is already 300 × 150, so it's a flag, not `!width`), `captureStream` + `SFX.stream()` into a `MediaRecorder`; MP4 if `pickMime` finds one, else WebM through `toMp4`, ffmpeg.wasm from jsdelivr), `saveVideo` (the app's `window.CaveApp` bridge, or a download), `fileName` |
| `vendshop.js` | `VendShop`: a vending machine's menu for any `ShopDef` (collection grid in groups, unlock button, the selected card, "Dispense selected"), `useMenuNav` (the right stick is a pointer past `MENU_PTR`: `menuPointer` maps it out to the furthest screen corner, `snapTo` pulls it gently onto the nearest button, a thin ring `.mptr` shows it, it lights that `[data-nav]` and presses it on release; a plain tap `input.current.menuTap` presses the lit one: right-stick tap, r/f/enter; arrows step with `navStep`) |
| `modshop.js` | `modShop` (the mods' `ShopDef`), `SHOP_DEFS` (by `SHOPS` key), `CrystalIcon`. **Archived since v0.0.138** with `VendShop` for mods and perks: those machines take crystals and have no menu (`takes` in `SHOPS`); the code stays so a menu can come back |
| `gunshop.js` | `GunVend`: the gun machine's menu (three `Reel`s of `LO.gunShop`, the selected `GunCard`, Buy / Reroll; reels stop one at a time, `REEL_*`; the Boosted reroll went in v0.0.140; with no gun to your name the first reel is a `scratchPistol`, **FREE**, standing in front of the offer's first gun, which isn't used up by taking it, v0.0.142). `SHOP_MENUS` (in `modshop.js`) maps each `SHOPS` key to its menu; `useMenuNav` (vendshop.js) is the shared stick/key handling |
| `levelshop.js` | `LevelVend`: the level buy machine's floor menu (`SHOP_MENUS.levels`; a `.lvrow[data-floor]` per floor with its debt, sale, reward and kill multiplier, locked ones dashed with 🔒, sold ones ticked; "Buy LVL N on credit" sets `input.current.buyFloor` and closes; `useMenuNav` for the stick and keys) |
| `exosuit.js` | `Bag` (the Bag's three tabs, `.btabs`: the `Editor`, which takes a `tabs` element to put at its foot, the Exo Suit, and Witness = `WitnessGallery`; `tab0` picks the one it opens on), `ExoSuit` (portrait, stats, `SUIT_SLOTS` slots `[data-xslot]`, the perk grid `.xperk` in a `ScrollBox` (a perk you can fit is `.grab`, `touch-action:none`; the rest `pan-y`; a cancelled press opens no card); drag a carried perk to a slot, a slot to a slot or off; tap for `PerkCard`; sets `perksDirty`; one of each: a fitted perk is `.xperk.inuse`, ticked, and won't drag into a second slot; a perk not unlocked is `.xperk.locked`: a blank tile in its own place, no glyph/tint/title, `pointer-events:none`) |
| `devpanel.js` | `FlamePreview`, `GradEditor` (tap the bar: a stop; drag; colour; delete), `RampEditor` (the opacity B-spline: tap to add, drag, delete) for Dev → Elites: flames; `FadeCurve` (the hologram flash); `CurveEdit` (any curve knob, `CURVES` in `dev/knobs.js`: four handles, the end points move only up and down; shown in its group); `DevPanel` (top: actions grid incl. Copy report and Copy audit (`auditText`, `save/audit.js`; same clipboard + fallback, `copyText`), a search box over every knob's label/key, the tabs from `DEV_TABS`; below, `.devbody` scrolls the tab's groups; tests reach tabs as `.devtab[data-t=…]`), `DevGroupHead` (a group header `.devghead[data-g=…]`: a tap opens/shuts it — a scroll fires no click; shows the knob count and how many changed), `DevRow`, `JellyPreview` (runs the real `jellyStep`/`drawJelly`), `SpawnGun` |

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
- **The HUD gun slots** (`gunhold.js` `gunSlotPress`, v0.0.149, owner: replaces the swap chooser). Tap =
  equip; tap the gun already in hand = its card (`gunInfo`). Hold (`GUN_HOLD_MS`, 450ms; `HoldRing`, an SVG
  ring filling round the slot, orange `.take` / pale `.lift`): with a gun on the ground in reach
  (`input.current.gunNear`, set by `stepPickups`, same reach as its card) → `input.current.takeGun(i)` takes it
  into that slot (your old gun lies where it was; the empty dotted slot too). With none in reach and a gun in
  the slot → it lifts out (`DragGun`, `.gundrag`, follows the finger); letting go → `input.current.dropGun(i,
  clientX, clientY)` drops it there (Game converts with the camera; `systems/pickups.js dropGun` settles it on
  the floor below, or at your feet if the spot is rock or out of sight); letting go over its own slot cancels.
  A finger moving 14px before the hold fires cancels it. `gunhold` (browser) checks all of it in a sandbox.
- **`GunSwap` is archived** (`swap.js`): the interact tap on a gun opens it only if `input.current.gunMenu` is
  set (the suites that still test the chooser — `gunpickup`, `compare`, `teleport` — set it); otherwise the
  tap just toasts "Hold a gun slot to take it", and a found gun's panel says "Hold a gun slot".
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
  (`.dbg.newcave`) → `input.current.newCave = true`; **Floor 2** (`.dbg.floor2`) → `newCave = 2` (that floor, fresh). **All mods** (`.dbg`) flips `LO.debug`. **All perks** (`.dbg.allperks`, v0.0.148) flips `LO.debugPerks`: the Exo Suit's grid shows every perk to fit, endless copies (fitting takes none off `LO.perks`, taking one out puts none back), and the suit and editor work anywhere (`canEdit` in `app.js`), to test perks.
  `JellyPreview` sits at the top of the Jellyfish colours group, folded away with it.
- **Death:** "Tap the right stick to restart"; the **WITNESS YOURSELF** button (`.witnessbtn`) opens
  `Witness`; `.app.witnessing` hides the controls (and the gold). A saved replay (`playClip`: the
  gallery's tap) closes the Bag, plays in the same `Witness`, and Close reopens the Bag on its Witness
  tab (`bagTab`).
- **Exporting a video**: the scene doesn't take drags while it records (the framing holds); the
  video is only the canvas's play area, so the panel and its progress bar never show in it.
