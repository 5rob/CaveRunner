// @ts-check
// VendShop: a vending machine's menu (game/systems/shops.js opens it), the same for every shop;
// what it sells comes in as a ShopDef (ui/modshop.js is the mods' one; guns and perks are meant
// to be more). Top half: the collection, a grid in groups (a gap between them) where what you
// have unlocked shows and the rest are empty cells, and the unlock button under it. Bottom half:
// the selected thing's card and "Dispense selected" with its price.
// Touch works directly; the sticks work too: the left stick moves the highlight (the nearest
// button that way), a tap on the right stick presses it (input.current.menuTap, also r/f/enter).

import { SFX } from '../audio/sfx.js';
import { fmtGold } from './hud.js';
import { h, useEffect, useRef, useState } from './h.js';

/**
 * What a shop sells: VendShop draws it, the def does the buying.
 * @typedef {{
 *   title: string,
 *   groups: { label: string, ids: string[] }[],
 *   owned: (id: string) => boolean,
 *   tile: (id: string) => { glyph: string, color: string, name: string },
 *   card: (id: string) => any,
 *   price: (id: string) => number,
 *   gold: () => number,
 *   unlock: { icon: any, count: () => number, run: () => string | null },
 *   dispense: (id: string) => void,
 * }} ShopDef
 */

// stick past this far counts as pointing; held, the highlight steps again after REPEAT_0, then every REPEAT
const NAV_MAG = 0.55, REPEAT_0 = 0.38, REPEAT = 0.17;

// The highlight's next stop from `cur`, pointing (dx, dy): the [data-nav] element whose centre lies
// that way, nearest along the way with a penalty for being off to the side
/** @param {HTMLElement} root @param {string} cur @param {number} dx @param {number} dy @returns {string | null} */
export function navStep(root, cur, dx, dy) {
  /** @type {HTMLElement[]} */
  const els = Array.from(root.querySelectorAll('[data-nav]'));
  const here = els.find(e => e.dataset.nav === cur);
  if (!here) return els.length ? els[0].dataset.nav || null : null;
  const c = here.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  let best = null, score = Infinity;
  for (const e of els) {
    if (e === here) continue;
    const r = e.getBoundingClientRect(), vx = r.left + r.width / 2 - cx, vy = r.top + r.height / 2 - cy;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const s = along + Math.abs(vx * dy - vy * dx) * 2.5;
    if (s < score) { score = s; best = e.dataset.nav || null; }
  }
  return best;
}

