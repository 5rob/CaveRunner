// @ts-check
// GunVend: the gun vending machine's menu (game/systems/shops.js opens it). Three guns on offer
// (LO.gunShop, spells/gunshop.js), stacked on the left as slot-machine reels with their prices
// under them; the selected gun's full card (stats and its mod grid) on the right; and at the
// bottom Buy selected and Reroll (gold, dearer each use on the floor; the red-crystal Boosted reroll
// went in v0.0.140: crystals can't be carried). A reroll spins the reels and stops them one at a
// time, each overshooting and thudding into place. Sticks: useMenuNav (ui/vendshop.js).
// Since v0.0.142 a new run starts with no guns: while you have none, the first reel is a Scratch
// Pistol, free (it stands in front of the offer's first gun, which comes back once you have a gun).

import { SFX } from '../audio/sfx.js';
import { gunLvCol, gunColor, makeGun, scratchPistol } from '../spells/guns.js';
import { GUN_OFFER, newOffer, rerollPrice, rollOffer, shopGunPrice } from '../spells/gunshop.js';
import { GunCard } from './cards.js';
import { GunIcon } from './editor.js';
import { h, useEffect, useRef, useState } from './h.js';
import { fmtGold } from './hud.js';
import { useMenuNav } from './vendshop.js';

// the reels: fillers on a strip, items per second, when each stops (the first, then the gap),
// how far past its gun it overshoots (items) and how long it takes to settle back
export const REEL_FILL = 5, REEL_SPEED = 12, REEL_BOOST = 17, REEL_STOP = 0.9, REEL_GAP = 0.45;
const OVER = 0.22, SETTLE = 0.18;
/** @type {Gun[]} */
const NO_GUNS = [];
/** @type {{ n: number, boost: boolean } | null} */
const NO_SPIN = null;

/** @param {{ gun: Gun | null }} props */
function ReelItem({ gun }) {
  return h('div', { className: 'gitem' + (gun ? '' : ' sold') },
    gun ? h(GunIcon, { gun }) : h('b', null, 'SOLD'),
    gun ? h('span', { style: { color: gunLvCol(gun) || '#c9ccd4' } }, (gun.boosted ? '✦ ' : '') + 'Lv ' + (gun.lvl || 1)) : null);
}

// One reel. While `spin` is up it scrolls a strip of filler guns, then (its turn to stop) eases
// onto its gun, past it by OVER, thuds, and settles back; onLand tells the menu it's done
/** @param {{ gun: Gun | null, idx: number, spin: { n: number, boost: boolean } | null, onLand: (i: number) => void }} props */
function Reel({ gun, idx, spin, onLand }) {
  const strip = useRef(null), win = useRef(null);
  const [fill, setFill] = useState(NO_GUNS);
  const [thud, setThud] = useState(0);
  const on = !!spin && fill.length > 0;
  // a new spin: fresh fillers of about the same level
  useEffect(() => {
    if (!spin) return;
    const lvl = gun && gun.lvl || 1;
    setFill(Array.from({ length: REEL_FILL }, () => makeGun(Math.random, lvl)));
  }, [spin && spin.n]);
  useEffect(() => {
    if (!on || !strip.current || !win.current) return;
    const H = win.current.clientHeight, K = REEL_FILL, speed = spin.boost ? REEL_BOOST : REEL_SPEED;
    const stopAt = REEL_STOP * (spin.boost ? 0.8 : 1) + idx * REEL_GAP;
    const t0 = performance.now();
    let raf = 0, tick = -1, land = null, thudded = false;
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      let o;
      if (!land) {
        const raw = t * speed;
        o = raw % K;
        if (Math.floor(raw) !== tick) { tick = Math.floor(raw); SFX.fx('reelTick'); }
        // its turn to stop, and its gun is coming round: brake onto it at the speed it's going
        if (t >= stopAt && o >= K - 0.6) land = { o0: o, t: t, dur: 3 * (K + 1 + OVER - o) / speed };
      }
      if (land) {
        const s = (t - land.t) / land.dur;
        if (s < 1) o = land.o0 + (K + 1 + OVER - land.o0) * (1 - Math.pow(1 - s, 3));
        else {
          if (!thudded) { thudded = true; SFX.fx('reelThud'); setThud(n => n + 1); }
          const b = Math.min(1, (t - land.t - land.dur) / SETTLE);
          o = K + 1 + OVER * (1 - b * b * (3 - 2 * b));
          if (b >= 1) { strip.current.style.transform = 'translateY(' + (-(K + 1) * H) + 'px)'; onLand(idx); return; }
        }
      }
      strip.current.style.transform = 'translateY(' + (-o * H) + 'px)';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on, spin && spin.n]);
  const items = on ? [...fill, fill[0], gun, fill[1]] : [gun];
  return h('div', { className: 'greelwin' + (on ? ' spinning' : ''), ref: win },
    h('div', { className: 'gstrip', ref: strip, key: on ? 's' + spin.n : 'still', style: on ? null : { transform: 'none' } },
      items.map((g, i) => h(ReelItem, { key: i, gun: g }))),
    h('div', { className: 'gthud', key: thud }));
}

