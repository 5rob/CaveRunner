// @ts-check
// VendShop: a vending machine's menu (game/systems/shops.js opens it), the same for every shop;
// what it sells comes in as a ShopDef (ui/modshop.js is the mods' one; guns and perks are meant
// to be more). Top half: the collection, a grid in groups (a gap between them) where what you
// have unlocked shows and the rest are empty cells, and the unlock button under it. Bottom half:
// the selected thing's card and "Dispense selected" with its price.
// Touch works directly; the sticks work too: the left stick moves the highlight (the nearest
// button that way), a tap on the right stick presses it (input.current.menuTap, also r/f/enter).

import { SFX } from '../audio/sfx.js';
import { KNOB } from '../core/consts.js';
import { fmtGold } from './hud.js';
import { h, useEffect, useRef, useState } from './h.js';

/**
 * What a shop sells: VendShop draws it, the def does the buying.
 * @typedef {{
 *   title: string,
 *   groups: { label: string, ids: string[] }[],
 *   owned: (id: string) => boolean,
 *   tile: (id: string) => { glyph: string, color: string, name: string, mark?: string },
 *   card: (id: string) => any,
 *   price: (id: string) => number,
 *   gold: () => number,
 *   unlock: { name: string, icon: any, count: () => number, run: () => string | null },
 *   dispense: (id: string) => void,
 * }} ShopDef
 */

// an arrow key held: the highlight steps again after REPEAT_0, then every REPEAT
const REPEAT_0 = 0.38, REPEAT = 0.17;

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

// A machine menu's stick and key handling, for every menu. The left stick is a pointer: drag it
// and a second knob, a thin ring, pushes out from it, travelling an exaggerated amount (menuPointer:
// the stick's 0..full range maps to 0..the distance to the furthest screen corner, capped at the
// window's edge); whatever button it's over is highlighted, and letting go over one presses it.
// A tap on the right stick (and r/f/enter) presses the highlighted button; the arrow keys step
// the highlight (navStep). `press` and `focus` are read through refs, so the hooks always see the
// latest render's. Returns the pointer ring, for the menu to put in its tree.
/** @param {{ current: GameInput }} input @param {{ current: HTMLElement | null }} root @param {string} focus @param {(f: string) => void} setFocus @param {(key: string) => void} press */
export function useMenuNav(input, root, focus, setFocus, press) {
  const pressRef = useRef(press), focusRef = useRef(focus), ring = useRef(null);
  pressRef.current = press; focusRef.current = focus;
  useEffect(() => {
    input.current.menuTap = () => pressRef.current(focusRef.current);
    return () => { input.current.menuTap = null; };
  }, []);
  useEffect(() => {
    let raf, dir = '', next = 0, was = false, over = '';
    // the [data-nav] under a screen point, inside this menu
    /** @param {number} x @param {number} y */
    const navAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      /** @type {HTMLElement | null} */
      const n = el && el.closest ? el.closest('[data-nav]') : null;
      return n && root.current && root.current.contains(n) ? n.dataset.nav || '' : '';
    };
    const tick = () => {
      const L = input.current.left, K = input.current.keys, R = ring.current;
      if (L.active && L.cx !== undefined) {
        const p = menuPointer(L, window.innerWidth, window.innerHeight);
        if (R) {
          const d = KNOB * (L.size || 100);
          R.style.display = 'block';
          R.style.width = R.style.height = d + 'px';
          R.style.transform = 'translate(' + (p.x - d / 2) + 'px,' + (p.y - d / 2) + 'px)';
        }
        over = navAt(p.x, p.y);
        if (over && over !== focusRef.current) { setFocus(over); SFX.fx('prompt'); }
        was = true;
      } else {
        if (was) {                              // let go: press what the pointer was over
          was = false;
          if (R) R.style.display = 'none';
          if (over) pressRef.current(over);
          over = '';
        }
        let dx = 0, dy = 0;
        if (K.a || K.d || K.w || K.s) { dx = (K.d ? 1 : 0) - (K.a ? 1 : 0); dy = (K.s ? 1 : 0) - (K.w ? 1 : 0); if (dx) dy = 0; }
        const d = dx + ',' + dy, now = performance.now() / 1000;
        if (!dx && !dy) dir = '';
        else if (d !== dir || now >= next) {
          next = now + (d !== dir ? REPEAT_0 : REPEAT);
          dir = d;
          const to = root.current && navStep(root.current, focusRef.current, dx, dy);
          if (to) { setFocus(to); SFX.fx('prompt'); }
        }
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
  return h('div', { className: 'mptr', ref: ring, 'aria-hidden': true });
}

// Where the menus' pointer is for a stick: out from the stick's centre along its direction, the
// stick's 0..1 mapped onto 0..the distance to the screen's furthest corner, then held inside the screen
/** @param {StickState} L @param {number} W @param {number} H @returns {Pt} */
export function menuPointer(L, W, H) {
  const cx = L.cx || 0, cy = L.cy || 0;
  const far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
  const d = Math.min(1, L.mag) * far;
  return { x: Math.max(0, Math.min(W, cx + L.nx * d)), y: Math.max(0, Math.min(H, cy + L.ny * d)) };
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
    if (def.unlock.count() <= 0) { SFX.ui('poor'); setMsg('No ' + def.unlock.name + ' to hand over'); return; }
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
  const ptr = useMenuNav(input, root, focus, setFocus, press);

  /** @param {string} key @param {string} cls */
  const navCls = (key, cls) => cls + (focus === key ? ' navon' : '');
  /** @param {string} key @returns {(e: PointerEvent) => void} */
  const tap = key => e => { e.preventDefault(); setFocus(key); press(key); };
  const n = def.unlock.count(), price = sel ? def.price(sel) : 0, can = !!sel && def.gold() >= price;
  return h('div', { className: 'vshop', ref: root, style: { bottom: (input.current.ctlH || 0) + 'px' } },
    ptr,
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
                t.glyph, t.mark ? h('i', { className: 'vmark' }, t.mark) : null);
            }))))),
      h('button', { className: navCls('unlock', 'vunlock') + (n ? '' : ' cant'), 'data-nav': 'unlock',
          onPointerDown: tap('unlock') },
        def.unlock.icon, h('b', null, '×' + n))),
    h('div', { className: 'vbot' },
      h('div', { className: 'vcard' }, msg ? h('div', { className: 'vmsg' }, msg) : null,
        sel ? def.card(sel) : h('p', { className: 'vhint' }, 'Nothing unlocked yet: hand over a ' + def.unlock.name)),
      h('button', { className: navCls('buy', 'vbuy') + (can ? '' : ' cant'), 'data-nav': 'buy', onPointerDown: tap('buy') },
        h('b', null, 'Dispense selected'), h('span', null, sel ? price + 'g' : '—'))));
}
