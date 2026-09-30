// @ts-check
// The build screen (the Bag): Editor, with the gun's stats (GunStats) and its tabs
// (GunIcon), the slot grid lit by the live fire preview (SlotGrid), the mod bag, and the
// ScrollBox grab bars both grids scroll with.

import { drawGun } from '../art/sprites.js';
import { SFX } from '../audio/sfx.js';
import { DEV } from '../dev/knobs.js';
import { buildAdvice } from '../spells/advisor.js';
import {
  fireSimGauges, fireSimNew, fireSimStep, gunModDeltas, pullSteps, statQual
} from '../spells/bagsim.js';
import { gunAccent, gunColor, gunLvCol, resetGun } from '../spells/guns.js';
import { ALL_IDS, FAMILIES, FAMILY_OF, MODS, famCol } from '../spells/mods.js';
import { ModCard } from './cards.js';
import { h, useEffect, useMemo, useRef, useState } from './h.js';
import { GAUGE_COL, healthCol } from './hud.js';

// A gun's stats, one per line: name in its gauge colour, value red->green by how near
// perfect it is, and what the fitted mods add or take away.
export const PULL_COL = ['#ff8a1f', '#3fc9ff', '#b565ff', '#57d267', '#ff5fa2', '#ffd23c'];
export const GS_ROWS = [
  { k: 'cap', label: 'Slots', fmt: v => String(v) },
  { k: 'castDelay', label: 'Cast delay', col: GAUGE_COL.cast, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'recharge', label: 'Recharge', col: GAUGE_COL.rech, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'manaMax', label: 'Mana', col: GAUGE_COL.mana, fmt: v => String(Math.round(v)), better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'manaRegen', label: 'Mana regen', col: GAUGE_COL.mana, fmt: v => Math.round(v) + '/s', better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'spread', label: 'Spread', fmt: v => v.toFixed(1) + '°', better: -1, dfmt: v => v.toFixed(1) + '°' },
  { k: 'speedMul', label: 'Shot speed', fmt: v => '×' + v.toFixed(2), better: 1, dfmt: v => v.toFixed(2) },
  { k: 'multi', label: 'Per cast', fmt: v => String(v) },
  { k: 'shuffle', label: 'Order', fmt: v => (v ? 'shuffle' : 'in order') },
];
// Cast delay, recharge and mana get a thin bar under them showing the fire preview live,
// draining and refilling like the right stick's rings (the other stats have none). The
// bars are written straight to the DOM each frame, not re-rendered.
export const LIVE_BAR = { castDelay: GAUGE_COL.cast, recharge: GAUGE_COL.rech, manaMax: GAUGE_COL.mana };
/** @param {{ gun: Gun, sim: { current: import('../spells/bagsim.js').FireSim | null }, sig: string }} props */
export function GunStats({ gun, sim, sig }) {
  const d = useMemo(() => gunModDeltas(gun), [sig]);
  const bars = useRef({});
  useEffect(() => {
    let raf;
    const loop = () => {
      const S = sim.current;
      if (S) {
        const gg = fireSimGauges(S);
        for (const k in LIVE_BAR) if (bars.current[k]) bars.current[k].style.width = (gg[k] * 100).toFixed(1) + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bar = (k, frac, col) => h('div', { className: 'gsbar' },
    h('i', { ref: LIVE_BAR[k] ? el => { bars.current[k] = el; } : undefined, 'data-live': LIVE_BAR[k] ? k : undefined,
      style: { width: (frac * 100).toFixed(1) + '%', background: col } }));
  return h('div', { className: 'gstats' },
    gun.lvl ? h('div', { className: 'gsrow' }, h('span', null, 'Level'),
      h('b', { style: { color: gunLvCol(gun) } }, 'Lv ' + gun.lvl)) : null,
    GS_ROWS.map(r => {
      const v = r.k === 'speedMul' ? (gun.speedMul || 1) : gun[r.k];
      const dv = d[r.k] || 0, show = r.dfmt && Math.abs(dv) > 0.005;
      const q = statQual(r.k, v);
      return h('div', { key: r.k, className: 'gsrow', 'data-stat': r.k },
        h('span', r.col ? { style: { color: r.col } } : null, r.label),
        h('b', { style: { color: healthCol(q) } }, r.fmt(v)),
        show ? h('u', { className: (dv > 0) === (r.better > 0) ? 'up' : 'down' },
          (dv > 0 ? '+' : '\u2212') + r.dfmt(Math.abs(dv))) : null,
        LIVE_BAR[r.k] ? bar(r.k, 1, LIVE_BAR[r.k]) : null);
    }));
}

// the gun's picture on its button, drawn with the same sprite as the one in your hands
/** @param {{ gun: Gun }} props */
export function GunIcon({ gun }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, W = 64, H = 32;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = 2.7;
    drawGun(ctx, W / 2 - 3.85 * sc, H / 2 + 1 * sc, 0, sc, gunAccent(gun));
  });
  return h('canvas', { ref, className: 'gicon' });
}

// The gun's slots as a fixed grid: a mod stays exactly where you drop it. The fire preview
// (fireSimStep, trigger held) runs here at DEV.bagSpeed × real time; each pull lights the
// slots it fired in that pull's colour. Only re-renders when the lit set changes, so the
// Editor (and the advisor) never re-render per frame.
/** @param {{ gun: Gun, tile: (id: string | null, from: { type: string, i: number }, key: number | string) => any, sig: string, sim: { current: import('../spells/bagsim.js').FireSim | null } }} props */
export function SlotGrid({ gun, tile, sig, sim }) {
  const [lit, setLit] = useState(null);
  const steps = useMemo(() => pullSteps(gun), [sig]);
  useEffect(() => {
    let raf, last = performance.now(), prev = null;
    const loop = now => {
      const S = sim.current;
      const dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now;
      if (S) {
        // small sub-steps so a very fast gun still fires every pull it should
        for (let t = dt; t > 0; t -= 0.01) fireSimStep(S, Math.min(0.01, t));
        if (S.lit !== prev) { prev = S.lit; setLit(S.lit); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pullOf = new Array(gun.slots.length).fill(-1);
  if (steps) for (const st of steps) pullOf[st.slot] = st.pull;
  const on = new Set(lit ? lit.slots : []);
  const col = lit ? PULL_COL[lit.pull % PULL_COL.length] : null;
  return h(ScrollBox, { cls: 'slotRow' }, h('div', { className: 'mgrid' },
    gun.slots.map((id, i) => {
      const el = tile(id, { type: 'slot', i }, i);
      return React.cloneElement(el, { 'data-pull': pullOf[i],
          className: el.props.className + (id && steps && pullOf[i] < 0 ? ' cold' : '') },
        ...[].concat(el.props.children),
        on.has(i) ? h('i', { className: 'pulse on', style: { background: col, borderColor: col, color: col } }) : null);
    })));
}

// A scroll box with a bar down its right side you can grab: the mod tiles take a touch for
// dragging, so with a full grid there was nothing left to scroll by. Tap the bar to jump
// there, or drag the thumb. The thumb follows the box however it scrolled.
/** @param {{ cls: string, drop?: string, children?: any }} props */
export function ScrollBox({ cls, drop, children }) {
  const ref = useRef(null);
  const [t, setT] = useState({ top: 0, size: 1, show: false, on: false });
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const H = el.scrollHeight, c = el.clientHeight, show = H > c + 1;
      const size = show ? Math.max(0.14, c / H) : 1;
      const top = show ? el.scrollTop / (H - c) * (1 - size) : 0;
      setT(o => o.show === show && Math.abs(o.size - size) < 0.002 && Math.abs(o.top - top) < 0.002 ? o
        : Object.assign({}, o, { top, size, show }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(el); if (el.firstChild) ro.observe(el.firstChild); }
    return () => { el.removeEventListener('scroll', measure); if (ro) ro.disconnect(); };
  }, []);
  const grab = e => {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current, bar = e.currentTarget.getBoundingClientRect();
    const size = t.size, thumb = size * bar.height, at = bar.top + t.top * bar.height;
    // held on the thumb: keep that grip; on the track: the thumb centres under the finger
    const off = e.clientY >= at && e.clientY <= at + thumb ? e.clientY - at : thumb / 2;
    const to = y => {
      const f = (y - off - bar.top) / Math.max(1, bar.height - thumb);
      el.scrollTop = Math.max(0, Math.min(1, f)) * (el.scrollHeight - el.clientHeight);
    };
    to(e.clientY);
    setT(o => Object.assign({}, o, { on: true }));
    const move = ev => to(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setT(o => Object.assign({}, o, { on: false }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return h('div', { className: 'sbwrap ' + cls.split(' ')[0] + 'W', 'data-drop': drop },
    h('div', { ref, className: cls + ' scroll', 'data-drop': drop }, children),
    t.show ? h('div', { className: 'sbar' + (t.on ? ' on' : ''), onPointerDown: grab },
      h('i', { style: { top: t.top * 100 + '%', height: t.size * 100 + '%' } })) : null);
}

// the build advisor's suggested swaps are parked (v72): the dmg/s line still shows, the
// tip buttons don't. buildAdvice and the tip code are kept; flip this to bring them back.
export const SHOW_TIPS = false;

/** @param {{ input: { current: GameInput }, close: () => void, refresh: () => void, canEdit: boolean }} props */
export function Editor({ input, close, refresh, canEdit }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); return () => SFX.fx('close'); }, []);
  const [sel, setSel] = useState(LO.sel);
  const sim = useRef(null);
  const [drag, setDrag] = useState(null);
  const [info, setInfo] = useState(null);
  const [gdrag, setGdrag] = useState(null);
  const gun = LO.guns[sel];

  // DEBUG swaps your collection for a shelf holding one of every mod, and nothing
  // you drag off it is used up. Your own bag is left completely alone while it is
  // on, so switching back hands your real mods straight back — the ones you fitted
  // to a gun stay fitted, because they live on the gun, not in the bag.
  const bagIds = LO.debug ? ALL_IDS : LO.bag;
  const takeFromBag = i => { if (!LO.debug) LO.bag.splice(i, 1); };
  const returnToBag = id => { if (!LO.debug && id) LO.bag.push(id); };

  // one-shot reorder into the 8 colour families (same grouping as the legend
  // below), not a display toggle — the bag is already player-mutable state
  // (dragging reorders it too), so this is just another way to reorder it, and
  // it keeps the sort useful as a resting order rather than something to redo
  // every time the sheet reopens. Stable sort: mods keep their relative order
  // within a family.
  const famKeys = Object.keys(FAMILIES);
  const sortBag = () => {
    if (LO.debug) return;
    const rank = id => famKeys.indexOf(FAMILY_OF[id] || 'shots');
    LO.bag.sort((a, b) => rank(a) - rank(b));
    refresh();
  };

  // move a gun to another slot, keeping whatever you had selected selected
  const moveGun = (from, to) => {
    if (from === to) return;
    const held = LO.guns[LO.sel];
    const [g] = LO.guns.splice(from, 1);
    LO.guns.splice(to, 0, g);
    if (held) LO.sel = LO.guns.indexOf(held);
    setSel(LO.sel);
    refresh();
  };

  // tap selects; hold picks the gun up and dragging drops it on another slot
  const gunPress = i => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false, over = i;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const timer = setTimeout(() => {
      if (!LO.guns[i] || !canEdit) return;           // nothing to pick up, or the bag is read-only
      dragging = true;
      setGdrag({ from: i, x: sx, y: sy, over: i });
    }, 320);
    const move = ev => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { cleanup(); setGdrag(null); }
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      /** @type {HTMLElement | null} */
      const tab = el && el.closest ? el.closest('[data-gun]') : null;
      if (tab) over = Number(tab.dataset.gun);
      setGdrag({ from: i, x: ev.clientX, y: ev.clientY, over });
    };
    const up = () => {
      cleanup();
      setGdrag(null);
      if (dragging) { if (canEdit) moveGun(i, over); }
      else if (LO.guns[i]) { setSel(i); LO.sel = i; refresh(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const drop = (x, y, id, from) => {
    if (!canEdit) return;                 // outside the shop (and without Tinker) the bag is read-only
    SFX.fx('place');
    const el = document.elementFromPoint(x, y);
    /** @type {HTMLElement | null} */
    const node = el && el.closest ? el.closest('[data-drop]') : null;
    const to = node && node.dataset.drop;
    const g = LO.guns[sel];
    if (!to) return;
    if (to === 'bag') {
      if (from.type === 'slot' && g) { g.slots[from.i] = null; returnToBag(id); }
    } else if (to.slice(0, 5) === 'slot:' && g) {
      const k = Number(to.slice(5));
      if (from.type === 'bag') {
        takeFromBag(from.i);
        returnToBag(g.slots[k]);
        g.slots[k] = id;
      } else if (from.i !== k) {
        const swap = g.slots[k];
        g.slots[k] = id;
        g.slots[from.i] = swap;
      }
    }
    if (g) resetGun(g);
    refresh();
  };

  const SLOP = 7;                      // move further than this and it's a drag, not a tap
  const startDrag = (id, from) => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    setDrag({ id, from, x: sx, y: sy, armed: false });
    const move = ev => setDrag(d => d && { id: d.id, from: d.from, x: ev.clientX, y: ev.clientY,
      armed: d.armed || Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP });
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) <= SLOP) setInfo(cur => (cur === id ? null : id));
      else drop(ev.clientX, ev.clientY, id, from);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const tile = (id, from, key) => {
    const m = id ? MODS[id] : null;
    return h('div', {
        key,
        className: 'tile' + (m ? '' : ' hole') + (m && m.kind === 'shot' ? ' shot' : ''),
        style: m ? { borderColor: famCol(id), color: famCol(id) } : null,
        'data-drop': from.type === 'slot' ? 'slot:' + from.i : 'bag',
        'data-mod': id || undefined,
        onPointerDown: m ? startDrag(id, from) : undefined,
      },
      m ? h('span', { className: 'tg' }, m.glyph) : h('span', { className: 'tg' }, '+'),
      m ? h('span', { className: 'tn' }, m.name) : null,
      m && m.mark ? h('span', { className: 'tmark' }, m.mark) : null
    );
  };

  const shown = info && MODS[info];

  // the backdrop closes the card, but a tap that lands on another mod switches to it
  const behind = e => {
    e.preventDefault();
    const el = e.currentTarget;
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = '';
    /** @type {HTMLElement | null} */
    const tile = under && under.closest ? under.closest('[data-mod]') : null;
    const next = tile && tile.dataset.mod;
    setInfo(next && next !== info ? next : null);
  };

  // restart the fire preview whenever the gun or its build changes
  const gsig = gun ? sel + '|' + gun.slots.join() + '|' + gun.multi + '|' + gun.shuffle + '|' + gun.castDelay + '|' + gun.recharge : '';
  if (!sim.current || sim.current.sig !== gsig) sim.current = gun ? Object.assign(fireSimNew(gun), { sig: gsig }) : null;

  const card = shown
    ? h('div', { key: 'card' },
        h('div', { className: 'shade', onPointerDown: behind }),
        h(ModCard, { id: info, onClose: () => setInfo(null), top: true }))
    : null;

  return h('div', { className: 'sheet' + (shown ? ' withcard' : '') },
    h('div', { className: 'shead' },
      h('h2', null, 'Guns & Mods'),
      h('span', { className: 'purse' }, LO.gold + 'g'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')
    ),
    h('div', { className: 'btop' },
      gun ? h(GunStats, { gun, sim, sig: gsig }) : h('div', { className: 'gstats' }, h('p', { className: 'lab' }, 'No gun in this slot')),
      h('div', { className: 'gtabs' },
        LO.guns.map((g, i) => h('button', {
            key: i,
            'data-gun': i,
            className: 'gtab' + (g ? '' : ' empty') + (i === sel ? ' on' : '') +
              (gdrag && gdrag.from === i ? ' lifted' : '') +
              (gdrag && gdrag.over === i && gdrag.from !== i ? ' target' : ''),
            onPointerDown: gunPress(i),
          },
          h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty'),
          g ? h(GunIcon, { gun: g }) : h('span', { className: 'gsub' }, '—')
        )))
    ),
    gun ? h('p', { className: 'lab' }, gun.shuffle
      ? 'On the gun — order is shuffled every recharge'
      : 'On the gun — fires left to right, row by row') : null,
    gun ? h(SlotGrid, { gun, tile, sig: gsig, sim }) : null,
    gun ? (() => {
      const adv = buildAdvice(gun, bagIds);
      const apply = t => e => {
        e.preventDefault();
        if (t.kind === 'move') {
          const a = gun.slots[t.slot];
          gun.slots[t.slot] = gun.slots[t.other];
          gun.slots[t.other] = a;
        } else {
          const outgoing = gun.slots[t.slot];
          const k = bagIds.indexOf(t.id);
          if (k >= 0) takeFromBag(k);
          gun.slots[t.slot] = t.id;
          returnToBag(outgoing);
        }
        resetGun(gun);
        refresh();
      };
      return h('div', { className: 'advice' },
        h('div', { className: 'diag ' + adv.limit.key },
          h('b', null, adv.now.dps.toFixed(1) + ' dmg/s'), adv.limit.text),
        SHOW_TIPS && canEdit && adv.tips.length ? h('div', { className: 'tips' },
          adv.tips.map((t, k) => h('button', { key: k, className: 'tip', onPointerDown: apply(t) },
            t.kind === 'move'
              ? 'Swap slots ' + (t.slot + 1) + ' and ' + (t.other + 1)
              : (gun.slots[t.slot] ? 'Replace slot ' + (t.slot + 1) + ' with ' : 'Slot ' +
                  (t.slot + 1) + ': ') + MODS[t.id].name,
            h('b', null, '\u00d7' + t.gain.toFixed(1) + ' dmg')))) : null);
    })() : null,
    h('div', { className: 'bagHead' },
      h('p', { className: 'lab' }, LO.debug
        ? 'Debug shelf — one of every mod, never used up'
        : 'Collected mods' + (LO.bag.length ? '' : ' — none yet, find them in the cave')),
      canEdit && !LO.debug && LO.bag.length > 1 ? h('button', { className: 'sortBag',
          onPointerDown: e => { e.preventDefault(); sortBag(); } }, 'Sort') : null),
    h(ScrollBox, { cls: 'bag' + (LO.debug ? ' debug' : ''), drop: 'bag' },
      h('div', { className: 'mgrid' }, bagIds.map((id, i) => tile(id, { type: 'bag', i }, 'b' + i)))
    ),
    h('div', { className: 'info' },
      canEdit
        ? 'Drag a mod to any slot. Tap one to see what it does. Hold a gun to reorder it.'
        : 'Viewing only — reach a shop, or take the Tinker perk, to change your setup. Tap a mod to see what it does.'),
    gdrag && LO.guns[gdrag.from] ? h('div', { className: 'gghost',
      style: { left: gdrag.x, top: gdrag.y } }, LO.guns[gdrag.from].name) : null,
    drag && drag.armed ? h('div', { className: 'ghost',
      style: { left: drag.x, top: drag.y, borderColor: famCol(drag.id), color: famCol(drag.id) } },
      MODS[drag.id].glyph) : null,
    card
  );
}