// A machine menu's stick and key handling, for every menu: the right stick's tap (and r/f/enter)
// presses the highlighted button (`press(focus)`), the left stick or the arrow keys move the
// highlight (navStep: once on pointing, again if held), and the highlight is kept in view.
// `press` and `focus` are read through refs, so the hooks always see the latest render's
/** @param {{ current: GameInput }} input @param {{ current: HTMLElement | null }} root @param {string} focus @param {(f: string) => void} setFocus @param {(key: string) => void} press */
export function useMenuNav(input, root, focus, setFocus, press) {
  const pressRef = useRef(press), focusRef = useRef(focus);
  pressRef.current = press; focusRef.current = focus;
  useEffect(() => {
    input.current.menuTap = () => pressRef.current(focusRef.current);
    return () => { input.current.menuTap = null; };
  }, []);
  useEffect(() => {
    let raf, dir = '', next = 0;
    const tick = () => {
      const L = input.current.left, K = input.current.keys;
      let dx = 0, dy = 0;
      if (L.active && L.mag > NAV_MAG) {
        if (Math.abs(L.nx) > Math.abs(L.ny)) dx = Math.sign(L.nx); else dy = Math.sign(L.ny);
      } else if (K.a || K.d || K.w || K.s) { dx = (K.d ? 1 : 0) - (K.a ? 1 : 0); dy = (K.s ? 1 : 0) - (K.w ? 1 : 0); if (dx) dy = 0; }
      const d = dx + ',' + dy, now = performance.now() / 1000;
      if (!dx && !dy) dir = '';
      else if (d !== dir || now >= next) {
        next = now + (d !== dir ? REPEAT_0 : REPEAT);
        dir = d;
        const to = root.current && navStep(root.current, focusRef.current, dx, dy);
        if (to) { setFocus(to); SFX.fx('prompt'); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const el = root.current && root.current.querySelector('[data-nav="' + focus + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [focus]);
}

/** @param {{ def: ShopDef, input: { current: GameInput }, close: () => void }} props */
export function VendShop({ def, input, close }) {
  const firstOwned = () => { for (const g of def.groups) for (const id of g.ids) if (def.owned(id)) return id; return null; };
  const [sel, setSel] = useState(firstOwned);
  const [focus, setFocus] = useState(() => (sel ? 't:' + sel : 'unlock'));
  const [fresh, setFresh] = useState('');            // the one just unlocked: it flashes
  const [msg, setMsg] = useState('');
  const [, bump] = useState(0);
  const root = useRef(null);

  const unlock = () => {
    if (def.unlock.count() <= 0) { SFX.ui('poor'); setMsg('No crystal to hand over'); return; }
    const id = def.unlock.run();
    if (!id) { SFX.ui('poor'); setMsg('Collection complete'); return; }
    SFX.ui('perk');
    setSel(id); setFocus('t:' + id); setFresh(id);
    setMsg('Unlocked ' + def.tile(id).name);
  };
  const buy = () => {
    if (!sel) { SFX.ui('poor'); setMsg('Select something first'); return; }
    if (def.gold() < def.price(sel)) { SFX.ui('poor'); setMsg('Not enough gold'); return; }
    SFX.ui('buy');
    def.dispense(sel);
    close();
  };
  /** @param {string} key */
  const press = key => {
    if (key === 'close') close();
    else if (key === 'unlock') unlock();
    else if (key === 'buy') buy();
    else if (key.startsWith('t:')) { setSel(key.slice(2)); setMsg(''); SFX.fx('switch'); }
    bump(n => n + 1);
  };
  useMenuNav(input, root, focus, setFocus, press);

  /** @param {string} key @param {string} cls */
  const navCls = (key, cls) => cls + (focus === key ? ' navon' : '');
  /** @param {string} key @returns {(e: PointerEvent) => void} */
  const tap = key => e => { e.preventDefault(); setFocus(key); press(key); };
  const n = def.unlock.count(), price = sel ? def.price(sel) : 0, can = !!sel && def.gold() >= price;
  return h('div', { className: 'vshop', ref: root, style: { bottom: (input.current.ctlH || 0) + 'px' } },
    h('div', { className: 'vtop' },
      h('div', { className: 'vhead' },
        h('b', null, def.title),
        h('span', { className: 'vgold' }, fmtGold(def.gold()), h('i', null, 'g')),
        h('button', { className: navCls('close', 'vclose'), 'data-nav': 'close', onPointerDown: tap('close') }, '×')),
      h('div', { className: 'vgrid scroll' },
        def.groups.map(g => h('div', { key: g.label, className: 'vtier' },
          h('div', { className: 'vtlab' }, g.label),
          h('div', { className: 'vcells' },
            g.ids.map(id => {
              if (!def.owned(id)) return h('div', { key: id, className: 'vcell empty' });
              const t = def.tile(id), key = 't:' + id;
              return h('div', { key: id, 'data-nav': key, 'data-id': id, title: t.name,
                  className: navCls(key, 'vcell') + (sel === id ? ' sel' : '') + (fresh === id ? ' fresh' : ''),
                  style: { color: t.color, borderColor: t.color }, onPointerDown: tap(key) },
                t.glyph);
            }))))),
      h('button', { className: navCls('unlock', 'vunlock') + (n ? '' : ' cant'), 'data-nav': 'unlock',
          onPointerDown: tap('unlock') },
        def.unlock.icon, h('b', null, '×' + n))),
    h('div', { className: 'vbot' },
      h('div', { className: 'vcard' }, msg ? h('div', { className: 'vmsg' }, msg) : null,
        sel ? def.card(sel) : h('p', { className: 'vhint' }, 'Nothing unlocked yet: hand over a red crystal')),
      h('button', { className: navCls('buy', 'vbuy') + (can ? '' : ' cant'), 'data-nav': 'buy', onPointerDown: tap('buy') },
        h('b', null, 'Dispense selected'), h('span', null, sel ? price + 'g' : '—'))));
}
