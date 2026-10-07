// @ts-check
// App: the page. Holds the loadout and the input ref shared with the Game, renders the
// canvas, the two sticks and the deck buttons, and opens every overlay (Bag, Dev panel, gun
// chooser, cards, death replay).

import { SFX } from '../audio/sfx.js';
import { START_GOLD } from '../core/consts.js';
import { SUIT_LEN, activePerks, perkBag } from '../data/perks.js';
import { Game } from '../game/Game.js';
import { clipGet } from '../save/clips.js';
import { clearSave, loadCollection, loadPerkCollection, loadSave, saveCollection } from '../save/save.js';
import { GunCard, ModCard, PerkCard } from './cards.js';
import { DevPanel, SpawnGun, SpawnLevel } from './devpanel.js';
import { Bag } from './exosuit.js';
import { GunIcon } from './editor.js';
import { h, useEffect, useRef, useState } from './h.js';
import { CrystalRow, DueClock, PickKey, RKey, Stick, deckLayout, fmtGold, holdPress, shadeAt } from './hud.js';
import { MapScreen, PinPicker, loadPins, savePins, usePin } from './map.js';
import { MiniMap, miniBox } from './minimap.js';
import { SHOP_MENUS } from './modshop.js';
import { DragGun, HoldRing, gunSlotPress } from './gunhold.js';
import { GunSwap } from './swap.js';
import { Witness } from './witness.js';


