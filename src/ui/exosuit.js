// @ts-check
// The Bag's tabs (Bag: Guns & Mods = the Editor, and the Exo Suit) and the Exo Suit itself: your
// portrait (the runner, hovering), your money, the suit's stats each with its own slot for that
// stat's perks (STAT_PERKS), the SUIT_SLOTS general perk slots (LO.suit holds both: the perks that count), and every perk in a grid: the ones you carry (LO.perks, with how many) bright,
// the ones you could buy dim, the ones not unlocked yet locked. Drag a carried perk onto a slot to
// fit it (what was there goes back to the carried ones), a fitted one to another slot to swap, or
// off the slots to take it out. A tap on any perk shows its card. Editing is gated like the Bag's
// (canEdit: in the shop, or with Tinker).

import { drawRunner } from '../art/sprites.js';
import { SFX } from '../audio/sfx.js';
import { COIN_PULL, FUEL_REGEN, PH, PW, WALK } from '../core/consts.js';
import { PERKS, PERK_IDS, ROMAN, STAT_KEYS, STAT_PERKS, SUIT_LEN, SUIT_SLOTS, activePerks, fitsSlot, perkBag } from '../data/perks.js';
import { PerkCard } from './cards.js';
import { Editor } from './editor.js';
import { h, useEffect, useRef, useState } from './h.js';
import { CrystalIcon, fmtGold } from './hud.js';

const SLOP = 8;                 // px a press may wander and still be a tap
/** @type {{ id: string, x: number, y: number } | null} */
const NO_DRAG = null;

/** @typedef {{ input: { current: GameInput }, close: () => void, refresh: () => void, canEdit: boolean }} BagProps */

// The Bag: its two tabs along the bottom
/** @param {BagProps} props */
export function Bag(props) {
  const [tab, setTab] = useState('guns');
  const tabs = h('div', { className: 'btabs' },
    [['guns', 'Guns & Mods'], ['suit', 'Exo Suit']].map(([k, label]) => h('button', {
        key: k, className: 'btab' + (tab === k ? ' on' : ''), 'data-tab': k,
        onPointerDown: e => { e.preventDefault(); if (tab !== k) { setTab(k); SFX.fx('switch'); } } }, label)));
  return tab === 'guns' ? h(Editor, Object.assign({}, props, { tabs })) : h(ExoSuit, Object.assign({}, props, { tabs }));
}

// The runner in the suit, hovering on its jet, in a little window
function Portrait() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1, S = 92;
    c.width = S * dpr; c.height = S * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000, sc = 2.7;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createRadialGradient(S / 2, S * 0.45, 4, S / 2, S / 2, S * 0.7);
      g.addColorStop(0, '#22344a'); g.addColorStop(1, '#0a1018');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      // scan lines
      ctx.fillStyle = 'rgba(120,200,255,0.05)';
      for (let y = (t * 12) % 4; y < S; y += 4) ctx.fillRect(0, y, S, 1);
      const bob = Math.sin(t * 2.2) * 2.5, jet = 0.55 + 0.45 * Math.abs(Math.sin(t * 17) * Math.sin(t * 5.3));
      ctx.save();
      ctx.translate(S / 2 - PW * sc / 2, S / 2 - PH * sc / 2 + bob - 4);
      ctx.scale(sc, sc);
      // the jet flame under it
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.moveTo(PW / 2 - 3, PH - 2); ctx.lineTo(PW / 2 + 3, PH - 2); ctx.lineTo(PW / 2, PH + 4 + jet * 6); ctx.fill();
      ctx.fillStyle = '#fff1c4';
      ctx.beginPath(); ctx.moveTo(PW / 2 - 1.5, PH - 2); ctx.lineTo(PW / 2 + 1.5, PH - 2); ctx.lineTo(PW / 2, PH + 1 + jet * 3); ctx.fill();
      drawRunner(ctx, 0, 0, PW, PH, 1, t * 0.6, true, jet, false);
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { className: 'xport', ref });
}