/** @param {{ input: { current: GameInput }, close: () => void }} props */
export function GunVend({ input, close }) {
  const LO = input.current.loadout, floor = input.current.floor || 1;
  // the floor's offer: made the first time you open the machine on a floor, kept till the next
  const [o] = useState(() => {
    if (!LO.gunShop || LO.gunShop.floor !== floor) LO.gunShop = newOffer(Math.random, floor);
    return LO.gunShop;
  });
  // no gun to your name: the first one's a Scratch Pistol, free
  const [pistol] = useState(scratchPistol);
  const free = !LO.guns.some(Boolean);
  const guns = free ? [pistol, ...o.guns.slice(1)] : o.guns;
  /** @param {number} i */
  const priceOf = i => (free && i === 0 ? 0 : guns[i] ? shopGunPrice(guns[i]) : 0);
  const firstGun = () => Math.max(0, guns.findIndex(Boolean));
  const [sel, setSel] = useState(firstGun);
  const [focus, setFocus] = useState(() => (guns.some(Boolean) ? 'g:' + firstGun() : 'reroll'));
  const [spin, setSpin] = useState(NO_SPIN);
  const [landed, setLanded] = useState(0);
  const [msg, setMsg] = useState('');
  const [, bump] = useState(0);
  const root = useRef(null);
  const spinning = !!spin && landed < GUN_OFFER;
  const gun = guns[sel] || null;
  const price = priceOf(sel);
  const rr = rerollPrice(floor, o.rerolls);

  const reroll = () => {
    if (spinning) return;
    if (LO.gold < rr) { SFX.ui('poor'); setMsg('Not enough gold'); return; }
    LO.gold -= rr; o.rerolls++;
    rollOffer(Math.random, o, false);
    SFX.ui('buy');
    setMsg(''); setLanded(0); setSel(0);
    setSpin(s => ({ n: (s ? s.n : 0) + 1, boost: false }));
    input.current.notify();
  };
  const buy = () => {
    if (spinning) return;
    if (!gun) { SFX.ui('poor'); setMsg('Nothing to buy there'); return; }
    if (LO.gold < price) { SFX.ui('poor'); setMsg('Not enough gold'); return; }
    LO.gold -= price;
    input.current.dispense = { shop: 'guns', gun };
    if (!(free && sel === 0)) o.guns[sel] = null;     // the free pistol isn't the offer's: it stays up while you have no gun
    SFX.ui('buy');
    close();
  };
  /** @param {string} key */
  const press = key => {
    if (key === 'close') close();
    else if (key === 'buy') buy();
    else if (key === 'reroll') reroll();
    else if (key.startsWith('g:') && !spinning) { setSel(Number(key.slice(2))); setMsg(''); SFX.fx('switch'); }
    bump(n => n + 1);
  };
  const ptr = useMenuNav(input, root, focus, setFocus, press);

  /** @param {string} key @param {string} cls */
  const navCls = (key, cls) => cls + (focus === key ? ' navon' : '');
  /** @param {string} key @returns {(e: PointerEvent) => void} */
  const tap = key => e => { e.preventDefault(); setFocus(key); press(key); };
  /** @param {number} i */
  const onLand = i => setLanded(n => Math.max(n, i + 1));
  const held = LO.guns[LO.sel];
  return h('div', { className: 'vshop gshop', ref: root, style: { bottom: (input.current.ctlH || 0) + 'px' } },
    ptr,
    h('div', { className: 'vhead' },
      h('b', null, 'Guns'),
      h('span', { className: 'vgold' }, fmtGold(LO.gold), h('i', null, 'g')),
      h('button', { className: navCls('close', 'vclose'), 'data-nav': 'close', onPointerDown: tap('close') }, '×')),
    h('div', { className: 'gmid' },
      h('div', { className: 'greels' },
        guns.map((g, i) => h('div', { key: i, 'data-nav': 'g:' + i, onPointerDown: tap('g:' + i),
            className: navCls('g:' + i, 'greel') + (sel === i ? ' sel' : '') },
          h(Reel, { gun: g, idx: i, spin, onLand }),
          h('div', { className: 'gprice' + (free && i === 0 ? ' free' : '') }, spinning && landed <= i ? '···' : !g ? '—' : free && i === 0 ? 'FREE' : priceOf(i) + 'g')))),
      h('div', { className: 'gcard scroll' },
        spinning ? h('p', { className: 'vhint' }, 'Rolling…')
          : gun ? h(GunCard, { gun, label: free && sel === 0 ? 'Free' : gun.boosted ? 'Boosted' : 'For sale', ingame: true, flow: true, tapMods: true,
              compare: held, compareName: held ? held.name : '' })
          : h('p', { className: 'vhint' }, 'Sold'))),
    msg ? h('div', { className: 'vmsg' }, msg) : null,
    h('div', { className: 'gbtns' },
      h('button', { className: navCls('buy', 'vbuy') + (gun && !spinning && LO.gold >= price ? '' : ' cant'), 'data-nav': 'buy', onPointerDown: tap('buy') },
        h('b', null, free && sel === 0 ? 'Take it' : 'Buy selected'), h('span', null, !gun ? '—' : free && sel === 0 ? 'FREE' : price + 'g')),
      h('div', { className: 'grow' },
        h('button', { className: navCls('reroll', 'vbuy greroll') + (!spinning && LO.gold >= rr ? '' : ' cant'), 'data-nav': 'reroll', onPointerDown: tap('reroll') },
          h('b', null, 'Reroll'), h('span', null, rr + 'g')))));
}
