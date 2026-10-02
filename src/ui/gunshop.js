// @ts-check
// GunVend: the gun vending machine's menu (game/systems/shops.js opens it). Three guns on offer
// (LO.gunShop, spells/gunshop.js), stacked on the left as slot-machine reels with their prices
// under them; the selected gun's full card (stats and its mod grid) on the right; and at the
// bottom Buy selected, Reroll (gold, dearer each use on the floor) and the crystal-boosted reroll
// (red crystals, one more each use: deeper levels, boosted stats). A reroll spins the reels and
// stops them one at a time, each overshooting and thudding into place; a boosted one spins faster
// with red sparks streaming past. Sticks: useMenuNav (ui/vendshop.js).

import { SFX } from '../audio/sfx.js';
import { gunLvCol, gunColor, makeGun } from '../spells/guns.js';
import { GUN_OFFER, boostCost, newOffer, rerollPrice, rollOffer, shopGunPrice } from '../spells/gunshop.js';
import { GunCard } from './cards.js';
import { GunIcon } from './editor.js';
import { h, useEffect, useRef, useState } from './h.js';
import { CrystalIcon, fmtGold } from './hud.js';
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

// Red sparks streaming up past the reels (a boosted reroll), a little faster than the reels so
// they read as nearer; the big ones fastest. Runs while `on`, then lets the last ones fly out
/** @param {{ on: boolean }} props */
function Sparks({ on }) {
  const ref = useRef(null), live = useRef(on);
  live.current = on;
  useEffect(() => {
    if (!on) return;
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /** @type {{ x: number, y: number, r: number, v: number }[]} */
    const ps = [];
    let raf = 0, last = performance.now();
    const base = REEL_BOOST * 64 * 1.3;           // px/s: the reels' speed and a third
    const frame = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (live.current) for (let i = 0; i < 4; i++) {
        const r = 1 + Math.random() * 2.5;
        ps.push({ x: Math.random() * W, y: H + 10, r, v: base * (0.7 + r * 0.25) });
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.y -= p.v * dt;
        if (p.y < -20) { ps.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, 'rgba(255,90,90,0.95)'); g.addColorStop(0.35, 'rgba(255,30,50,0.5)'); g.addColorStop(1, 'rgba(255,0,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r * 4, p.y - p.r * 10, p.r * 8, p.r * 14);
        ctx.fillStyle = 'rgba(255,230,230,0.9)';
        ctx.fillRect(p.x - p.r * 0.4, p.y - p.r * 3, p.r * 0.8, p.r * 4);
      }
      if (live.current || ps.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return h('canvas', { className: 'gsparks', ref });
}

/** @param {{ input: { current: GameInput }, close: () => void }} props */
export function GunVend({ input, close }) {
  const LO = input.current.loadout, floor = input.current.floor || 1;
  // the floor's offer: made the first time you open the machine on a floor, kept till the next
  const [o] = useState(() => {
    if (!LO.gunShop || LO.gunShop.floor !== floor) LO.gunShop = newOffer(Math.random, floor);
    return LO.gunShop;
  });
  const firstGun = () => Math.max(0, o.guns.findIndex(Boolean));
  const [sel, setSel] = useState(firstGun);
  const [focus, setFocus] = useState(() => (o.guns.some(Boolean) ? 'g:' + firstGun() : 'reroll'));
  const [spin, setSpin] = useState(NO_SPIN);
  const [landed, setLanded] = useState(0);
  const [msg, setMsg] = useState('');
  const [, bump] = useState(0);
  const root = useRef(null);
  const spinning = !!spin && landed < GUN_OFFER;
  const crystals = LO.crystals || (LO.crystals = []);
  const gun = o.guns[sel] || null;
  const price = gun ? shopGunPrice(gun) : 0;
  const rr = rerollPrice(floor, o.rerolls), bc = boostCost(o.boosts);

  /** @param {boolean} boost */
  const reroll = boost => {
    if (spinning) return;
    if (boost) {
      if (crystals.length < bc) { SFX.ui('poor'); setMsg('Needs ' + bc + ' red crystal' + (bc > 1 ? 's' : '')); return; }
      crystals.splice(0, bc); o.boosts++;
    } else {
      if (LO.gold < rr) { SFX.ui('poor'); setMsg('Not enough gold'); return; }
      LO.gold -= rr; o.rerolls++;
    }
    rollOffer(Math.random, o, boost);
    SFX.ui(boost ? 'perk' : 'buy');
    setMsg(''); setLanded(0); setSel(0);
    setSpin(s => ({ n: (s ? s.n : 0) + 1, boost }));
    input.current.notify();
  };
  const buy = () => {
    if (spinning) return;
    if (!gun) { SFX.ui('poor'); setMsg('Nothing to buy there'); return; }
    if (LO.gold < price) { SFX.ui('poor'); setMsg('Not enough gold'); return; }
    LO.gold -= price;
    input.current.dispense = { shop: 'guns', gun };
    o.guns[sel] = null;
    SFX.ui('buy');
    close();
  };
  /** @param {string} key */
  const press = key => {
    if (key === 'close') close();
    else if (key === 'buy') buy();
    else if (key === 'reroll') reroll(false);
    else if (key === 'boost') reroll(true);
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
      h('span', { className: 'vcrys' }, h(CrystalIcon, { size: 18 }), crystals.length),
      h('span', { className: 'vgold' }, fmtGold(LO.gold), h('i', null, 'g')),
      h('button', { className: navCls('close', 'vclose'), 'data-nav': 'close', onPointerDown: tap('close') }, '×')),
    h('div', { className: 'gmid' },
      h('div', { className: 'greels' },
        o.guns.map((g, i) => h('div', { key: i, 'data-nav': 'g:' + i, onPointerDown: tap('g:' + i),
            className: navCls('g:' + i, 'greel') + (sel === i ? ' sel' : '') },
          h(Reel, { gun: g, idx: i, spin, onLand }),
          h('div', { className: 'gprice' }, spinning && landed <= i ? '···' : g ? shopGunPrice(g) + 'g' : '—'))),
        h(Sparks, { on: spinning && !!spin && spin.boost })),
      h('div', { className: 'gcard scroll' },
        spinning ? h('p', { className: 'vhint' }, 'Rolling…')
          : gun ? h(GunCard, { gun, label: gun.boosted ? 'Boosted' : 'For sale', ingame: true, flow: true,
              compare: held, compareName: held ? held.name : '' })
          : h('p', { className: 'vhint' }, 'Sold'))),
    msg ? h('div', { className: 'vmsg' }, msg) : null,
    h('div', { className: 'gbtns' },
      h('button', { className: navCls('buy', 'vbuy') + (gun && !spinning && LO.gold >= price ? '' : ' cant'), 'data-nav': 'buy', onPointerDown: tap('buy') },
        h('b', null, 'Buy selected'), h('span', null, gun ? price + 'g' : '—')),
      h('div', { className: 'grow' },
        h('button', { className: navCls('reroll', 'vbuy greroll') + (!spinning && LO.gold >= rr ? '' : ' cant'), 'data-nav': 'reroll', onPointerDown: tap('reroll') },
          h('b', null, 'Reroll'), h('span', null, rr + 'g')),
        h('button', { className: navCls('boost', 'vbuy gboost') + (!spinning && crystals.length >= bc ? '' : ' cant'), 'data-nav': 'boost', onPointerDown: tap('boost') },
          h('b', null, 'Boosted'), h('span', { className: 'gcost' }, h(CrystalIcon, { size: 20 }), '×' + bc)))));
}