/** @param {BagProps & { tabs: any }} props */
export function ExoSuit({ input, close, refresh, canEdit, tabs }) {
  const LO = input.current.loadout;
  if (!LO.suit) LO.suit = [];
  while (LO.suit.length < SUIT_LEN) LO.suit.push(null);
  const suit = LO.suit;
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const [drag, setDrag] = useState(NO_DRAG);
  const P = perkBag(activePerks(LO));
  const maxHp = P.maxHp + (LO.maxBonus || 0);
  const hud = input.current.hud;
  const hp = Math.round((hud ? hud.hp : 1) * maxHp);

  // a press on a perk (in the grid, or fitted in slot `slot`): a tap shows its card, a drag moves it
  /** @param {string} id @param {number} slot -1 for the grid @param {boolean} movable @returns {(e: PointerEvent) => void} */
  const press = (id, slot, movable) => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let armed = false;
    /** @param {PointerEvent} ev */
    const move = ev => {
      if (!armed && movable && canEdit && Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP) armed = true;
      if (armed) setDrag({ id, x: ev.clientX, y: ev.clientY });
    };
    /** @param {PointerEvent} ev */
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (!armed) { setInfo(id); return; }
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      /** @type {HTMLElement | null} */
      const el = under && under.closest ? under.closest('[data-xslot]') : null;
      const to = el ? Number(el.dataset.xslot) : -1;
      const no = () => { SFX.ui('poor'); setMsg(PERKS[id].stat ? PERKS[id].name + ' fits only the ' + STAT_PERKS[PERKS[id].stat].name + ' slot'
        : 'Stat slots take only their stat’s perks'); };
      if (to >= 0 && !fitsSlot(id, to)) { no(); return; }
      if (slot >= 0 && to >= 0 && suit[to] && !fitsSlot(suit[to], slot)) { no(); return; }
      setMsg('');
      if (slot < 0 && to >= 0) {                 // fit it: one off the carried pile, the old one back
        const k = LO.perks.indexOf(id);
        if (k < 0) return;
        LO.perks.splice(k, 1);
        if (suit[to]) LO.perks.push(suit[to]);
        suit[to] = id;
        SFX.ui('perk');
      } else if (slot >= 0 && to >= 0 && to !== slot) {   // slot to slot: swap
        const a = suit[to]; suit[to] = suit[slot]; suit[slot] = a;
        SFX.fx('place');
      } else if (slot >= 0 && to < 0) {          // off the slots: taken out, carried again
        LO.perks.push(id); suit[slot] = null;
        SFX.fx('place');
      } else return;
      input.current.perksDirty = true;
      refresh();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** @param {string} label @param {any} value @param {string} [cls] */
  const stat = (label, value, cls) => h('div', { className: 'xstat' + (cls ? ' ' + cls : '') }, h('span', null, label), h('b', null, value));
  /** @param {number} m */
  const pct = m => (m >= 1 ? '+' : '−') + Math.round(Math.abs(m - 1) * 100) + '%';
  // the suit's stats, each with what it is now and what the perks add
  /** @type {Record<string, [string, string]>} */
  const SV = {
    hp: [hp + ' / ' + maxHp, maxHp > 100 ? '+' + (maxHp - 100) : ''],
    walk: [String(Math.round(WALK * P.walk)), P.walk !== 1 ? pct(P.walk) : ''],
    fuel: [Math.round(100 * P.fuel) + '%', P.fuel !== 1 ? pct(P.fuel) : ''],
    refuel: [Math.round(100 * FUEL_REGEN * P.refuel) + '%/s', P.refuel !== 1 ? pct(P.refuel) : ''],
    pull: [String(Math.round(COIN_PULL * P.goldPull)), P.goldPull !== 1 ? pct(P.goldPull) : ''],
  };
  /** @param {number} i @param {string} [cls] */
  const slotEl = (i, cls) => {
    const id = suit[i];
    return h('div', { key: i, 'data-xslot': i, className: 'xslot' + (cls ? ' ' + cls : '') + (id ? ' full' : '') +
        (drag && fitsSlot(drag.id, i) ? ' ok' : ''),
        style: id ? { color: PERKS[id].tint, borderColor: PERKS[id].tint } : null,
        onPointerDown: id ? press(id, i, true) : undefined },
      id ? PERKS[id].glyph : '', id && PERKS[id].tier ? h('i', null, ROMAN[PERKS[id].tier - 1]) : null);
  };
  const unlocked = input.current.perkCollection || [];
  return h('div', { className: 'sheet exosuit' },
    h('div', { className: 'shead' },
      h('h2', null, 'Exo Suit'),
      h('span', { className: 'purse' }, LO.gold + 'g'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')),
    h('div', { className: 'xtop' },
      h(Portrait),
      h('div', { className: 'xstats' },
        stat('Gold', fmtGold(LO.gold) + 'g', 'xgold'),
        LO.debt ? stat('Owed', fmtGold(LO.debt) + 'g', 'xdebt') : null,
        h('div', { className: 'xstat xcrys' }, h('span', null, 'Crystals'),
          h('b', null, h(CrystalIcon, { size: 14 }), (LO.crystals || []).length, ' ', h(CrystalIcon, { size: 14, green: true }), (LO.greens || []).length)),
        stat('Floor', input.current.floor || 1),
        P.lives ? stat('Extra lives', Math.max(0, P.lives - (LO.usedLives || 0))) : null)),
    h('div', { className: 'xrows' },
      STAT_KEYS.map((k, j) => h('div', { key: k, className: 'xrow' },
        slotEl(SUIT_SLOTS + j, 'stat'),
        h('span', { className: 'xrl', style: { color: STAT_PERKS[k].tint } }, STAT_PERKS[k].glyph, ' ', STAT_PERKS[k].name),
        h('b', null, SV[k][0]), h('i', null, SV[k][1])))),
    h('p', { className: 'lab' }, 'Perk slots — ' + suit.slice(0, SUIT_SLOTS).filter(Boolean).length + ' of ' + SUIT_SLOTS + ' fitted'),
    h('div', { className: 'xslots' }, suit.slice(0, SUIT_SLOTS).map((_, i) => slotEl(i))),
    h('p', { className: 'lab' }, 'Perks — drag one you carry onto a slot'),
    h('div', { className: 'xgrid scroll' },
      PERK_IDS.map(id => {
        const n = LO.perks.filter(p => p === id).length, pk = PERKS[id];
        const state = n ? 'have' : unlocked.includes(id) ? 'none' : 'locked';
        return h('div', { key: id, 'data-perk': id, className: 'xperk ' + state, title: pk.name,
            style: { color: pk.tint, borderColor: pk.tint }, onPointerDown: press(id, -1, n > 0) },
          pk.glyph,
          pk.tier ? h('em', null, ROMAN[pk.tier - 1]) : null,
          n > 1 ? h('i', null, '×' + n) : null,
          state === 'locked' ? h('u', null, '🔒') : null);
      })),
    msg ? h('div', { className: 'vmsg xmsg' }, msg) : null,
    h('div', { className: 'info' }, canEdit
      ? 'Tap a perk to see what it does. Drag it off a slot to take it out.'
      : 'Locked — the suit can only be changed in the shop, or anywhere with the Tinker perk.'),
    tabs,
    drag ? h('div', { className: 'ghost', style: { left: drag.x, top: drag.y, borderColor: PERKS[drag.id].tint, color: PERKS[drag.id].tint } },
      PERKS[drag.id].glyph) : null,
    info ? h('div', { key: 'card' },
      h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setInfo(''); } }),
      h(PerkCard, { id: info, top: true, onClose: () => setInfo('') })) : null);
}
