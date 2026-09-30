// @ts-check
// App: the page. Holds the loadout and the input ref shared with the Game, renders the
// canvas, the two sticks and the deck buttons, and opens every overlay (Bag, Dev panel, gun
// chooser, cards, death replay).

import { SFX } from '../audio/sfx.js';
import { START_GOLD } from '../core/consts.js';
import { PERKS, perkBag } from '../data/perks.js';
import { Game } from '../game/Game.js';
import { clearSave, loadSave } from '../save/save.js';
import { startingGuns } from '../spells/guns.js';
import { GunCard, ModCard, PerkCard } from './cards.js';
import { DevPanel, SpawnGun } from './devpanel.js';
import { Editor, GunIcon } from './editor.js';
import { h, useEffect, useRef, useState } from './h.js';
import { RKey, Stick, deckLayout, fmtGold, holdPress } from './hud.js';
import { GunSwap } from './swap.js';
import { Witness } from './witness.js';

export function App() {
  const blank = () => ({ active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false });
  const [saved] = useState(loadSave);      // last session's run, if there is one
  /** @type {{ current: GameInput }} */
  const input = useRef({
    left: blank(), right: blank(),
    loadout: saved ? saved.loadout : { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 },
    saved,                      // handed to Game once, to rebuild the floor
    paused: false, notify: () => {}, inShop: true, prompt: null, interact: false, sig: '',
    found: null,                // a gun on the ground, waiting on the swap chooser
    confirmAct: null, confirmAim: null,   // legacy hooks still read (harmlessly) by Stick
    pendingToast: null,         // raised while paused, shown by the loop when it resumes
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, inside: false, down: false },
  });
  const [size, setSize] = useState(150);
  const [vw, setVw] = useState(window.innerWidth);
  const [mapOpen, setMapOpen] = useState(false);
  const ctlRef = useRef(null);
  const [run, setRun] = useState(0);
  const [edit, setEdit] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [gunInfo, setGunInfo] = useState(-1);
  const [held, setHeld] = useState(-1);
  // null when closed; a timestamp (from the tap that opened it) while open, so
  // the Restart button's own tap can't also land on the Yes button underneath —
  // see the guard on the confirm button below
  const [confirmAt, setConfirmAt] = useState(null);
  const [, bump] = useState(0);
  const refresh = () => bump(n => n + 1);
  input.current.notify = refresh;
  const found = input.current.found;
  input.current.mapOpen = mapOpen;
  input.current.paused = edit || !!found || devOpen || spawnOpen || mapOpen || witnessOpen;

  const LO = input.current.loadout;
  // read through the ref: after a Restart the loadout object is replaced, and a
  // handler that closed over the old one silently edits a discarded loadout
  const select = i => {
    const L = input.current.loadout;
    if (L.guns[i]) { if (L.sel !== i) SFX.fx('switch'); L.sel = i; refresh(); }
  };
  const restart = () => {
    clearSave();
    input.current.saved = null;
    input.current.loadout = { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 };
    input.current.sig = '';
    input.current.found = null;
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
        if (input.current.inShop || perkBag(input.current.loadout.perks || []).tinker) setEdit(v => !v); }
      if (k === 'f') input.current.interact = true;
      if (k === 'm') setMapOpen(v => !v);
      if (k === 'escape') setEdit(false);
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
  const perkB = perkBag(LO.perks || []);
  const canEdit = inShop || perkB.tinker;      // Tinker with Wands Everywhere frees the editor
  const heldGun = input.current.loadout.guns[input.current.loadout.sel];
  const deck = deckLayout(vw, size, LO.guns.length);
  const btnAt = pt => ({ width: deck.btn, height: deck.btn,
    left: Math.round(pt.x - deck.btn / 2), top: Math.round(pt.y - deck.btn / 2) });

  // the death replay: offered once the recording has run on past the death (input.current.witness)
  const witness = input.current.witness;
  const openWitness = () => {
    input.current.replay = { t: witness.t0, speed: 1, playing: true, loop: true, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, unit: 1 };
    setWitnessOpen(true);
  };
  const closeWitness = () => { input.current.replay = null; setWitnessOpen(false); };

  return h('div', { className: 'app' + (witnessOpen ? ' witnessing' : '') },
    h('div', { className: 'view' },
      h(Game, { key: run, input }),
      witness && !witnessOpen ? h('button', { className: 'witnessbtn',
        onPointerDown: e => { e.preventDefault(); openWitness(); } }, 'WITNESS YOURSELF') : null,
      witnessOpen && witness ? h(Witness, { input, close: closeWitness }) : null,
      // The item's card and its buy/take line are one panel now, grown up from the
      // bottom: the info you're reading and the price you're paying sit together.
      // The panel is pointer-events:none so a tap still reaches the sticks underneath;
      // buying and taking a mod is a tap on the right stick's dead zone (or the f key),
      // taken straight. A gun on the ground opens the swap chooser instead, so the panel
      // hides while that is up (the game pauses behind it).
      prompt && !found ? h('div', { className: 'buypanel',
        style: { bottom: (input.current.promptBottom || 12) + 'px',
          maxHeight: 'calc(100% - ' + ((input.current.promptBottom || 12) + 12) + 'px)' } },
        prompt.id ? h(ModCard, { id: prompt.id, ingame: true }) : null,
        prompt.perk ? h(PerkCard, { id: prompt.perk, ingame: true }) : null,
        prompt.gun ? h(GunCard, { gun: prompt.gun, label: prompt.found ? 'Found' : 'For sale',
          ingame: true, compare: heldGun, compareName: heldGun ? heldGun.name : '' }) : null,
        // shop stock is "Buy <price>"; anything you pick up for free is just "Take" —
        // the card above already names it, so a nameless item (the heal) shows its name here.
        h('div', { className: 'pbuy' + (prompt.can ? '' : ' cant'),
            'aria-label': 'Tap the right stick to ' + (prompt.price ? 'buy for ' + prompt.price + 'g' : 'take') },
          h(RKey),
          h('b', null, prompt.price ? prompt.price + 'g'
            : (prompt.id || prompt.gun || prompt.perk || prompt.heart) ? 'free' : prompt.text))) : null,
      // one gear in the top-right opens the Dev panel; Restart now lives inside it.
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
    h('div', { className: 'controls', ref: ctlRef },
      (LO.perks && LO.perks.length)
        ? h('div', { className: 'perkrow' },
            LO.perks.map((id, i) => PERKS[id] ? h('span', {
                key: i, className: 'perkpip', title: PERKS[id].name,
                style: { color: PERKS[id].tint } }, PERKS[id].glyph) : null))
        : null,
      h('div', { className: 'sticks' },
        h(Stick, { size, kind: 'left', input, refresh }),
        h(Stick, { size, kind: 'right', input, refresh }),
        // gold sits in the gap between the two sticks, down level with their bottom halves.
        // "g" not "gold", and thousands truncate to a "k" (1234 -> 1.2k, 2000 -> 2k).
        h('div', { className: 'gold' }, fmtGold(LO.gold), h('span', null, 'g')),
        // the gun buttons ride an arc round the right stick; tap to hold it, hold for its card
        h('div', { className: 'slots' },
          LO.guns.map((g, i) => h('button', {
              key: i,
              className: 'dbtn slot' + (g ? '' : ' empty') + (i === LO.sel ? ' on' : '') +
                (held === i ? ' holding' : ''),
              style: btnAt(deck.guns[i]),
              title: g ? g.name + ' — hold for details' : 'Empty slot',
              onPointerDown: holdPress(
                () => select(i),
                () => { if (input.current.loadout.guns[i]) setGunInfo(i); },
                on => setHeld(on ? i : -1)),
            }, g ? h(GunIcon, { gun: g }) : null))),
        // the bag mirrors the last gun on the left, and the map toggle sits right above it
        h('button', {
            className: 'dbtn weapon' + (canEdit ? '' : ' locked'), style: btnAt(deck.bag),
            title: canEdit ? 'Bag: guns & mods' : 'Bag: guns & mods (edit in the shop or with Tinker)',
            'aria-label': 'Bag',
            onPointerDown: e => { e.preventDefault(); setMapOpen(false); setEdit(true); } },
          h('span', { className: 'emo' }, '🎒'),
          LO.bag.length ? h('b', { className: 'badge' }, LO.bag.length) : null),
        h('button', {
            className: 'dbtn mapbtn' + (mapOpen ? ' on' : ''), style: btnAt(deck.map),
            title: 'Map', 'aria-label': 'Map',
            onPointerDown: e => { e.preventDefault(); setMapOpen(v => !v); } },
          h('span', { className: 'emo' }, '🗺️'))
      )
    ),
    edit ? h(Editor, { input, refresh, canEdit, close: () => setEdit(false) }) : null,
    devOpen ? h(DevPanel, { input, refresh, close: () => setDevOpen(false),
      onRestart: () => { setDevOpen(false); setConfirmAt(performance.now()); },
      onSpawnGun: () => { setDevOpen(false); setSpawnOpen(true); } }) : null,
    spawnOpen ? h(SpawnGun, { input, close: () => setSpawnOpen(false) }) : null,
    found ? h(GunSwap, { input, refresh, onDone: () => { setGunInfo(-1); refresh(); } }) : null,
    gunInfo >= 0 && LO.guns[gunInfo]
      ? h('div', null,
          h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setGunInfo(-1); } }),
          h(GunCard, { gun: LO.guns[gunInfo], label: 'Slot ' + (gunInfo + 1),
            onClose: () => setGunInfo(-1) }))
      : null
  );
}
