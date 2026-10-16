// @ts-check
// The build screen (the Bag): Editor, with the gun's stats (GunStats) and its tabs
// (GunIcon), the slot grid lit by the live fire preview (SlotGrid), the mod bag, and the
// ScrollBox grab bars both grids scroll with.

import { gunArtFit, gunArtId } from '../art/gunart.js';
import { PH, PW } from '../core/consts.js';
import { fireSimGauges, gunModDeltas, statQual } from '../spells/bagsim.js';
import { gunLvCol } from '../spells/guns.js';
import { h, useEffect, useMemo, useRef } from './h.js';
import { GAUGE_COL, healthCol } from './hud.js';

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
        // the mana row is `manaMax`, its gauge `mana` (the bar never moved under the old key)
        for (const k in LIVE_BAR) if (bars.current[k]) bars.current[k].style.width = ((k === 'manaMax' ? gg.mana : gg[k]) * 100).toFixed(1) + '%';
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
    gunArtFit(ctx, gunArtId(gun), W, H);   // its sprite, fitted to the icon, crisp
  });
  return h('canvas', { ref, className: 'gicon' });
}

export const GF_DUMMY_GAP = 6, GF_DUMMY_K = 2 / 3, DW = PW * GF_DUMMY_K, DH = PH * GF_DUMMY_K;