export function App() {
  const blank = () => ({ active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false });
  const [saved] = useState(loadSave);      // last session's run, if there is one
  /** @type {{ current: GameInput }} */
  const input = useRef({
    left: blank(), right: blank(),
    loadout: saved ? saved.loadout : { guns: [null, null, null, null], bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], suit: Array(SUIT_LEN).fill(null), maxBonus: 0, usedLives: 0 },
    saved,                      // handed to Game once, to rebuild the floor
    paused: false, notify: () => {}, inShop: true, prompt: null, interact: false, sig: '',
    found: null,                // a gun on the ground, waiting on the swap chooser
    confirmAct: null, confirmAim: null,   // legacy hooks still read (harmlessly) by Stick
    pendingToast: null,         // raised while paused, shown by the loop when it resumes
    collection: loadCollection(),   // the mods unlocked, across runs
    perkCollection: loadPerkCollection(),   // and the perks
    shopOpen: null, menuTap: null, dispense: null,
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, inside: false, down: false },
  });
  const [size, setSize] = useState(150);
  const [vw, setVw] = useState(window.innerWidth);
  const [mapOpen, setMapOpen] = useState(false);
  const [pins, setPins] = useState(loadPins);      // the pin picker's pins, last used first (ui/map.js)
  const [pinOpen, setPinOpen] = useState(false);
  const [pinHeld, setPinHeld] = useState(false);
  const ctlRef = useRef(null);
  const sticksRef = useRef(null);
  const [run, setRun] = useState(0);
  const [edit, setEdit] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [lvlOpen, setLvlOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [savedClip, setSavedClip] = useState(null);   // the saved replay playing (its ClipMeta), from the Bag's Witness tab
  const [bagTab, setBagTab] = useState('guns');
  const [gunInfo, setGunInfo] = useState(-1);
  /** @type {[GunHold, (v: GunHold) => void]} */
  const [gunHold, setGunHold] = useState(null);
  /** @type {[GunDrag, (v: GunDrag) => void]} */
  const [gunDrag, setGunDrag] = useState(null);
  // null when closed; a timestamp (from the tap that opened it) while open, so
  // the Restart button's own tap can't also land on the Yes button underneath —
  // see the guard on the confirm button below
  const [confirmAt, setConfirmAt] = useState(null);
  const [, bump] = useState(0);
  const refresh = () => bump(n => n + 1);
  input.current.notify = refresh;
  const found = input.current.found;
  input.current.mapOpen = mapOpen;
  const shopOpen = input.current.shopOpen;
  input.current.paused = edit || !!found || devOpen || spawnOpen || mapOpen || witnessOpen || !!shopOpen;
  const closeShop = () => { input.current.shopOpen = null; input.current.sig = ''; refresh(); };

  const LO = input.current.loadout;
  // read through the ref: after a Restart the loadout object is replaced, and a
  // handler that closed over the old one silently edits a discarded loadout
  const select = i => {
    const L = input.current.loadout;
    if (L.guns[i]) { if (L.sel !== i) SFX.fx('switch'); L.sel = i; refresh(); }
  };
  const restart = () => {
    clearSave();
    // a new run, like a death: the mods unlocked go (the perks unlocked stay)
    input.current.collection.length = 0; saveCollection([]);
    input.current.saved = null;
    input.current.loadout = { guns: [null, null, null, null], bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], suit: Array(SUIT_LEN).fill(null), maxBonus: 0, usedLives: 0 };
    input.current.sig = '';
    input.current.found = null;
    input.current.shopOpen = null;
    input.current.witness = null; input.current.replay = null;
    setWitnessOpen(false);
    setGunInfo(-1);
    setEdit(false);
    setRun(r => r + 1);
  };
  // the game loop calls this when you tap the right stick on the death screen
  input.current.requestRestart = restart;

  useEffect(() => {
    // the circles are as big as two of them side by side will go: width is the binding
    // constraint on a phone, not height
    const fit = () => {
      // back to the size these were: the complaint was about the knob inside them, not
      // the pad. The -28 rather than -36 is because they are border-box now, which buys
      // the toolbar its 4px back and then some.
      setSize(Math.max(80, Math.floor(Math.min((window.innerWidth - 28) / 2, window.innerHeight * 0.28))));
      setVw(window.innerWidth);
    };
    fit();
    window.addEventListener('resize', fit);
    // the game frames itself to the area above the controls, so tell it how tall they are
    const ro = new ResizeObserver(() => {
      if (ctlRef.current) input.current.ctlH = ctlRef.current.getBoundingClientRect().height;
    });
    if (ctlRef.current) { ro.observe(ctlRef.current); input.current.ctlH = ctlRef.current.getBoundingClientRect().height; }
    return () => { window.removeEventListener('resize', fit); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const stop = e => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); };
    // in an embedded preview the page starts without keyboard focus, so the number
    // keys go nowhere until something in here is touched
    const grab = () => { try { window.focus(); } catch (_) {} SFX.unlock(); };
    grab();
    document.addEventListener('pointerdown', grab, true);
    document.addEventListener('contextmenu', stop);
    document.addEventListener('touchmove', stop, { passive: false });

    const map = { w: 'w', arrowup: 'w', ' ': 'w', a: 'a', arrowleft: 'a', s: 's', arrowdown: 's', d: 'd', arrowright: 'd' };
    const key = down => e => {
      // never let the game read keys meant for a text field, like the dev panel's inputs
      const t = e.target;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (map[k]) { input.current.keys[map[k]] = down; e.preventDefault(); }
      if (!down) return;
      SFX.unlock();
      if (k >= '1' && k <= '4') select(Number(k) - 1);
      if (k === 'e' || k === 'tab') { e.preventDefault();
        if (input.current.inShop || perkBag(activePerks(input.current.loadout)).tinker) setEdit(v => !v); }
      if ((k === 'r' || k === 'f' || k === 'enter') && input.current.menuTap) { input.current.menuTap(); return; }
      if (k === 'f') input.current.interact = true;
      if (k === 'm') setMapOpen(v => !v);
      if (k === 'escape') { setEdit(false); if (input.current.shopOpen) { input.current.shopOpen = null; input.current.sig = ''; refresh(); } }
    };
    const kd = key(true), ku = key(false);
    const blur = () => {
      Object.keys(input.current.keys).forEach(k => { input.current.keys[k] = false; });
      input.current.mouse.down = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerdown', grab, true);
      document.removeEventListener('contextmenu', stop);
      document.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const prompt = input.current.prompt;
  const inShop = input.current.inShop;
  const perkB = perkBag(activePerks(LO));
  const canEdit = inShop || perkB.tinker || !!LO.debugPerks;   // Tinker with Wands Everywhere frees the editor (and Dev → All perks, to test perks anywhere)
  const heldGun = input.current.loadout.guns[input.current.loadout.sel];
  const deck = deckLayout(vw, size, LO.guns.length);
  // the Mini-map perk's box: over the gun buttons, up to half the screen's height (sticks-row coordinates)
  const sticksTop = sticksRef.current ? sticksRef.current.getBoundingClientRect().top : window.innerHeight - size;
  const mini = perkB.minimap && !mapOpen ? miniBox(deck, window.innerHeight / 2 - sticksTop) : null;
  const btnAt = pt => ({ width: deck.btn, height: deck.btn,
    left: Math.round(pt.x - deck.btn / 2), top: Math.round(pt.y - deck.btn / 2) });

  // the death replay: offered once the recording has run on past the death (input.current.witness)
  const witness = input.current.witness;
  const openWitness = () => {
    input.current.replay = { t: witness.t0, speed: 1, playing: true, loop: true, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, unit: 1,
      clip: witness };
    setSavedClip(null);
    setWitnessOpen(true);
  };
  // a saved one, from the Bag's Witness tab: it plays full screen, and Close goes back to the tab
  /** @param {ClipMeta} m */
  const playClip = async m => {
    const S = await clipGet(m.id);
    if (!S || !input.current.clipFromSaved) return;
    const C = input.current.clipFromSaved(S);
    C.id = m.id; C.name = m.name;
    input.current.replay = { t: C.t0, speed: 1, playing: true, loop: true, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, unit: 1, clip: C };
    setSavedClip(m); setEdit(false); setWitnessOpen(true);
  };
  const closeWitness = () => {
    input.current.replay = null; setWitnessOpen(false);
    if (savedClip) { setSavedClip(null); setBagTab('witness'); setEdit(true); }
  };

  // the pin button: the chosen pin is the first in the list; picking one moves it there
  /** @param {string} e */
  const pickPin = e => { const L = usePin(pins, e); setPins(L); savePins(L); setPinOpen(false); };
  const dropPin = () => {
    if (!input.current.dropPin) return;
    input.current.dropPin(pins[0]);
    SFX.fx('place');
    setPinOpen(false);
  };

  return h('div', { className: 'app' + (witnessOpen ? ' witnessing' : '') + (mapOpen ? ' mapping' : '') + (mapOpen && pinOpen ? ' pinning' : '') },
    h('div', { className: 'view' },
      h(Game, { key: run, input }),
      witness && !witnessOpen ? h('button', { className: 'witnessbtn',
        onPointerDown: e => { e.preventDefault(); openWitness(); } }, 'WITNESS YOURSELF') : null,
      witnessOpen && input.current.replay ? h(Witness, { key: savedClip ? savedClip.id : 'live', input, close: closeWitness, saved: savedClip }) : null,
      // The item's card and its buy/take line are one panel now, grown up from the
      // bottom: the info you're reading and the price you're paying sit together.
      // The panel is pointer-events:none so a tap still reaches the sticks underneath;
      // buying and taking a mod is a tap on the right stick's dead zone (or the f key),
      // taken straight. A gun on the ground opens the swap chooser instead, so the panel
      // hides while that is up (the game pauses behind it).
      prompt && !found && !shopOpen ? h('div', { className: 'buypanel' + (prompt.pick ? ' pickpanel' + (prompt.idle ? '' : ' pickhide') : ''),
        style: { bottom: (input.current.promptBottom || 12) + 'px',
          maxHeight: 'calc(100% - ' + ((input.current.promptBottom || 12) + 12) + 'px)' } },
        prompt.id ? h(ModCard, { id: prompt.id, ingame: true }) : null,
        prompt.perk ? h(PerkCard, { id: prompt.perk, ingame: true }) : null,
        prompt.gun ? h(GunCard, { gun: prompt.gun, label: prompt.found ? 'Found' : 'For sale',
          ingame: true, compare: heldGun, compareName: heldGun ? heldGun.name : '' }) : null,
        // shop stock is "Buy <price>"; anything you pick up for free is just "Take" —
        // the card above already names it, so a nameless item (the heal) shows its name here.
        // a gun on the ground: hold a gun slot to take it (ui/gunhold.js), no right-stick tap
        prompt.gun && prompt.found && !input.current.gunMenu ? h('div', { className: 'pbuy' },
          h('b', null, 'Hold a gun slot')) :
        // the buy machine: flick the right stick up/down to pick the floor (left), tap to buy it (right)
        prompt.pick ? h('div', { className: 'pbuy pick' },
          h('div', { className: 'popt' }, h(PickKey), h('b', null, 'Select Level')),
          h('div', { className: 'popt' + (prompt.can ? '' : ' cant'), 'aria-label': 'Tap the right stick to buy' },
            h(RKey), h('b', null, prompt.text))) :
        h('div', { className: 'pbuy' + (prompt.can ? '' : ' cant'),
            'aria-label': 'Tap the right stick to ' + (prompt.price ? 'buy for ' + prompt.price + 'g' : 'take') },
          h(RKey),
          h('b', null, prompt.price ? prompt.price + 'g'
            : (prompt.id || prompt.gun || prompt.perk || prompt.heart) ? 'free' : prompt.text))) : null,
      // one gear in the top-right opens the Dev panel; Restart now lives inside it.
      // gold, top centre: "g" not "gold", truncated to k/M/B (1234 -> 1.2k). Under it in red, what
      // you owe the company for the level you're on, in full (64,000,000,000), and the time left to settle it
      h('div', { className: 'gold' },
        h('div', { className: 'purse' }, fmtGold(LO.gold), h('span', null, 'g')),
        h(CrystalRow, { red: (LO.crystals || []).length, green: (LO.greens || []).length }),
        LO.debt > 0 ? h('div', { className: 'debt' }, '-' + Math.trunc(LO.debt).toLocaleString('en-US'), h('span', null, 'g owed')) : null,
        LO.debt > 0 && LO.due ? h(DueClock, { due: LO.due }) : null),
      h('button', { className: 'devbtn', title: 'Dev tools',
        onPointerDown: e => { e.preventDefault(); setDevOpen(true); } }, '⚙️'),
      confirmAt != null ? h('div', { className: 'confirm' },
        h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }),
        h('div', { className: 'confirmCard' },
          h('p', null, 'Restart the run? You’ll lose your guns and mods.'),
          h('div', { className: 'confirmRow' },
            h('button', { className: 'cancel',
              onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }, 'Cancel'),
            h('button', { className: 'go',
              onPointerDown: e => {
                e.preventDefault();
                // the tap that opened this dialog can land here too, on some devices,
                // as a second pointerdown a moment later — ignore anything that close
                // to the open so that one tap can never both open and confirm
                if (performance.now() - confirmAt < 400) return;
                setConfirmAt(null);
                restart();
              } }, 'Yes, restart')))) : null
    ),
    mapOpen ? h(MapScreen, { input }) : null,
    h('div', { className: 'controls', ref: ctlRef },
      h('div', { className: 'sticks', ref: sticksRef },
        // a dark shade under the controls (owner): clear at the map button's top, black by the
        // sticks' middles and on down, so the sticks and buttons stand out from the cave
        h('div', { className: 'ctlshade', style: shadeAt(deck, size) }),
        mini ? h(MiniMap, { input, box: mini }) : null,
        h(Stick, { size, kind: 'left', input, refresh }),
        h(Stick, { size, kind: 'right', input, refresh }),
        // the gun buttons ride an arc round the right stick (ui/gunhold.js): tap to hold it (the
        // one in hand: its card); hold by a gun on the ground to take it into that slot; hold
        // with none in reach to drag this one out and drop it
        h('div', { className: 'slots' },
          LO.guns.map((g, i) => h('button', {
              key: i,
              className: 'dbtn slot' + (g ? '' : ' empty') + (i === LO.sel ? ' on' : '') +
                (gunHold && gunHold.i === i ? ' ringing ' + gunHold.mode : '') + (gunDrag && gunDrag.i === i ? ' lifted' : ''),
              style: btnAt(deck.guns[i]),
              title: g ? g.name + ' — hold to take a gun here, or drag it out' : 'Empty slot — hold to take a gun here',
              onPointerDown: gunSlotPress(input, i, {
                tap: () => { const L = input.current.loadout; if (L.guns[i] && L.sel === i) setGunInfo(i); else select(i); },
                setHold: setGunHold, setDrag: setGunDrag }),
            }, g && !(gunDrag && gunDrag.i === i) ? h(GunIcon, { gun: g }) : null,
            gunHold && gunHold.i === i ? h(HoldRing) : null))),
        // the bag mirrors the last gun on the left, and the map toggle sits right above it
        h('button', {
            className: 'dbtn weapon' + (canEdit ? '' : ' locked'), style: btnAt(deck.bag),
            title: canEdit ? 'Bag: guns & mods' : 'Bag: guns & mods (edit in the shop or with Tinker)',
            'aria-label': 'Bag',
            onPointerDown: e => { e.preventDefault(); setMapOpen(false); setBagTab('guns'); setEdit(true); } },
          h('span', { className: 'emo' }, '🎒'),
          LO.bag.length ? h('b', { className: 'badge' }, LO.bag.length) : null),
        h('button', {
            className: 'dbtn mapbtn' + (mapOpen ? ' on' : ''), style: btnAt(deck.map),
            title: 'Map', 'aria-label': 'Map',
            onPointerDown: e => { e.preventDefault(); setMapOpen(v => !v); setPinOpen(false); } },
          h('span', { className: 'emo' }, '🗺️')),
        // the pin button, opposite the map and only on the map screen (owner): tap for the picker,
        // hold to drop the pin where you are
        mapOpen ? h('button', {
            className: 'dbtn pinbtn' + (pinOpen ? ' on' : '') + (pinHeld ? ' holding' : ''), style: btnAt(deck.pin),
            title: 'Pins: tap to choose, hold to drop', 'aria-label': 'Pin',
            onPointerDown: holdPress(() => setPinOpen(v => !v), dropPin, setPinHeld) },
          h('span', { className: 'emo' }, pins[0])) : null,
        mapOpen && pinOpen ? h(PinPicker, { pins, cur: pins[0], pick: pickPin,
          style: { right: Math.max(8, Math.round(vw - deck.pin.x - deck.btn / 2)), top: Math.round(deck.pin.y - deck.btn / 2 - 8) } }) : null
      )
    ),
    edit ? h(Bag, { key: bagTab, input, refresh, canEdit, close: () => setEdit(false), tab0: bagTab, play: playClip }) : null,
    devOpen ? h(DevPanel, { input, refresh, close: () => setDevOpen(false),
      onRestart: () => { setDevOpen(false); setConfirmAt(performance.now()); },
      onSpawnGun: () => { setDevOpen(false); setSpawnOpen(true); },
      onSpawnLevel: () => { setDevOpen(false); setLvlOpen(true); } }) : null,
    lvlOpen ? h(SpawnLevel, { input, close: () => setLvlOpen(false) }) : null,
    spawnOpen ? h(SpawnGun, { input, close: () => setSpawnOpen(false) }) : null,
    shopOpen && SHOP_MENUS[shopOpen] ? h(SHOP_MENUS[shopOpen], { key: shopOpen, input, close: closeShop }) : null,
    gunDrag && LO.guns[gunDrag.i] ? h(DragGun, { gun: LO.guns[gunDrag.i], x: gunDrag.x, y: gunDrag.y }) : null,
    found ? h(GunSwap, { input, refresh, onDone: () => { setGunInfo(-1); refresh(); } }) : null,
    gunInfo >= 0 && LO.guns[gunInfo]
      ? h('div', null,
          h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setGunInfo(-1); } }),
          h(GunCard, { gun: LO.guns[gunInfo], label: 'Slot ' + (gunInfo + 1), tapMods: true,
            onClose: () => setGunInfo(-1) }))
      : null
  );
}
